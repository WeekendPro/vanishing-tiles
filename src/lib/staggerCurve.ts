import type { DifficultyConfig, PieceType, Rotation } from '@shared/types'

/**
 * Infinite Stagger's own difficulty + scoring curve, expressed as a hand-authored
 * rung table (STAGGER_CURVE) indexed by the 0-based batch index, clamped to the
 * last rung for the endless tail. Difficulty is split across INDEPENDENT levers
 * so exactly one conceptual lever moves per level — shape joins land on
 * batch indices 1, 2, 5, 6, 9; orientation frees at index 8; gap bumps land at
 * 4, 7, 10, 13, …, 28 (see STAGGER_CURVE below) — no two levers ever share a
 * level (see the "moves at most one difficulty lever" test):
 *
 *   1. shape variety — how many distinct piece types may appear (SHAPE_SCHEDULE)
 *   2. orientation    — gaps locked to the tray rotation, then freed (ORIENTATION_FREE_FROM)
 *   3. gap count (N)  — how many gaps to recall (STAGGER_CURVE[i].gaps); a single
 *      gentle ramp with a runway, capped at MAX_GAPS
 *
 * A fourth, orthogonal lever runs on wall-clock time rather than per-level: the
 * select clock slowly tightens as the run goes on (selectDurationForBatch), so
 * the endless tail keeps getting tenser even after the gap count caps out.
 *
 * Every gap reveals as its own SOLO beat — there is no chunking or back-loaded
 * reveal variant; recall load is driven purely by gap count and shape variety.
 */
export const STAGGER = {
  MAX_GAPS: 12,        // cap so the 12×12 board stays solvable
  // Reveal timing is CONSTANT for every batch — we deliberately do NOT speed the
  // reveal/decay up as the run escalates (complexity comes from other levers).
  // Each piece: flash all cells at once → hold bright → decay to nothing in a
  // per-cell wave. The bloom keyframe (vtBloom) encodes the flash/hold/decay
  // split; these drive the JS pacing and the wave spread.
  REVEAL_BLOOM_MS: 1082, // flash + HOLD bright time for one piece (the "visible" phase, before it starts decaying)
  REVEAL_DECAY_MS: 998,  // decay-to-void time for one piece, independent of the hold above
  REVEAL_STEP_MS: 1120,  // time between consecutive piece flashes (overlapping: next flashes as prev starts to decay)
  REVEAL_WAVE_MS: 220,   // per-cell DECAY wave spread (only the decay tail stretches per cell, so cells end at staggered times)
  SELECT_BASE: 6000,   // ms base select clock
  SELECT_PER_GAP: 1400,// ms of select clock added per gap
  SELECT_TIGHTEN_PER_BATCH: 0.005, // select clock loses 0.5% per level…
  SELECT_MIN_FACTOR: 0.7,          // …until it bottoms out at 70% (batch 60+)
  ACCURACY_PER_GAP: 100, // points banked per correctly recalled gap
  SPEED_MAX: 500,      // max per-batch speed bonus
  // Per-batch "clean clear" rewards, banked at clear like the speed bonus. Flat
  // per-gap (they do NOT compound with the streak), so they scale with batch size
  // without ballooning the economy. FLAWLESS = cleared with no life lost (all
  // modes); IN ORDER = flawless AND recalled in reveal order (Easy/Medium only,
  // since Hard enforces order anyway). IN ORDER implies FLAWLESS, so they stack.
  FLAWLESS_PER_GAP: 150,
  IN_ORDER_PER_GAP: 250,
  START_LIVES: 5,      // shared lives for the whole run
  LIFE_EVERY: 10000,   // every N cumulative points earns one life back
  REPLAY_COST: 500,    // points spent to replay the memorize sequence mid-batch
} as const

/** The rotation each piece is drawn at in the tray — and the rotation its gaps
 *  use while orientation is still locked. I / J / L stand upright (rotation 1)
 *  as in proper Tetris; the rest sit at their canonical rotation. */
export const DISPLAY_ROTATION: Record<PieceType, Rotation> = {
  I: 1, J: 1, L: 1, O: 0, S: 0, Z: 0, T: 0,
}

/** Shapes are introduced gradually. The run opens on O + I only; the trickier
 *  shapes join one at a time so memory load ramps slowly. (`from` = batch index
 *  at which the shape becomes available.)
 *
 *  Variety is the PRIMARY early lever: gaps are held at 3 through the runway
 *  (see gapCountForBatch), so levels 1–4 grow harder only by widening the
 *  shape pool rather than by adding board volume. New shapes are spaced onto
 *  batch indices 1, 2, 5, 6, 9 — all held-gap levels (STAGGER_CURVE holds gaps
 *  flat across each of those spans) — so no shape join ever lands on the same
 *  level as a gap-count bump or the orientation unlock (idx 8). Z (the last
 *  shape) arrives AFTER orientation frees up (idx 9 > idx 8), so the hardest
 *  piece doesn't debut rotated. All 7 shapes are in by L10. */
const SHAPE_SCHEDULE: { from: number; type: PieceType }[] = [
  { from: 0, type: 'O' },
  { from: 0, type: 'I' },
  { from: 1, type: 'L' },  // L2
  { from: 2, type: 'J' },  // L3
  { from: 5, type: 'T' },  // L6
  { from: 6, type: 'S' },  // L7
  { from: 9, type: 'Z' },  // L10 — last shape, the level after orientation frees
]

/** From this batch on, gaps may appear in any rotation; before it, every gap is
 *  locked to its tray orientation so the player maps shapes 1:1 with the cart.
 *  Orientation freedom is the single most disorienting lever (it multiplies the
 *  effective shape vocabulary), so it lands ALONE on L9 (idx 8) — no shape joins
 *  at L9 itself (Z, the last shape, arrives the following level, L10), so
 *  nothing else moves the level orientation unlocks. */
export const ORIENTATION_FREE_FROM = 8

/** The piece types that may appear as gaps in a given batch. */
export function allowedTypesForBatch(batchIndex: number): PieceType[] {
  return SHAPE_SCHEDULE.filter(s => batchIndex >= s.from).map(s => s.type)
}

/** While orientation is locked, the fixed rotation each type's gaps must use;
 *  `undefined` once rotations are free (the generator then varies them). */
export function lockedRotationsForBatch(batchIndex: number): Record<PieceType, Rotation> | undefined {
  return batchIndex < ORIENTATION_FREE_FROM ? DISPLAY_ROTATION : undefined
}

/** The difficulty rungs (one per level), indexed by batch index and clamped to
 *  the last rung for the endless tail. `gaps` is the recall load (N) — the only
 *  lever this table carries; shape variety and orientation are driven separately
 *  (SHAPE_SCHEDULE, ORIENTATION_FREE_FROM). A single gentle ramp with runway:
 *  hold at 3 for four levels, then climb one gap every three levels to the cap.
 *  Longevity now comes from the select clock slowly tightening over time
 *  (see selectDurationForBatch) rather than from a steeper gap-count curve.
 *
 *    L1–4   N3   runway: held flat while shape variety grows (+L, +J)
 *    L5–7   N4   held flat while T (L6) and S (L7) join
 *    L8–10  N5   held flat while orientation unlocks (L9), last shape (Z) joins (L10)
 *    L11–13 N6
 *    L14–16 N7
 *    L17–19 N8
 *    L20–22 N9
 *    L23–25 N10
 *    L26–28 N11
 *    L29+   N12  terminal rung: held at the cap for the endless tail */
interface StaggerRung { gaps: number }
const STAGGER_CURVE: StaggerRung[] = [
  { gaps: 3 }, { gaps: 3 }, { gaps: 3 }, { gaps: 3 },   // L1–4 on-ramp
  { gaps: 4 }, { gaps: 4 }, { gaps: 4 },                 // L5–7 (T joins L6, S joins L7)
  { gaps: 5 }, { gaps: 5 }, { gaps: 5 },                 // L8–10 (orientation unlocks L9, Z joins L10)
  { gaps: 6 }, { gaps: 6 }, { gaps: 6 },                 // L11–13
  { gaps: 7 }, { gaps: 7 }, { gaps: 7 },                 // L14–16
  { gaps: 8 }, { gaps: 8 }, { gaps: 8 },                 // L17–19
  { gaps: 9 }, { gaps: 9 }, { gaps: 9 },                 // L20–22
  { gaps: 10 }, { gaps: 10 }, { gaps: 10 },              // L23–25
  { gaps: 11 }, { gaps: 11 }, { gaps: 11 },              // L26–28
  { gaps: 12 },                                          // L29+ terminal; only time keeps tightening
]

function rung(batchIndex: number): StaggerRung {
  return STAGGER_CURVE[Math.min(Math.max(batchIndex, 0), STAGGER_CURVE.length - 1)]
}

/** Gap count (memory volume / recall load) for a batch, capped at MAX_GAPS. */
export function gapCountForBatch(batchIndex: number): number {
  return Math.min(STAGGER.MAX_GAPS, rung(batchIndex).gaps)
}

// Fisher–Yates shuffle of `a` IN PLACE, driven by `rng`. Returns `a`.
function shuffleInPlace<T>(a: T[], rng: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** The reveal ORDER for a batch's gaps: every gap reveals as its own solo beat, in
 *  a shuffled sequence — a Fisher–Yates shuffle of `[0..count)`. This is also the
 *  presentation order a later Hard-mode variant enforces the player must recall in. */
export function revealOrderForGaps(count: number, rng: () => number = Math.random): number[] {
  return shuffleInPlace(Array.from({ length: count }, (_, i) => i), rng)
}

/** Time between consecutive piece flashes during reveal — CONSTANT for every
 *  batch. (We no longer shorten reveal/decay as the run escalates.) */
export function revealStepMs(): number {
  return STAGGER.REVEAL_STEP_MS
}

/** Total reveal (memorize) time for a batch. Beats overlap, so it's the last
 *  beat's flash plus one full bloom — grows only with the gap count, never by
 *  speeding individual pieces up. */
export function batchRevealMs(batchIndex: number): number {
  return (gapCountForBatch(batchIndex) - 1) * STAGGER.REVEAL_STEP_MS + STAGGER.REVEAL_BLOOM_MS
}

/** Select clock grows with the gap count so picking is never the bottleneck,
 *  then slowly tightens over the length of the run — losing
 *  SELECT_TIGHTEN_PER_BATCH per batch, floored at SELECT_MIN_FACTOR — so late-run
 *  levels stay tense even after the gap count caps out. */
export function selectDurationForBatch(batchIndex: number): number {
  const factor = Math.max(
    STAGGER.SELECT_MIN_FACTOR,
    1 - batchIndex * STAGGER.SELECT_TIGHTEN_PER_BATCH,
  )
  return Math.round((STAGGER.SELECT_BASE + gapCountForBatch(batchIndex) * STAGGER.SELECT_PER_GAP) * factor)
}

/** Mirrors The Classic's complexity bands (simple ≤5 / medium ≤8 / complex). */
export function complexityForGapCount(gapCount: number): DifficultyConfig['complexity'] {
  if (gapCount <= 5) return 'simple'
  if (gapCount <= 8) return 'medium'
  return 'complex'
}

/** Build the DifficultyConfig the puzzle generator expects for a given batch.
 *  view/place durations are unused by Stagger (reveal is its own sequence). */
export function difficultyForBatch(batchIndex: number): DifficultyConfig {
  const gapCount = gapCountForBatch(batchIndex)
  return {
    gapCount,
    complexity: complexityForGapCount(gapCount),
    viewDuration: 0,
    selectDuration: selectDurationForBatch(batchIndex),
    placeDuration: 0,
  }
}

/** The select clock's URGENCY window. When remaining/duration drops below
 *  FRACTION the timer bar flips red (StaggerScreen's `barLow`) AND the urgency
 *  ticker starts — one shared threshold, so ear and eye heat up on the same
 *  beat. Inside the window the tick repeats on an interval that shrinks from
 *  TICK_MAX_MS (right at the threshold) to TICK_MIN_MS (at expiry) — an
 *  accelerating clock. The tick's SOUND is the `urgentTick` patch in sfx.ts
 *  (tweakable in the Sound Design lab); these constants shape only WHEN it
 *  fires. */
export const CLOCK_URGENT = {
  FRACTION: 0.25,   // urgency begins when remaining/duration falls below this
  TICK_MAX_MS: 560, // tick interval at the threshold…
  TICK_MIN_MS: 200, // …tightening to this as the clock hits zero
} as const

/** How deep into the urgency window the clock is: 0 at the threshold, 1 at
 *  expiry (clamped). `fractionLeft` = remaining/duration. */
export function urgentHeat(fractionLeft: number): number {
  return Math.min(1, Math.max(0, 1 - fractionLeft / CLOCK_URGENT.FRACTION))
}

/** Interval to the next urgency tick — linear from TICK_MAX_MS down to
 *  TICK_MIN_MS as heat runs 0 → 1 (the accelerando). */
export function urgentTickIntervalMs(heat: number): number {
  const h = Math.min(1, Math.max(0, heat))
  return Math.round(CLOCK_URGENT.TICK_MAX_MS - (CLOCK_URGENT.TICK_MAX_MS - CLOCK_URGENT.TICK_MIN_MS) * h)
}

/** Per-batch speed bonus = SPEED_MAX × fraction of the select clock left when the
 *  final gap was filled (the same ratio-based model the rest of the game uses). */
export function batchSpeedBonus(remainingMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0
  const ratio = Math.max(0, Math.min(1, remainingMs / durationMs))
  return Math.round(STAGGER.SPEED_MAX * ratio)
}
