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
  getOwnProfile: vi.fn().mockResolvedValue(null),
  setDisplayName: vi.fn(),
}))
import * as auth from '../../src/lib/auth'
import * as api from '../../src/lib/api'
import App from '../../src/App'
import { useNavStore } from '../../src/store/navStore'
import { useProfileStore } from '../../src/store/profileStore'

beforeEach(() => {
  useNavStore.getState().reset()
  useProfileStore.getState().clear()
  vi.clearAllMocks()
})

describe('App routing', () => {
  it('shows the auth screen when there is no session', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: null } })
    render(<App />)
    expect(await screen.findByText(/Continue as guest/i)).toBeInTheDocument()
    expect(useNavStore.getState().appView).toBe('auth')
  })

  it('routes to the Home landing page when a session exists and the profile is named', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    ;(auth.getUser as any).mockResolvedValue({
      data: { user: { email: 'lou@example.com', is_anonymous: false, user_metadata: {} } },
    })
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: 'NeonRider', isGuest: false })
    render(<App />)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('home'))
  })

  it('renders the leaderboard screen on the leaderboard view', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    ;(auth.getUser as any).mockResolvedValue({
      data: { user: { email: 'lou@example.com', is_anonymous: false, user_metadata: {} } },
    })
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: 'NeonRider', isGuest: false })
    render(<App />)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('home'))

    useNavStore.getState().goLeaderboard()

    expect(await screen.findByText(/Global rankings/i)).toBeInTheDocument()
  })

  it('gates an unnamed non-guest into the claim screen before Home', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    ;(auth.getUser as any).mockResolvedValue({
      data: { user: { email: 'lou@example.com', is_anonymous: false, user_metadata: {} } },
    })
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: null, isGuest: false })
    render(<App />)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('claimName'))
    expect(await screen.findByText(/Choose your display name/i)).toBeInTheDocument()
    // It's a gate: the global menu is suppressed here.
    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument()
  })

  it('guests skip the gate and land on Home unnamed', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'g1' } } } })
    ;(auth.getUser as any).mockResolvedValue({
      data: { user: { email: null, is_anonymous: true, user_metadata: {} } },
    })
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: null, isGuest: true })
    render(<App />)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('home'))
  })
})
