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
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy' } })
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

  it('hides the Experimental Modes entry (and its modes) for now', () => {
    render(<HomeScreen />)
    expect(screen.queryByRole('button', { name: 'Experimental Modes' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Training/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Subway Map/i })).toBeNull()
  })

  it('defaults the difficulty selector to Easy', () => {
    render(<HomeScreen />)
    expect(screen.getByRole('button', { name: 'Easy', pressed: true })).toBeTruthy()
  })

  it('selecting Medium / Hard updates the difficulty setting', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Medium' }))
    expect(useSettingsStore.getState().settings.difficulty).toBe('medium')
    await user.click(screen.getByRole('button', { name: 'Hard' }))
    expect(useSettingsStore.getState().settings.difficulty).toBe('hard')
  })

  it('does not offer Logout — that lives in the global menu', () => {
    render(<HomeScreen />)
    expect(screen.queryByRole('button', { name: /Logout/i })).toBeNull()
  })
})
