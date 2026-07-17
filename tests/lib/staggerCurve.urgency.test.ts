import { describe, it, expect } from 'vitest'
import { CLOCK_URGENT, urgentHeat, urgentTickIntervalMs, selectDurationForBatch } from '../../src/lib/staggerCurve'

/**
 * The select clock's urgency window: the ticker starts when remaining time
 * crosses CLOCK_URGENT.FRACTION (the same threshold that flips the timer bar
 * red) and accelerates from TICK_MAX_MS to TICK_MIN_MS as the clock expires.
 */
describe('clock urgency window', () => {
  it('heat is 0 at (and above) the threshold, 1 at expiry, clamped', () => {
    expect(urgentHeat(CLOCK_URGENT.FRACTION)).toBe(0)
    expect(urgentHeat(1)).toBe(0)      // plenty of time left → no heat
    expect(urgentHeat(0)).toBe(1)      // clock expiring → full heat
    expect(urgentHeat(-0.1)).toBe(1)   // never overshoots past 1
  })

  it('heat rises monotonically as remaining time falls through the window', () => {
    const halfway = urgentHeat(CLOCK_URGENT.FRACTION / 2)
    expect(halfway).toBeGreaterThan(0)
    expect(halfway).toBeLessThan(1)
    expect(urgentHeat(CLOCK_URGENT.FRACTION / 4)).toBeGreaterThan(halfway)
  })

  it('tick interval accelerates from MAX to MIN across the window, clamped', () => {
    expect(urgentTickIntervalMs(0)).toBe(CLOCK_URGENT.TICK_MAX_MS)
    expect(urgentTickIntervalMs(1)).toBe(CLOCK_URGENT.TICK_MIN_MS)
    expect(urgentTickIntervalMs(-1)).toBe(CLOCK_URGENT.TICK_MAX_MS)
    expect(urgentTickIntervalMs(2)).toBe(CLOCK_URGENT.TICK_MIN_MS)
    const mid = urgentTickIntervalMs(0.5)
    expect(mid).toBeLessThan(CLOCK_URGENT.TICK_MAX_MS)
    expect(mid).toBeGreaterThan(CLOCK_URGENT.TICK_MIN_MS)
  })

  it('the urgency window is comfortably longer than one tick, even on the tightest clock', () => {
    // The endless tail's floor (batch 60+) is the shortest select clock a
    // player ever sees; its red zone must still fit several ticks or the
    // accelerando never reads as one.
    const tightest = selectDurationForBatch(999) * CLOCK_URGENT.FRACTION
    expect(tightest).toBeGreaterThan(CLOCK_URGENT.TICK_MAX_MS * 3)
  })
})
