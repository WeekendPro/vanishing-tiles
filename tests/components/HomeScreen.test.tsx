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
import { useTrainingStore } from '../../src/store/trainingStore'

beforeEach(() => {
  useNavStore.getState().reset()
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy', soundEnabled: true, sfxVolume: 1, hideDemo: false } })
  useStaggerStore.getState().exit()
  useTrainingStore.getState().exit()
  vi.clearAllMocks()
})

describe('HomeScreen', () => {
  it('Play drops into Infinite Stagger, leading with the first-run demo', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(useNavStore.getState().appView).toBe('stagger')
    expect(useStaggerStore.getState().phase).toBe('demoIntro')
    expect(useStaggerStore.getState().demo).toBe(true)
  })

  it('Play skips the demo straight to the countdown once opted out', async () => {
    useSettingsStore.setState(s => ({ settings: { ...s.settings, hideDemo: true } }))
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(useStaggerStore.getState().phase).toBe('countdown')
    expect(useStaggerStore.getState().demo).toBe(false)
  })

  it('has no Training segment — the drill lives in the global menu now', () => {
    render(<HomeScreen />)
    expect(screen.queryByRole('button', { name: 'Training' })).toBeNull()
    expect(useTrainingStore.getState().active).toBe(false)
  })

  it('Play at a chosen difficulty starts Stagger in that mode', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Medium' }))
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(useNavStore.getState().appView).toBe('stagger')
    expect(useStaggerStore.getState().mode).toBe('medium')
  })

  it('the mode switch sits above Play', () => {
    render(<HomeScreen />)
    const easy = screen.getByRole('button', { name: 'Easy' })
    const play = screen.getByRole('button', { name: 'Play' })
    expect(easy.compareDocumentPosition(play) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('hides the Experimental Modes entry (and its modes) for now', () => {
    render(<HomeScreen />)
    expect(screen.queryByRole('button', { name: 'Experimental Modes' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Practice/i })).toBeNull()
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
