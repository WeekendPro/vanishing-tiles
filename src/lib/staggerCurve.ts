import type { DifficultyConfig, PieceType, Rotation } from '@shared/types'

/**
 * Infinite Stagger's own difficulty + scoring curve, expressed as a hand-authored
 * rung table (STAGGER_CURVE) indexed by the 0-based batch index, clamped to the
 * last rung for the endless tail. Difficulty is split across four INDEPENDENT
 * levers so only ONE ever moves per level (no stacked spikes):
 *
 *   1. shape variety   — how many distinct piece types may appear (SHAPE_SCHEDULE)
 *   2. orientation      — gaps locked to the tray rotation, then freed (ORIENTATION_FREE_FROM)
 *   3. gap count (N)    — how many gaps to recall (STAGGER_CURVE[i].gaps)
 *   4. pairing (P)      — how many gaps are revealed TWO-at-a-once in a single
 *                         flash beat instead of one (STAGGER_CURVE[i].pairs)
 *
 * Pairing is a DENSITY lever, not a volume one: a board of N gaps with P pairs
 * plays in N − P flash beats (fewer, denser beats), so recall load can climb
 * while the reveal rhythm stays low. Each pair is always two DISTINCT shapes.
 */
export const STAGGER = {
  MAX_GAPS: 12,        // cap so the 12×12 board stays solvable
  // Reveal timing is CONSTANT for every batch — we deliberately do NOT speed the
  // reveal/decay up as the run escalates (complexity comes from other levers).
  // Each piece: flash all cells at once → hold bright → decay to nothing in a
  // per-cell wave. The bloom keyframe (vtBloom) encodes the flash/hold/decay
  // split; these drive the JS pacing and the wave spread.
  REVEAL_BLOOM_MS: 2080, // total visible time for one piece (flash + ~1s hold + ~1s decay)
  REVEAL_STEP_MS: 1120,  // time between consecutive piece flashes (overlapping: next flashes as prev starts to decay)
  REVEAL_WAVE_MS: 220,   // per-cell decay wave spread (cells end at staggered times)
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
 *  AFTER orientation frees up, so the hardest pieces don't debut rotated. */
const SHAPE_SCHEDULE: { from: number; type: PieceType }[] = [
  { from: 0,  type: 'O' },
  { from: 0,  type: 'I' },
  { from: 2,  type: 'L' },  // L3
  { from: 4,  type: 'J' },  // L5
  { from: 7,  type: 'T' },  // L8
  { from: 9,  type: 'S' },  // L10
  { from: 11, type: 'Z' },  // L12 — last shape, the level after orientation frees
]

/** From this batch on, gaps may appear in any rotation; before it, every gap is
 *  locked to its tray orientation so the player maps shapes 1:1 with the cart.
 *  Orientation freedom is the single most disorienting lever (it multiplies the
 *  effective shape vocabulary), so it's pushed out to L11 (idx 10) and lands
 *  ALONE — the gap count is deliberately held at 5 across L9–11 so nothing else
 *  moves the level it unlocks. */
export const ORIENTATION_FREE_FROM = 10

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
 *  the last rung for the endless tail. `gaps` is the recall load (N); `pairs` is
 *  how many of those gaps reveal two-at-a-once (P). The back half is irregular by
 *  DESIGN — the gap and pair levers alternate so exactly one moves per level, and
 *  a pair always needs two gaps (2·P ≤ N) — so it's a table, not a formula.
 *
 *    L1–6   N3            on-ramp: held flat, variety is the only lever
 *    L7–8   N4            +gap, then +shape (T)
 *    L9–12  N5            +gap, +shape (S), orientation unlock, +shape (Z) — N held
 *    L13–14 N5  P1→P2     pairing switches on with NO extra recall load (density only)
 *    L15–16 N6  P2→P3     L16 is fully paired: 3 pairs, 0 singles, 3 beats
 *    L17–24 N7→12 P3→P5   gap and pair levers alternate up to the cap
 *    L25+   N12 P6        the 12-gap board fully paired into 6 dense beats */
interface StaggerRung { gaps: number; pairs: number }
const STAGGER_CURVE: StaggerRung[] = [
  { gaps: 3,  pairs: 0 }, // L1
  { gaps: 3,  pairs: 0 }, // L2
  { gaps: 3,  pairs: 0 }, // L3
  { gaps: 3,  pairs: 0 }, // L4
  { gaps: 3,  pairs: 0 }, // L5
  { gaps: 3,  pairs: 0 }, // L6
  { gaps: 4,  pairs: 0 }, // L7
  { gaps: 4,  pairs: 0 }, // L8
  { gaps: 5,  pairs: 0 }, // L9
  { gaps: 5,  pairs: 0 }, // L10
  { gaps: 5,  pairs: 0 }, // L11
  { gaps: 5,  pairs: 0 }, // L12
  { gaps: 5,  pairs: 1 }, // L13 — first pair (recall load unchanged)
  { gaps: 5,  pairs: 2 }, // L14
  { gaps: 6,  pairs: 2 }, // L15
  { gaps: 6,  pairs: 3 }, // L16 — fully paired: 3 pairs / 3 beats
  { gaps: 7,  pairs: 3 }, // L17
  { gaps: 8,  pairs: 3 }, // L18
  { gaps: 8,  pairs: 4 }, // L19
  { gaps: 9,  pairs: 4 }, // L20
  { gaps: 10, pairs: 4 }, // L21
  { gaps: 10, pairs: 5 }, // L22
  { gaps: 11, pairs: 5 }, // L23
  { gaps: 12, pairs: 5 }, // L24
  { gaps: 12, pairs: 6 }, // L25 — 12 gaps in 6 dense beats (terminal rung)
]

function rung(batchIndex: number): StaggerRung {
  return STAGGER_CURVE[Math.min(Math.max(batchIndex, 0), STAGGER_CURVE.length - 1)]
}

/** Gap count (memory volume / recall load) for a batch, capped at MAX_GAPS. */
export function gapCountForBatch(batchIndex: number): number {
  return Math.min(STAGGER.MAX_GAPS, rung(batchIndex).gaps)
}

/** How many of the batch's gaps are revealed as PAIRS (two distinct shapes on a
 *  single flash beat). Clamped to ⌊N/2⌋ so we never ask for more pairs than the
 *  gap count can supply. */
export function pairsForBatch(batchIndex: number): number {
  return Math.min(rung(batchIndex).pairs, Math.floor(gapCountForBatch(batchIndex) / 2))
}

/** Number of flash BEATS in a batch's reveal: each pair collapses two gaps into
 *  one beat, so beats = N − P. This (not the gap count) sets the reveal rhythm. */
export function flashEventsForBatch(batchIndex: number): number {
  return gapCountForBatch(batchIndex) - pairsForBatch(batchIndex)
}

// Fisher–Yates shuffle of `a` IN PLACE, driven by `rng`. Returns `a`.
function shuffleInPlace<T>(a: T[], rng: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Group a batch's gaps into reveal BEATS. `pairCount` beats bloom two gaps of
 *  DISTINCT shapes at once; the rest bloom one. Returns beats as arrays of gap
 *  indices (length 1 or 2) in shuffled order. Greedy distinct-shape pairing —
 *  when the drawn shapes can't supply `pairCount` distinct pairs it returns as
 *  many as it can (makeBatch re-rolls the board to hit the target). */
export function buildRevealPlan(
  types: PieceType[],
  pairCount: number,
  rng: () => number = Math.random,
): number[][] {
  const order = shuffleInPlace(types.map((_, i) => i), rng)
  const used = new Set<number>()
  const pairs: number[][] = []
  for (const i of order) {
    if (pairs.length >= pairCount) break
    if (used.has(i)) continue
    // Pair `i` with the first unused gap of a DIFFERENT shape (no (I,I) pairs).
    const j = order.find(k => k !== i && !used.has(k) && types[k] !== types[i])
    if (j === undefined) continue
    used.add(i); used.add(j)
    pairs.push([i, j])
  }
  const singles = order.filter(i => !used.has(i)).map(i => [i])
  // Mix pairs and singles so a pair beat isn't always first.
  return shuffleInPlace([...pairs, ...singles], rng)
}

/** Time between consecutive piece flashes during reveal — CONSTANT for every
 *  batch. (We no longer shorten reveal/decay as the run escalates.) */
export function revealStepMs(): number {
  return STAGGER.REVEAL_STEP_MS
}

/** Total reveal (memorize) time for a batch. Beats overlap, so it's the last
 *  beat's flash plus one full bloom — grows only with the number of flash BEATS
 *  (N − P), never by speeding individual pieces up. Pairing therefore SHORTENS
 *  the reveal even as recall load climbs (two gaps share one beat). */
export function batchRevealMs(batchIndex: number): number {
  return (flashEventsForBatch(batchIndex) - 1) * STAGGER.REVEAL_STEP_MS + STAGGER.REVEAL_BLOOM_MS
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
