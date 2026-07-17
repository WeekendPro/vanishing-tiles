import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/auth', () => ({
  getUser: vi.fn().mockResolvedValue({
    data: { user: { email: 'luis@example.com', is_anonymous: false, user_metadata: {} } },
  }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}))

import { SoundDesignScreen } from '../../src/components/SoundDesignScreen'
import { useNavStore } from '../../src/store/navStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import { useSoundLabStore } from '../../src/store/soundLabStore'
import { sfx } from '../../src/lib/sfx'

beforeEach(() => {
  localStorage.clear()
  useNavStore.getState().reset()
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy', soundEnabled: true, sfxVolume: 1, hideDemo: false } })
  useSoundLabStore.setState({ overrides: {}, presets: [] })
  useSoundLabStore.getState().resetAll()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SoundDesignScreen', () => {
  it('lists every game sound and the SFX channel control (music is gone)', () => {
    render(<SoundDesignScreen />)
    expect(screen.getByText('Sound Design')).toBeInTheDocument()
    expect(screen.getByText('Correct choice')).toBeInTheDocument()
    expect(screen.getByText('Incorrect choice')).toBeInTheDocument()
    expect(screen.getByText('Round complete')).toBeInTheDocument()
    expect(screen.getByText('Game over')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /Sound FX volume/i })).toBeInTheDocument()
    // The synth music bed was cut — no bed card, no music channel.
    expect(screen.queryByText(/Ambient bed/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: /Music volume/i })).not.toBeInTheDocument()
  })

  it('▶ replays a sound through the engine with its preview context', async () => {
    const preview = vi.spyOn(sfx, 'previewOneShot').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<SoundDesignScreen />)
    await user.click(screen.getByRole('button', { name: /Play Correct choice/i }))
    expect(preview).toHaveBeenCalledWith('pickCorrect', { streak: 1 })
  })

  it('expanding a sound exposes its layer knobs', async () => {
    const user = userEvent.setup()
    render(<SoundDesignScreen />)
    await user.click(screen.getByRole('button', { name: /Expand Incorrect choice/i }))
    expect(screen.getAllByText(/Pitch \(Hz\)/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Loudness/i).length).toBeGreaterThan(0)
    // The default miss buzz is two layers, each removable — robustness knobs exist.
    expect(screen.getByText(/Layer 2/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+ tone layer/i })).toBeInTheDocument()
  })

  it('saving a labeled preset lands in the lab store', async () => {
    const user = userEvent.setup()
    render(<SoundDesignScreen />)
    await user.click(screen.getByRole('button', { name: /Expand Round complete/i }))
    await user.type(screen.getByRole('textbox', { name: /batchClear preset label/i }), 'triumphant v2')
    await user.click(screen.getByRole('button', { name: /Save batchClear preset/i }))
    const presets = useSoundLabStore.getState().presets
    expect(presets).toHaveLength(1)
    expect(presets[0]).toMatchObject({ label: 'triumphant v2', soundId: 'batchClear' })
  })

  it('⟳ loops a sound until toggled off', async () => {
    // Fake ONLY timeout timers, and drive clicks with the synchronous
    // fireEvent — user-event's internal waits deadlock under fake timers.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const preview = vi.spyOn(sfx, 'previewOneShot').mockImplementation(() => {})
    render(<SoundDesignScreen />)

    const loop = screen.getByRole('button', { name: /Loop Correct choice/i })
    fireEvent.click(loop)
    expect(loop).toHaveAttribute('aria-pressed', 'true')
    expect(preview.mock.calls.length).toBeGreaterThanOrEqual(1) // fires immediately…
    const afterStart = preview.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(preview.mock.calls.length).toBeGreaterThan(afterStart) // …then keeps cycling

    fireEvent.click(loop) // toggle off
    expect(loop).toHaveAttribute('aria-pressed', 'false')
    const callsWhenStopped = preview.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(preview.mock.calls.length).toBe(callsWhenStopped)
  })

  it('Home navigates back', async () => {
    useNavStore.setState({ appView: 'soundDesign' })
    const user = userEvent.setup()
    render(<SoundDesignScreen />)
    await user.click(screen.getByRole('button', { name: /← Home/i }))
    expect(useNavStore.getState().appView).toBe('home')
  })
})
