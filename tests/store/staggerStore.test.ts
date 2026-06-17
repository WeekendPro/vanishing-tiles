import { describe, it, expect, beforeEach } from 'vitest'
import { useStaggerStore } from '../../src/store/staggerStore'
import {
  STAGGER,
  gapCountForBatch,
  holdMsForBatch,
  selectDurationForBatch,
  complexityForGapCount,
  difficultyForBatch,
  batchSpeedBonus,
  gapRevealMs,
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

  it('hold time decreases monotonically and floors at MIN_HOLD', () => {
    expect(holdMsForBatch(0)).toBe(STAGGER.START_HOLD)
    expect(holdMsForBatch(1)).toBeLessThan(holdMsForBatch(0))
    expect(holdMsForBatch(100)).toBe(STAGGER.MIN_HOLD)
  })

  it('reveal time per gap = fades + hold', () => {
    expect(gapRevealMs(0)).toBe(STAGGER.FADE_MS * 2 + STAGGER.START_HOLD)
  })

  it('select clock grows with gap count and exceeds the reveal time', () => {
    expect(selectDurationForBatch(0)).toBe(STAGGER.SELECT_BASE + 3 * STAGGER.SELECT_PER_GAP)
    const revealTotal = gapCountForBatch(5) * gapRevealMs(5)
    expect(selectDurationForBatch(5)).toBeGreaterThan(revealTotal)
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
    // accuracy for every gap, plus a speed bonus in [0, SPEED_MAX].
    const accuracy = gaps.length * STAGGER.ACCURACY_PER_GAP
    expect(useStaggerStore.getState().score).toBeGreaterThanOrEqual(accuracy)
    expect(useStaggerStore.getState().score).toBeLessThanOrEqual(accuracy + STAGGER.SPEED_MAX)
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
