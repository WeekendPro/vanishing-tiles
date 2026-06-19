import { describe, it, expect, beforeEach } from 'vitest'
import { useStaggerStore } from '../../src/store/staggerStore'
import {
  STAGGER,
  gapCountForBatch,
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
} from '../../src/lib/staggerCurve'
import type { PieceType } from '@shared/types'

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
  it('gap count climbs 3,3,4,4,5,5,… and caps at MAX_GAPS', () => {
    expect(gapCountForBatch(0)).toBe(3)
    expect(gapCountForBatch(1)).toBe(3)
    expect(gapCountForBatch(2)).toBe(4)
    expect(gapCountForBatch(3)).toBe(4)
    expect(gapCountForBatch(100)).toBe(STAGGER.MAX_GAPS)
  })

  it('reveal pacing is constant per piece across batches (no speed-up lever)', () => {
    expect(revealStepMs()).toBe(STAGGER.REVEAL_STEP_MS)
    // Batch reveal time grows ONLY because there are more pieces, at a fixed step —
    // individual pieces never get faster as the run escalates.
    expect(batchRevealMs(2) - batchRevealMs(0)).toBe(
      (gapCountForBatch(2) - gapCountForBatch(0)) * STAGGER.REVEAL_STEP_MS,
    )
    expect(batchRevealMs(0)).toBe(2 * STAGGER.REVEAL_STEP_MS + STAGGER.REVEAL_BLOOM_MS)
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
    expect(d.gapCount).toBe(4)
    expect(d.complexity).toBe('simple')
    expect(d.selectDuration).toBe(selectDurationForBatch(2))
  })

  it('introduces shapes gradually, starting on O + I only', () => {
    expect(new Set(allowedTypesForBatch(0))).toEqual(new Set(['O', 'I']))
    expect(new Set(allowedTypesForBatch(1))).toEqual(new Set(['O', 'I']))
    expect(allowedTypesForBatch(3)).toContain('L')
    expect(allowedTypesForBatch(3)).not.toContain('Z')
    expect(new Set(allowedTypesForBatch(11))).toEqual(new Set(['O', 'I', 'L', 'J', 'S', 'T', 'Z']))
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

  it('beginReveal generates the first batch of unfilled gaps', () => {
    useStaggerStore.getState().startRun()
    useStaggerStore.getState().beginReveal()
    const s = useStaggerStore.getState()
    expect(s.phase).toBe('reveal')
    expect(s.gaps.length).toBe(gapCountForBatch(0))
    expect(s.gaps.every(g => !g.filled)).toBe(true)
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
