import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Stub the animation so the test isolates briefing layout + PLAY wiring.
vi.mock('../../src/components/briefing/HowToAnimation', () => ({
  HowToAnimation: ({ component }: { component: string }) => <div data-testid={`howto-${component}`} />,
}))

import { BriefingPhase } from '../../src/components/BriefingPhase'
import { useGameStore } from '../../src/store/gameStore'

beforeEach(() => { useGameStore.getState().resetGame() })

describe('BriefingPhase', () => {
  it('shows the component title, objective, animation, and a PLAY button', () => {
    useGameStore.setState({ activeComponent: 'main' } as any)
    render(<BriefingPhase />)
    expect(screen.getByText('THE CLASSIC')).toBeTruthy()
    expect(screen.getByText(/Memorize where the gaps are/i)).toBeTruthy()
    expect(screen.getByTestId('howto-main')).toBeTruthy()
    expect(screen.getByTestId('briefing-play')).toBeTruthy()
  })

  it('PLAY calls beginCountdown', () => {
    const spy = vi.fn()
    useGameStore.setState({ activeComponent: 'colors', beginCountdown: spy } as any)
    render(<BriefingPhase />)
    fireEvent.click(screen.getByTestId('briefing-play'))
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
