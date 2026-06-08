import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ResultsScreen } from '../../src/components/ResultsScreen'
import { useGameStore } from '../../src/store/gameStore'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useGameStore.getState().resetGame()
  useNavStore.getState().reset()
})

describe('ResultsScreen — practice level summary', () => {
  it('renders a level-complete summary with stars, lives bonus, and level total', () => {
    act(() => {
      useGameStore.setState({
        mode: 'practice', score: 6600, livesRemaining: 3,
        roundResults: [1400, 1400, 1400, 1400], levelComplete: true,
      } as any)
    })
    render(<ResultsScreen />)
    expect(screen.getByText('Level Complete!')).toBeInTheDocument()
    expect(screen.getByText(/Lives Bonus/i)).toBeInTheDocument()
    // livesBonus(3) === 1000
    expect(screen.getByText(/^1,?000$/)).toBeInTheDocument()
    // level total
    expect(screen.getByText(/^6,?600$/)).toBeInTheDocument()
    // every round is listed
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getByText('Round 4')).toBeInTheDocument()
    // three star slots
    expect(screen.getAllByText('★')).toHaveLength(3)
    expect(screen.getByRole('button', { name: /Play Again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back to Menu/i })).toBeInTheDocument()
  })

  it('renders a game-over summary with no filled stars', () => {
    act(() => {
      useGameStore.setState({
        mode: 'practice', score: 2800, livesRemaining: 0,
        roundResults: [1400, 1400], levelComplete: false,
      } as any)
    })
    render(<ResultsScreen />)
    expect(screen.getByText('Game Over')).toBeInTheDocument()
    const filled = screen.getAllByText('★').filter(el =>
      el.className.includes('text-neon-yellow'))
    expect(filled).toHaveLength(0)
  })

  it('Play Again restarts practice and routes to the practice view', async () => {
    act(() => {
      useGameStore.setState({
        mode: 'practice', score: 6600, livesRemaining: 3,
        roundResults: [1400, 1400, 1400, 1400], levelComplete: true,
      } as any)
    })
    const user = userEvent.setup()
    render(<ResultsScreen />)
    await user.click(screen.getByRole('button', { name: /Play Again/i }))
    expect(useNavStore.getState().appView).toBe('practice')
  })

  it('Back to Menu resets game and routes to journey map', async () => {
    act(() => {
      useGameStore.setState({
        mode: 'practice', score: 6600, livesRemaining: 3,
        roundResults: [1400, 1400, 1400, 1400], levelComplete: true,
      } as any)
    })
    const user = userEvent.setup()
    render(<ResultsScreen />)
    await user.click(screen.getByRole('button', { name: /Back to Menu/i }))
    expect(useNavStore.getState().appView).toBe('journey')
  })
})
