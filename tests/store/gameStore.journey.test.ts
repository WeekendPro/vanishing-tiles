import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import type { DifficultyConfig } from '@shared/types'
import { THEME_SEQUENCE } from '@shared/types'

// Mock the api module BEFORE importing the store.
vi.mock('../../src/lib/api', () => ({
  submitLevelResult: vi.fn(),
}))
import * as api from '../../src/lib/api'
import { useGameStore } from '../../src/store/gameStore'

const PROFILE: DifficultyConfig = {
  viewDuration: 7000, selectDuration: 9000, placeDuration: 0,
  gapCount: 4, complexity: 'medium', adjacency: 1,
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  vi.clearAllMocks()
})

describe('startJourneyLevel', () => {
  it('pins the level difficulty and starts the 4-round machinery locally', () => {
    act(() => useGameStore.getState().startJourneyLevel('lvl-1', PROFILE, 1200, 5, 'Castle Hill'))
    const s = useGameStore.getState()
    expect(s.mode).toBe('journey')
    expect(s.levelId).toBe('lvl-1')
    expect(s.levelDifficulty).toEqual(PROFILE)
    expect(s.priorPr).toBe(1200)
    expect(s.levelDisplayNumber).toBe(5)
    expect(s.levelName).toBe('Castle Hill')
    // startLevel resets the round state and starts round 0 at the countdown.
    expect(s.phase).toBe('countdown')
    expect(s.roundIndex).toBe(0)
    expect(s.roundTheme).toBe(THEME_SEQUENCE[0])
    expect(s.livesRemaining).toBe(3)
    expect(s.roundResults).toEqual([])
    expect(s.levelComplete).toBe(false)
    // The generated puzzle uses the LEVEL's fixed difficulty, not the table.
    expect(s.difficulty).toEqual(PROFILE)
    expect(s.grid.length).toBeGreaterThan(0)
  })

  it('applies the SAME fixed difficulty to every round (no per-round escalation)', () => {
    act(() => useGameStore.getState().startJourneyLevel('lvl-1', PROFILE, 0, 1))
    // Clear round 0 and advance.
    useGameStore.setState({ roundScore: { accuracy: 0, speedBonus: 1200, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 1200 } })
    act(() => useGameStore.getState().advanceRound())
    const s = useGameStore.getState()
    expect(s.roundIndex).toBe(1)
    expect(s.roundTheme).toBe(THEME_SEQUENCE[1])
    // Round 1 reuses the level's fixed profile (gapCount 4 / view 7000).
    expect(s.difficulty).toEqual(PROFILE)
  })
})

describe('submitJourneyLevel (aggregate submission)', () => {
  it('submits the aggregate level total + stars + cleared on a completed level', async () => {
    ;(api.submitLevelResult as any).mockResolvedValue({})
    act(() => useGameStore.getState().startJourneyLevel('lvl-1', PROFILE, 0, 1))
    // Fake a completed level: four banked rounds, full lives.
    useGameStore.setState({
      roundResults: [1200, 1200, 1200, 1200], livesRemaining: 3,
      levelComplete: true, score: 5800,
    })
    await act(async () => { await useGameStore.getState().submitJourneyLevel() })
    expect(api.submitLevelResult).toHaveBeenCalledTimes(1)
    const arg = (api.submitLevelResult as any).mock.calls[0][0]
    expect(arg.levelId).toBe('lvl-1')
    // levelTotal([1200×4], 3) = 4800 + livesBonus(3)=1000 = 5800
    expect(arg.total).toBe(5800)
    expect(arg.cleared).toBe(true)
    expect(arg.stars).toBeGreaterThan(0)
    expect(useGameStore.getState().submitting).toBe(false)
  })

  it('submits cleared:false and 0 stars on a game over', async () => {
    ;(api.submitLevelResult as any).mockResolvedValue({})
    act(() => useGameStore.getState().startJourneyLevel('lvl-1', PROFILE, 0, 1))
    useGameStore.setState({
      roundResults: [1200, 1200], livesRemaining: 0,
      levelComplete: false,
    })
    await act(async () => { await useGameStore.getState().submitJourneyLevel() })
    const arg = (api.submitLevelResult as any).mock.calls[0][0]
    expect(arg.cleared).toBe(false)
    expect(arg.stars).toBe(0)
    // levelTotal([1200,1200], 0) = 2400 + livesBonus(0)=0
    expect(arg.total).toBe(2400)
  })

  it('records an error and clears submitting when submission fails', async () => {
    ;(api.submitLevelResult as any).mockRejectedValue(new Error('network down'))
    act(() => useGameStore.getState().startJourneyLevel('lvl-1', PROFILE, 0, 1))
    useGameStore.setState({ roundResults: [1200], levelComplete: false, livesRemaining: 0 })
    await act(async () => { await useGameStore.getState().submitJourneyLevel() })
    const s = useGameStore.getState()
    expect(s.journeyError).toMatch(/network down/)
    expect(s.submitting).toBe(false)
  })
})

describe('practice keeps using the difficulty table (not levelDifficulty)', () => {
  it('startPractice clears any pinned level difficulty', () => {
    act(() => useGameStore.getState().startJourneyLevel('lvl-1', PROFILE, 0, 1))
    expect(useGameStore.getState().levelDifficulty).toEqual(PROFILE)
    act(() => useGameStore.getState().startPractice())
    expect(useGameStore.getState().levelDifficulty).toBeNull()
    expect(useGameStore.getState().mode).toBe('practice')
  })
})
