import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The sfx engine speaks pure Web Audio, which jsdom doesn't provide — so these
 * tests install a minimal fake AudioContext and assert the engine's CONTRACT:
 * lazy context creation, the enabled gate, gesture unlock/resume, and the
 * musical rules the game leans on (streak pitch climb, bloom melody ascent).
 * The module holds its context in module state, so each test re-imports fresh.
 */

class FakeParam {
  values: number[] = []
  value = 0
  setValueAtTime(v: number) { this.values.push(v); this.value = v; return this }
  exponentialRampToValueAtTime(v: number) { this.values.push(v); return this }
}

class FakeNode {
  connected: unknown[] = []
  connect(target: unknown) { this.connected.push(target); return target }
}

class FakeOscillator extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  started = false
  stopped = false
  start() { this.started = true }
  stop() { this.stopped = true }
}

class FakeGain extends FakeNode {
  gain = new FakeParam()
}

class FakeFilter extends FakeNode {
  type = 'lowpass'
  frequency = new FakeParam()
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  filters: FakeFilter[] = []
  destination = new FakeNode()
  currentTime = 0
  state = 'suspended'
  resumeCalls = 0
  constructor() { FakeAudioContext.instances.push(this) }
  resume() { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve() }
  createOscillator() { const o = new FakeOscillator(); this.oscillators.push(o); return o }
  createGain() { const g = new FakeGain(); this.gains.push(g); return g }
  createBiquadFilter() { const f = new FakeFilter(); this.filters.push(f); return f }
}

async function freshSfx() {
  vi.resetModules()
  FakeAudioContext.instances = []
  ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext
  const { sfx } = await import('../../src/lib/sfx')
  return sfx
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('sfx engine', () => {
  it('creates no context until a sound (or unlock) needs one, then reuses it', async () => {
    const sfx = await freshSfx()
    expect(FakeAudioContext.instances).toHaveLength(0)
    sfx.uiTap()
    expect(FakeAudioContext.instances).toHaveLength(1)
    sfx.pickCorrect(1)
    sfx.batchClear()
    expect(FakeAudioContext.instances).toHaveLength(1)
  })

  it('unlock() spins up and resumes the context (the PLAY-tap gesture)', async () => {
    const sfx = await freshSfx()
    sfx.unlock()
    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(FakeAudioContext.instances[0].resumeCalls).toBeGreaterThan(0)
    expect(FakeAudioContext.instances[0].state).toBe('running')
  })

  it('plays nothing while disabled, and disabled unlock() creates no context', async () => {
    const sfx = await freshSfx()
    sfx.setEnabled(false)
    sfx.unlock()
    sfx.pickCorrect(3)
    sfx.pickWrong()
    sfx.gameOver()
    expect(FakeAudioContext.instances).toHaveLength(0)
    sfx.setEnabled(true)
    sfx.pickWrong()
    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(FakeAudioContext.instances[0].oscillators.length).toBeGreaterThan(0)
  })

  it('every oscillator is started and scheduled to stop', async () => {
    const sfx = await freshSfx()
    sfx.batchClear()
    const ctx = FakeAudioContext.instances[0]
    expect(ctx.oscillators.length).toBeGreaterThan(0)
    ctx.oscillators.forEach(o => {
      expect(o.started).toBe(true)
      expect(o.stopped).toBe(true)
    })
  })

  it('pickCorrect pitch climbs with the streak and resets with it', async () => {
    const sfx = await freshSfx()
    const fundamentalOf = (call: () => void) => {
      const ctx = FakeAudioContext.instances[0]
      const before = ctx?.oscillators.length ?? 0
      call()
      return FakeAudioContext.instances[0].oscillators[before].frequency.values[0]
    }
    const atStreak1 = fundamentalOf(() => sfx.pickCorrect(1))
    const atStreak5 = fundamentalOf(() => sfx.pickCorrect(5))
    const backTo1 = fundamentalOf(() => sfx.pickCorrect(1))
    expect(atStreak5).toBeGreaterThan(atStreak1)
    expect(backTo1).toBe(atStreak1) // broken streak audibly restarts at the root
    // The climb caps an octave up — deep streaks never go shrill.
    const atStreak99 = fundamentalOf(() => sfx.pickCorrect(99))
    expect(atStreak99).toBeLessThanOrEqual(atStreak1 * 2)
  })

  it('bloom melody rises with the reveal step and stays capped', async () => {
    const sfx = await freshSfx()
    const ctx = () => FakeAudioContext.instances[0]
    sfx.bloom(0)
    const first = ctx().oscillators[0].frequency.values[0]
    const before = ctx().oscillators.length
    sfx.bloom(3)
    const later = ctx().oscillators[before].frequency.values[0]
    expect(later).toBeGreaterThan(first)
    // Step 11 (the 12-gap cap batch) stays within two octaves of the root.
    const beforeDeep = ctx().oscillators.length
    sfx.bloom(11)
    const deep = ctx().oscillators[beforeDeep].frequency.values[0]
    expect(deep).toBeLessThanOrEqual(first * 4)
  })

  it('no-ops safely where Web Audio does not exist (jsdom default)', async () => {
    vi.resetModules()
    delete (window as unknown as { AudioContext?: unknown }).AudioContext
    const { sfx } = await import('../../src/lib/sfx')
    expect(() => {
      sfx.unlock()
      sfx.pickCorrect(2)
      sfx.timeout()
    }).not.toThrow()
  })
})
