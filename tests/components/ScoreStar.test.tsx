import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { ScoreStar } from '../../src/components/ResolutionPhase/ScoreStar'

describe('ScoreStar', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(<ScoreStar show={false} score={80} livesRemaining={3} />)
    expect(container.firstChild).toBeNull()
  })

  it('plays the full reveal — starts at 0, shows the life tokens, then counts up (no hard snap)', async () => {
    render(<ScoreStar show score={100} livesRemaining={3} />)
    // The reveal must NOT jump straight to the final value.
    expect(screen.getByTestId('score-star-value').textContent).toBe('0')
    // Full choreography: one floating heart token per remaining life.
    expect(screen.getAllByText('♥')).toHaveLength(3)
    // …and the score climbs (the animation runs, regardless of reduced motion).
    await waitFor(
      () => expect(Number(screen.getByTestId('score-star-value').textContent)).toBeGreaterThan(0),
      { timeout: 3000 },
    )
  })

  it('rains sparkles into the star during the leftover-time phase, then stops', async () => {
    render(<ScoreStar show score={100} livesRemaining={3} />)
    // No sparkles before the time phase.
    expect(screen.queryAllByTestId('score-star-sparkle')).toHaveLength(0)
    // After the lives land, the leftover-time phase rains sparkles in.
    await waitFor(
      () => expect(screen.queryAllByTestId('score-star-sparkle').length).toBeGreaterThan(0),
      { timeout: 6000 },
    )
    // …and they clear once the reveal settles.
    await waitFor(
      () => expect(screen.queryAllByTestId('score-star-sparkle')).toHaveLength(0),
      { timeout: 5000 },
    )
  }, 15000)
})
