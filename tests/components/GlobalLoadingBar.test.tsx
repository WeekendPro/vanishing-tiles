import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { GlobalLoadingBar } from '../../src/components/GlobalLoadingBar'
import { useAsyncStatus } from '../../src/store/asyncStatus'

beforeEach(() => { vi.useFakeTimers(); useAsyncStatus.setState({ pending: 0 }) })
afterEach(() => { vi.useRealTimers() })

describe('GlobalLoadingBar', () => {
  it('shows nothing when idle', () => {
    render(<GlobalLoadingBar />)
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })

  it('shows the trickle bar when async work is pending', () => {
    render(<GlobalLoadingBar />)
    act(() => { useAsyncStatus.setState({ pending: 1 }) })
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('trickle-bar')).toBeInTheDocument()
  })
})
