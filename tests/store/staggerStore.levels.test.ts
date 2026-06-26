import { describe, it, expect, beforeEach } from 'vitest'
import { useStaggerStore, activeLevel, isSandboxRun } from '../../src/store/staggerStore'
import { STAGGER } from '../../src/lib/staggerCurve'
import { STAGGER_LEVELS, levelIndexByKey } from '../../src/lib/staggerLevels'
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

describe('startRun level param', () => {
  it('with no level: normal run starts at solos (levelIndex 0), sandboxLevel null', () => {
    useStaggerStore.getState().startRun()
    const s = useStaggerStore.getState()
    expect(s.sandboxLevel).toBeNull()
    expect(s.levelIndex).toBe(0)
    expect(isSandboxRun(s)).toBe(false)
  })

  it('with a level: locks sandboxLevel + levelIndex to that level', () => {
    useStaggerStore.getState().startRun('triplets')
    const s = useStaggerStore.getState()
    expect(s.sandboxLevel).toBe('triplets')
    expect(s.levelIndex).toBe(levelIndexByKey('triplets'))
    expect(isSandboxRun(s)).toBe(true)
    expect(activeLevel(s).key).toBe('triplets')
  })

  it('a fresh run/exit resets sandboxLevel, levelIndex, and completedLevelIndex', () => {
    useStaggerStore.getState().startRun('crawlers')
    useStaggerStore.setState({ completedLevelIndex: 2 })
    useStaggerStore.getState().exit()
    const s = useStaggerStore.getState()
    expect(s.sandboxLevel).toBeNull()
    expect(s.levelIndex).toBe(0)
    expect(s.completedLevelIndex).toBeNull()
  })
})

describe('multiplier stacking on correct picks', () => {
  it('level 0 (solos, ×1): gained = ACCURACY_PER_GAP × combo', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    const type = useStaggerStore.getState().gaps[0].pieceType
    const res = useStaggerStore.getState().pickPiece(type)
    expect(res.gained).toBe(STAGGER.ACCURACY_PER_GAP * 1 * 1)
  })

  it('sandboxed at triplets (×3): gained = ACCURACY_PER_GAP × combo × 3', () => {
    const st = useStaggerStore.getState()
    st.startRun('triplets'); st.beginReveal(); st.beginSelecting()
    const type = useStaggerStore.getState().gaps[0].pieceType
    const res = useStaggerStore.getState().pickPiece(type)
    expect(res.gained).toBe(STAGGER.ACCURACY_PER_GAP * 1 * 3)
    // second correct pick: combo 2 × multiplier 3
    const remaining = useStaggerStore.getState().gaps.find(g => !g.filled)
    if (remaining) {
      const res2 = useStaggerStore.getState().pickPiece(remaining.pieceType)
      expect(res2.gained).toBe(STAGGER.ACCURACY_PER_GAP * 2 * 3)
    }
  })

  it('non-sandbox run uses the level the cumulative score currently falls in', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    // Force the run's levelIndex to twins (×2), as if it had already advanced.
    useStaggerStore.setState({ levelIndex: levelIndexByKey('twins'), score: 20000 })
    const type = useStaggerStore.getState().gaps[0].pieceType
    const res = useStaggerStore.getState().pickPiece(type)
    expect(res.gained).toBe(STAGGER.ACCURACY_PER_GAP * 1 * 2)
  })
})

describe('level transitions at the batch boundary', () => {
  it('crossing a threshold on batch clear enters levelComplete with completedLevelIndex set', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal()
    // Simulate a score that has just crossed the solos threshold.
    useStaggerStore.setState({ score: 20000, levelIndex: 0 })
    st.advanceBatch()
    const s = useStaggerStore.getState()
    expect(s.phase).toBe('levelComplete')
    expect(s.completedLevelIndex).toBe(0)
  })

  it('no threshold crossed → advanceBatch behaves as before (reveal, next batch)', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal()
    useStaggerStore.setState({ score: 0, levelIndex: 0 })
    st.advanceBatch()
    const s = useStaggerStore.getState()
    expect(s.phase).toBe('reveal')
    expect(s.batchIndex).toBe(1)
  })

  it('crossing the final threshold on batch clear enters won', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal()
    useStaggerStore.setState({ score: 500000, levelIndex: levelIndexByKey('crawlers') })
    st.advanceBatch()
    expect(useStaggerStore.getState().phase).toBe('won')
  })

  it('sandbox never enters levelComplete or won, even past every threshold', () => {
    const st = useStaggerStore.getState()
    st.startRun('solos'); st.beginReveal()
    useStaggerStore.setState({ score: 999999 })
    st.advanceBatch()
    const s = useStaggerStore.getState()
    expect(s.phase).toBe('reveal')
    expect(s.levelIndex).toBe(levelIndexByKey('solos'))
  })

  it('proceedAfterLevelComplete adopts the next level and starts its countdown', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal()
    useStaggerStore.setState({ score: 20000, levelIndex: 0 })
    st.advanceBatch()
    expect(useStaggerStore.getState().phase).toBe('levelComplete')
    st.proceedAfterLevelComplete()
    const s = useStaggerStore.getState()
    expect(s.phase).toBe('countdown')
    expect(s.levelIndex).toBe(levelIndexByKey('twins'))
    expect(s.completedLevelIndex).toBeNull()
  })
})

describe('sandbox is unlosable', () => {
  it('a wrong pick in sandbox does not decrement lives or reach gameOver', () => {
    const st = useStaggerStore.getState()
    st.startRun('crawlers'); st.beginReveal(); st.beginSelecting()
    const before = useStaggerStore.getState().lives
    for (let i = 0; i < 20; i++) {
      const res = useStaggerStore.getState().pickPiece(missingType())
      expect(res.gameOver).toBe(false)
    }
    const s = useStaggerStore.getState()
    expect(s.lives).toBe(before)
    expect(s.phase).not.toBe('gameOver')
  })

  it('timeoutBatch in sandbox does not decrement lives or reach gameOver', () => {
    const st = useStaggerStore.getState()
    st.startRun('twins'); st.beginReveal(); st.beginSelecting()
    const before = useStaggerStore.getState().lives
    for (let i = 0; i < 20; i++) st.timeoutBatch()
    const s = useStaggerStore.getState()
    expect(s.lives).toBe(before)
    expect(s.phase).not.toBe('gameOver')
  })

  it('a normal (non-sandbox) run still loses lives and can reach gameOver', () => {
    const st = useStaggerStore.getState()
    st.startRun(); st.beginReveal(); st.beginSelecting()
    for (let i = 0; i < STAGGER.START_LIVES; i++) {
      useStaggerStore.getState().pickPiece(missingType())
    }
    expect(useStaggerStore.getState().phase).toBe('gameOver')
  })
})

describe('STAGGER_LEVELS sanity in store context', () => {
  it('STAGGER_LEVELS has 5 levels matching the spec multipliers', () => {
    expect(STAGGER_LEVELS.map(l => l.multiplier)).toEqual([1, 2, 3, 4, 5])
  })
})
