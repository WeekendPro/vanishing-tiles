import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'

vi.mock('../../src/lib/api', () => ({
  startSession: vi.fn(),
  submitAttempt: vi.fn(),
}))
import * as api from '../../src/lib/api'
import { useGameStore, DIFFICULTY_TABLE } from '../../src/store/gameStore'

const RESULT = {
  attempt: {
    solved: true, coverage: 1,
    pillars: { accuracy: 800, speed: 0, efficiency: 0, attempts: 1, total: 800, stars: 3 },
    total: 800, stars: 3,
  },
  placements: [],
  session_status: 'cleared' as const,
  progress: {},
}

function enterSelecting() {
  useGameStore.setState({
    phase: 'selecting', mode: 'journey', selection: [], sessionId: 's1',
    difficulty: DIFFICULTY_TABLE[0], phaseStartTime: Date.now(),
    viewTimeRemaining: 0, triesUsed: 1, submitting: false, journeyError: null,
  })
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  vi.clearAllMocks()
})

describe('submitJourneyAttempt — submitting flag', () => {
  it('defaults to false', () => {
    expect(useGameStore.getState().submitting).toBe(false)
  })

  it('is true while the attempt is in flight and false once it resolves', async () => {
    let resolve!: (v: typeof RESULT) => void
    ;(api.submitAttempt as any).mockReturnValue(new Promise(r => { resolve = r }))
    enterSelecting()
    let p!: Promise<void>
    act(() => { p = useGameStore.getState().submitJourneyAttempt() })
    expect(useGameStore.getState().submitting).toBe(true)
    await act(async () => { resolve(RESULT); await p })
    expect(useGameStore.getState().submitting).toBe(false)
    expect(useGameStore.getState().phase).toBe('resolving')
  })

  it('clears submitting when the attempt fails', async () => {
    ;(api.submitAttempt as any).mockRejectedValue(new Error('network down'))
    enterSelecting()
    await act(async () => { await useGameStore.getState().submitJourneyAttempt() })
    expect(useGameStore.getState().submitting).toBe(false)
    expect(useGameStore.getState().journeyError).toMatch(/network down/)
  })
})
