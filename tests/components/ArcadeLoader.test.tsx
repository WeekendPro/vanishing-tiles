import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ArcadeLoader } from '../../src/components/ArcadeLoader'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('ArcadeLoader', () => {
  it('renders nothing when inactive', () => {
    render(<ArcadeLoader active={false} />)
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.queryByTestId('arcade-loader')).toBeNull()
  })

  it('does not paint before the show-delay elapses', () => {
    render(<ArcadeLoader active />)
    act(() => { vi.advanceTimersByTime(119) })
    expect(screen.queryByTestId('arcade-loader')).toBeNull()
  })

  it('paints after the 120ms show-delay while active', () => {
    render(<ArcadeLoader active />)
    act(() => { vi.advanceTimersByTime(120) })
    const overlay = screen.getByTestId('arcade-loader')
    expect(overlay).toBeInTheDocument()
    expect(screen.getByText('LOADING')).toBeInTheDocument()
  })

  it('disappears when active flips back to false', () => {
    const { rerender } = render(<ArcadeLoader active />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('arcade-loader')).toBeInTheDocument()
    rerender(<ArcadeLoader active={false} />)
    act(() => { vi.advanceTimersByTime(0) })
    expect(screen.queryByTestId('arcade-loader')).toBeNull()
  })
})
