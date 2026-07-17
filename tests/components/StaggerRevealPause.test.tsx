import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../../src/lib/api', () => ({
  submitStaggerRun: vi.fn().mockResolvedValue({}),
  getOwnProfile: vi.fn().mockResolvedValue({ displayName: 'NeonRider', isGuest: false }),
  setDisplayName: vi.fn(),
}))
import { StaggerScreen } from '../../src/components/StaggerScreen'
import { useStaggerStore } from '../../src/store/staggerStore'
import { useNavStore } from '../../src/store/navStore'
import { STAGGER } from '../../src/lib/staggerCurve'

// One full reveal takes 350ms breath + a step per gap + the final decay tail;
// generously past that, the driver must have handed off to selecting.
const REVEAL_OVERSHOOT_MS = 20000

beforeEach(() => {
  vi.useFakeTimers()
  useNavStore.setState({ appView: 'stagger' })
  const st = useStaggerStore.getState()
  st.startRun('easy')
  st.beginReveal()
})

afterEach(() => {
  vi.useRealTimers()
  useStaggerStore.getState().exit()
})

describe('StaggerScreen memorize-phase pause', () => {
  it('shows the pause button and a concealed tray (no clickable pieces) during the reveal', () => {
    render(<StaggerScreen />)
    expect(useStaggerStore.getState().phase).toBe('reveal')
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    // The tray panel is up for layout, but its sockets are empty: no piece options.
    expect(screen.getByText('Pieces')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-piece-option]')).toHaveLength(0)
  })

  it('freezes the reveal while paused and hands off to selecting after resume', () => {
    render(<StaggerScreen />)

    // Let the reveal get one gap in, then pause via the real button.
    act(() => { vi.advanceTimersByTime(350 + STAGGER.REVEAL_STEP_MS) })
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(useStaggerStore.getState().paused).toBe(true)
    expect(useStaggerStore.getState().phase).toBe('reveal')

    // Frozen: no amount of wall-clock reaches selecting while paused.
    act(() => { vi.advanceTimersByTime(REVEAL_OVERSHOOT_MS) })
    expect(useStaggerStore.getState().phase).toBe('reveal')

    // Resume (the overlay's button), then the rest of the sequence plays out
    // and hands off to the recall phase with a fresh full clock.
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    expect(useStaggerStore.getState().paused).toBe(false)
    act(() => { vi.advanceTimersByTime(REVEAL_OVERSHOOT_MS) })
    const s = useStaggerStore.getState()
    expect(s.phase).toBe('selecting')
    expect(s.paused).toBe(false)
    // And the tray is armed again: all seven piece options are clickable.
    expect(document.querySelectorAll('[data-piece-option]')).toHaveLength(7)
  })
})
