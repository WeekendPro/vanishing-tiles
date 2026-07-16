import type { DifficultyConfig, PieceType, Rotation } from '@shared/types'

/**
 * Infinite Stagger's own difficulty + scoring curve, expressed as a hand-authored
 * rung table (STAGGER_CURVE) indexed by the 0-based batch index, clamped to the
 * last rung for the endless tail. Difficulty is split across INDEPENDENT levers so
 * only ONE conceptual lever ever moves per level (no stacked spikes):
 *
 *   1. shape variety — how many distinct piece types may appear (SHAPE_SCHEDULE)
 *   2. orientation    — gaps locked to the tray rotation, then freed (ORIENTATION_FREE_FROM)
 *   3. gap count (N)  — how many gaps to recall (STAGGER_CURVE[i].gaps)
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
  ACCURACY_PER_GAP: 100, // points banked per correctly recalled gap
  SPEED_MAX: 500,      // max per-batch speed bonus
  START_LIVES: 5,      // shared lives for the whole run
  LIFE_EVERY: 5000,    // every N cumulative points earns one life back
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
 *  Variety is the PRIMARY early lever: gaps are held at 3 through the whole
 *  on-ramp (see gapCountForBatch), so levels 1–6 grow harder only by widening
 *  the shape pool (2 → 4) rather than by adding board volume. New shapes are
 *  spaced so they never land on the same level as a gap-count bump or the
 *  orientation unlock — one lever moves at a time. Z (the last shape) arrives
 *  AFTER orientation frees up (idx 8 > idx 7), so the hardest pieces don't debut
 *  rotated. The on-ramp is short (only L1–3 hold 3 gaps), so all 7 shapes are in
 *  by L9, the level before pairing begins. */
const SHAPE_SCHEDULE: { from: number; type: PieceType }[] = [
  { from: 0, type: 'O' },
  { from: 0, type: 'I' },
  { from: 1, type: 'L' },  // L2
  { from: 2, type: 'J' },  // L3
  { from: 4, type: 'T' },  // L5
  { from: 6, type: 'S' },  // L7
  { from: 8, type: 'Z' },  // L9 — last shape, the level after orientation frees
]

/** From this batch on, gaps may appear in any rotation; before it, every gap is
 *  locked to its tray orientation so the player maps shapes 1:1 with the cart.
 *  Orientation freedom is the single most disorienting lever (it multiplies the
 *  effective shape vocabulary), so it lands ALONE on L8 (idx 7) — the gap count
 *  is held at 5 across L6–9 so nothing else moves the level it unlocks. */
export const ORIENTATION_FREE_FROM = 7

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
 *  (SHAPE_SCHEDULE, ORIENTATION_FREE_FROM) so they never move on the same level
 *  as a gap-count bump.
 *
 *    L1–3   N3    on-ramp: held flat while variety grows (+L, +J)
 *    L4–5   N4    +gap, then +shape (T)
 *    L6–9   N5    +gap, +shape (S), orientation unlock, +shape (Z) — N held
 *    L10–13 N5→6  gap lever resumes once all 7 shapes and free orientation are in
 *    L14–20 N7→11 steady climb toward the cap
 *    L21+   N12   terminal rung: held at the cap for the endless tail */
interface StaggerRung { gaps: number }
const STAGGER_CURVE: StaggerRung[] = [
  { gaps: 3 },  // L1
  { gaps: 3 },  // L2
  { gaps: 3 },  // L3 — last on-ramp level (on-ramp halved to 3 levels)
  { gaps: 4 },  // L4
  { gaps: 4 },  // L5
  { gaps: 5 },  // L6
  { gaps: 5 },  // L7
  { gaps: 5 },  // L8 — orientation unlocks here
  { gaps: 5 },  // L9 — last shape (Z) joins; all 7 in
  { gaps: 5 },  // L10
  { gaps: 5 },  // L11
  { gaps: 6 },  // L12
  { gaps: 6 },  // L13
  { gaps: 7 },  // L14
  { gaps: 8 },  // L15
  { gaps: 8 },  // L16
  { gaps: 9 },  // L17
  { gaps: 10 }, // L18
  { gaps: 10 }, // L19
  { gaps: 11 }, // L20
  { gaps: 12 }, // L21
  { gaps: 12 }, // L22
  { gaps: 12 }, // L23
  { gaps: 12 }, // L24
  { gaps: 12 }, // L25
  { gaps: 12 }, // L26
  { gaps: 12 }, // L27
  { gaps: 12 }, // L28
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

/** Select clock grows with the gap count so picking is never the bottleneck. */
export function selectDurationForBatch(batchIndex: number): number {
  return STAGGER.SELECT_BASE + gapCountForBatch(batchIndex) * STAGGER.SELECT_PER_GAP
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

/** Per-batch speed bonus = SPEED_MAX × fraction of the select clock left when the
 *  final gap was filled (the same ratio-based model the rest of the game uses). */
export function batchSpeedBonus(remainingMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0
  const ratio = Math.max(0, Math.min(1, remainingMs / durationMs))
  return Math.round(STAGGER.SPEED_MAX * ratio)
}
