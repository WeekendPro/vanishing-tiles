import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { GlobalLoadingOverlay } from '../../src/components/GlobalLoadingOverlay'
import { useAsyncStatus } from '../../src/store/asyncStatus'

beforeEach(() => { vi.useFakeTimers(); useAsyncStatus.setState({ pending: 0 }) })
afterEach(() => { vi.useRealTimers() })

describe('GlobalLoadingOverlay', () => {
  it('shows nothing when idle', () => {
    render(<GlobalLoadingOverlay />)
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByTestId('arcade-loader')).toBeNull()
  })

  it('shows the arcade loader when async work is pending', () => {
    render(<GlobalLoadingOverlay />)
    act(() => { useAsyncStatus.setState({ pending: 1 }) })
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('arcade-loader')).toBeInTheDocument()
  })
})
