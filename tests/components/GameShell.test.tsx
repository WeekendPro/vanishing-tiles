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

  it('journey header leads with the puzzle: "PUZZLE @ Name | Level N", no score', () => {
    useGameStore.setState({
      mode: 'journey', activeComponent: 'colors', levelName: 'Cellar Door',
      levelDisplayNumber: 3, phase: 'viewing', livesRemaining: 3, score: 1400,
    } as any)
    render(<GameShell />)
    // puzzle title leads (in the <strong>)
    expect(screen.getByText((_, el) => el?.tagName === 'STRONG' && el?.textContent === 'Chromatic')).toBeTruthy()
    expect(screen.getByText('Cellar Door')).toBeTruthy()
    expect(screen.getByText(/Level 3/)).toBeTruthy()
    expect(screen.queryByText(/\/ 4/)).toBeNull()
    expect(screen.queryByText('1,400')).toBeNull()   // score no longer in the bar
  })

  it('journey header shows the puzzle name even for The Classic (main)', () => {
    useGameStore.setState({
      mode: 'journey', activeComponent: 'main', levelName: 'Cellar Door',
      levelDisplayNumber: 1, phase: 'viewing', livesRemaining: 3,
    } as any)
    render(<GameShell />)
    expect(screen.getByText((_, el) => el?.tagName === 'STRONG' && el?.textContent === 'The Classic')).toBeTruthy()
    expect(screen.getByText('Cellar Door')).toBeTruthy()
    expect(screen.getByText(/Level 1/)).toBeTruthy()
  })
})

describe('GameShell lives row', () => {
  it('renders a centered lives row during viewing, hidden in resolving', () => {
    act(() => { useGameStore.setState({ mode: 'journey', phase: 'viewing', livesRemaining: 2 }) })
    const { rerender } = render(<GameShell />)
    const row = screen.getByTestId('lives-row')
    expect(row).toBeInTheDocument()
    expect(row.textContent).toContain('♥')
    act(() => { useGameStore.setState({ phase: 'resolving' }) })
    rerender(<GameShell />)
    expect(screen.queryByTestId('lives-row')).toBeNull()
  })
})
