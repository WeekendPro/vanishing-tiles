/**
 * Sound — the game's audio layer, spoken entirely in SEMANTIC game gestures
 * (`sfx.pickCorrect(streak)`, `sfx.bloom(step)`, …), never in audio tech.
 * Screens/stores call these; how a gesture SOUNDS lives only here.
 *
 * Every sound is a PATCH — plain data (a list of tone/noise layers with
 * frequencies, envelopes, filters) played back by two synth primitives. The
 * defaults below are the shipped palette; the Sound Design screen
 * (`SoundDesignScreen.tsx` + `soundLabStore.ts`) can override any patch live
 * via `setPatch`, which is how the soundscape gets tuned by ear instead of by
 * prose. (The shipped bank is swapped wholesale from time to time; snapshots
 * live in docs/sound-banks/ — see the note on DEFAULT_PATCHES below.)
 *
 * SFX only for now: the ambient music bed was tried (synth zen hum) and cut —
 * music returns as a produced audio file when the designer's Logic Pro bed
 * lands. The SFX channel has a toggle + volume in settings.
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

export const ONE_SHOT_IDS = [
  'uiTap', 'count', 'go', 'bloom', 'pickCorrect',
  'pickWrong', 'batchClear', 'bonusLift', 'lifeGained', 'urgentTick', 'timeout', 'gameOver',
] as const
export type OneShotId = typeof ONE_SHOT_IDS[number]
// (streakMilestone — an every-5th-pick 1-Up flourish — was CUT 2026-07-17:
// with no visual indicator attached, it read as an unprompted sound that
// falsely promised an extra life.)

export const SOUND_LABELS: Record<OneShotId, string> = {
  uiTap: 'UI tap',
  count: 'Countdown beat',
  go: 'GO (run start)',
  bloom: 'Reveal bloom',
  pickCorrect: 'Correct choice',
  pickWrong: 'Incorrect choice',
  batchClear: 'Round complete',
  bonusLift: 'Speed-bonus lift',
  lifeGained: 'Extra life',
  urgentTick: 'Clock urgency tick',
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
 *  (see `bloomScale`/`coinScale`), so edits keep the musical system intact.
 *
 *  ON TRIAL (2026-07-17): a full-palette re-synthesis of ALL 12 sounds —
 *  multi-layer, glide-heavy, with noise transients back on the punchy ones
 *  (go / bloom / batchClear / pickWrong / timeout / gameOver). Bloom's noise
 *  "shing" is UN-muted again in this bank (gain > 0). This replaced the
 *  designer's earlier lab-tuned bank, which is preserved verbatim at
 *  docs/sound-banks/2026-07-17-lab-bank.json — paste it back over this object
 *  (and update the pinned defaults in tests/lib/sfx.test.ts) to revert. This
 *  bank is also mirrored at docs/sound-banks/2026-07-17-full-palette.json. */
export const DEFAULT_PATCHES: Record<OneShotId, SoundPatch> = {
  uiTap: { layers: [
    { kind: 'tone', freq: 1180, endFreq: 1540, type: 'square', dur: 0.032, gain: 0.045, lowpass: 2800 },
    { kind: 'tone', freq: 2360, type: 'sine', at: 0.008, dur: 0.025, gain: 0.025 },
  ] },
  count: { layers: [
    { kind: 'tone', freq: 1480, endFreq: 1780, type: 'triangle', dur: 0.075, attack: 0.002, gain: 0.105, lowpass: 4200 },
    { kind: 'tone', freq: 2960, type: 'sine', at: 0.012, dur: 0.045, gain: 0.035 },
  ] },
  go: { layers: [
    { kind: 'tone', freq: 392, endFreq: 523, type: 'triangle', dur: 0.12, attack: 0.004, gain: 0.13 },
    { kind: 'tone', freq: 587, endFreq: 784, type: 'square', at: 0.055, dur: 0.17, gain: 0.085, lowpass: 2400 },
    { kind: 'tone', freq: 1047, endFreq: 1568, type: 'triangle', at: 0.115, dur: 0.31, attack: 0.004, gain: 0.11 },
    { kind: 'noise', from: 1800, to: 7200, at: 0.1, dur: 0.18, gain: 0.025, q: 2.5 },
  ] },
  bloom: { layers: [
    { kind: 'tone', freq: 196, endFreq: 588, type: 'sawtooth', dur: 0.34, attack: 0.008, gain: 0.1, lowpass: 1800 },
    { kind: 'tone', freq: 784, endFreq: 1176, type: 'triangle', at: 0.018, dur: 0.29, attack: 0.005, gain: 0.09, lowpass: 3600 },
    { kind: 'tone', freq: 2352, endFreq: 1764, type: 'sine', at: 0.045, dur: 0.38, gain: 0.045 },
    { kind: 'noise', from: 1200, to: 7600, dur: 0.21, gain: 0.032, q: 2.8 }, // shing back ON in this bank
  ] },
  pickCorrect: { layers: [
    { kind: 'tone', freq: 330, endFreq: 495, type: 'square', dur: 0.115, attack: 0.002, gain: 0.085, lowpass: 1800 },
    { kind: 'tone', freq: 587, endFreq: 784, type: 'triangle', at: 0.024, dur: 0.14, gain: 0.13 },
    { kind: 'tone', freq: 1175, endFreq: 1568, type: 'sine', at: 0.07, dur: 0.095, gain: 0.055 },
  ] },
  pickWrong: { layers: [
    { kind: 'tone', freq: 185, endFreq: 68, type: 'sawtooth', dur: 0.29, attack: 0.002, gain: 0.2, lowpass: 520 },
    { kind: 'tone', freq: 123, endFreq: 91, type: 'square', at: 0.035, dur: 0.19, gain: 0.13, lowpass: 380 },
    { kind: 'noise', from: 240, to: 1300, at: 0.01, dur: 0.11, gain: 0.035, q: 1.7 },
  ] },
  batchClear: { layers: [
    { kind: 'tone', freq: 98, endFreq: 65, type: 'sine', dur: 0.28, gain: 0.12, lowpass: 420 },
    { kind: 'tone', freq: 523, type: 'triangle', dur: 0.14, gain: 0.11 },
    { kind: 'tone', freq: 659, type: 'triangle', at: 0.065, dur: 0.15, gain: 0.115 },
    { kind: 'tone', freq: 784, type: 'triangle', at: 0.13, dur: 0.17, gain: 0.12 },
    { kind: 'tone', freq: 1047, endFreq: 1568, type: 'square', at: 0.205, dur: 0.34, gain: 0.075, lowpass: 3400 },
    { kind: 'noise', from: 1600, to: 8200, at: 0.2, dur: 0.16, gain: 0.025, q: 3 },
  ] },
  bonusLift: { layers: [
    { kind: 'tone', freq: 196, endFreq: 392, type: 'sawtooth', dur: 0.52, attack: 0.008, gain: 0.09, lowpass: 1200 },
    { kind: 'tone', freq: 784, endFreq: 1175, type: 'triangle', at: 0.035, dur: 0.48, attack: 0.005, gain: 0.12 },
    { kind: 'tone', freq: 988, endFreq: 1568, type: 'triangle', at: 0.13, dur: 0.52, attack: 0.004, gain: 0.105 },
    { kind: 'tone', freq: 2350, endFreq: 3136, type: 'sine', at: 0.24, dur: 0.55, gain: 0.055 },
    { kind: 'tone', freq: 3136, endFreq: 2350, type: 'sine', at: 0.64, dur: 0.28, gain: 0.035 },
    { kind: 'noise', from: 1200, to: 9000, at: 0.22, dur: 0.24, gain: 0.025, q: 3.2 },
  ] },
  lifeGained: { layers: [
    { kind: 'tone', freq: 196, endFreq: 220, type: 'sine', dur: 0.13, gain: 0.12, lowpass: 620 },
    { kind: 'tone', freq: 196, endFreq: 262, type: 'sine', at: 0.16, dur: 0.18, gain: 0.15, lowpass: 720 },
    { kind: 'tone', freq: 659, endFreq: 880, type: 'triangle', at: 0.21, dur: 0.46, attack: 0.006, gain: 0.12 },
    { kind: 'tone', freq: 1760, endFreq: 2640, type: 'sine', at: 0.31, dur: 0.44, gain: 0.045 },
  ] },
  // The urgency tick: a tense clock "tock" fired repeatedly by the select
  // clock's red zone (StaggerScreen's urgency ticker, paced by CLOCK_URGENT in
  // staggerCurve), pitching up as expiry nears. Gains sit LOW on purpose — it
  // repeats every batch for the whole run, so it must read as tension, not alarm.
  urgentTick: { layers: [
    { kind: 'tone', freq: 2200, endFreq: 1760, type: 'square', dur: 0.028, gain: 0.065, lowpass: 4200 },
    { kind: 'tone', freq: 145, endFreq: 110, type: 'triangle', at: 0.004, dur: 0.075, gain: 0.13, lowpass: 550 },
    { kind: 'noise', from: 2600, to: 7000, dur: 0.022, gain: 0.018, q: 3.5 },
  ] },
  timeout: { layers: [
    { kind: 'tone', freq: 392, endFreq: 62, type: 'square', dur: 0.88, attack: 0.003, gain: 0.16, lowpass: 850 },
    { kind: 'tone', freq: 196, endFreq: 49, type: 'sawtooth', at: 0.055, dur: 1.12, gain: 0.11, lowpass: 520 },
    { kind: 'tone', freq: 2350, endFreq: 440, type: 'sine', at: 0.02, dur: 0.46, gain: 0.055 },
    { kind: 'noise', from: 5200, to: 180, at: 0.04, dur: 0.5, gain: 0.038, q: 2 },
    { kind: 'tone', freq: 54, type: 'sine', at: 0.53, dur: 0.72, gain: 0.085 },
  ] },
  gameOver: { layers: [
    { kind: 'tone', freq: 523, endFreq: 494, type: 'triangle', dur: 0.3, gain: 0.12 },
    { kind: 'tone', freq: 392, endFreq: 370, type: 'triangle', at: 0.24, dur: 0.34, gain: 0.125 },
    { kind: 'tone', freq: 294, endFreq: 277, type: 'triangle', at: 0.52, dur: 0.42, gain: 0.13 },
    { kind: 'tone', freq: 196, endFreq: 92, type: 'sawtooth', at: 0.82, dur: 1.28, gain: 0.105, lowpass: 620 },
    { kind: 'tone', freq: 98, endFreq: 48, type: 'sine', at: 0.84, dur: 1.85, gain: 0.085 },
    { kind: 'tone', freq: 2350, endFreq: 880, type: 'sine', at: 0.86, dur: 0.72, gain: 0.035 },
    { kind: 'noise', from: 4400, to: 120, at: 0.92, dur: 0.72, gain: 0.03, q: 1.8 },
  ] },
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// ── Engine state ─────────────────────────────────────────────────────────────

const MASTER_GAIN = 0.5

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null // one-shots; gain = sfxVolume

let sfxOn = true
let sfxVolume = 1

// The live (possibly lab-overridden) palette.
const patches: Record<OneShotId, SoundPatch> = clone(DEFAULT_PATCHES)

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
  }
  // Autoplay policy: a suspended context resumes silently on the next
  // gesture-driven trigger. Fire-and-forget — failure just means silence.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
}

/** One second of cached white noise — raw material for noise layers. */
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
  // A zeroed layer is MUTED, not an error — the lab's loudness knob goes to
  // 0, and Web Audio's exponential ramps reject non-positive targets.
  const peak = spec.gain ?? 0.2
  if (peak <= 0) return
  const ac = context()
  if (!ac || !sfxBus) return
  const t0 = ac.currentTime + (spec.at ?? 0)
  const dur = spec.dur

  const osc = ac.createOscillator()
  osc.type = spec.type ?? 'sine'
  osc.frequency.setValueAtTime(spec.freq, t0)
  if (spec.endFreq && spec.endFreq > 0) osc.frequency.exponentialRampToValueAtTime(spec.endFreq, t0 + dur)

  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(peak, t0 + (spec.attack ?? 0.004))
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
  // Same zero-gain guard as tone(): a muted layer plays nothing (this is how
  // the designer silenced the bloom's shing without deleting the layer).
  const peak = spec.gain ?? 0.15
  if (peak <= 0) return
  const ac = context()
  if (!ac || !sfxBus) return
  const t0 = ac.currentTime + (spec.at ?? 0)

  const src = ac.createBufferSource()
  src.buffer = sharedNoise(ac)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = spec.q ?? 1.8
  bp.frequency.setValueAtTime(Math.max(1, spec.from), t0)
  bp.frequency.exponentialRampToValueAtTime(Math.max(1, spec.to), t0 + spec.dur)
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur)

  src.connect(bp)
  bp.connect(env)
  env.connect(sfxBus)
  src.start(t0)
  src.stop(t0 + spec.dur + 0.05)
}

/** Play a patch's layers. `freqScale` transposes TONE layers only (noise
 *  keeps its designed band); `at` offsets the whole phrase. */
function playPatch(
  patch: SoundPatch,
  opts: { freqScale?: number; at?: number } = {},
): void {
  const fs = opts.freqScale ?? 1
  for (const layer of patch.layers) {
    const at = (layer.at ?? 0) + (opts.at ?? 0)
    if (layer.kind === 'tone') {
      tone({ ...layer, at, freq: layer.freq * fs, endFreq: layer.endFreq ? layer.endFreq * fs : undefined })
    } else {
      noiseSweep({ ...layer, at })
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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Urgency transpose: the tick climbs up to a perfect fifth (7 semitones) as
 *  the clock's red zone runs out (heat 0 → 1) — pitch winds UP while the
 *  caller shrinks the interval: the classic ticking-bomb accelerando. */
function urgentScale(heat: number): number {
  return 2 ** ((7 * clamp01(heat)) / 12)
}

export const sfx = {
  // ── Channel controls (driven by settingsStore) ─────────────────────────────
  /** SFX on/off. Checked at trigger time, so muting mid-run is instant. */
  setEnabled(on: boolean): void { sfxOn = on },
  isEnabled(): boolean { return sfxOn },
  setSfxVolume(v: number): void {
    sfxVolume = clamp01(v)
    if (ctx && sfxBus) sfxBus.gain.setValueAtTime(sfxVolume, ctx.currentTime)
  },

  /** Create/resume the audio context from a USER GESTURE (autoplay policy).
   *  The Home screen's PLAY tap calls this so the run's timer-driven sounds
   *  (blooms, timeout) are already unlocked when they fire. */
  unlock(): void { if (sfxOn) context() },

  // ── Patch access (the Sound Design lab drives these) ───────────────────────
  getPatch(id: OneShotId): SoundPatch { return clone(patches[id]) },
  getDefaultPatch(id: OneShotId): SoundPatch { return clone(DEFAULT_PATCHES[id]) },
  setPatch(id: OneShotId, patch: SoundPatch): void { patches[id] = clone(patch) },
  resetPatch(id: OneShotId): void { patches[id] = clone(DEFAULT_PATCHES[id]) },

  /** Lab replay of any one-shot, with the gameplay context that shapes it
   *  (streak for the coin's scale climb, reveal step for the bloom's). */
  previewOneShot(id: OneShotId, ctxOpts: { streak?: number; step?: number; heat?: number } = {}): void {
    if (id === 'pickCorrect') playPatch(patches.pickCorrect, { freqScale: coinScale(ctxOpts.streak ?? 1) })
    else if (id === 'bloom') playPatch(patches.bloom, { freqScale: bloomScale(ctxOpts.step ?? 0) })
    else if (id === 'urgentTick') playPatch(patches.urgentTick, { freqScale: urgentScale(ctxOpts.heat ?? 0) })
    else playPatch(patches[id])
  },

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
   *  multiplier wind up and reset. */
  pickCorrect(streak: number): void {
    playPatch(patches.pickCorrect, { freqScale: coinScale(streak) })
  },

  /** A miss — a short dissonant buzz falling out of the scale, under the red
   *  border flash + board shake. Deliberately unmusical (saw glide + low
   *  thud): the only "wrong" texture in the palette. */
  pickWrong(): void { playPatch(patches.pickWrong) },

  /** Batch CLEAR! — a quick rising A-major arpeggio (A5 C#6 E6) with a
   *  sparkle tail: the run's core "you did it" resolution. */
  batchClear(): void { playPatch(patches.batchClear) },

  /** The time → score "Lift" payoff — the riser under the bar draining into
   *  the score. Plays as authored (no stretching to the animation window):
   *  the patch was tuned by ear in the lab, tail included. */
  bonusLift(): void { playPatch(patches.bonusLift) },

  /** An extra life earned (every 5000 pts) — a warm two-note rise (E5 → A5)
   *  under the heart burst. */
  lifeGained(): void { playPatch(patches.lifeGained) },

  /** One tick of the select clock's URGENCY accelerando — fired repeatedly by
   *  the screen once the clock enters its red zone (the same threshold that
   *  turns the bar red). `heat` runs 0 → 1 across the window (threshold →
   *  expiry) and pitches the tick up to a fifth; the CALLER shrinks the
   *  interval between ticks (CLOCK_URGENT in staggerCurve.ts). */
  urgentTick(heat: number): void {
    playPatch(patches.urgentTick, { freqScale: urgentScale(heat) })
  },

  /** The select clock expiring — a falling "womp" (life lost, same batch
   *  replays). Downward glide: the opposite arc of every reward. */
  timeout(): void { playPatch(patches.timeout) },

  /** Run over — a slow descending A-minor-flavored farewell (A4 E4 A3),
   *  long releases; elegiac, not punishing. Matches "Memory Fades". */
  gameOver(): void { playPatch(patches.gameOver) },
}
