import { describe, it, expect } from 'vitest'
import { computeFitScale } from '../../src/components/ui/ScaleToFit'

describe('computeFitScale', () => {
  const designW = 384

  it('stays at 1 when the surface already fits (never enlarges)', () => {
    // Desktop: plenty of room in both axes → no scaling up.
    expect(computeFitScale({ availW: 1280, availH: 800, designW, naturalH: 713 })).toBe(1)
  })

  it('scales down by WIDTH on a narrow phone', () => {
    // iPhone 12 mini: 375 wide is the binding constraint (375/384 ≈ 0.977).
    const k = computeFitScale({ availW: 375, availH: 2000, designW, naturalH: 713 })
    expect(k).toBeCloseTo(375 / 384, 5)
    expect(k).toBeLessThan(1)
  })

  it('scales down by HEIGHT when the viewport is short', () => {
    // Tall-enough width but a short window → height binds (629/713 ≈ 0.882).
    const k = computeFitScale({ availW: 1000, availH: 629, designW, naturalH: 713 })
    expect(k).toBeCloseTo(629 / 713, 5)
  })

  it('picks the smaller (binding) of the two axes', () => {
    // Both axes constrained; the more severe one wins.
    const k = computeFitScale({ availW: 300, availH: 500, designW, naturalH: 713 })
    expect(k).toBeCloseTo(Math.min(300 / 384, 500 / 713), 5)
  })

  it('guards degenerate inputs (unmeasured content) by returning 1', () => {
    expect(computeFitScale({ availW: 375, availH: 629, designW, naturalH: 0 })).toBe(1)
    expect(computeFitScale({ availW: 0, availH: 0, designW, naturalH: 713 })).toBe(1)
  })
})
