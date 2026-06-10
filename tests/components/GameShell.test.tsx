import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// Stub the phase children so the test isolates GameShell's slot logic.
vi.mock('../../src/components/SelectingPhase', () => ({ SelectingPhase: () => null }))
vi.mock('../../src/components/ViewingPhase', () => ({ ViewingPhase: () => null }))
vi.mock('../../src/components/CountdownPhase', () => ({ CountdownPhase: () => null }))
vi.mock('../../src/components/ResolutionPhase', () => ({ ResolutionPhase: () => null }))

import { GameShell } from '../../src/components/GameShell'
import { useGameStore } from '../../src/store/gameStore'

beforeEach(() => { vi.useFakeTimers(); useGameStore.getState().resetGame() })
afterEach(() => { vi.useRealTimers() })

describe('GameShell loading slot', () => {
  it('shows the full-screen loader (not the timer slot) while submitting', () => {
    act(() => { useGameStore.setState({ phase: 'selecting', mode: 'journey', submitting: true }) })
    render(<GameShell />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('arcade-loader')).toBeInTheDocument()
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })

  it('shows no loader when not submitting', () => {
    act(() => { useGameStore.setState({ phase: 'selecting', mode: 'journey', submitting: false }) })
    render(<GameShell />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.queryByTestId('arcade-loader')).toBeNull()
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })
})

describe('GameShell header', () => {
  it('shows round-of-4 in practice level mode', () => {
    act(() => {
      useGameStore.setState({ mode: 'practice', phase: 'viewing', roundIndex: 1, livesRemaining: 2, score: 1400, levelComplete: false })
    })
    render(<GameShell />)
    expect(screen.getByText(/ROUND/i)).toBeInTheDocument()
    expect(screen.getByText(/2\s*\/\s*4|2 OF 4/i)).toBeInTheDocument()
  })

  it('journey header shows "NN: Name | Badge" and no score', () => {
    useGameStore.setState({
      mode: 'journey', activeComponent: 'colors', levelName: 'Cellar Door',
      levelDisplayNumber: 3, phase: 'viewing', livesRemaining: 3, score: 1400,
    } as any)
    render(<GameShell />)
    expect(screen.getByText(/03: Cellar Door/i)).toBeTruthy()
    expect(screen.getByText(/True Colors/i)).toBeTruthy()
    expect(screen.queryByText(/\/ 4/)).toBeNull()
    expect(screen.queryByText('1,400')).toBeNull()   // score no longer in the bar
  })

  it('journey main puzzle shows no badge suffix', () => {
    useGameStore.setState({
      mode: 'journey', activeComponent: 'main', levelName: 'Cellar Door',
      levelDisplayNumber: 1, phase: 'viewing', livesRemaining: 3,
    } as any)
    render(<GameShell />)
    expect(screen.getByText(/01: Cellar Door/i)).toBeTruthy()
    expect(screen.queryByText(/Main/)).toBeNull()    // 'main' has no suffix
  })
})
