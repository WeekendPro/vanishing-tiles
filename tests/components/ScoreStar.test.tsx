import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, useReducedMotion: () => true }
})

import { ScoreStar } from '../../src/components/ResolutionPhase/ScoreStar'

describe('ScoreStar (reduced motion)', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(<ScoreStar show={false} score={80} livesRemaining={3} />)
    expect(container.firstChild).toBeNull()
  })

  it('still animates a gentle count-up under reduced motion (does NOT hard-snap to final)', async () => {
    render(<ScoreStar show score={80} livesRemaining={3} />)
    // Reduced motion must NOT jump straight to the final value — it starts from 0
    // and reveals the score with a quick count-up (iOS Low Power Mode forces
    // reduced motion, and a score reveal is core feedback, not decoration).
    expect(screen.getByTestId('score-star-value').textContent).toBe('0')
    await waitFor(
      () => {
        expect(screen.getByTestId('score-star-value').textContent).toBe('80')
        expect((screen.getByTestId('score-star-fill') as HTMLElement).style.height).toBe('80%')
      },
      { timeout: 2000 },
    )
  })

  it('omits the per-life tokens and sparks under reduced motion', () => {
    render(<ScoreStar show score={80} livesRemaining={3} />)
    // The bubbly per-life choreography is suppressed under reduced motion;
    // only the star itself reveals. No floating heart tokens.
    expect(screen.queryByText('♥')).toBeNull()
  })
})
