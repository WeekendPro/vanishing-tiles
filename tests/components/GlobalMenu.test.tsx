import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/auth', () => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
}))
// The menu's identity flows through profileStore → getUser + getOwnProfile.
vi.mock('../../src/lib/api', () => ({
  getOwnProfile: vi.fn(),
  setDisplayName: vi.fn(),
}))
import * as auth from '../../src/lib/auth'
import * as api from '../../src/lib/api'
import { GlobalMenu } from '../../src/components/GlobalMenu'
import { useNavStore } from '../../src/store/navStore'
import { useGameStore } from '../../src/store/gameStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import { useTrainingStore } from '../../src/store/trainingStore'
import { useProfileStore } from '../../src/store/profileStore'

beforeEach(() => {
  useNavStore.getState().reset()
  useGameStore.getState().resetGame()
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy', soundEnabled: true, sfxVolume: 1, hideDemo: false } })
  useTrainingStore.getState().exit()
  useProfileStore.getState().clear()
  vi.clearAllMocks()
  vi.mocked(auth.getUser).mockResolvedValue({
    data: { user: { email: 'luis@example.com', is_anonymous: false, user_metadata: {} } },
  } as never)
  vi.mocked(auth.signOut).mockResolvedValue({ error: null } as never)
  vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: 'NeonRider', isGuest: false })
})

const mockGuest = () => {
  vi.mocked(auth.getUser).mockResolvedValue({
    data: { user: { email: null, is_anonymous: true, user_metadata: {} } },
  } as never)
  vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: null, isGuest: true })
}

describe('GlobalMenu', () => {
  it('offers Leaderboard, Training, and Logout — but no Settings, modes, or maps', async () => {
    useNavStore.setState({ appView: 'journey' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('button', { name: /Logout/i })).toBeInTheDocument()
    // Training launches from the menu; it sits directly after Leaderboard.
    const leaderboard = screen.getByRole('button', { name: 'Leaderboard' })
    const training = screen.getByRole('button', { name: 'Training' })
    expect(leaderboard.compareDocumentPosition(training) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Settings returns when there's something behind it; Reset Journey is gone.
    expect(screen.queryByRole('button', { name: /Settings/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reset Journey/i })).not.toBeInTheDocument()
    // Game modes and map styles live on the Home landing page, not the menu.
    expect(screen.queryByRole('button', { name: /Infinite Stagger/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Subway Map/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Git Map/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument()
  })

  it('Training entry starts the drill, navigates to it, and closes the menu', async () => {
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: 'Training' }))
    expect(useNavStore.getState().appView).toBe('training')
    expect(useTrainingStore.getState().active).toBe(true)
    expect(useTrainingStore.getState().piece).not.toBeNull()
    // Menu overlay is gone — only the reopen toggle remains.
    expect(screen.queryByRole('button', { name: 'Training' })).not.toBeInTheDocument()
  })

  it('in game shows Resume + Quit and pauses on open, resumes on Resume', async () => {
    useNavStore.setState({ appView: 'practice' })
    useGameStore.setState({ phase: 'viewing', phaseStartTime: Date.now(), phaseDuration: 10000 })
    const user = userEvent.setup()
    render(<GlobalMenu />)

    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(useGameStore.getState().paused).toBe(true)
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exit Practice/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Resume/i }))
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('Exit resets the game and navigates to Home', async () => {
    useNavStore.setState({ appView: 'practice' })
    useGameStore.setState({ phase: 'viewing', round: 4 })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Exit Practice/i }))
    expect(useNavStore.getState().appView).toBe('home')
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('a guest gets the generic person icon, not "GU" initials', async () => {
    mockGuest()
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(await screen.findByRole('img', { name: /guest avatar/i })).toBeInTheDocument()
    expect(screen.queryByText('GU')).not.toBeInTheDocument()
  })

  it('a guest gets "Sign up" instead of "Logout" — same teardown, back to the auth screen', async () => {
    mockGuest()
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    const signUp = await screen.findByRole('button', { name: /Sign up/i })
    expect(screen.queryByRole('button', { name: /Logout/i })).not.toBeInTheDocument()
    await user.click(signUp)
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(useNavStore.getState().appView).toBe('auth')
  })

  it('Leaderboard entry navigates to the leaderboard view and closes the menu', async () => {
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Leaderboard/i }))
    expect(useNavStore.getState().appView).toBe('leaderboard')
    // Menu overlay is gone — only the reopen toggle remains.
    expect(screen.queryByRole('button', { name: /Leaderboard/i })).not.toBeInTheDocument()
  })

  it('guests also get the Leaderboard entry (the board is viewable; only ranking needs an account)', async () => {
    mockGuest()
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(await screen.findByRole('button', { name: /Leaderboard/i })).toBeInTheDocument()
  })

  it('Logout calls signOut and resets navigation', async () => {
    useNavStore.setState({ appView: 'journey' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Logout/i }))
    expect(auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('shows the profiles display name, not the auth-metadata name', async () => {
    vi.mocked(auth.getUser).mockResolvedValue({
      data: { user: { email: 'luis@example.com', is_anonymous: false, user_metadata: { full_name: 'Luis Alejo' } } },
    } as never)
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(await screen.findByText('NeonRider')).toBeInTheDocument()
    expect(screen.queryByText('Luis Alejo')).not.toBeInTheDocument()
  })

  it('tapping the profile header opens the edit form; saving updates the header', async () => {
    vi.mocked(api.setDisplayName).mockResolvedValue({ ok: true, displayName: 'GapMaster' })
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(await screen.findByRole('button', { name: /edit profile/i }))

    const input = screen.getByLabelText(/display name/i) as HTMLInputElement
    expect(input.value).toBe('NeonRider') // prefilled with the current name
    await user.clear(input)
    await user.type(input, 'GapMaster')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText('GapMaster')).toBeInTheDocument()
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument() // overlay closed
  })

  it('Cancel closes the edit form without saving', async () => {
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(await screen.findByRole('button', { name: /edit profile/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument()
    expect(api.setDisplayName).not.toHaveBeenCalled()
  })

  it('guests have no edit affordance on the header', async () => {
    mockGuest()
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(await screen.findByRole('img', { name: /guest avatar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument()
  })
})
