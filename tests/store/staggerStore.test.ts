import { describe, it, expect, beforeEach } from 'vitest'
import { useStaggerStore } from '../../src/store/staggerStore'
import {
  STAGGER,
  gapCountForBatch,
  pairsForBatch,
  triplesForBatch,
  invertedForBatch,
  flashEventsForBatch,
  buildRevealPlan,
  revealStepMs,
  selectDurationForBatch,
  complexityForGapCount,
  difficultyForBatch,
  batchSpeedBonus,
  batchRevealMs,
  allowedTypesForBatch,
  lockedRotationsForBatch,
  DISPLAY_ROTATION,
  ORIENTATION_FREE_FROM,
  INVERTED_FROM,
} from '../../src/lib/staggerCurve'
import type { PieceType } from '@shared/types'

/** A tiny deterministic LCG so reveal-plan tests don't depend on Math.random. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
}

const ALL_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

/** A piece type that does NOT appear among the unfilled gaps → guaranteed miss. */
function missingType(): PieceType {
  const present = new Set(useStaggerStore.getState().gaps.map(g => g.pieceType))
  return ALL_TYPES.find(t => !present.has(t))!
}

beforeEach(() => {
  useStaggerStore.getState().exit()
})

describe('staggerCurve', () => {
  it('holds gaps at 3 for only the first 3 levels, then climbs one at a time, capped at MAX_GAPS', () => {
    // L1–3: only the first 3 levels hold 3 gaps (on-ramp halved).
    for (let b = 0; b <= 2; b++) expect(gapCountForBatch(b)).toBe(3)
    expect(gapCountForBatch(3)).toBe(4)   // L4
    expect(gapCountForBatch(4)).toBe(4)   // L5
    // L6–11: held at 5 while the last shapes (S, Z) land, orientation unlocks, and
    // pairing switches on with no extra recall load.
    for (let b = 5; b <= 10; b++) expect(gapCountForBatch(b)).toBe(5)
    expect(gapCountForBatch(11)).toBe(6)  // L12
    expect(gapCountForBatch(12)).toBe(6)  // L13
    expect(gapCountForBatch(13)).toBe(7)  // L14
    expect(gapCountForBatch(20)).toBe(STAGGER.MAX_GAPS)  // L21 reaches the cap
    expect(gapCountForBatch(100)).toBe(STAGGER.MAX_GAPS)
    // Monotonic, never stepping by more than one gap at a time.
    for (let b = 1; b <= 60; b++) {
      const step = gapCountForBatch(b) - gapCountForBatch(b - 1)
      expect(step).toBeGreaterThanOrEqual(0)
      expect(step).toBeLessThanOrEqual(1)
    }
  })

  it('density is feasible (2·pairs + 3·triples ≤ gaps − inverted) and beats = gaps − pairs − 2·triples', () => {
    for (let b = 0; b <= 60; b++) {
      const chunkable = gapCountForBatch(b) - invertedForBatch(b)
      expect(2 * pairsForBatch(b) + 3 * triplesForBatch(b)).toBeLessThanOrEqual(chunkable)
      expect(flashEventsForBatch(b)).toBe(gapCountForBatch(b) - pairsForBatch(b) - 2 * triplesForBatch(b))
    }
    // Pairing is off through the on-ramp + shape/orientation phase (L1–9)…
    for (let b = 0; b <= 8; b++) expect(pairsForBatch(b)).toBe(0)
    expect(pairsForBatch(9)).toBe(1)  // L10 — first pair
    // …and L13 is fully paired: 6 gaps, 3 pairs → just 3 dense beats.
    expect(gapCountForBatch(12)).toBe(6)
    expect(pairsForBatch(12)).toBe(3)
    expect(flashEventsForBatch(12)).toBe(3)
    // Triples are off until after the doubles section (≤ L22 / idx 21).
    for (let b = 0; b <= 21; b++) expect(triplesForBatch(b)).toBe(0)
  })

  it('triples switch on AFTER doubles, grow one at a time, and never on a gap bump', () => {
    // First triple at L23 (idx 22), a gentle intro; grows 1→2→3→4 by L26 (idx 25).
    expect(triplesForBatch(22)).toBe(1)  // L23
    expect(triplesForBatch(23)).toBe(2)  // L24
    expect(triplesForBatch(24)).toBe(3)  // L25
    expect(triplesForBatch(25)).toBe(4)  // L26 — fully tripled
    // Gap count is pinned at the cap across the whole triples section (no gap bump).
    for (let b = 20; b <= 28; b++) expect(gapCountForBatch(b)).toBe(STAGGER.MAX_GAPS)
    // L26 is fully tripled: 4 triples · 3 = 12 gaps, 0 pairs, 4 beats.
    expect(pairsForBatch(25)).toBe(0)
    expect(flashEventsForBatch(25)).toBe(4)
    // Triples never grow by more than one per level.
    for (let b = 1; b <= 60; b++) {
      const step = triplesForBatch(b) - triplesForBatch(b - 1)
      expect(step).toBeLessThanOrEqual(1)
    }
  })

  it('inverted gaps switch on after the triples section, growing one per batch', () => {
    // Off everywhere before INVERTED_FROM.
    for (let b = 0; b < INVERTED_FROM; b++) expect(invertedForBatch(b)).toBe(0)
    expect(invertedForBatch(INVERTED_FROM)).toBe(1)       // L27 — first inverted
    expect(invertedForBatch(INVERTED_FROM + 1)).toBe(2)   // L28
    expect(invertedForBatch(100)).toBe(2)                 // capped on the endless tail
    // Inverted lands AFTER triples grow in (idx 25 is the fully-tripled rung).
    expect(INVERTED_FROM).toBeGreaterThan(25)
    // Inverted gaps are solo beats, so density still fits the NON-inverted gaps.
    for (let b = INVERTED_FROM; b <= 60; b++) {
      const chunkable = gapCountForBatch(b) - invertedForBatch(b)
      expect(2 * pairsForBatch(b) + 3 * triplesForBatch(b)).toBeLessThanOrEqual(chunkable)
    }
  })

  it('reveal pacing is constant per beat across batches, and pairing shortens it', () => {
    expect(revealStepMs()).toBe(STAGGER.REVEAL_STEP_MS)
    // Reveal time grows ONLY with the number of flash BEATS, at a fixed step —
    // individual pieces never get faster as the run escalates.
    expect(batchRevealMs(8) - batchRevealMs(0)).toBe(
      (flashEventsForBatch(8) - flashEventsForBatch(0)) * STAGGER.REVEAL_STEP_MS,
    )
    expect(batchRevealMs(0)).toBe(2 * STAGGER.REVEAL_STEP_MS + STAGGER.REVEAL_BLOOM_MS)
    // L14 (7 gaps, 3 pairs → 4 beats) reveals FASTER than L6 (5 gaps, 0 pairs →
    // 5 beats) despite MORE recall load — pairing collapses beats.
    expect(batchRevealMs(13)).toBeLessThan(batchRevealMs(5))
  })

  it('select clock grows with gap count and exceeds the reveal time', () => {
    expect(selectDurationForBatch(0)).toBe(STAGGER.SELECT_BASE + 3 * STAGGER.SELECT_PER_GAP)
    expect(selectDurationForBatch(5)).toBeGreaterThan(batchRevealMs(5))
  })

  it('complexity follows The Classic bands', () => {
    expect(complexityForGapCount(3)).toBe('simple')
    expect(complexityForGapCount(5)).toBe('simple')
    expect(complexityForGapCount(8)).toBe('medium')
    expect(complexityForGapCount(12)).toBe('complex')
  })

  it('difficultyForBatch wires gap count + complexity together', () => {
    const d = difficultyForBatch(2)
    expect(d.gapCount).toBe(3)
    expect(d.complexity).toBe('simple')
    expect(d.selectDuration).toBe(selectDurationForBatch(2))
  })

  it('introduces shapes gradually, starting on O + I only', () => {
    expect(new Set(allowedTypesForBatch(0))).toEqual(new Set(['O', 'I']))
    expect(allowedTypesForBatch(1)).toContain('L')      // L joins at L2 (idx 1)
    expect(allowedTypesForBatch(2)).toContain('J')      // J joins at L3 (idx 2)
    expect(allowedTypesForBatch(7)).not.toContain('Z')  // Z is last
    // Z (the last shape) debuts at L9 (idx 8), the level AFTER orientation frees
    // (idx 7) — the hardest piece never arrives already rotated.
    expect(new Set(allowedTypesForBatch(8))).toEqual(new Set(['O', 'I', 'L', 'J', 'S', 'T', 'Z']))
  })

  it('moves only one difficulty lever per level (no stacked spikes)', () => {
    // For each level transition, count how many CONCEPTUAL levers changed: gap
    // count, shape-pool size, orientation freedom, density (pairs+triples form ONE
    // chunking lever — trading a pair for a triple is a single "densify" move), and
    // inverted. Never more than one — EXCEPT that switching an inverted gap on must
    // ease a chunk back to free its solo slot, so a density easing that accompanies
    // an inverted bump is counted as part of that single "add inverted" move.
    for (let b = 1; b <= 40; b++) {
      const gapChanged = gapCountForBatch(b) !== gapCountForBatch(b - 1)
      const poolChanged = allowedTypesForBatch(b).length !== allowedTypesForBatch(b - 1).length
      const orientChanged =
        (lockedRotationsForBatch(b) === undefined) !== (lockedRotationsForBatch(b - 1) === undefined)
      const densityChanged =
        pairsForBatch(b) !== pairsForBatch(b - 1) || triplesForBatch(b) !== triplesForBatch(b - 1)
      const invertedChanged = invertedForBatch(b) !== invertedForBatch(b - 1)
      // The chunk-easing on an inverted bump is part of that move, not a second lever.
      const densityIsOwnLever = densityChanged && !invertedChanged
      const leversMoved =
        [gapChanged, poolChanged, orientChanged, densityIsOwnLever, invertedChanged].filter(Boolean).length
      expect(leversMoved).toBeLessThanOrEqual(1)
    }
  })

  it('buildRevealPlan forms the requested distinct-shape pairs, covering every gap once', () => {
    const types: PieceType[] = ['O', 'I', 'L', 'J', 'T', 'S']  // 6 distinct shapes
    const plan = buildRevealPlan(types, 3, 0, [], seededRng(7))
    const pairs = plan.filter(beat => beat.length === 2)
    expect(pairs.length).toBe(3)
    // Each pair is two DIFFERENT shapes (never the same piece twice).
    pairs.forEach(([a, b]) => expect(types[a]).not.toBe(types[b]))
    // Every gap appears exactly once across the whole plan.
    expect(plan.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('buildRevealPlan returns fewer pairs when the shapes cannot supply them', () => {
    // Five gaps but only one non-O shape → at most ONE distinct pair is possible.
    const types: PieceType[] = ['O', 'O', 'O', 'O', 'I']
    const plan = buildRevealPlan(types, 2, 0, [], seededRng(3))
    expect(plan.filter(beat => beat.length === 2).length).toBe(1)
  })

  it('buildRevealPlan emits TRIPLE beats (length-3), each with ≥2 distinct shapes', () => {
    const types: PieceType[] = ['O', 'I', 'L', 'J', 'T', 'S']  // 6 distinct
    const plan = buildRevealPlan(types, 0, 2, [], seededRng(11))
    const triples = plan.filter(beat => beat.length === 3)
    expect(triples.length).toBe(2)
    // A triple is never all-identical (mirrors the pairs no-same-same rule).
    triples.forEach(beat => expect(new Set(beat.map(i => types[i])).size).toBeGreaterThanOrEqual(2))
    // Every gap appears exactly once across the whole plan.
    expect(plan.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('buildRevealPlan mixes triples and pairs, covering every gap once', () => {
    // 12 gaps → 1 triple (3) + 2 pairs (4) + 5 singles = 12.
    const types: PieceType[] = ['O', 'I', 'L', 'J', 'T', 'S', 'Z', 'O', 'I', 'L', 'J', 'T']
    const plan = buildRevealPlan(types, 2, 1, [], seededRng(5))
    expect(plan.filter(b => b.length === 3).length).toBe(1)
    expect(plan.filter(b => b.length === 2).length).toBe(2)
    expect(plan.flat().sort((a, b) => a - b)).toEqual([...Array(12).keys()])
  })

  it('a triple needs at least two distinct shapes (all-identical cannot triple)', () => {
    // 3 identical O gaps can never form a valid (≥2 distinct) triple.
    const plan = buildRevealPlan(['O', 'O', 'O'], 0, 1, [], seededRng(9))
    expect(plan.filter(b => b.length === 3).length).toBe(0)
  })

  it('buildRevealPlan keeps inverted gaps as SOLO beats (never paired/tripled)', () => {
    const types: PieceType[] = ['O', 'I', 'L', 'J', 'T', 'S']
    const inverted = [true, false, false, false, false, false]  // gap 0 is inverted
    const plan = buildRevealPlan(types, 2, 1, inverted, seededRng(13))
    // The inverted gap is always alone in its beat…
    const invBeat = plan.find(beat => beat.includes(0))!
    expect(invBeat).toEqual([0])
    // …and never appears inside a pair or triple.
    plan.filter(b => b.length > 1).forEach(b => expect(b).not.toContain(0))
  })

  it('the allowed-shape set only ever grows', () => {
    for (let b = 1; b <= 12; b++) {
      const prev = new Set(allowedTypesForBatch(b - 1))
      allowedTypesForBatch(b - 1).forEach(t => expect(allowedTypesForBatch(b)).toContain(t))
      expect(allowedTypesForBatch(b).length).toBeGreaterThanOrEqual(prev.size)
    }
  })

  it('locks gap orientation early, frees it once rotations open up', () => {
    expect(lockedRotationsForBatch(0)).toEqual(DISPLAY_ROTATION)
    expect(lockedRotationsForBatch(ORIENTATION_FREE_FROM)).toBeUndefined()
    expect(DISPLAY_ROTATION.I).toBe(1)  // upright I/J/L
    expect(DISPLAY_ROTATION.J).toBe(1)
    expect(DISPLAY_ROTATION.L).toBe(1)
    expect(DISPLAY_ROTATION.O).toBe(0)
  })

  it('starts the run with five lives', () => {
    expect(STAGGER.START_LIVES).toBe(5)
  })

  it('speed bonus is the clamped time-left ratio × SPEED_MAX', () => {
    expect(batchSpeedBonus(5000, 5000)).toBe(STAGGER.SPEED_MAX)
    expect(batchSpeedBonus(0, 5000)).toBe(0)
    expect(batchSpeedBonus(2500, 5000)).toBe(Math.round(STAGGER.SPEED_MAX * 0.5))
    expect(batchSpeedBonus(9999, 5000)).toBe(STAGGER.SPEED_MAX) // clamped
    expect(batchSpeedBonus(100, 0)).toBe(0)                     // guard
  })
})

describe('useStaggerStore', () => {
  it('startRun seeds a fresh run in countdown with full lives and zero score', () => {
    useStaggerStore.getState().startRun()
    const s = useStaggerStore.getState()
    expect(s.phase).toBe('countdown')
    expect(s.lives).toBe(STAGGER.START_LIVES)
    expect(s.score).toBe(0)
    expect(s.batchIndex).toBe(0)
  })

  it('beginReveal generates the first batch of unfilled gaps with a single-flash plan', () => {
    useStaggerStore.getState().startRun()
    useStaggerStore.getState().beginReveal()
    const s = useStaggerStore.getState()
    expect(s.phase).toBe('reveal')
    expect(s.gaps.length).toBe(gapCountForBatch(0))
    expect(s.gaps.every(g => !g.filled)).toBe(true)
    // Batch 0 has no pairs: one gap per beat, every gap covered once.
    expect(s.revealPlan.length).toBe(flashEventsForBatch(0))
    expect(s.revealPlan.every(beat => beat.length === 1)).toBe(true)
    expect(s.revealPlan.flat().sort((a, b) => a - b)).toEqual(s.gaps.map((_, i) => i))
  })

  it('a paired batch reveals two distinct shapes per pair beat', () => {
    const st = useStaggerStore.getState()
    st.startRun()
    useStaggerStore.setState({ batchIndex: 15 })  // L16: 8 gaps, 4 pairs
    st.beginReveal()
    const { gaps, revealPlan } = useStaggerStore.getState()
    expect(gaps.length).toBe(gapCountForBatch(15))
    expect(revealPlan.length).toBe(flashEventsForBatch(15))
    const pairs = revealPlan.filter(beat => beat.length === 2)
    expect(pairs.length).toBe(pairsForBatch(15))
    // Every pair beat shows two DIFFERENT shapes; every gap appears exactly once.
    pairs.forEach(([a, b]) => expect(gaps[a].pieceType).not.toBe(gaps[b].pieceType))
    expect(revealPlan.flat().sort((a, b) => a - b)).toEqual(gaps.map((_, i) => i))
  })

  it('a tripled batch reveals three gaps (≥2 distinct shapes) per triple beat', () => {
    const st = useStaggerStore.getState()
    st.startRun()
    useStaggerStore.setState({ batchIndex: 25 })  // L26: 12 gaps, 4 triples, 0 pairs, 4 beats (no inverted)
    st.beginReveal()
    const { gaps, revealPlan } = useStaggerStore.getState()
    expect(gaps.length).toBe(gapCountForBatch(25))
    expect(revealPlan.length).toBe(flashEventsForBatch(25))
    const triples = revealPlan.filter(beat => beat.length === 3)
    expect(triples.length).toBe(triplesForBatch(25))
    // Every triple beat shows at least two DIFFERENT shapes; every gap appears once.
    triples.forEach(beat => expect(new Set(beat.map(i => gaps[i].pieceType)).size).toBeGreaterThanOrEqual(2))
    expect(revealPlan.flat().sort((a, b) => a - b)).toEqual(gaps.map((_, i) => i))
  })

  it('an inverted batch flags inverted gaps and keeps them as SOLO reveal beats', () => {
    const st = useStaggerStore.getState()
    st.startRun()
    useStaggerStore.setState({ batchIndex: INVERTED_FROM + 1 })  // L28: 2 inverted gaps
    st.beginReveal()
    const { gaps, revealPlan } = useStaggerStore.getState()
    const invertedGaps = gaps.filter(g => g.inverted)
    expect(invertedGaps.length).toBe(invertedForBatch(INVERTED_FROM + 1))
    // Each inverted gap occupies a length-1 beat all by itself.
    gaps.forEach((g, i) => {
      if (!g.inverted) return
      const beat = revealPlan.find(bt => bt.includes(i))!
      expect(beat).toEqual([i])
    })
    // No pair/triple beat contains an inverted gap.
    revealPlan.filter(bt => bt.length > 1).forEach(bt =>
      bt.forEach(i => expect(gaps[i].inverted).toBeFalsy()))
    // The whole plan still covers every gap exactly once.
    expect(revealPlan.flat().sort((a, b) => a - b)).toEqual(gaps.map((_, i) => i))
  })

  it('early batches never flag any gap as inverted', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal()  // batch 0
    expect(useStaggerStore.getState().gaps.every(g => !g.inverted)).toBe(true)
  })

  it('a correct pick fills exactly one matching gap and banks accuracy', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    const type = useStaggerStore.getState().gaps[0].pieceType
    const before = useStaggerStore.getState().score
    const res = useStaggerStore.getState().pickPiece(type)
    expect(res.ok).toBe(true)
    expect(useStaggerStore.getState().score).toBe(before + STAGGER.ACCURACY_PER_GAP)
    expect(useStaggerStore.getState().gaps.filter(g => g.filled).length).toBe(1)
  })

  it('a wrong pick costs a life and banks no points', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    const before = useStaggerStore.getState()
    const res = useStaggerStore.getState().pickPiece(missingType())
    expect(res.ok).toBe(false)
    expect(res.gameOver).toBe(false)
    expect(useStaggerStore.getState().lives).toBe(before.lives - 1)
    expect(useStaggerStore.getState().score).toBe(before.score)
  })

  it('picks of one type fill every gap of that type, then miss', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    const type = useStaggerStore.getState().gaps[0].pieceType
    const count = useStaggerStore.getState().gaps.filter(g => g.pieceType === type).length
    for (let i = 0; i < count; i++) {
      expect(useStaggerStore.getState().pickPiece(type).ok).toBe(true)
    }
    // No gap of that type remains → next identical pick is a miss.
    expect(useStaggerStore.getState().pickPiece(type).ok).toBe(false)
  })

  it('filling the last gap clears the batch and adds a speed bonus', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    const gaps = [...useStaggerStore.getState().gaps]
    let res = { batchCleared: false } as ReturnType<typeof st.pickPiece>
    gaps.forEach(g => { res = useStaggerStore.getState().pickPiece(g.pieceType) })
    expect(res.batchCleared).toBe(true)
    // Combo-scaled accuracy: a clean run scores base×1 + base×2 + … + base×n
    // (linear multiplier), plus a speed bonus in [0, SPEED_MAX].
    const n = gaps.length
    const accuracy = (STAGGER.ACCURACY_PER_GAP * n * (n + 1)) / 2
    expect(useStaggerStore.getState().score).toBeGreaterThanOrEqual(accuracy)
    expect(useStaggerStore.getState().score).toBeLessThanOrEqual(accuracy + STAGGER.SPEED_MAX)
  })

  it('combo multiplies per-pick points linearly and resets on a miss', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    const gaps = [...useStaggerStore.getState().gaps]
    const r1 = useStaggerStore.getState().pickPiece(gaps[0].pieceType)
    expect(r1).toMatchObject({ ok: true, combo: 1, gained: STAGGER.ACCURACY_PER_GAP })
    const r2 = useStaggerStore.getState().pickPiece(gaps[1].pieceType)
    expect(r2).toMatchObject({ ok: true, combo: 2, gained: 2 * STAGGER.ACCURACY_PER_GAP })
    // A miss breaks the streak: the multiplier resets to 0.
    expect(useStaggerStore.getState().pickPiece(missingType()).ok).toBe(false)
    expect(useStaggerStore.getState().currentCombo).toBe(0)
  })

  it('earns a life every LIFE_EVERY points', () => {
    useStaggerStore.setState({ phase: 'selecting', score: STAGGER.LIFE_EVERY - 50, lives: 2, currentCombo: 0,
      gaps: [{ cells: [[0, 0]], pieceType: 'O', rotation: 0, filled: false } as never] })
    // A pick worth ≥50 crosses the threshold and awards exactly one life.
    useStaggerStore.getState().pickPiece('O')
    expect(useStaggerStore.getState().lives).toBe(3)
  })

  it('advanceBatch escalates difficulty and resets the gaps unfilled', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal()
    st.advanceBatch()
    const s = useStaggerStore.getState()
    expect(s.batchIndex).toBe(1)
    expect(s.phase).toBe('reveal')
    expect(s.gaps.every(g => !g.filled)).toBe(true)
  })

  it('an early batch only contains O/I gaps, each in its locked orientation', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal()
    const gaps = useStaggerStore.getState().gaps
    gaps.forEach(g => {
      expect(['O', 'I']).toContain(g.pieceType)
      expect(g.rotation).toBe(DISPLAY_ROTATION[g.pieceType])
    })
  })

  it('timeoutBatch costs a life but does NOT advance the phase (replays the same batch)', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    const before = useStaggerStore.getState().lives
    st.timeoutBatch()
    const s = useStaggerStore.getState()
    expect(s.lives).toBe(before - 1)
    expect(s.batchIndex).toBe(0)              // stays on the same phase — no advance
    expect(s.phase).toBe('reveal')
    expect(s.gaps.every(g => !g.filled)).toBe(true)  // same batch, reset unfilled
  })

  it('a selection timeout breaks the running combo (losing a life resets it)', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    const type = useStaggerStore.getState().gaps[0].pieceType
    useStaggerStore.getState().pickPiece(type)           // build a streak
    expect(useStaggerStore.getState().currentCombo).toBeGreaterThan(0)
    st.timeoutBatch()
    expect(useStaggerStore.getState().currentCombo).toBe(0)
  })

  it('timeoutBatch on the last life ends the run', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    for (let i = 0; i < STAGGER.START_LIVES - 1; i++) {
      useStaggerStore.getState().pickPiece(missingType())
    }
    expect(useStaggerStore.getState().lives).toBe(1)
    st.timeoutBatch()
    expect(useStaggerStore.getState().lives).toBe(0)
    expect(useStaggerStore.getState().phase).toBe('gameOver')
  })

  it('losing the last life ends the run immediately', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    for (let i = 0; i < STAGGER.START_LIVES - 1; i++) {
      useStaggerStore.getState().pickPiece(missingType())
    }
    expect(useStaggerStore.getState().phase).toBe('selecting')
    const res = useStaggerStore.getState().pickPiece(missingType())
    expect(res.gameOver).toBe(true)
    expect(useStaggerStore.getState().lives).toBe(0)
    expect(useStaggerStore.getState().phase).toBe('gameOver')
  })

  it('cumulative score carries across batches', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    useStaggerStore.getState().pickPiece(useStaggerStore.getState().gaps[0].pieceType)
    const carried = useStaggerStore.getState().score
    expect(carried).toBeGreaterThan(0)
    st.advanceBatch()
    st.beginSelecting()
    expect(useStaggerStore.getState().score).toBe(carried) // not reset
  })

  it('pickPiece is a no-op outside the selecting phase', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal()
    const res = useStaggerStore.getState().pickPiece('O')
    expect(res.ok).toBe(false)
    expect(useStaggerStore.getState().lives).toBe(STAGGER.START_LIVES)
  })
})

describe('Infinite Stagger run-stats (Game Over)', () => {
  it('startRun zeroes the run stats', () => {
    const st = useStaggerStore.getState()
    st.startRun()
    const s = useStaggerStore.getState()
    expect(s.shapesRecalled).toBe(0)
    expect(s.bestCombo).toBe(0)
    expect(s.totalPicks).toBe(0)
    expect(s.correctPicks).toBe(0)
  })

  it('a correct pick increments shapesRecalled, correctPicks and totalPicks', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    const type = useStaggerStore.getState().gaps[0].pieceType
    useStaggerStore.getState().pickPiece(type)
    const s = useStaggerStore.getState()
    expect(s.shapesRecalled).toBe(1)
    expect(s.correctPicks).toBe(1)
    expect(s.totalPicks).toBe(1)
    expect(s.bestCombo).toBe(1)
  })

  it('a wrong pick increments totalPicks only and resets the running combo', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    const type = useStaggerStore.getState().gaps[0].pieceType
    useStaggerStore.getState().pickPiece(type)      // correct → combo 1
    useStaggerStore.getState().pickPiece(missingType())  // wrong → combo breaks
    const s = useStaggerStore.getState()
    expect(s.shapesRecalled).toBe(1)
    expect(s.correctPicks).toBe(1)
    expect(s.totalPicks).toBe(2)
    expect(s.bestCombo).toBe(1)  // best so far survives the miss
  })

  it('bestCombo tracks the longest streak of consecutive correct picks', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    // First batch: fill every gap → a clean streak of gaps.length.
    const firstBatch = [...useStaggerStore.getState().gaps]
    firstBatch.forEach(g => useStaggerStore.getState().pickPiece(g.pieceType))
    expect(useStaggerStore.getState().bestCombo).toBe(firstBatch.length)

    // Advance, break the streak with a miss, then a single correct pick → the
    // long first-batch streak must still be the best.
    st.advanceBatch(); st.beginSelecting()
    useStaggerStore.getState().pickPiece(missingType())
    useStaggerStore.getState().pickPiece(useStaggerStore.getState().gaps[0].pieceType)
    expect(useStaggerStore.getState().bestCombo).toBe(firstBatch.length)
    // Stats accumulate across batches.
    const s = useStaggerStore.getState()
    expect(s.shapesRecalled).toBe(firstBatch.length + 1)
    expect(s.correctPicks).toBe(firstBatch.length + 1)
    expect(s.totalPicks).toBe(firstBatch.length + 2)
  })

  it('stats persist into the gameOver phase', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    useStaggerStore.getState().pickPiece(useStaggerStore.getState().gaps[0].pieceType)
    for (let i = 0; i < STAGGER.START_LIVES; i++) {
      useStaggerStore.getState().pickPiece(missingType())
    }
    const s = useStaggerStore.getState()
    expect(s.phase).toBe('gameOver')
    expect(s.shapesRecalled).toBe(1)
    expect(s.bestCombo).toBe(1)
    expect(s.correctPicks).toBe(1)
    expect(s.totalPicks).toBe(1 + STAGGER.START_LIVES)
  })
})

describe('Infinite Stagger replay + pause', () => {
  it('replayReveal spends points, replays the sequence, and resumes the clock', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    useStaggerStore.setState({ score: 600 })
    expect(useStaggerStore.getState().replayReveal()).toBe(true)
    const mid = useStaggerStore.getState()
    expect(mid.score).toBe(600 - STAGGER.REPLAY_COST)
    expect(mid.phase).toBe('reveal')
    expect(mid.resumeRemaining).toBeGreaterThan(0)
    // Finishing the replayed reveal resumes selecting and consumes the saved time.
    st.beginSelecting()
    const after = useStaggerStore.getState()
    expect(after.phase).toBe('selecting')
    expect(after.resumeRemaining).toBeNull()
  })

  it('replayReveal is refused when the player cannot afford it', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    useStaggerStore.setState({ score: STAGGER.REPLAY_COST - 1 })
    expect(useStaggerStore.getState().replayReveal()).toBe(false)
    expect(useStaggerStore.getState().phase).toBe('selecting')
    expect(useStaggerStore.getState().score).toBe(STAGGER.REPLAY_COST - 1)
  })

  it('replayReveal only fires mid-selection', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal()
    useStaggerStore.setState({ score: 9999 })
    expect(useStaggerStore.getState().replayReveal()).toBe(false)
  })

  it('pause freezes the clock and resume restores the remaining time', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    st.pause()
    const paused = useStaggerStore.getState()
    expect(paused.paused).toBe(true)
    expect(paused.resumeRemaining).toBeGreaterThan(0)
    const saved = paused.resumeRemaining!
    st.resume()
    const resumed = useStaggerStore.getState()
    expect(resumed.paused).toBe(false)
    expect(resumed.resumeRemaining).toBeNull()
    const remaining = resumed.selectStartTime + resumed.selectDuration - Date.now()
    expect(Math.abs(remaining - saved)).toBeLessThan(50)
  })
})
