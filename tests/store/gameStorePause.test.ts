import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useGameStore } from '../../src/store/gameStore'

beforeEach(() => { useGameStore.getState().resetGame() })
afterEach(() => { vi.restoreAllMocks() })

describe('gameStore pause/resume', () => {
  it('starts un-paused', () => {
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('pauseGame flips the flag and resumeGame preserves elapsed time', () => {
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1000)
    useGameStore.setState({ phase: 'viewing', phaseStartTime: 1000, phaseDuration: 10000, paused: false })

    now.mockReturnValue(4000)              // 3000ms elapsed
    useGameStore.getState().pauseGame()
    expect(useGameStore.getState().paused).toBe(true)

    now.mockReturnValue(9000)              // 5000ms spent paused
    useGameStore.getState().resumeGame()
    const s = useGameStore.getState()
    expect(s.paused).toBe(false)
    // phaseStartTime rebased so elapsed at the resume instant is still 3000
    expect(Date.now() - s.phaseStartTime).toBe(3000)
  })

  it('resumeGame does not rebase phaseStartTime outside viewing/selecting', () => {
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(5000)
    useGameStore.setState({ phase: 'resolving', phaseStartTime: 1234, paused: true, pausedElapsed: 999 } as any)
    useGameStore.getState().resumeGame()
    const s = useGameStore.getState()
    expect(s.paused).toBe(false)
    expect(s.phaseStartTime).toBe(1234)   // untouched
  })

  it('startGame clears a leftover paused flag', () => {
    useGameStore.setState({ paused: true })
    useGameStore.getState().startGame()
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('double pauseGame does not overwrite the captured elapsed', () => {
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1000)
    useGameStore.setState({ phase: 'viewing', phaseStartTime: 1000, phaseDuration: 10000, paused: false })

    now.mockReturnValue(4000)               // 3000ms elapsed
    useGameStore.getState().pauseGame()
    now.mockReturnValue(8000)               // a second (accidental) pause later
    useGameStore.getState().pauseGame()
    expect(useGameStore.getState().pausedElapsed).toBe(3000)  // unchanged

    now.mockReturnValue(10000)
    useGameStore.getState().resumeGame()
    expect(Date.now() - useGameStore.getState().phaseStartTime).toBe(3000)
  })
})
