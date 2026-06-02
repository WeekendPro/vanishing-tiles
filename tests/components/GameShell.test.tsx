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
  it('shows the trickle bar in the timer slot while submitting', () => {
    act(() => { useGameStore.setState({ phase: 'selecting', mode: 'journey', submitting: true }) })
    render(<GameShell />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('trickle-bar')).toBeInTheDocument()
  })

  it('does not show the trickle bar when not submitting', () => {
    act(() => { useGameStore.setState({ phase: 'selecting', mode: 'journey', submitting: false }) })
    render(<GameShell />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })
})
