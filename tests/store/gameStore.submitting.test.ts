import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import type { DifficultyConfig } from '@shared/types'

vi.mock('../../src/lib/api', () => ({
  submitLevelResult: vi.fn(),
}))
import * as api from '../../src/lib/api'
import { useGameStore } from '../../src/store/gameStore'

const PROFILE: DifficultyConfig = {
  viewDuration: 7000, selectDuration: 9000, placeDuration: 0,
  gapCount: 4, complexity: 'medium', adjacency: 1,
}

function enterCompletedLevel() {
  act(() => useGameStore.getState().startJourneyLevel('lvl-1', PROFILE, 0, 1))
  useGameStore.setState({
    roundResults: [1200, 1200, 1200, 1200], livesRemaining: 3,
    levelComplete: true, score: 5800, submitting: false, journeyError: null,
  })
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  vi.clearAllMocks()
})

describe('submitJourneyLevel — submitting flag', () => {
  it('defaults to false', () => {
    expect(useGameStore.getState().submitting).toBe(false)
  })

  it('is true while the submission is in flight and false once it resolves', async () => {
    let resolve!: (v: unknown) => void
    ;(api.submitLevelResult as any).mockReturnValue(new Promise(r => { resolve = r }))
    enterCompletedLevel()
    let p!: Promise<void>
    act(() => { p = useGameStore.getState().submitJourneyLevel() })
    expect(useGameStore.getState().submitting).toBe(true)
    await act(async () => { resolve({}); await p })
    expect(useGameStore.getState().submitting).toBe(false)
  })

  it('clears submitting when the submission fails', async () => {
    ;(api.submitLevelResult as any).mockRejectedValue(new Error('network down'))
    enterCompletedLevel()
    await act(async () => { await useGameStore.getState().submitJourneyLevel() })
    expect(useGameStore.getState().submitting).toBe(false)
    expect(useGameStore.getState().journeyError).toMatch(/network down/)
  })
})
