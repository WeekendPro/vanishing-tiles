import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameOverReveal } from '../../src/components/ResolutionPhase/GameOverReveal'
import { useGameStore } from '../../src/store/gameStore'

beforeEach(() => {
  useGameStore.setState({
    gaps: [
      { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
      { pieceType: 'I', rotation: 0, anchorRow: 3, anchorCol: 0, cells: [[3, 0], [3, 1], [3, 2], [3, 3]] },
    ],
    selection: [{ pieceType: 'O', freeCount: 1 }],
  } as never)
})

describe('GameOverReveal', () => {
  it('shows GAME OVER with the player and correct selection sections', () => {
    render(<GameOverReveal />)
    expect(screen.getByText('GAME OVER')).toBeTruthy()
    expect(screen.getByText('YOUR SELECTION')).toBeTruthy()
    expect(screen.getByText('CORRECT SELECTION')).toBeTruthy()
  })
})
