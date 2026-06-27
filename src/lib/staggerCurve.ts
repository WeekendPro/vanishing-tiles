import type { DifficultyConfig, PieceType, Rotation } from '@shared/types'

/**
 * Infinite Stagger's own difficulty + scoring curve, expressed as a hand-authored
 * rung table (STAGGER_CURVE) indexed by the 0-based batch index, clamped to the
 * last rung for the endless tail. Difficulty is split across INDEPENDENT levers so
 * only ONE conceptual lever ever moves per level (no stacked spikes):
 *
 *   1. shape variety   — how many distinct piece types may appear (SHAPE_SCHEDULE)
 *   2. orientation      — gaps locked to the tray rotation, then freed (ORIENTATION_FREE_FROM)
 *   3. gap count (N)    — how many gaps to recall (STAGGER_CURVE[i].gaps)
 *   4. density (P / Tr) — how many gaps share a single flash beat: a PAIR collapses
 *                         two gaps into one beat (saves 1 beat), a TRIPLE collapses
 *                         three (saves 2). Pairs and triples together form the one
 *                         "density" lever — the late curve trades pairs for triples,
 *                         monotonically shrinking the beat count (denser chunks).
 *   5. inverted (Inv)   — how many gaps reveal with the back-loaded INVERTED build
 *                         (seed → flow-in build → bright COMPLETE → magenta poof; see
 *                         InvertedReveal in StaggerScreen). Inverted gaps always take
 *                         a SOLO beat (never paired/tripled); they switch on after the
 *                         triples section (INVERTED_FROM), growing one per level.
 *
 * Density is a chunking lever, not a volume one: a board of N gaps with P pairs and
 * Tr triples plays in N − P − 2·Tr flash beats (fewer, denser beats), so recall load
 * can climb while the reveal rhythm stays low. A pair is always two DISTINCT shapes;
 * a triple is at least two distinct shapes (never all-identical).
 *
 * Feasibility: chunks only draw from the NON-inverted gaps, so 2·P + 3·Tr ≤ N − Inv
 * on every rung. The rung table is authored to respect this, and triplesForBatch /
 * pairsForBatch clamp defensively (triples first, then pairs against what's left).
 *
 * Curve shape (gaps N, pairs P, triples Tr, inverted Inv):
 *    L1–3   N3                       on-ramp: only 3 levels held at 3 gaps (variety
 *                                    grows via +L, +J while the gap count holds)
 *    L4–5   N4                       +gap, then +shape (T)
 *    L6–9   N5                       +gap, +shape (S), orientation unlock, +shape (Z)
 *    L10–11 N5  P1→P2                pairing switches on with NO extra recall load
 *    L12–13 N6  P2→P3                L13 is fully paired: 3 pairs, 3 beats
 *    L14–22 N7→12 P3→P6              gap and pair levers alternate up to the cap;
 *                                    L22 is the LAST Doubles round (12 gaps, 6 pairs)
 *    L23–26 N12 Tr1→Tr4             Triples switch on — a GENTLE intro (L23 = 1 triple
 *                                    + 2 pairs + singles), ramping to fully tripled at
 *                                    L26 (4 triples, 4 beats)
 *    L27–28 N12 Inv1→Inv2           inverted gaps switch on (1 then 2 per batch); a
 *                                    triple eases back so the inverted solo beats fit
 *    L29+   N12 Tr3 Inv2            terminal rung: 3 triples + 2 inverted solos (6 beats)
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
  REVEAL_TWIN_OFFSET_MS: 70, // intra-beat onset offset between the gaps sharing ONE beat (a pair/triple):
                             // 0 = perfectly simultaneous; a small offset reads as one coupled "da-dum" pulse
  SELECT_BASE: 6000,   // ms base select clock
  SELECT_PER_GAP: 1400,// ms of select clock added per gap
  ACCURACY_PER_GAP: 100, // points banked per correctly recalled gap
  SPEED_MAX: 500,      // max per-batch speed bonus
  START_LIVES: 5,      // shared lives for the whole run
  LIFE_EVERY: 5000,    // every N cumulative points earns one life back
  REPLAY_COST: 500,    // points spent to replay the memorize sequence mid-batch
  // ── Inverted Reveal sub-timeline (constant per batch, like the standard bloom).
  // A beat whose gap is `inverted` plays: seed ember → smooth overlapping flow-in
  // build → full-bright magenta COMPLETE (the memory payload) → magenta CONTRACT
  // poof (no white flash). The build STEP (start-to-start) is much shorter than the
  // per-cell flow ease (~640ms in CSS) so the ramps overlap into one growth.
  INV_SEED_MS: 600,       // seed ember hold before the build starts
  INV_BUILD_STEP_MS: 230, // start-to-start gap between build cells (overlapping ease)
  INV_EQUALIZE_MS: 580,   // after the last cell starts: seed equalizes, shape settles dim
  INV_COMPLETE_HOLD_MS: 520, // full-bright payload hold
  INV_POOF_MS: 320,       // magenta contract poof
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
 *  the last rung for the endless tail. `gaps` is the recall load (N); `pairs` /
 *  `triples` are how many of those gaps reveal two- / three-at-a-once (P / Tr). The
 *  back half is irregular by DESIGN — the gap and density levers alternate so
 *  exactly one conceptual lever moves per level, and the chunked gaps must fit
 *  (2·P + 3·Tr ≤ N − Inv) — so it's a table, not a formula.
 *
 *    L1–6   N3                on-ramp: held flat, variety is the only lever
 *    L7–8   N4                +gap, then +shape (T)
 *    L9–12  N5                +gap, +shape (S), orientation unlock, +shape (Z) — N held
 *    L13–14 N5  P1→P2         pairing switches on with NO extra recall load (density only)
 *    L15–16 N6  P2→P3         L16 is fully paired: 3 pairs, 0 singles, 3 beats
 *    L17–25 N7→12 P3→P6       gap and pair levers alternate up to the cap
 *    L26–29 N12 Tr1→Tr4      triples switch on, trading pairs one at a time
 *                             (L29 fully tripled: 4 triples, 0 pairs, 4 beats)
 *    L30–31 N12 Inv1→Inv2    inverted gaps switch on (see INVERTED_FROM); a triple
 *                             eases back so the inverted SOLO beats fit
 *    L32+   N12 Tr3 Inv2     terminal rung: 3 triples + 2 inverted solos (6 beats) */
interface StaggerRung { gaps: number; pairs: number; triples: number }
const STAGGER_CURVE: StaggerRung[] = [
  { gaps: 3,  pairs: 0, triples: 0 }, // L1
  { gaps: 3,  pairs: 0, triples: 0 }, // L2
  { gaps: 3,  pairs: 0, triples: 0 }, // L3 — last 3-beat level (on-ramp halved to 3 levels)
  { gaps: 4,  pairs: 0, triples: 0 }, // L4
  { gaps: 4,  pairs: 0, triples: 0 }, // L5
  { gaps: 5,  pairs: 0, triples: 0 }, // L6
  { gaps: 5,  pairs: 0, triples: 0 }, // L7
  { gaps: 5,  pairs: 0, triples: 0 }, // L8 — orientation unlocks here
  { gaps: 5,  pairs: 0, triples: 0 }, // L9 — last shape (Z) joins; all 7 in
  { gaps: 5,  pairs: 1, triples: 0 }, // L10 — first pair (Doubles begin, recall load unchanged)
  { gaps: 5,  pairs: 2, triples: 0 }, // L11
  { gaps: 6,  pairs: 2, triples: 0 }, // L12
  { gaps: 6,  pairs: 3, triples: 0 }, // L13 — fully paired at 6 gaps: 3 pairs / 3 beats
  { gaps: 7,  pairs: 3, triples: 0 }, // L14
  { gaps: 8,  pairs: 3, triples: 0 }, // L15
  { gaps: 8,  pairs: 4, triples: 0 }, // L16
  { gaps: 9,  pairs: 4, triples: 0 }, // L17
  { gaps: 10, pairs: 4, triples: 0 }, // L18
  { gaps: 10, pairs: 5, triples: 0 }, // L19
  { gaps: 11, pairs: 5, triples: 0 }, // L20
  { gaps: 12, pairs: 5, triples: 0 }, // L21
  { gaps: 12, pairs: 6, triples: 0 }, // L22 — last Doubles round: 12 gaps fully paired (6 beats)
  { gaps: 12, pairs: 2, triples: 1 }, // L23 — Triples begin, gentle: 1 triple + 2 pairs (+5 singles)
  { gaps: 12, pairs: 2, triples: 2 }, // L24 — 2 triples + 2 pairs
  { gaps: 12, pairs: 0, triples: 3 }, // L25 — 3 triples
  { gaps: 12, pairs: 0, triples: 4 }, // L26 — fully tripled: 4 triples / 4 beats
  { gaps: 12, pairs: 0, triples: 3 }, // L27 — Inv1: a triple eases for the inverted solo
  { gaps: 12, pairs: 0, triples: 3 }, // L28 — Inv2: 3 triples + 2 inverted solos (terminal)
]

function rung(batchIndex: number): StaggerRung {
  return STAGGER_CURVE[Math.min(Math.max(batchIndex, 0), STAGGER_CURVE.length - 1)]
}

/** From this batch on, a growing number of gaps reveal with the INVERTED build
 *  (InvertedReveal). It lands AFTER the triples section so it's the only lever
 *  moving on the level it switches on (one-lever-per-level discipline). Each
 *  inverted gap takes a SOLO beat, so the density chunks below clamp against the
 *  NON-inverted gaps only. */
export const INVERTED_FROM = 26
const INVERTED_MAX = 2

/** Gap count (memory volume / recall load) for a batch, capped at MAX_GAPS. */
export function gapCountForBatch(batchIndex: number): number {
  return Math.min(STAGGER.MAX_GAPS, rung(batchIndex).gaps)
}

/** How many of the batch's gaps reveal with the INVERTED build, growing one per
 *  level from INVERTED_FROM and capped (and never more than the gap count). */
export function invertedForBatch(batchIndex: number): number {
  if (batchIndex < INVERTED_FROM) return 0
  const want = Math.min(INVERTED_MAX, batchIndex - INVERTED_FROM + 1)
  return Math.min(want, gapCountForBatch(batchIndex))
}

/** Gaps available for density chunking — every gap MINUS the inverted ones (which
 *  always reveal as solo beats and are never paired/tripled). */
function chunkableForBatch(batchIndex: number): number {
  return gapCountForBatch(batchIndex) - invertedForBatch(batchIndex)
}

/** How many of the batch's gaps are revealed as TRIPLES (three gaps — at least two
 *  distinct shapes — on a single flash beat). Clamped so 3·Tr ≤ chunkable gaps. */
export function triplesForBatch(batchIndex: number): number {
  return Math.max(0, Math.min(rung(batchIndex).triples, Math.floor(chunkableForBatch(batchIndex) / 3)))
}

/** How many of the batch's gaps are revealed as PAIRS (two distinct shapes on a
 *  single flash beat). Clamped to the chunkable gaps LEFT after triples, so we
 *  never ask for more pairs than the board can supply (2·P + 3·Tr ≤ N − Inv). */
export function pairsForBatch(batchIndex: number): number {
  const left = chunkableForBatch(batchIndex) - 3 * triplesForBatch(batchIndex)
  return Math.max(0, Math.min(rung(batchIndex).pairs, Math.floor(left / 2)))
}

/** Number of flash BEATS in a batch's reveal: a pair collapses two gaps into one
 *  beat (−1), a triple collapses three (−2), so beats = N − P − 2·Tr. This (not the
 *  gap count) sets the reveal rhythm. Inverted gaps stay solo, so they're already
 *  counted as their own beats here (they're excluded from P and Tr). */
export function flashEventsForBatch(batchIndex: number): number {
  return gapCountForBatch(batchIndex) - pairsForBatch(batchIndex) - 2 * triplesForBatch(batchIndex)
}

// Fisher–Yates shuffle of `a` IN PLACE, driven by `rng`. Returns `a`.
function shuffleInPlace<T>(a: T[], rng: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Group a batch's gaps into reveal BEATS. `tripleCount` beats bloom THREE gaps at
 *  once (at least two distinct shapes — never all-identical); `pairCount` beats
 *  bloom TWO gaps of DISTINCT shapes; the rest bloom one. `inverted[i]` gaps always
 *  fall through to a SOLO beat (never paired/tripled). Returns beats as arrays of
 *  gap indices (length 1, 2, or 3) in shuffled order.
 *
 *  Triples are formed first (they're the scarcer constraint), then pairs, then the
 *  leftover singles. Greedy — when the drawn shapes can't supply the requested
 *  distinct chunks it returns as many as it can (makeBatch re-rolls to hit the
 *  target). */
export function buildRevealPlan(
  types: PieceType[],
  pairCount: number,
  tripleCount = 0,
  inverted: boolean[] = [],
  rng: () => number = Math.random,
): number[][] {
  const order = shuffleInPlace(types.map((_, i) => i), rng)
  // `used` marks gaps already committed to a pair/triple. Inverted gaps are seeded
  // in up front so they can never be pulled into a chunk — but they are NOT dropped
  // from the plan: they resurface below as their own SOLO beats.
  const used = new Set<number>()
  order.forEach(i => { if (inverted[i]) used.add(i) })

  // Triples: pick a seed `i`, then any two more unused gaps such that the trio is
  // NOT all-identical (require ≥2 distinct shapes; prefer 3 distinct).
  const triples: number[][] = []
  for (const i of order) {
    if (triples.length >= tripleCount) break
    if (used.has(i)) continue
    const rest = order.filter(k => k !== i && !used.has(k))
    if (rest.length < 2) continue
    // Prefer a partner of a DIFFERENT shape first so the trio is never same-same-x.
    const diff = rest.find(k => types[k] !== types[i])
    const j = diff ?? rest[0]
    const third = rest.find(k => k !== j && (types[k] !== types[i] || types[k] !== types[j]))
    if (third === undefined) continue
    // Distinctness guard: a valid triple has at least two distinct shapes.
    const distinct = new Set([types[i], types[j], types[third]]).size
    if (distinct < 2) continue
    used.add(i); used.add(j); used.add(third)
    triples.push([i, j, third])
  }

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

  // Everything not committed to a pair/triple becomes a solo beat — this INCLUDES
  // the inverted gaps (which were never chunked), so they surface as length-1 beats.
  const singles = order.filter(i => !used.has(i) || inverted[i]).map(i => [i])
  // Mix chunk beats and singles so a chunked beat isn't always first.
  return shuffleInPlace([...triples, ...pairs, ...singles], rng)
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
