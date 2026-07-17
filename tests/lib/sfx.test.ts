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

  it('a 5th streak pick is just the coin — the milestone flourish was cut', async () => {
    const sfx = await freshSfx()
    sfx.pickCorrect(4)
    const plain = ctx().oscillators.length
    sfx.pickCorrect(5)
    expect(ctx().oscillators.length - plain).toBe(plain) // same layer count, no extra run
  })

  it('bloom melody rises with the reveal step; its shing layer sweeps (active in this bank)', async () => {
    const sfx = await freshSfx()
    sfx.bloom(0)
    const first = ctx().oscillators[0].frequency.values[0]
    // The full-palette bank UN-mutes the noise layer (gain > 0): it must play,
    // sweeping its bandpass — the audible "shing" of the reveal.
    expect(ctx().bufferSources.length).toBe(1)
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

  it('a noise layer with gain > 0 still sweeps (the shing is one knob away)', async () => {
    const sfx = await freshSfx()
    const patch = sfx.getDefaultPatch('bloom')
    patch.layers = patch.layers.map(l => (l.kind === 'noise' ? { ...l, gain: 0.12 } : l))
    sfx.setPatch('bloom', patch)
    sfx.bloom(0)
    expect(ctx().bufferSources.length).toBe(1)
    const sweep = ctx().filters.find(f => f.type === 'bandpass')!
    expect(sweep.frequency.values[1]).toBeGreaterThan(sweep.frequency.values[0]) // sweeps UP
  })

  it('zero-gain tone layers are muted, not errors', async () => {
    const sfx = await freshSfx()
    sfx.setPatch('uiTap', { layers: [{ kind: 'tone', freq: 1300, dur: 0.05, gain: 0 }] })
    expect(() => sfx.uiTap()).not.toThrow()
    expect(ctx()?.oscillators ?? []).toHaveLength(0)
  })

  it('setPatch overrides what a gesture plays; resetPatch restores the default', async () => {
    const sfx = await freshSfx()
    sfx.setPatch('pickWrong', { layers: [{ kind: 'tone', freq: 505, dur: 0.1, gain: 0.1 }] })
    sfx.pickWrong()
    expect(ctx().oscillators).toHaveLength(1)
    expect(ctx().oscillators[0].frequency.values[0]).toBe(505)
    sfx.resetPatch('pickWrong')
    sfx.pickWrong()
    expect(ctx().oscillators.length).toBe(1 + 2) // default buzz is two tone layers (+ a noise transient)
  })

  it('ships the full-palette bonusLift default (sawtooth riser + triangle climb, 2026-07-17)', async () => {
    const sfx = await freshSfx()
    sfx.bonusLift()
    const [riser, climbA, climbB, sparkle, tail] = ctx().oscillators
    expect(riser.type).toBe('sawtooth')
    expect(riser.frequency.values[0]).toBe(196)
    expect(riser.frequency.values[1]).toBe(392) // glides up an octave
    expect(climbA.type).toBe('triangle')
    expect(climbA.frequency.values[0]).toBe(784)
    expect(climbB.type).toBe('triangle')
    expect(climbB.frequency.values[0]).toBe(988)
    expect(sparkle.type).toBe('sine')
    expect(sparkle.frequency.values[0]).toBe(2350)
    expect(tail.frequency.values[0]).toBe(3136)
    // The riser's noise sparkle is a buffer source, not an oscillator.
    expect(ctx().bufferSources.length).toBe(1)
  })

  it('ships the full-palette countdown tick (gliding triangle blip)', async () => {
    const sfx = await freshSfx()
    sfx.count()
    const [blip] = ctx().oscillators
    expect(blip.type).toBe('triangle')
    expect(blip.frequency.values[0]).toBe(1480)
    expect(blip.frequency.values[1]).toBe(1780) // glides up
  })

  it('ships the full-palette timeout default (square womp gliding into the sub-bass)', async () => {
    const sfx = await freshSfx()
    sfx.timeout()
    const [womp] = ctx().oscillators
    expect(womp.type).toBe('square')
    expect(womp.frequency.values[0]).toBe(392)
    expect(womp.frequency.values[1]).toBe(62) // collapses far below the root
  })

  it('urgentTick pitches up with heat, capped at a fifth above the patch root', async () => {
    const sfx = await freshSfx()
    const rootOf = (call: () => void) => {
      const before = ctx()?.oscillators.length ?? 0
      call()
      return ctx().oscillators[before].frequency.values[0]
    }
    const cold = rootOf(() => sfx.urgentTick(0))
    const warm = rootOf(() => sfx.urgentTick(0.5))
    const expiring = rootOf(() => sfx.urgentTick(1))
    expect(cold).toBe(2200) // the shipped patch's high-click root, untransposed
    expect(warm).toBeGreaterThan(cold)
    expect(expiring).toBeGreaterThan(warm)
    expect(expiring).toBeCloseTo(cold * 2 ** (7 / 12), 6) // a perfect fifth up
    // Out-of-range heat clamps instead of running away.
    expect(rootOf(() => sfx.urgentTick(5))).toBeCloseTo(expiring, 6)
  })

  it('previewOneShot honors heat for urgentTick (the lab slider)', async () => {
    const sfx = await freshSfx()
    sfx.previewOneShot('urgentTick', { heat: 0 })
    const base = ctx().oscillators[0].frequency.values[0]
    const before = ctx().oscillators.length
    sfx.previewOneShot('urgentTick', { heat: 1 })
    expect(ctx().oscillators[before].frequency.values[0]).toBeGreaterThan(base)
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
