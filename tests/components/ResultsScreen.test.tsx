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
  it('renders the four pillar bars with raw points', () => {
    seedResult()
    render(<ResultsScreen />)
    expect(screen.getByText(/Accuracy/i)).toBeInTheDocument()
    expect(screen.getByText(/800\s*\/\s*800/)).toBeInTheDocument()
    expect(screen.getByText(/250\s*\/\s*500/)).toBeInTheDocument()
    expect(screen.getByText(/150\s*\/\s*300/)).toBeInTheDocument()
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
