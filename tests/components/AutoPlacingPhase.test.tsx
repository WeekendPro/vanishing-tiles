import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutoPlacingPhase } from '../../src/components/AutoPlacingPhase'
import { useGameStore } from '../../src/store/gameStore'

// Mock useReducedMotion to return true.
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, useReducedMotion: () => true }
})

beforeEach(() => {
  useGameStore.getState().resetGame()
})

describe('AutoPlacingPhase with reduced motion', () => {
  it('renders the Next Round button immediately after mount', () => {
    // Drive the store into auto-placing with a solved selection.
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    render(<AutoPlacingPhase />)
    // The button text is "Next Round →"
    expect(screen.getByText(/Next Round/)).toBeInTheDocument()
  })

  it('advances the round when Next Round is clicked', async () => {
    const user = userEvent.setup()
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    render(<AutoPlacingPhase />)
    const before = useGameStore.getState().round
    await user.click(screen.getByText(/Next Round/))
    expect(useGameStore.getState().round).toBe(before + 1)
  })

  it('Next Round button is idempotent — multiple clicks advance only one round', async () => {
    const user = userEvent.setup()
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    render(<AutoPlacingPhase />)
    const before = useGameStore.getState().round
    const btn = screen.getByText(/Next Round/)
    await user.click(btn)
    await user.click(btn)
    await user.click(btn)
    expect(useGameStore.getState().round).toBe(before + 1)
  })
})
