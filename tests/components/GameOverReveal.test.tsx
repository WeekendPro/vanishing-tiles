import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameOverReveal } from '../../src/components/ResolutionPhase/GameOverReveal'
import { useGameStore } from '../../src/store/gameStore'

// 12×12 board of filled cells (the Game Over solved/empty grids derive from this).
function filledGrid() {
  return Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => ({ status: 'filled' })))
}

beforeEach(() => {
  useGameStore.setState({
    sessionGrid: filledGrid(),
    grid: filledGrid(),
    gaps: [
      { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
      { pieceType: 'I', rotation: 0, anchorRow: 3, anchorCol: 0, cells: [[3, 0], [3, 1], [3, 2], [3, 3]] },
    ],
    // One correct pick (O), missing the I → morph = 1 keep + 1 add.
    selection: [{ pieceType: 'O', freeCount: 1 }],
  } as never)
})

describe('GameOverReveal', () => {
  it('shows GAME OVER and the answer cart, and toggles the board with Inspect', () => {
    render(<GameOverReveal />)
    expect(screen.getByText('GAME OVER')).toBeTruthy()
    // Cart starts on the player's picks; the label flips to "THE ANSWER" after
    // the morph timeline (not asserted here to avoid timer flakiness).
    expect(screen.getByText('YOUR PICKS')).toBeTruthy()

    const inspect = screen.getByTestId('game-over-inspect')
    expect(inspect.textContent).toContain('INSPECT GAPS')
    fireEvent.click(inspect)
    expect(inspect.textContent).toContain('SHOW ANSWER')
  })
})
