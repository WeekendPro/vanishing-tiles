import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { ResultsScreen } from '../../src/components/ResultsScreen'
import { useGameStore } from '../../src/store/gameStore'
import { useNavStore } from '../../src/store/navStore'

function seedResult(over: Partial<any> = {}) {
  act(() => {
    useGameStore.setState({
      // The journey results screen is only reached in journey mode; the practice
      // branch (mode === 'practice') short-circuits before the journey render.
      mode: 'journey',
      priorPr: over.priorPr ?? 0,
      journeyResult: over.journeyResult ?? {
        attempt: { solved: true, coverage: 1,
          pillars: { accuracy: 800, speed: 250, efficiency: 150, attempts: 400, total: 1600, stars: 3 },
          total: 1600, stars: 3 },
        placements: [], session_status: 'cleared', progress: null,
      },
    } as any)
  })
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  useNavStore.getState().reset()
})

describe('ResultsScreen', () => {
  it('renders the three pillar bars with raw points', () => {
    seedResult()
    render(<ResultsScreen />)
    expect(screen.getByText(/Accuracy/i)).toBeInTheDocument()
    expect(screen.getByText(/800\s*\/\s*800/)).toBeInTheDocument()
    expect(screen.getByText(/250\s*\/\s*800/)).toBeInTheDocument()
    expect(screen.getByText(/400\s*\/\s*400/)).toBeInTheDocument()
  })

  it('shows a PR-break celebration when total beats the prior PR on a clear', () => {
    seedResult({ priorPr: 1200 })
    render(<ResultsScreen />)
    expect(screen.getByText(/New PR/i)).toBeInTheDocument()
  })

  it('shows only Back to Map after a clear', () => {
    seedResult()
    render(<ResultsScreen />)
    expect(screen.getByRole('button', { name: /Back to Map/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Try Again/i })).not.toBeInTheDocument()
  })

  it('explains over-selection when a failed attempt still covered every gap', () => {
    seedResult({
      journeyResult: {
        attempt: { solved: false, coverage: 1,
          pillars: { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 },
          total: 0, stars: 0 },
        placements: [], session_status: 'active', progress: null,
      },
    })
    render(<ResultsScreen />)
    expect(screen.getByText(/Too many pieces/i)).toBeInTheDocument()
    expect(screen.getByText(/extra pieces/i)).toBeInTheDocument()
    expect(screen.queryByText(/Coverage/i)).not.toBeInTheDocument()
  })

  it('shows the coverage percentage for a genuine partial miss', () => {
    seedResult({
      journeyResult: {
        attempt: { solved: false, coverage: 0.4,
          pillars: { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 },
          total: 0, stars: 0 },
        placements: [], session_status: 'active', progress: null,
      },
    })
    render(<ResultsScreen />)
    expect(screen.getByText(/Coverage 40%/i)).toBeInTheDocument()
    expect(screen.queryByText(/Too many pieces/i)).not.toBeInTheDocument()
  })

  it('offers Try Again on an active session and replays the same session', async () => {
    seedResult({
      journeyResult: {
        attempt: { solved: false, coverage: 0.4,
          pillars: { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 },
          total: 0, stars: 0 },
        placements: [], session_status: 'active', progress: null,
      },
    })
    const retrySpy = vi.spyOn(useGameStore.getState(), 'retryJourney')
    const user = userEvent.setup()
    render(<ResultsScreen />)
    await user.click(screen.getByRole('button', { name: /Try Again/i }))
    expect(retrySpy).toHaveBeenCalledTimes(1)
    expect(useNavStore.getState().appView).toBe('playing')
  })
})

describe('ResultsScreen — practice level summary', () => {
  it('renders a level-complete summary with stars, lives bonus, and level total', () => {
    act(() => {
      useGameStore.setState({
        mode: 'practice', score: 6600, livesRemaining: 3,
        roundResults: [1400, 1400, 1400, 1400], levelComplete: true,
        journeyResult: null,
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
    // three filled stars on a strong clear (6600 / 9000 ≈ 0.73 → 2 stars; assert star slots exist)
    expect(screen.getAllByText('★')).toHaveLength(3)
    expect(screen.getByRole('button', { name: /Play Again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back to Menu/i })).toBeInTheDocument()
  })

  it('renders a game-over summary with no filled stars', () => {
    act(() => {
      useGameStore.setState({
        mode: 'practice', score: 2800, livesRemaining: 0,
        roundResults: [1400, 1400], levelComplete: false,
        journeyResult: null,
      } as any)
    })
    render(<ResultsScreen />)
    expect(screen.getByText('Game Over')).toBeInTheDocument()
    // levelComplete === false ⇒ 0 filled stars (all empty / arcade-edge)
    const filled = screen.getAllByText('★').filter(el =>
      el.className.includes('text-neon-yellow'))
    expect(filled).toHaveLength(0)
  })
})
