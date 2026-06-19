import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/auth', () => ({
  getUser: vi.fn().mockResolvedValue({
    data: { user: { email: 'luis@example.com', is_anonymous: false, user_metadata: {} } },
  }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}))
import * as auth from '../../src/lib/auth'
import { GlobalMenu } from '../../src/components/GlobalMenu'
import { useNavStore } from '../../src/store/navStore'
import { useGameStore } from '../../src/store/gameStore'
import { useSettingsStore } from '../../src/store/settingsStore'

beforeEach(() => {
  useNavStore.getState().reset()
  useGameStore.getState().resetGame()
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy' } })
  vi.clearAllMocks()
})

describe('GlobalMenu', () => {
  it('is simplified to Settings / Reset Journey / Logout (no modes or maps)', async () => {
    useNavStore.setState({ appView: 'journey' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('button', { name: /Settings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reset Journey/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Logout/i })).toBeInTheDocument()
    // Game modes and map styles now live on the Home landing page, not the menu.
    expect(screen.queryByRole('button', { name: /Training Mode/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Infinite Stagger/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Subway Map/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Git Map/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument()
  })

  it('in game shows Resume + Quit and pauses on open, resumes on Resume', async () => {
    useNavStore.setState({ appView: 'practice' })
    useGameStore.setState({ phase: 'viewing', phaseStartTime: Date.now(), phaseDuration: 10000 })
    const user = userEvent.setup()
    render(<GlobalMenu />)

    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(useGameStore.getState().paused).toBe(true)
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exit Training Mode/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Resume/i }))
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('Exit resets the game and navigates to Home', async () => {
    useNavStore.setState({ appView: 'practice' })
    useGameStore.setState({ phase: 'viewing', round: 4 })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Exit Training Mode/i }))
    expect(useNavStore.getState().appView).toBe('home')
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('Logout calls signOut and resets navigation', async () => {
    useNavStore.setState({ appView: 'journey' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Logout/i }))
    expect(auth.signOut).toHaveBeenCalledTimes(1)
  })
})
