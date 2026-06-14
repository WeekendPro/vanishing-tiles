import { describe, it, expect, beforeEach } from 'vitest'
import {
  useProgressStore, emptyLevelProgress, levelTotal, levelStars, levelCleared, isEarned,
  PROGRESS_STORAGE_KEY,
} from '../../src/store/progressStore'

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ byLevel: {} })
})

describe('progressStore', () => {
  it('returns an empty progress for an unplayed level', () => {
    const p = useProgressStore.getState().getLevel('L1')
    expect(p).toEqual(emptyLevelProgress())
    expect(levelTotal(p)).toBe(0)
    expect(levelStars(p)).toBe(0)
    expect(levelCleared(p)).toBe(false)
  })

  it('records a play: best is a max, timesPlayed/lastPlayed update', () => {
    const { recordPlay } = useProgressStore.getState()
    recordPlay('L1', 'main', 80)
    recordPlay('L1', 'main', 70) // lower — must NOT downgrade best
    const p = useProgressStore.getState().getLevel('L1')
    expect(p.best.main).toBe(80)
    expect(p.timesPlayed).toBe(2)
    expect(p.lastPlayed).not.toBeNull()
  })

  it('clears the level only once the total reaches the 65% threshold (325)', () => {
    const { recordPlay, getLevel } = useProgressStore.getState()
    recordPlay('L1', 'main', 100)
    recordPlay('L1', 'colors', 100)
    recordPlay('L1', 'inSequence', 100)
    let p = getLevel('L1')
    expect(levelTotal(p)).toBe(300)
    expect(levelCleared(p)).toBe(false) // 300 < 325
    recordPlay('L1', 'flash', 50)
    p = getLevel('L1')
    expect(levelTotal(p)).toBe(350)
    expect(levelCleared(p)).toBe(true)
    expect(isEarned(p, 'flash')).toBe(true)
    expect(levelStars(p)).toBe(4) // 350 → tier ≥350
  })

  it('persists to localStorage and rehydrates', () => {
    useProgressStore.getState().recordPlay('L2', 'main', 50)
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    expect(raw).toContain('L2')
    useProgressStore.setState({ byLevel: JSON.parse(raw!) })
    expect(useProgressStore.getState().getLevel('L2').best.main).toBe(50)
  })
})
