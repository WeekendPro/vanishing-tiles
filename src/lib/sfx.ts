/**
 * Sound — the game's audio layer, spoken entirely in SEMANTIC game gestures
 * (`sfx.pickCorrect(streak)`, `sfx.bloom(step)`, …), never in audio tech.
 * Screens/stores call these; how a gesture SOUNDS lives only here.
 *
 * Every sound is a PATCH — plain data (a list of tone/noise layers with
 * frequencies, envelopes, filters) played back by two synth primitives. The
 * defaults below are the shipped palette; the Sound Design screen
 * (`SoundDesignScreen.tsx` + `soundLabStore.ts`) can override any patch live
 * via `setPatch`/`setBedPatch`, which is how the soundscape gets tuned by ear
 * instead of by prose.
 *
 * Two independent channels, each with its own toggle + volume (settings):
 *  - SFX   — the per-gesture one-shots.
 *  - MUSIC — the ambient BED: a zen meditation hum (slow-beating detuned
 *    drones + filtered ocean-swell noise) that fades in for the length of a
 *    run and fades out on exit. Started/stopped by the game screens.
 *
 * Everything is SYNTHESIZED on a Web Audio graph at trigger time — there are
 * no audio files, nothing to host, nothing to preload, zero bytes of assets.
 *
 * PORTABILITY: this module deliberately uses ONLY the standard Web Audio API
 * and imports nothing from the app. The planned React Native port swaps the
 * context source for `react-native-audio-api` (Software Mansion), which
 * implements this same spec — the synthesis code carries over as-is.
 *
 * BROWSER AUTOPLAY: browsers refuse to start audio until a user gesture.
 * `unlock()` must be called from a tap handler (the Home screen's PLAY does
 * this) before any timer-driven sounds (reveal blooms, timeouts, the bed) can
 * play; afterwards the context stays running. Every trigger also retries a
 * resume, so a missed unlock degrades to silence, never an error.
 *
 * The design map (which gesture gets which sound, and why) is documented in
 * docs/superpowers/specs/2026-07-16-sound-design.md.
 */

// ── Patch model ──────────────────────────────────────────────────────────────

export type OscType = 'sine' | 'triangle' | 'square' | 'sawtooth'

/** One oscillator voice: percussive gain envelope, optional pitch glide and
 *  lowpass. Times in seconds, frequencies in Hz, gain is the peak level. */
export interface ToneLayer {
  kind: 'tone'
  freq: number
  dur: number
  type?: OscType   // default 'sine'
  endFreq?: number // exponential pitch glide across the layer's life
  at?: number      // onset delay (schedules multi-note phrases)
  attack?: number  // default 4ms — percussive
  gain?: number    // default 0.2
  lowpass?: number // optional cutoff — softens/darkens
}

/** One noise voice: white noise through a bandpass whose center sweeps
 *  `from → to` — swept up fast it reads as drawn steel; slow+low as wind. */
export interface NoiseLayer {
  kind: 'noise'
  from: number
  to: number
  dur: number
  at?: number
  gain?: number // default 0.15
  q?: number    // bandpass resonance, default 1.8
}

export type SoundLayer = ToneLayer | NoiseLayer

/** A one-shot sound: layers played together (each offset by its `at`). */
export interface SoundPatch { layers: SoundLayer[] }

/** The ambient bed's voicing — named musical levers instead of raw layers. */
export interface BedPatch {
  baseFreq: number    // the hum's root (Hz)
  beatHz: number      // detune between the paired drones → the slow throb
  droneLevel: number  // level of EACH of the two beating drones
  octaveLevel: number // the octave shimmer above the root
  fifthLevel: number  // the soft fifth for warmth
  oceanLevel: number  // the noise swell's base level
  oceanCutoff: number // lowpass center for the ocean noise (Hz)
  tideRateHz: number  // how fast the cutoff drifts open/closed
  tideDepth: number   // how far the cutoff drifts (±Hz)
  swellRateHz: number // how fast the ocean level rises and falls
  swellDepth: number  // how far the level swings (±gain)
  fadeInS: number
  fadeOutS: number
}

export const ONE_SHOT_IDS = [
  'uiTap', 'count', 'go', 'bloom', 'pickCorrect', 'streakMilestone',
  'pickWrong', 'batchClear', 'bonusLift', 'lifeGained', 'timeout', 'gameOver',
] as const
export type OneShotId = typeof ONE_SHOT_IDS[number]

export const SOUND_LABELS: Record<OneShotId, string> = {
  uiTap: 'UI tap',
  count: 'Countdown beat',
  go: 'GO (run start)',
  bloom: 'Reveal bloom',
  pickCorrect: 'Correct choice',
  streakMilestone: 'Streak milestone (every 5th)',
  pickWrong: 'Incorrect choice',
  batchClear: 'Round complete',
  bonusLift: 'Speed-bonus lift',
  lifeGained: 'Extra life',
  timeout: 'Clock timeout',
  gameOver: 'Game over',
}

// The musical spine: everything is rooted on A so the whole game stays in one
// key. Reveals walk the A MINOR pentatonic (tense, neon); rewards climb the
// A MAJOR scale (game-show escalation) or land on the A major triad
// (resolution). Misses/failures live below the root as inharmonic buzzes —
// consequence reads as pitch falling out of the scale.
// (Patch frequencies are literal Hz, voiced from A4 = 440.)
const MINOR_PENTA = [0, 3, 5, 7, 10] // semitone offsets: A C D E G
const MAJOR = [0, 2, 4, 5, 7, 9, 11] // semitone offsets: the A major scale

/** The shipped palette. `bloom` is voiced at reveal-step 0 and `pickCorrect`
 *  at streak 1 — gameplay scales their TONE layers up the scale from there
 *  (see `bloomScale`/`coinScale`), so edits keep the musical system intact. */
export const DEFAULT_PATCHES: Record<OneShotId, SoundPatch> = {
  uiTap: { layers: [
    { kind: 'tone', freq: 1300, dur: 0.045, gain: 0.06 },
  ] },
  count: { layers: [
    { kind: 'tone', freq: 700, dur: 0.07, gain: 0.1 },
  ] },
  go: { layers: [
    { kind: 'tone', freq: 659, type: 'triangle', dur: 0.09, gain: 0.14 },
    { kind: 'tone', freq: 880, type: 'triangle', at: 0.09, dur: 0.35, gain: 0.16 },
    { kind: 'tone', freq: 1760, at: 0.09, dur: 0.3, gain: 0.07 },
  ] },
  bloom: { layers: [
    { kind: 'tone', freq: 440, dur: 0.45, attack: 0.006, gain: 0.15, lowpass: 3200 },
    { kind: 'tone', freq: 1329, dur: 0.16, gain: 0.045 },
    { kind: 'noise', from: 1400, to: 6800, dur: 0.24, gain: 0.12, q: 2.2 },
  ] },
  pickCorrect: { layers: [
    { kind: 'tone', freq: 440, type: 'square', dur: 0.08, gain: 0.085 },
    { kind: 'tone', freq: 587, type: 'square', at: 0.07, dur: 0.26, gain: 0.085 },
    { kind: 'tone', freq: 880, at: 0.07, dur: 0.3, gain: 0.05 },
  ] },
  streakMilestone: { layers: [880, 1109, 1319, 1760, 2217, 2637].map((freq, i) => (
    { kind: 'tone' as const, freq, type: 'square' as OscType, at: i * 0.055, dur: 0.12, gain: 0.07 }
  )) },
  pickWrong: { layers: [
    { kind: 'tone', freq: 150, endFreq: 95, type: 'sawtooth', dur: 0.22, gain: 0.26, lowpass: 420 },
    { kind: 'tone', freq: 82, dur: 0.18, gain: 0.2 },
  ] },
  batchClear: { layers: [
    { kind: 'tone', freq: 880, type: 'triangle', dur: 0.18, gain: 0.14 },
    { kind: 'tone', freq: 1109, type: 'triangle', at: 0.07, dur: 0.18, gain: 0.14 },
    { kind: 'tone', freq: 1319, type: 'triangle', at: 0.14, dur: 0.22, gain: 0.14 },
    { kind: 'tone', freq: 1760, at: 0.21, dur: 0.4, gain: 0.08 },
  ] },
  bonusLift: { layers: [
    { kind: 'tone', freq: 260, endFreq: 1040, type: 'sawtooth', dur: 0.98, attack: 0.1, gain: 0.07, lowpass: 1200 },
  ] },
  lifeGained: { layers: [
    { kind: 'tone', freq: 659, type: 'triangle', dur: 0.2, gain: 0.16 },
    { kind: 'tone', freq: 880, type: 'triangle', at: 0.09, dur: 0.35, gain: 0.18 },
  ] },
  timeout: { layers: [
    { kind: 'tone', freq: 330, endFreq: 110, type: 'sawtooth', dur: 0.55, gain: 0.22, lowpass: 600 },
    { kind: 'tone', freq: 220, endFreq: 82, dur: 0.5, gain: 0.14 },
  ] },
  gameOver: { layers: [
    { kind: 'tone', freq: 440, at: 0.12, dur: 0.5, gain: 0.16 },
    { kind: 'tone', freq: 330, at: 0.34, dur: 0.55, gain: 0.16 },
    { kind: 'tone', freq: 220, at: 0.6, dur: 0.9, gain: 0.16, type: 'triangle' },
  ] },
}

export const DEFAULT_BED: BedPatch = {
  baseFreq: 110,
  beatHz: 0.34,
  droneLevel: 0.4,
  octaveLevel: 0.12,
  fifthLevel: 0.09,
  oceanLevel: 0.16,
  oceanCutoff: 520,
  tideRateHz: 0.06,
  tideDepth: 320,
  swellRateHz: 0.045,
  swellDepth: 0.09,
  fadeInS: 2.5,
  fadeOutS: 1.2,
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// ── Engine state ─────────────────────────────────────────────────────────────

const MASTER_GAIN = 0.5

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null   // one-shots; gain = sfxVolume
let musicBus: GainNode | null = null // the bed; gain = musicVolume

let sfxOn = true
let sfxVolume = 1
let musicOn = true
let musicVolume = 0.6

// The live (possibly lab-overridden) palette.
const patches: Record<OneShotId, SoundPatch> = clone(DEFAULT_PATCHES)
let bedPatch: BedPatch = { ...DEFAULT_BED }

// The ambient bed's live nodes (null when silent) + whether a game screen
// currently WANTS the bed (survives the music toggle flipping off and on).
let bed: { out: GainNode; sources: { stop: () => void }[] } | null = null
let bedWanted = false

let noiseBuffer: AudioBuffer | null = null

/** Lazily create (and re-resume) the shared context + channel buses. Returns
 *  null wherever Web Audio doesn't exist (jsdom tests, SSR) — every sound
 *  no-ops safely. */
function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.gain.value = sfxVolume
    sfxBus.connect(master)
    musicBus = ctx.createGain()
    musicBus.gain.value = musicVolume
    musicBus.connect(master)
  }
  // Autoplay policy: a suspended context resumes silently on the next
  // gesture-driven trigger. Fire-and-forget — failure just means silence.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
}

/** One second of cached white noise — raw material for noise layers and the
 *  bed's ocean swells. */
function sharedNoise(ac: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

// ── Synth primitives (exponential ramps can't touch zero → float on 0.0001) ──

function tone(spec: Omit<ToneLayer, 'kind'>): void {
  if (!sfxOn) return
  const ac = context()
  if (!ac || !sfxBus) return
  const t0 = ac.currentTime + (spec.at ?? 0)
  const dur = spec.dur

  const osc = ac.createOscillator()
  osc.type = spec.type ?? 'sine'
  osc.frequency.setValueAtTime(spec.freq, t0)
  if (spec.endFreq) osc.frequency.exponentialRampToValueAtTime(spec.endFreq, t0 + dur)

  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(spec.gain ?? 0.2, t0 + (spec.attack ?? 0.004))
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  if (spec.lowpass) {
    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = spec.lowpass
    osc.connect(filter)
    filter.connect(env)
  } else {
    osc.connect(env)
  }
  env.connect(sfxBus)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function noiseSweep(spec: Omit<NoiseLayer, 'kind'>): void {
  if (!sfxOn) return
  const ac = context()
  if (!ac || !sfxBus) return
  const t0 = ac.currentTime + (spec.at ?? 0)

  const src = ac.createBufferSource()
  src.buffer = sharedNoise(ac)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = spec.q ?? 1.8
  bp.frequency.setValueAtTime(spec.from, t0)
  bp.frequency.exponentialRampToValueAtTime(spec.to, t0 + spec.dur)
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(spec.gain ?? 0.15, t0 + 0.012)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur)

  src.connect(bp)
  bp.connect(env)
  env.connect(sfxBus)
  src.start(t0)
  src.stop(t0 + spec.dur + 0.05)
}

/** Play a patch's layers. `freqScale` transposes TONE layers only (noise
 *  keeps its designed band); `at` offsets the whole phrase; `durOverride`
 *  stretches every layer to a caller-driven window (the Lift). */
function playPatch(
  patch: SoundPatch,
  opts: { freqScale?: number; at?: number; durOverride?: number } = {},
): void {
  const fs = opts.freqScale ?? 1
  for (const layer of patch.layers) {
    const at = (layer.at ?? 0) + (opts.at ?? 0)
    const dur = opts.durOverride ?? layer.dur
    if (layer.kind === 'tone') {
      tone({ ...layer, at, dur, freq: layer.freq * fs, endFreq: layer.endFreq ? layer.endFreq * fs : undefined })
    } else {
      noiseSweep({ ...layer, at, dur })
    }
  }
}

/** Reveal-step transpose: walks MINOR_PENTA upward, wrapping into the next
 *  octave every 5 steps, capped two octaves up so deep batches (12 gaps)
 *  never climb into shrillness. Multiplies the bloom patch's tone layers. */
function bloomScale(step: number): number {
  const st = Math.min(
    MINOR_PENTA[step % MINOR_PENTA.length] + 12 * Math.floor(step / MINOR_PENTA.length),
    24,
  )
  return 2 ** (st / 12)
}

/** Streak transpose: one A-major scale degree per streak step, capped two
 *  octaves up. Multiplies the pickCorrect patch's tone layers. */
function coinScale(streak: number): number {
  const step = Math.min(Math.max(streak, 1) - 1, 14)
  return 2 ** ((MAJOR[step % MAJOR.length] + 12 * Math.floor(step / MAJOR.length)) / 12)
}

// ── The ambient bed ──────────────────────────────────────────────────────────
// Zen meditation hum, voiced by the live BedPatch: two barely-detuned drones
// whose interference beats at `beatHz` (the binaural-style throb), a quiet
// octave + fifth for warmth, and lowpassed noise whose cutoff and level drift
// on sub-0.1 Hz LFOs — hollow, slow ocean swells.

function startBedNodes(): void {
  if (bed || !musicOn) return
  const ac = context()
  if (!ac || !musicBus) return
  const t0 = ac.currentTime
  const p = bedPatch

  const out = ac.createGain()
  out.gain.setValueAtTime(0.0001, t0)
  out.gain.linearRampToValueAtTime(1, t0 + p.fadeInS)
  out.connect(musicBus)

  const sources: { stop: () => void }[] = []
  const drone = (freq: number, level: number) => {
    if (level <= 0) return
    const osc = ac.createOscillator()
    osc.frequency.setValueAtTime(freq, t0)
    const g = ac.createGain()
    g.gain.value = level
    osc.connect(g)
    g.connect(out)
    osc.start(t0)
    sources.push(osc)
  }
  drone(p.baseFreq, p.droneLevel)
  drone(p.baseFreq + p.beatHz, p.droneLevel)         // …beats against the root
  drone(p.baseFreq * 2 + p.beatHz, p.octaveLevel)    // octave shimmer, itself beating
  drone(p.baseFreq * 1.5, p.fifthLevel)              // soft fifth for warmth

  if (p.oceanLevel > 0) {
    const src = ac.createBufferSource()
    src.buffer = sharedNoise(ac)
    src.loop = true
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = p.oceanCutoff
    const swell = ac.createGain()
    swell.gain.value = p.oceanLevel
    src.connect(lp)
    lp.connect(swell)
    swell.connect(out)

    const lfo = (hz: number, depth: number, target: AudioParam) => {
      if (hz <= 0 || depth <= 0) return
      const osc = ac.createOscillator()
      osc.frequency.value = hz
      const g = ac.createGain()
      g.gain.value = depth
      osc.connect(g)
      g.connect(target)
      osc.start(t0)
      sources.push(osc)
    }
    lfo(p.tideRateHz, p.tideDepth, lp.frequency)  // the tide: cutoff drifts
    lfo(p.swellRateHz, p.swellDepth, swell.gain)  // the swell: level breathes

    src.start(t0)
    sources.push(src)
  }
  bed = { out, sources }
}

function stopBedNodes(): void {
  if (!bed || !ctx) return
  const dying = bed
  bed = null
  const fadeOut = bedPatch.fadeOutS
  dying.out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeOut)
  window.setTimeout(() => {
    dying.sources.forEach(s => { try { s.stop() } catch { /* already stopped */ } })
  }, fadeOut * 1000 + 200)
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export const sfx = {
  // ── Channel controls (driven by settingsStore) ─────────────────────────────
  /** SFX on/off. Checked at trigger time, so muting mid-run is instant. */
  setEnabled(on: boolean): void { sfxOn = on },
  isEnabled(): boolean { return sfxOn },
  setSfxVolume(v: number): void {
    sfxVolume = clamp01(v)
    if (ctx && sfxBus) sfxBus.gain.setValueAtTime(sfxVolume, ctx.currentTime)
  },
  /** Music on/off. Off fades the bed out; back on rejoins a run in progress. */
  setMusicEnabled(on: boolean): void {
    musicOn = on
    if (!on) stopBedNodes()
    else if (bedWanted) startBedNodes()
  },
  setMusicVolume(v: number): void {
    musicVolume = clamp01(v)
    if (ctx && musicBus) musicBus.gain.setValueAtTime(musicVolume, ctx.currentTime)
  },

  /** Create/resume the audio context from a USER GESTURE (autoplay policy).
   *  The Home screen's PLAY tap calls this so the run's timer-driven sounds
   *  (blooms, timeout, the bed) are already unlocked when they fire. */
  unlock(): void { if (sfxOn || musicOn) context() },

  // ── Patch access (the Sound Design lab drives these) ───────────────────────
  getPatch(id: OneShotId): SoundPatch { return clone(patches[id]) },
  getDefaultPatch(id: OneShotId): SoundPatch { return clone(DEFAULT_PATCHES[id]) },
  setPatch(id: OneShotId, patch: SoundPatch): void { patches[id] = clone(patch) },
  resetPatch(id: OneShotId): void { patches[id] = clone(DEFAULT_PATCHES[id]) },
  getBedPatch(): BedPatch { return { ...bedPatch } },
  getDefaultBed(): BedPatch { return { ...DEFAULT_BED } },
  /** Re-voices a RUNNING bed live (fade-out/in crossover). */
  setBedPatch(p: BedPatch): void {
    bedPatch = { ...p }
    if (bed) { stopBedNodes(); startBedNodes() }
  },
  resetBed(): void { this.setBedPatch({ ...DEFAULT_BED }) },
  isBedRunning(): boolean { return bed != null },

  /** Lab replay of any one-shot, with the gameplay context that shapes it
   *  (streak for the coin's scale climb, reveal step for the bloom's). */
  previewOneShot(id: OneShotId, ctxOpts: { streak?: number; step?: number } = {}): void {
    if (id === 'pickCorrect') playPatch(patches.pickCorrect, { freqScale: coinScale(ctxOpts.streak ?? 1) })
    else if (id === 'bloom') playPatch(patches.bloom, { freqScale: bloomScale(ctxOpts.step ?? 0) })
    else playPatch(patches[id])
  },

  // ── The ambient bed (game screens call these on mount/unmount) ─────────────
  startBed(): void { bedWanted = true; startBedNodes() },
  stopBed(): void { bedWanted = false; stopBedNodes() },

  // ── Gestures ───────────────────────────────────────────────────────────────
  /** Any small UI tap (PLAY, mode switch) — a barely-there tick. */
  uiTap(): void { playPatch(patches.uiTap) },

  /** Countdown beat (3 · 2 · 1) — a soft, even metronome blip. */
  count(): void { playPatch(patches.count) },

  /** The fourth beat — GO: the decisive run-start note the 3·2·1 resolves
   *  into (E5 pickup onto a ringing A5 + octave sheen). */
  go(): void { playPatch(patches.go) },

  /** A gap blooming during MEMORIZE, `step` = its 0-based position in the
   *  reveal sequence. Two layers:
   *  - the NOTE: one minor-pentatonic step up per bloom, so the sequence
   *    plays as a rising melody — pitch order encodes reveal order, a real
   *    memory hook for hard mode's ordered recall;
   *  - the EDGE: a fast upward bandpassed-noise sweep + a high inharmonic
   *    partial — the "shing" of a sword drawn from its scabbard. */
  bloom(step: number): void {
    playPatch(patches.bloom, { freqScale: bloomScale(step) })
  },

  /** A correct recall — the game-show / consecutive-stomp escalation: a
   *  chiptune coin blip (square base note + a perfect fourth above) that
   *  climbs the A MAJOR scale one degree per streak step (capped two octaves
   *  up), restarting at the root when the streak breaks — you HEAR the
   *  multiplier wind up and reset. Every 5th streak step lands the
   *  streakMilestone patch on top: the "you eventually get there" reward. */
  pickCorrect(streak: number): void {
    playPatch(patches.pickCorrect, { freqScale: coinScale(streak) })
    if (streak > 0 && streak % 5 === 0) playPatch(patches.streakMilestone, { at: 0.16 })
  },

  /** A miss — a short dissonant buzz falling out of the scale, under the red
   *  border flash + board shake. Deliberately unmusical (saw glide + low
   *  thud): the only "wrong" texture in the palette. */
  pickWrong(): void { playPatch(patches.pickWrong) },

  /** Batch CLEAR! — a quick rising A-major arpeggio (A5 C#6 E6) with a
   *  sparkle tail: the run's core "you did it" resolution. */
  batchClear(): void { playPatch(patches.batchClear) },

  /** The time → score "Lift" payoff — a gentle filtered riser under the bar
   *  draining into the score, stretched to the animation window (ms). */
  bonusLift(ms: number): void {
    playPatch(patches.bonusLift, { durOverride: Math.max(0.3, (ms / 1000) * 0.75) })
  },

  /** An extra life earned (every 5000 pts) — a warm two-note rise (E5 → A5)
   *  under the heart burst. */
  lifeGained(): void { playPatch(patches.lifeGained) },

  /** The select clock expiring — a falling "womp" (life lost, same batch
   *  replays). Downward glide: the opposite arc of every reward. */
  timeout(): void { playPatch(patches.timeout) },

  /** Run over — a slow descending A-minor-flavored farewell (A4 E4 A3),
   *  long releases; elegiac, not punishing. Matches "Memory Fades" — and
   *  reads as designed against the bed's hum, which keeps humming under it. */
  gameOver(): void { playPatch(patches.gameOver) },
}
