import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountUp } from '../../src/hooks/useCountUp'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCountUp', () => {
  it('starts at 0', () => {
    const { result } = renderHook(() => useCountUp(1000, 500))
    expect(result.current).toBe(0)
  })

  it('reaches the target value by the end of the duration', () => {
    const { result } = renderHook(() => useCountUp(1000, 500))
    act(() => {
      vi.advanceTimersByTime(600)  // past the 500ms duration
    })
    expect(result.current).toBe(1000)
  })

  it('progresses monotonically', () => {
    const { result } = renderHook(() => useCountUp(1000, 500))
    const samples: number[] = []
    for (let t = 0; t <= 500; t += 100) {
      act(() => { vi.advanceTimersByTime(100) })
      samples.push(result.current)
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1])
    }
  })

  it('immediately returns target when duration is 0', () => {
    const { result } = renderHook(() => useCountUp(500, 0))
    act(() => { vi.advanceTimersByTime(0) })
    expect(result.current).toBe(500)
  })

  it('restarts when the target value changes', () => {
    const { result, rerender } = renderHook(({ target }) => useCountUp(target, 500), {
      initialProps: { target: 100 },
    })
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current).toBe(100)
    rerender({ target: 500 })
    expect(result.current).toBe(0)
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current).toBe(500)
  })
})
