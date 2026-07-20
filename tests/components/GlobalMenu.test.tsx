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
  eraseStaggerRecords: vi.fn(),
  deleteOwnAccount: vi.fn(),
}))
// Sound Design gates on isAdminEnv; default to admin (matches the local dev
// session tests run under) and override per-test. Erase My Data is NOT gated.
vi.mock('../../src/lib/config', () => ({
  PROVIDERS_ENABLED: false,
  isAdminEnv: vi.fn(() => true),
}))
import * as auth from '../../src/lib/auth'
import * as api from '../../src/lib/api'
import * as config from '../../src/lib/config'
import { GlobalMenu } from '../../src/components/GlobalMenu'
import { useNavStore } from '../../src/store/navStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import { useTrainingStore } from '../../src/store/trainingStore'
import { useProfileStore } from '../../src/store/profileStore'

beforeEach(() => {
  useNavStore.getState().reset()
  useSettingsStore.setState({ settings: { difficulty: 'easy', soundEnabled: true, sfxVolume: 1, hideDemo: false } })
  useTrainingStore.getState().exit()
  useProfileStore.getState().clear()
  vi.clearAllMocks()
  vi.mocked(auth.getUser).mockResolvedValue({
    data: { user: { email: 'luis@example.com', is_anonymous: false, user_metadata: {} } },
  } as never)
  vi.mocked(auth.signOut).mockResolvedValue({ error: null } as never)
  vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: 'NeonRider', isGuest: false })
  vi.mocked(api.eraseStaggerRecords).mockResolvedValue(undefined)
  vi.mocked(api.deleteOwnAccount).mockResolvedValue(undefined)
  vi.mocked(config.isAdminEnv).mockReturnValue(true)
})

const mockGuest = () => {
  vi.mocked(auth.getUser).mockResolvedValue({
    data: { user: { email: null, is_anonymous: true, user_metadata: {} } },
  } as never)
  vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: null, isGuest: true })
}

describe('GlobalMenu', () => {
  it('offers Leaderboard, Training, and Logout — but no Settings, modes, or maps', async () => {
    useNavStore.setState({ appView: 'stagger' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('button', { name: /Logout/i })).toBeInTheDocument()
    // Training launches from the menu; it sits directly after Leaderboard.
    // (Each nav row's accessible name now includes its subtitle, so anchor on
    // the leading title.)
    const leaderboard = screen.getByRole('button', { name: /^Leaderboard/i })
    const training = screen.getByRole('button', { name: /^Training/i })
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
    await user.click(screen.getByRole('button', { name: /^Training/i }))
    expect(useNavStore.getState().appView).toBe('training')
    expect(useTrainingStore.getState().active).toBe(true)
    expect(useTrainingStore.getState().piece).not.toBeNull()
    // Menu overlay is gone — only the reopen toggle remains.
    expect(screen.queryByRole('button', { name: /^Training/i })).not.toBeInTheDocument()
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

  it('a guest gets the "Create an account" invite instead of "Logout" — same teardown, back to the auth screen', async () => {
    mockGuest()
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    // The guest sign-up ramp is the invite banner under the avatar (it replaced
    // the old bottom "Sign up" text link); same teardown, only the framing differs.
    const signUp = await screen.findByRole('button', { name: /Create an account/i })
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
    // Anchor on the leading title: the guest CTA banner's name also contains
    // "leaderboard" ("…climb the leaderboard"), so a bare /Leaderboard/ matches two.
    expect(await screen.findByRole('button', { name: /^Leaderboard/i })).toBeInTheDocument()
  })

  it('Logout calls signOut and resets navigation', async () => {
    useNavStore.setState({ appView: 'stagger' })
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

  it('Sound Design shows in the admin env and hides outside it', async () => {
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    const { unmount } = render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('button', { name: /Sound Design/i })).toBeInTheDocument()
    unmount()

    vi.mocked(config.isAdminEnv).mockReturnValue(false)
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.queryByRole('button', { name: /Sound Design/i })).not.toBeInTheDocument()
  })

  it('Erase My Data is shown regardless of admin env — to players and guests alike', async () => {
    vi.mocked(config.isAdminEnv).mockReturnValue(false)
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    const { unmount } = render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(await screen.findByRole('button', { name: /Erase My Data/i })).toBeInTheDocument()
    unmount()

    mockGuest()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(await screen.findByRole('button', { name: /Erase My Data/i })).toBeInTheDocument()
  })

  it('Erase My Data opens a confirmation modal defaulting to the in-game (non-destructive) option', async () => {
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Erase My Data/i }))

    // Modal is up with the irreversibility warning + both options; nothing fired.
    expect(screen.getByRole('dialog', { name: /erase my data/i })).toBeInTheDocument()
    expect(screen.getByText(/permanent and can.t be undone/i)).toBeInTheDocument()
    const ingame = screen.getByRole('radio', { name: /Erase my In-Game Data/i }) as HTMLInputElement
    const account = screen.getByRole('radio', { name: /Erase my Account/i }) as HTMLInputElement
    expect(ingame.checked).toBe(true)   // safe default
    expect(account.checked).toBe(false)
    expect(api.eraseStaggerRecords).not.toHaveBeenCalled()
    expect(api.deleteOwnAccount).not.toHaveBeenCalled()
  })

  it('in-game scope wipes only the game records, keeps the account, and confirms', async () => {
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Erase My Data/i }))
    await user.click(screen.getByRole('button', { name: /^Erase$/i }))

    expect(api.eraseStaggerRecords).toHaveBeenCalledTimes(1)
    expect(api.deleteOwnAccount).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()   // account survives
    expect(await screen.findByText(/in-game data has been erased/i)).toBeInTheDocument()
  })

  it('account scope deletes the account, signs out, and returns to the auth screen', async () => {
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Erase My Data/i }))
    await user.click(screen.getByRole('radio', { name: /Erase my Account/i }))
    await user.click(screen.getByRole('button', { name: /^Erase$/i }))

    expect(api.deleteOwnAccount).toHaveBeenCalledTimes(1)
    expect(api.eraseStaggerRecords).not.toHaveBeenCalled()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(useNavStore.getState().appView).toBe('auth')
  })

  it('Cancel closes the Erase My Data modal without erasing anything', async () => {
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Erase My Data/i }))
    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(screen.queryByRole('dialog', { name: /erase my data/i })).not.toBeInTheDocument()
    expect(api.eraseStaggerRecords).not.toHaveBeenCalled()
    expect(api.deleteOwnAccount).not.toHaveBeenCalled()
  })
})
