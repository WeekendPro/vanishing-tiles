import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({
  submitStaggerRun: vi.fn().mockResolvedValue({}),
  getOwnProfile: vi.fn().mockResolvedValue({ displayName: 'NeonRider', isGuest: false }),
  setDisplayName: vi.fn(),
}))
import { StaggerScreen } from '../../src/components/StaggerScreen'
import { useStaggerStore } from '../../src/store/staggerStore'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useNavStore.setState({ appView: 'stagger' })
  useStaggerStore.setState({ phase: 'gameOver', mode: 'medium', score: 4200, lives: 0 })
})

describe('StaggerScreen game over', () => {
  it('offers Play again / Leaderboard / Home', async () => {
    render(<StaggerScreen />)
    expect(await screen.findByRole('button', { name: /play again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /leaderboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument()
  })

  it('Leaderboard tears the run down and navigates to the rankings', async () => {
    const user = userEvent.setup()
    render(<StaggerScreen />)
    await user.click(await screen.findByRole('button', { name: /leaderboard/i }))
    expect(useNavStore.getState().appView).toBe('leaderboard')
    expect(useStaggerStore.getState().phase).toBe('idle')
  })
})
