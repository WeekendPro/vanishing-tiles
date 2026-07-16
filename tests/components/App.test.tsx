import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../../src/lib/auth', () => ({
  getSession: vi.fn(),
  getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
  signOut: vi.fn(),
}))
// Keep the journey/leaderboard screens from hitting the network in this routing test.
vi.mock('../../src/lib/api', () => ({
  getJourney: vi.fn().mockResolvedValue([]),
  getStaggerLeaderboard: vi.fn().mockResolvedValue({ total: 0, top: [], me: null }),
}))
import * as auth from '../../src/lib/auth'
import App from '../../src/App'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('App routing', () => {
  it('shows the auth screen when there is no session', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: null } })
    render(<App />)
    expect(await screen.findByText(/Continue as guest/i)).toBeInTheDocument()
    expect(useNavStore.getState().appView).toBe('auth')
  })

  it('routes to the Home landing page when a session exists', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    render(<App />)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('home'))
  })

  it('renders the leaderboard screen on the leaderboard view', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    render(<App />)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('home'))

    useNavStore.getState().goLeaderboard()

    expect(await screen.findByText(/Global rankings/i)).toBeInTheDocument()
  })
})
