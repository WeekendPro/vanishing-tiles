import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * The haptics engine is the tactile twin of sfx: semantic game gestures
 * (`pickCorrect`, `bloom`, …) fired at `navigator.vibrate`. jsdom has no
 * Vibration API, so these tests install a fake `navigator.vibrate` and assert
 * the engine's CONTRACT: the platform/channel gates (mirroring iOS's total
 * absence + the settings mute), the per-gesture patterns, the streak/heat
 * scaling, backgrounding, and clean no-op degradation. The module holds its
 * on/off flag in module state, so each test re-imports fresh.
 */

type VibrateArg = number | number[]

async function freshHaptics(withVibrate = true) {
  vi.resetModules()
  const calls: VibrateArg[] = []
  if (withVibrate) {
    ;(navigator as Navigator & { vibrate?: unknown }).vibrate = (p: VibrateArg) => { calls.push(p); return true }
  } else {
    delete (navigator as Navigator & { vibrate?: unknown }).vibrate
  }
  const mod = await import('../../src/lib/haptics')
  return { ...mod, calls }
}

beforeEach(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (navigator as Navigator & { vibrate?: unknown }).vibrate
})

describe('haptics engine', () => {
  it('reports support from the presence of navigator.vibrate', async () => {
    const on = await freshHaptics(true)
    expect(on.haptics.isSupported()).toBe(true)
    const off = await freshHaptics(false)
    expect(off.haptics.isSupported()).toBe(false)
  })

  it('fires the authored pattern for each gesture when enabled + supported', async () => {
    const { haptics, calls, HAPTIC_PATTERNS } = await freshHaptics()
    haptics.uiTap()
    haptics.pickWrong()
    haptics.batchClear()
    haptics.timeout()
    haptics.gameOver()
    expect(calls).toEqual([
      HAPTIC_PATTERNS.uiTap,
      HAPTIC_PATTERNS.pickWrong,
      HAPTIC_PATTERNS.batchClear,
      HAPTIC_PATTERNS.timeout,
      HAPTIC_PATTERNS.gameOver,
    ])
  })

  it('buzzes nothing while the channel is disabled, and resumes when re-enabled', async () => {
    const { haptics, calls } = await freshHaptics()
    haptics.setEnabled(false)
    haptics.uiTap()
    haptics.pickCorrect(5)
    haptics.gameOver()
    expect(calls).toHaveLength(0)
    haptics.setEnabled(true)
    haptics.uiTap()
    expect(calls).toHaveLength(1)
  })

  it('no-ops safely (no throw, no call) where the Vibration API is absent — every iOS device today', async () => {
    const { haptics, calls } = await freshHaptics(false)
    expect(() => {
      haptics.uiTap()
      haptics.pickCorrect(3)
      haptics.go()
      haptics.bloom()
      haptics.timeout()
      haptics.cancel()
    }).not.toThrow()
    expect(calls).toHaveLength(0)
  })

  it('does not vibrate while the page is backgrounded (no buzzing a pocketed phone)', async () => {
    const { haptics, calls } = await freshHaptics()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    haptics.pickCorrect(1)
    haptics.bloom()
    expect(calls).toHaveLength(0)
  })

  it('survives a browser that rejects the vibration (blocked / no activation)', async () => {
    vi.resetModules()
    ;(navigator as Navigator & { vibrate?: unknown }).vibrate = () => { throw new Error('blocked') }
    const { haptics } = await import('../../src/lib/haptics')
    expect(() => haptics.uiTap()).not.toThrow()
  })

  it('pickCorrect grows with the streak and caps (the tactile echo of the coin climb)', async () => {
    const { haptics, calls } = await freshHaptics()
    haptics.pickCorrect(1)
    haptics.pickCorrect(4)
    haptics.pickCorrect(99)
    const [s1, s4, s99] = calls as number[]
    expect(s4).toBeGreaterThan(s1)
    expect(s99).toBeGreaterThanOrEqual(s4)
    expect(s99).toBeLessThanOrEqual(26) // capped — a deep streak never becomes a long rumble
    // A broken streak resets the feel to the root, exactly like the sound.
    haptics.pickCorrect(1)
    expect((calls as number[])[3]).toBe(s1)
  })

  it('urgentTick winds up with heat and caps at the expiry jolt', async () => {
    const { haptics, calls } = await freshHaptics()
    haptics.urgentTick(0)
    haptics.urgentTick(0.5)
    haptics.urgentTick(1)
    haptics.urgentTick(5) // out-of-range clamps, never runs away
    const [cold, warm, hot, over] = calls as number[]
    expect(cold).toBe(8)
    expect(warm).toBeGreaterThan(cold)
    expect(hot).toBeGreaterThan(warm)
    expect(hot).toBe(22)
    expect(over).toBe(hot)
  })

  it('cancel() stops any in-progress pattern via vibrate(0)', async () => {
    const { haptics, calls } = await freshHaptics()
    haptics.cancel()
    expect(calls).toEqual([0])
  })

  it('exposes stable pattern shapes for the felt gestures', async () => {
    const { HAPTIC_PATTERNS } = await freshHaptics()
    // A single miss/timeout is one strong pulse or a jarring array; celebrations
    // are multi-pulse. Spot-check the load-bearing few.
    expect(HAPTIC_PATTERNS.uiTap).toBe(8)
    expect(HAPTIC_PATTERNS.timeout).toBe(70)
    expect(Array.isArray(HAPTIC_PATTERNS.pickWrong)).toBe(true)
    expect(Array.isArray(HAPTIC_PATTERNS.batchClear)).toBe(true)
    expect(Array.isArray(HAPTIC_PATTERNS.gameOver)).toBe(true)
  })
})
