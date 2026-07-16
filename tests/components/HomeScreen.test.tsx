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
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy', soundEnabled: true } })
  useStaggerStore.getState().exit()
  useTrainingStore.getState().exit()
  vi.clearAllMocks()
})

describe('HomeScreen', () => {
  it('Play drops into Infinite Stagger', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(useNavStore.getState().appView).toBe('stagger')
    expect(useStaggerStore.getState().phase).toBe('countdown')
  })

  it('Training is mode zero: select it, then Play drops into the piece-naming trainer', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Training' }))
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(useNavStore.getState().appView).toBe('training')
    expect(useTrainingStore.getState().active).toBe(true)
    expect(useTrainingStore.getState().piece).not.toBeNull()
    expect(useStaggerStore.getState().phase).toBe('idle')
  })

  it('selecting Training never overwrites the persisted difficulty', async () => {
    const user = userEvent.setup()
    useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'hard', soundEnabled: true } })
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Training' }))
    expect(screen.getByRole('button', { name: 'Training', pressed: true })).toBeTruthy()
    expect(useSettingsStore.getState().settings.difficulty).toBe('hard')
  })

  it('picking a difficulty deselects Training, and Play goes back to Stagger', async () => {
    const user = userEvent.setup()
    render(<HomeScreen />)
    await user.click(screen.getByRole('button', { name: 'Training' }))
    await user.click(screen.getByRole('button', { name: 'Medium' }))
    expect(screen.getByRole('button', { name: 'Training', pressed: false })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(useNavStore.getState().appView).toBe('stagger')
    expect(useStaggerStore.getState().mode).toBe('medium')
    expect(useTrainingStore.getState().active).toBe(false)
  })

  it('the mode switch sits above Play (single CTA pinned to the thumb arc)', () => {
    render(<HomeScreen />)
    const training = screen.getByRole('button', { name: 'Training' })
    const play = screen.getByRole('button', { name: 'Play' })
    expect(training.compareDocumentPosition(play) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
