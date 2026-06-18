import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/auth', () => ({
  signOut: vi.fn().mockResolvedValue({ error: null }),
}))
import * as auth from '../../src/lib/auth'
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

  it('Training Mode opens the practice gauntlet', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: /Training Mode/i }))
    expect(useNavStore.getState().appView).toBe('practice')
  })

  it('Brain Mode selects the mentalBrain map and opens the journey', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: /Brain Mode/i }))
    expect(useSettingsStore.getState().settings.mapStyle).toBe('mentalBrain')
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('Git Mode selects the git map and opens the journey', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: /Git Mode/i }))
    expect(useSettingsStore.getState().settings.mapStyle).toBe('git')
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('Logout signs out and resets navigation', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: /Logout/i }))
    expect(auth.signOut).toHaveBeenCalledTimes(1)
  })
})
