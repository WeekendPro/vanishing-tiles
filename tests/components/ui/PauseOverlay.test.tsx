import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PauseOverlay } from '../../../src/components/ui'
import { useSettingsStore } from '../../../src/store/settingsStore'

beforeEach(() => {
  localStorage.clear()
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy', soundEnabled: true, sfxVolume: 1 } })
})

describe('PauseOverlay', () => {
  it('shows Resume/Exit and the Sound FX control (toggle + volume)', () => {
    render(<PauseOverlay onResume={() => {}} onExit={() => {}} />)
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exit to Home/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sound FX: On/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /Sound FX volume/i })).toBeInTheDocument()
  })

  it('toggling sound from the pause screen persists the setting', async () => {
    const user = userEvent.setup()
    render(<PauseOverlay onResume={() => {}} onExit={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Sound FX: On/i }))
    expect(useSettingsStore.getState().settings.soundEnabled).toBe(false)
    expect(screen.getByRole('button', { name: /Sound FX: Off/i })).toBeInTheDocument()
    // Volume slider disables while the channel is off.
    expect(screen.getByRole('slider', { name: /Sound FX volume/i })).toBeDisabled()
  })

  it('volume changes from the pause screen persist', () => {
    render(<PauseOverlay onResume={() => {}} onExit={() => {}} />)
    const slider = screen.getByRole('slider', { name: /Sound FX volume/i })
    fireEvent.change(slider, { target: { value: '40' } })
    expect(useSettingsStore.getState().settings.sfxVolume).toBeCloseTo(0.4)
  })

  it('Resume and Exit fire their callbacks', async () => {
    const onResume = vi.fn()
    const onExit = vi.fn()
    const user = userEvent.setup()
    render(<PauseOverlay onResume={onResume} onExit={onExit} />)
    await user.click(screen.getByRole('button', { name: /Resume/i }))
    await user.click(screen.getByRole('button', { name: /Exit to Home/i }))
    expect(onResume).toHaveBeenCalledTimes(1)
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
