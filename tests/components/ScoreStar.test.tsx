import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ScoreStar } from '../../src/components/ResolutionPhase/ScoreStar'

describe('ScoreStar', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(<ScoreStar show={false} score={80} livesRemaining={3} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the Lives accounting line with red remaining + gray lost hearts', () => {
    render(<ScoreStar show score={80} livesRemaining={2} />)
    const lives = screen.getByTestId('acct-lives')
    const red = lives.querySelectorAll('.text-neon-red')
    const gray = lives.querySelectorAll('.text-arcade-edge')
    expect(red).toHaveLength(2)   // livesRemaining = 2
    expect(gray).toHaveLength(1)  // MAX_LIVES - livesRemaining = 1
  })

  it('starts the star at 0 and counts up (no hard snap)', async () => {
    render(<ScoreStar show score={100} livesRemaining={3} />)
    expect(screen.getByTestId('score-star-value').textContent).toBe('0')
    await waitFor(
      () => expect(Number(screen.getByTestId('score-star-value').textContent)).toBeGreaterThan(0),
      { timeout: 4000 },
    )
  })

  it('rains sparkles, evaporates Speed to 0, then shows the performance word', async () => {
    render(<ScoreStar show score={86} livesRemaining={3} />)   // speed = 86 - 60 = 26
    // sparkles appear during the time phase
    await waitFor(
      () => expect(screen.queryAllByTestId('score-star-sparkle').length).toBeGreaterThan(0),
      { timeout: 7000 },
    )
    // Speed evaporates to 0 and the performance word appears
    await waitFor(() => {
      expect(screen.getByTestId('acct-speed').textContent).toBe('0')
      expect(screen.getByTestId('score-perf').textContent).toBe('Great!')   // 86 → Great!
    }, { timeout: 6000 })
  }, 15000)
})
