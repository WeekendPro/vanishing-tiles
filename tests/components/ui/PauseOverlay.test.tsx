import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PauseOverlay } from '../../../src/components/ui'
import { useSettingsStore } from '../../../src/store/settingsStore'

beforeEach(() => {
  localStorage.clear()
  useSettingsStore.setState({ settings: { difficulty: 'easy', soundEnabled: true, sfxVolume: 1, hideDemo: false } })
})

describe('PauseOverlay', () => {
  it('shows Resume/Exit and the Sound control (toggle switch + volume)', () => {
    render(<PauseOverlay onResume={() => {}} onExit={() => {}} />)
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exit to Home/i })).toBeInTheDocument()
    const sw = screen.getByRole('switch', { name: /Sound/i })
    expect(sw).toBeInTheDocument()
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('slider', { name: /Sound volume/i })).toBeInTheDocument()
  })

  it('toggling sound from the pause screen persists the setting', async () => {
    const user = userEvent.setup()
    render(<PauseOverlay onResume={() => {}} onExit={() => {}} />)
    await user.click(screen.getByRole('switch', { name: /Sound/i }))
    expect(useSettingsStore.getState().settings.soundEnabled).toBe(false)
    expect(screen.getByRole('switch', { name: /Sound/i })).toHaveAttribute('aria-checked', 'false')
    // Volume slider disables while the channel is off.
    expect(screen.getByRole('slider', { name: /Sound volume/i })).toBeDisabled()
  })

  it('volume changes from the pause screen persist', () => {
    render(<PauseOverlay onResume={() => {}} onExit={() => {}} />)
    const slider = screen.getByRole('slider', { name: /Sound volume/i })
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
