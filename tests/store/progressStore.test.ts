import { describe, it, expect, beforeEach } from 'vitest'
import {
  useProgressStore, emptyLevelProgress, levelTotal, levelStars, badgesUnlocked, isEarned,
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
    expect(badgesUnlocked(p)).toBe(false)
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

  it('unlocks badges and earns them once scored', () => {
    const { recordPlay } = useProgressStore.getState()
    recordPlay('L1', 'main', 90)
    let p = useProgressStore.getState().getLevel('L1')
    expect(badgesUnlocked(p)).toBe(true)
    expect(isEarned(p, 'colors')).toBe(false)
    recordPlay('L1', 'colors', 60)
    p = useProgressStore.getState().getLevel('L1')
    expect(isEarned(p, 'colors')).toBe(true)
    expect(levelTotal(p)).toBe(150)
    expect(levelStars(p)).toBe(2)
  })

  it('persists to localStorage and rehydrates', () => {
    useProgressStore.getState().recordPlay('L2', 'main', 50)
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    expect(raw).toContain('L2')
    useProgressStore.setState({ byLevel: JSON.parse(raw!) })
    expect(useProgressStore.getState().getLevel('L2').best.main).toBe(50)
  })
})
