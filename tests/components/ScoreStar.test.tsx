import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

  it('renders the final score and fills the star to that percentage immediately', () => {
    render(<ScoreStar show score={80} livesRemaining={3} />)
    expect(screen.getByTestId('score-star-value').textContent).toBe('80')
    const fill = screen.getByTestId('score-star-fill') as HTMLElement
    expect(fill.style.height).toBe('80%')
  })
})
