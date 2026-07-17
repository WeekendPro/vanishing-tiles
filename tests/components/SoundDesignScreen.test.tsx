import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy', soundEnabled: true, sfxVolume: 1, musicEnabled: true, musicVolume: 0.6 } })
  useSoundLabStore.setState({ overrides: {}, bedOverride: null, presets: [] })
  useSoundLabStore.getState().resetAll()
  vi.restoreAllMocks()
})

describe('SoundDesignScreen', () => {
  it('lists every game sound plus the ambient bed and both channel controls', () => {
    render(<SoundDesignScreen />)
    expect(screen.getByText('Sound Design')).toBeInTheDocument()
    expect(screen.getByText('Ambient bed (music)')).toBeInTheDocument()
    expect(screen.getByText('Correct choice')).toBeInTheDocument()
    expect(screen.getByText('Incorrect choice')).toBeInTheDocument()
    expect(screen.getByText('Round complete')).toBeInTheDocument()
    expect(screen.getByText('Game over')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /Sound FX volume/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /Music volume/i })).toBeInTheDocument()
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

  it('Home stops any bed preview and navigates back', async () => {
    const stop = vi.spyOn(sfx, 'stopBed')
    useNavStore.setState({ appView: 'soundDesign' })
    const user = userEvent.setup()
    render(<SoundDesignScreen />)
    await user.click(screen.getByRole('button', { name: /← Home/i }))
    expect(stop).toHaveBeenCalled()
    expect(useNavStore.getState().appView).toBe('home')
  })
})
