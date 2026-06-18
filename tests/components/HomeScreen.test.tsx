import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/auth', () => ({
  signOut: vi.fn().mockResolvedValue({ error: null }),
}))
import { HomeScreen } from '../../src/components/HomeScreen'
import { useNavStore } from '../../src/store/navStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import { useStaggerStore } from '../../src/store/staggerStore'

beforeEach(() => {
  useNavStore.getState().reset()
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit' } })
  useStaggerStore.getState().exit()
  vi.clearAllMocks()
})

describe('HomeScreen', () => {
  it('Play drops into Infinite Stagger', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: /Play/i }))
    expect(useNavStore.getState().appView).toBe('stagger')
    expect(useStaggerStore.getState().phase).toBe('countdown')
  })

  it('Training opens the practice gauntlet', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Experimental Modes' }))
    await user.click(screen.getByRole('button', { name: /Training/i }))
    expect(useNavStore.getState().appView).toBe('practice')
  })

  it('Subway Map selects the transit map and opens the journey', async () => {
    const user = userEvent.setup()
    useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'git' } })
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Experimental Modes' }))
    await user.click(screen.getByRole('button', { name: /Subway Map/i }))
    expect(useSettingsStore.getState().settings.mapStyle).toBe('transit')
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('Mind Map selects the mentalBrain map and opens the journey', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Experimental Modes' }))
    await user.click(screen.getByRole('button', { name: /Mind Map/i }))
    expect(useSettingsStore.getState().settings.mapStyle).toBe('mentalBrain')
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('Git Map selects the git map and opens the journey', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Experimental Modes' }))
    await user.click(screen.getByRole('button', { name: /Git Map/i }))
    expect(useSettingsStore.getState().settings.mapStyle).toBe('git')
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('does not offer Logout — that lives in the global menu', () => {
    render(<HomeScreen />)
    expect(screen.queryByRole('button', { name: /Logout/i })).toBeNull()
  })
})
