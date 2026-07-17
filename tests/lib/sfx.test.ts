import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * The sfx engine speaks pure Web Audio, which jsdom doesn't provide — so these
 * tests install a minimal fake AudioContext and assert the engine's CONTRACT:
 * lazy context creation, the per-channel gates (SFX / music), gesture
 * unlock/resume, channel volumes, the ambient bed lifecycle, and the musical
 * rules the game leans on (streak pitch climb, bloom melody ascent, the
 * reveal's noise "shing"). The module holds its context in module state, so
 * each test re-imports fresh.
 */

class FakeParam {
  values: number[] = []
  value = 0
  setValueAtTime(v: number) { this.values.push(v); this.value = v; return this }
  exponentialRampToValueAtTime(v: number) { this.values.push(v); return this }
  linearRampToValueAtTime(v: number) { this.values.push(v); return this }
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
  Q = new FakeParam()
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null
  loop = false
  started = false
  stopped = false
  start() { this.started = true }
  stop() { this.stopped = true }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  filters: FakeFilter[] = []
  bufferSources: FakeBufferSource[] = []
  destination = new FakeNode()
  sampleRate = 44100
  currentTime = 0
  state = 'suspended'
  resumeCalls = 0
  constructor() { FakeAudioContext.instances.push(this) }
  resume() { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve() }
  createOscillator() { const o = new FakeOscillator(); this.oscillators.push(o); return o }
  createGain() { const g = new FakeGain(); this.gains.push(g); return g }
  createBiquadFilter() { const f = new FakeFilter(); this.filters.push(f); return f }
  createBufferSource() { const s = new FakeBufferSource(); this.bufferSources.push(s); return s }
  createBuffer(_ch: number, len: number) { return { getChannelData: () => new Float32Array(len) } }
}

async function freshSfx() {
  vi.resetModules()
  FakeAudioContext.instances = []
  ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext
  const { sfx } = await import('../../src/lib/sfx')
  return sfx
}

const ctx = () => FakeAudioContext.instances[0]

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
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
    expect(ctx().resumeCalls).toBeGreaterThan(0)
    expect(ctx().state).toBe('running')
  })

  it('plays no SFX while the channel is disabled', async () => {
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
    expect(ctx().oscillators.length).toBeGreaterThan(0)
  })

  it('every oscillator is started and scheduled to stop', async () => {
    const sfx = await freshSfx()
    sfx.batchClear()
    expect(ctx().oscillators.length).toBeGreaterThan(0)
    ctx().oscillators.forEach(o => {
      expect(o.started).toBe(true)
      expect(o.stopped).toBe(true)
    })
  })

  it('SFX volume lands on the bus, clamped to 0..1', async () => {
    const sfx = await freshSfx()
    sfx.unlock()
    // Bus creation order in context(): master, then sfxBus.
    const [, sfxBus] = ctx().gains
    sfx.setSfxVolume(0.25)
    expect(sfxBus.gain.value).toBe(0.25)
    sfx.setSfxVolume(7)
    expect(sfxBus.gain.value).toBe(1)
    sfx.setSfxVolume(-2)
    expect(sfxBus.gain.value).toBe(0)
  })

  it('pickCorrect pitch climbs with the streak and resets with it', async () => {
    const sfx = await freshSfx()
    const fundamentalOf = (call: () => void) => {
      const before = ctx()?.oscillators.length ?? 0
      call()
      return ctx().oscillators[before].frequency.values[0]
    }
    const atStreak1 = fundamentalOf(() => sfx.pickCorrect(1))
    const atStreak4 = fundamentalOf(() => sfx.pickCorrect(4))
    const backTo1 = fundamentalOf(() => sfx.pickCorrect(1))
    expect(atStreak4).toBeGreaterThan(atStreak1)
    expect(backTo1).toBe(atStreak1) // broken streak audibly restarts at the root
    // The climb caps two octaves up — deep streaks never go shrill.
    const atStreak99 = fundamentalOf(() => sfx.pickCorrect(99))
    expect(atStreak99).toBeLessThanOrEqual(atStreak1 * 4)
  })

  it('every 5th streak step adds the 1-Up-style milestone run', async () => {
    const sfx = await freshSfx()
    sfx.pickCorrect(4)
    const plain = ctx().oscillators.length
    const before = ctx().oscillators.length
    sfx.pickCorrect(5)
    const milestone = ctx().oscillators.length - before
    expect(milestone).toBeGreaterThan(plain) // the flourish rides on top of the coin blip
  })

  it('bloom pairs the rising pentatonic note with a noise "shing" sweep', async () => {
    const sfx = await freshSfx()
    sfx.bloom(0)
    const first = ctx().oscillators[0].frequency.values[0]
    expect(ctx().bufferSources.length).toBe(1) // the drawn-steel noise layer
    const sweep = ctx().filters.find(f => f.type === 'bandpass')!
    expect(sweep.frequency.values[1]).toBeGreaterThan(sweep.frequency.values[0]) // sweeps UP
    const beforeOsc = ctx().oscillators.length
    sfx.bloom(3)
    const later = ctx().oscillators[beforeOsc].frequency.values[0]
    expect(later).toBeGreaterThan(first)
    // Step 11 (the 12-gap cap batch) stays within two octaves of the root.
    const beforeDeep = ctx().oscillators.length
    sfx.bloom(11)
    const deep = ctx().oscillators[beforeDeep].frequency.values[0]
    expect(deep).toBeLessThanOrEqual(first * 4)
  })

  it('setPatch overrides what a gesture plays; resetPatch restores the default', async () => {
    const sfx = await freshSfx()
    sfx.setPatch('pickWrong', { layers: [{ kind: 'tone', freq: 505, dur: 0.1, gain: 0.1 }] })
    sfx.pickWrong()
    expect(ctx().oscillators).toHaveLength(1)
    expect(ctx().oscillators[0].frequency.values[0]).toBe(505)
    sfx.resetPatch('pickWrong')
    sfx.pickWrong()
    expect(ctx().oscillators.length).toBe(1 + 2) // default is the two-layer buzz
  })

  it('ships the lab-tuned bonusLift default (designer config, 2026-07-17)', async () => {
    const sfx = await freshSfx()
    sfx.bonusLift()
    const [riser, sparkle] = ctx().oscillators
    expect(riser.type).toBe('square')
    expect(riser.frequency.values[0]).toBe(396)
    expect(riser.frequency.values[1]).toBe(1817) // the glide target
    expect(sparkle.type).toBe('triangle')
    expect(sparkle.frequency.values[0]).toBe(2251)
  })

  it('previewOneShot honors gameplay context (streak transposes the coin)', async () => {
    const sfx = await freshSfx()
    sfx.previewOneShot('pickCorrect', { streak: 1 })
    const base = ctx().oscillators[0].frequency.values[0]
    const before = ctx().oscillators.length
    sfx.previewOneShot('pickCorrect', { streak: 8 })
    expect(ctx().oscillators[before].frequency.values[0]).toBeGreaterThan(base)
  })

  it('no-ops safely where Web Audio does not exist (jsdom default)', async () => {
    vi.resetModules()
    delete (window as unknown as { AudioContext?: unknown }).AudioContext
    const { sfx } = await import('../../src/lib/sfx')
    expect(() => {
      sfx.unlock()
      sfx.pickCorrect(2)
      sfx.go()
      sfx.bonusLift()
      sfx.timeout()
    }).not.toThrow()
  })
})
