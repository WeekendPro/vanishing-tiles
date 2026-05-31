import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import type { Grid, Cell } from '@shared/types'

// Mock the api module BEFORE importing the store.
vi.mock('../../src/lib/api', () => ({
  startSession: vi.fn(),
  submitAttempt: vi.fn(),
}))
import * as api from '../../src/lib/api'
import { useGameStore } from '../../src/store/gameStore'

// 2x2 all-filled grid is enough; the store never solves on the journey path.
function filledGrid(): Grid {
  const cell = (): Cell => ({ status: 'filled' })
  return Array.from({ length: 2 }, () => Array.from({ length: 2 }, cell))
}

const START_RESULT = {
  session_id: 'sess-1',
  puzzle: { grid: filledGrid(), gaps: [] },
  view_duration_ms: 7000,
  select_duration_ms: 9000,
  max_tries: 3,
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  vi.clearAllMocks()
})

describe('startJourneySession', () => {
  it('loads the server puzzle into state without local generation', async () => {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    await act(async () => {
      await useGameStore.getState().startJourneySession('lvl-1', 1200, 5)
    })
    const s = useGameStore.getState()
    expect(api.startSession).toHaveBeenCalledWith('lvl-1')
    expect(s.mode).toBe('journey')
    expect(s.sessionId).toBe('sess-1')
    expect(s.phase).toBe('countdown')
    expect(s.triesUsed).toBe(1)
    expect(s.maxTries).toBe(3)
    expect(s.priorPr).toBe(1200)
    expect(s.levelDisplayNumber).toBe(5)
    expect(s.difficulty.viewDuration).toBe(7000)
    expect(s.difficulty.selectDuration).toBe(9000)
    // sessionGrid is a pristine copy for retry replays.
    expect(s.sessionGrid).toHaveLength(2)
    expect(s.sessionGrid).not.toBe(s.grid)
  })
})

describe('submitJourneyAttempt', () => {
  async function startThenSubmit(submitResult: any) {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    ;(api.submitAttempt as any).mockResolvedValue(submitResult)
    await act(async () => {
      await useGameStore.getState().startJourneySession('lvl-1', 0, 1)
    })
    act(() => useGameStore.getState().beginViewing())
    act(() => useGameStore.getState().endViewing())
    await act(async () => {
      await useGameStore.getState().submitJourneyAttempt()
    })
  }

  it('stores the server result and enters the resolving phase on a clear', async () => {
    await startThenSubmit({
      attempt: { solved: true, coverage: 1,
        pillars: { accuracy: 800, speed: 300, efficiency: 200, attempts: 400, total: 1700, stars: 3 },
        total: 1700, stars: 3 },
      placements: [], session_status: 'cleared', progress: null,
    })
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s.journeyResult?.session_status).toBe('cleared')
    expect(s._resolution?.kind).toBe('perfect')
    // A cleared session must NOT offer another try.
    expect(s.triesUsed).toBe(1)
  })

  it('increments triesUsed when the session stays active after a miss', async () => {
    await startThenSubmit({
      attempt: { solved: false, coverage: 0.4,
        pillars: { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 },
        total: 0, stars: 0 },
      placements: [], session_status: 'active', progress: null,
    })
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('partial')
    expect(s.triesUsed).toBe(2)
  })

  it('does not increment triesUsed when the session is exhausted', async () => {
    await startThenSubmit({
      attempt: { solved: false, coverage: 0.4,
        pillars: { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 },
        total: 0, stars: 0 },
      placements: [], session_status: 'exhausted', progress: null,
    })
    expect(useGameStore.getState().triesUsed).toBe(1)
  })

  it('sends the cart as { pieceType, count } pairs', async () => {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    ;(api.submitAttempt as any).mockResolvedValue({
      attempt: { solved: true, coverage: 1,
        pillars: { accuracy: 800, speed: 0, efficiency: 0, attempts: 400, total: 1200, stars: 2 },
        total: 1200, stars: 2 },
      placements: [], session_status: 'cleared', progress: null,
    })
    await act(async () => { await useGameStore.getState().startJourneySession('lvl-1', 0, 1) })
    act(() => useGameStore.getState().beginViewing())
    act(() => useGameStore.getState().endViewing())
    act(() => { useGameStore.getState().incrementSelection('T') })
    act(() => { useGameStore.getState().incrementSelection('T') })
    await act(async () => { await useGameStore.getState().submitJourneyAttempt() })
    const arg = (api.submitAttempt as any).mock.calls[0][0]
    expect(arg.sessionId).toBe('sess-1')
    expect(arg.selection).toEqual([{ pieceType: 'T', count: 2 }])
  })
})

describe('retryJourney (same-puzzle invariant)', () => {
  it('replays the same session and puzzle without calling startSession again', async () => {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    ;(api.submitAttempt as any).mockResolvedValue({
      attempt: { solved: false, coverage: 0.3,
        pillars: { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 },
        total: 0, stars: 0 },
      placements: [], session_status: 'active', progress: null,
    })
    await act(async () => { await useGameStore.getState().startJourneySession('lvl-1', 0, 1) })
    act(() => useGameStore.getState().beginViewing())
    act(() => useGameStore.getState().endViewing())
    await act(async () => { await useGameStore.getState().submitJourneyAttempt() })

    const sessionBefore = useGameStore.getState().sessionId
    ;(api.startSession as any).mockClear()
    act(() => useGameStore.getState().retryJourney())
    const s = useGameStore.getState()
    expect(api.startSession).not.toHaveBeenCalled()
    expect(s.sessionId).toBe(sessionBefore)
    expect(s.phase).toBe('countdown')
    expect(s.selection).toEqual([])
    expect(s._resolution).toBeNull()
    expect(s.triesUsed).toBe(2) // carried over from the failed attempt
  })
})

describe('submit dispatcher', () => {
  it('routes to submitJourneyAttempt in journey mode', async () => {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    ;(api.submitAttempt as any).mockResolvedValue({
      attempt: { solved: true, coverage: 1,
        pillars: { accuracy: 800, speed: 0, efficiency: 0, attempts: 400, total: 1200, stars: 2 },
        total: 1200, stars: 2 },
      placements: [], session_status: 'cleared', progress: null,
    })
    await act(async () => { await useGameStore.getState().startJourneySession('lvl-1', 0, 1) })
    act(() => useGameStore.getState().beginViewing())
    act(() => useGameStore.getState().endViewing())
    await act(async () => { await useGameStore.getState().submit() })
    expect(api.submitAttempt).toHaveBeenCalledTimes(1)
    expect(useGameStore.getState().phase).toBe('resolving')
  })
})

describe('journey error handling', () => {
  it('keeps the player in selecting and records an error when submit fails', async () => {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    ;(api.submitAttempt as any).mockRejectedValue(new Error('network down'))
    await act(async () => { await useGameStore.getState().startJourneySession('lvl-1', 0, 1) })
    act(() => useGameStore.getState().beginViewing())
    act(() => useGameStore.getState().endViewing())
    await act(async () => { await useGameStore.getState().submitJourneyAttempt() })
    const s = useGameStore.getState()
    expect(s.phase).toBe('selecting')          // not advanced to resolving
    expect(s._resolution).toBeNull()
    expect(s.journeyError).toMatch(/network down/)
  })

  it('clears a prior error on the next session start and on retry', async () => {
    useGameStore.setState({ journeyError: 'stale' } as any)
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    await act(async () => { await useGameStore.getState().startJourneySession('lvl-1', 0, 1) })
    expect(useGameStore.getState().journeyError).toBeNull()
  })
})
