import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({
  submitStaggerRun: vi.fn().mockResolvedValue({}),
  getOwnProfile: vi.fn().mockResolvedValue({ displayName: 'NeonRider', isGuest: false }),
  setDisplayName: vi.fn(),
}))
vi.mock('../../src/lib/auth', () => ({
  signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  getUser: vi.fn(),
}))
import * as auth from '../../src/lib/auth'
import { StaggerScreen } from '../../src/components/StaggerScreen'
import { useStaggerStore } from '../../src/store/staggerStore'
import { useNavStore } from '../../src/store/navStore'
import { useProfileStore } from '../../src/store/profileStore'

beforeEach(() => {
  vi.clearAllMocks()
  useNavStore.setState({ appView: 'stagger', authPrefillEmail: null })
  useProfileStore.setState({ isGuest: false, displayName: 'NeonRider' })
  useStaggerStore.setState({ phase: 'gameOver', mode: 'medium', score: 4200, lives: 0 })
})

describe('StaggerScreen game over', () => {
  it('offers Play again / Home / Share / Ranks', async () => {
    render(<StaggerScreen />)
    expect(await screen.findByRole('button', { name: /play again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ranks/i })).toBeInTheDocument()
  })

  it('Ranks tears the run down and navigates to the rankings', async () => {
    const user = userEvent.setup()
    render(<StaggerScreen />)
    await user.click(await screen.findByRole('button', { name: /ranks/i }))
    expect(useNavStore.getState().appView).toBe('leaderboard')
    expect(useStaggerStore.getState().phase).toBe('idle')
  })

  describe('for a guest', () => {
    beforeEach(() => {
      useProfileStore.setState({ isGuest: true, displayName: null })
    })

    it('shows the leaderboard sign-up CTA instead of the run-history chart', async () => {
      render(<StaggerScreen />)
      expect(await screen.findByText(/save this score to the leaderboard/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      // The summary chrome is unchanged for guests too.
      expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument()
    })

    it('hands the typed email to the auth screen and drops the guest session', async () => {
      const user = userEvent.setup()
      render(<StaggerScreen />)
      await user.type(await screen.findByLabelText(/^email$/i), 'skeptic@example.com')
      await user.click(screen.getByRole('button', { name: /sign up with email/i }))
      expect(useNavStore.getState().appView).toBe('auth')
      expect(useNavStore.getState().authPrefillEmail).toBe('skeptic@example.com')
      expect(auth.signOut).toHaveBeenCalledTimes(1)
      expect(useStaggerStore.getState().phase).toBe('idle')
    })

    it('continue with Google starts the OAuth sign-in', async () => {
      const user = userEvent.setup()
      render(<StaggerScreen />)
      await user.click(await screen.findByRole('button', { name: /continue with google/i }))
      expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1)
    })
  })
})
