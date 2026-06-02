import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TrickleBar } from '../../src/components/TrickleBar'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('TrickleBar', () => {
  it('renders nothing before the show-delay elapses', () => {
    render(<TrickleBar active />)
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
    act(() => { vi.advanceTimersByTime(119) })
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })

  it('appears after the 120ms delay while active', () => {
    render(<TrickleBar active />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('trickle-bar')).toBeInTheDocument()
  })

  it('does not flash for a call that resolves within the delay', () => {
    const { rerender } = render(<TrickleBar active />)
    act(() => { vi.advanceTimersByTime(80) })
    rerender(<TrickleBar active={false} />)
    act(() => { vi.advanceTimersByTime(600) })
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })

  it('snaps to 100% then unmounts after active turns false', () => {
    const { rerender } = render(<TrickleBar active />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('trickle-bar')).toBeInTheDocument()
    rerender(<TrickleBar active={false} />)
    expect(screen.getByTestId('trickle-bar')).toHaveStyle({ width: '100%' })
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })
})
