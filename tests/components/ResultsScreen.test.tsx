import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// The Journey branch submits the aggregate level result on mount.
vi.mock('../../src/lib/api', () => ({ submitLevelResult: vi.fn().mockResolvedValue({}) }))
import * as api from '../../src/lib/api'
import { ResultsScreen } from '../../src/components/ResultsScreen'
import { useGameStore } from '../../src/store/gameStore'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useGameStore.getState().resetGame()
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('ResultsScreen — journey level summary', () => {
  function seedJourney(over: Partial<any> = {}) {
    act(() => {
      useGameStore.setState({
        mode: 'journey', levelId: 'l1', priorPr: 0,
        score: 5800, livesRemaining: 3,
        roundResults: [1200, 1200, 1200, 1200], levelComplete: true,
        ...over,
      } as any)
    })
  }

  it('submits the aggregate level result on mount', () => {
    seedJourney()
    render(<ResultsScreen />)
    expect(api.submitLevelResult).toHaveBeenCalledTimes(1)
  })

  it('renders the per-round totals, lives bonus, and level total (not pillar bars)', () => {
    seedJourney()
    render(<ResultsScreen />)
    expect(screen.getByText('Level Complete!')).toBeInTheDocument()
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getByText('Round 4')).toBeInTheDocument()
    expect(screen.getByText(/Lives Bonus/i)).toBeInTheDocument()
    expect(screen.getByText(/^5,?800$/)).toBeInTheDocument()
    // The old 4-pillar bars are gone.
    expect(screen.queryByText(/Accuracy/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Attempts/i)).not.toBeInTheDocument()
  })

  it('shows a PR-break celebration when the level total beats the prior PR', () => {
    seedJourney({ priorPr: 1200 })
    render(<ResultsScreen />)
    expect(screen.getByText(/New PR/i)).toBeInTheDocument()
  })

  it('does not celebrate a PR on a game over (level not cleared)', () => {
    seedJourney({ levelComplete: false, livesRemaining: 0, roundResults: [1200, 1200], score: 2400, priorPr: 0 })
    render(<ResultsScreen />)
    expect(screen.getByText('Game Over')).toBeInTheDocument()
    expect(screen.queryByText(/New PR/i)).not.toBeInTheDocument()
  })

  it('Back to Map returns to the journey view', async () => {
    seedJourney()
    const user = userEvent.setup()
    render(<ResultsScreen />)
    await user.click(screen.getByRole('button', { name: /Back to Map/i }))
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('Play Again replays the level from round 1', async () => {
    seedJourney()
    const startLevelSpy = vi.spyOn(useGameStore.getState(), 'startLevel')
    const user = userEvent.setup()
    render(<ResultsScreen />)
    await user.click(screen.getByRole('button', { name: /Play Again/i }))
    expect(startLevelSpy).toHaveBeenCalledTimes(1)
    expect(useNavStore.getState().appView).toBe('playing')
  })

  it('surfaces a save error with a retry control', async () => {
    ;(api.submitLevelResult as any).mockRejectedValueOnce(new Error('network down'))
    seedJourney()
    render(<ResultsScreen />)
    // The async failure sets journeyError; re-render reflects it.
    await act(async () => { await Promise.resolve() })
    expect(await screen.findByText(/Couldn’t save/i)).toBeInTheDocument()
  })
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
})
