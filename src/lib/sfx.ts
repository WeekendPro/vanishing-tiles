/**
 * Sound — the game's audio layer, spoken entirely in SEMANTIC game gestures
 * (`sfx.pickCorrect(streak)`, `sfx.bloom(step)`, …), never in audio tech.
 * Screens/stores call these; how a gesture SOUNDS lives only here.
 *
 * Two independent channels, each with its own toggle + volume (settings):
 *  - SFX   — the per-gesture one-shots below.
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

// The musical spine: everything is rooted on A so the whole game stays in one
// key. Reveals walk the A MINOR pentatonic (tense, neon); rewards climb the
// A MAJOR scale (game-show escalation) or land on the A major triad
// (resolution). Misses/failures live below the root as inharmonic buzzes —
// consequence reads as pitch falling out of the scale.
const A4 = 440
const MINOR_PENTA = [0, 3, 5, 7, 10] // semitone offsets: A C D E G
const MAJOR = [0, 2, 4, 5, 7, 9, 11] // semitone offsets: the A major scale

const MASTER_GAIN = 0.5
const BED_FADE_IN_S = 2.5
const BED_FADE_OUT_S = 1.2

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null   // one-shots; gain = sfxVolume
let musicBus: GainNode | null = null // the bed; gain = musicVolume

let sfxOn = true
let sfxVolume = 1
let musicOn = true
let musicVolume = 0.6

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

/** One second of cached white noise — the raw material for the reveal's
 *  drawn-steel "shing" and the bed's ocean swells. */
function sharedNoise(ac: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

interface ToneSpec {
  freq: number
  /** Exponential pitch glide across the tone's life (sweeps, womps). */
  endFreq?: number
  type?: OscillatorType // default 'sine'
  /** Seconds from now to start (schedules multi-note phrases). */
  at?: number
  /** Seconds from onset to silence (attack + decay). */
  dur: number
  attack?: number // seconds, default 4ms — percussive
  gain?: number   // peak, default 0.2
  /** Optional lowpass cutoff (Hz) — softens/darkens the tone. */
  lowpass?: number
}

/** The tonal synthesis primitive: one oscillator through an (optional)
 *  lowpass and a percussive gain envelope, onto the SFX bus. Every gesture
 *  below is a phrase of these. Exponential ramps can't touch zero, so
 *  envelopes float on 0.0001. */
function tone(spec: ToneSpec): void {
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

/** The noise primitive: white noise through a bandpass whose center sweeps
 *  `from → to` — the metallic "shhing" of steel leaving a scabbard when swept
 *  upward fast. Also onto the SFX bus. */
function noiseSweep(spec: { at?: number; from: number; to: number; dur: number; gain?: number; q?: number }): void {
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

/** Pentatonic step → Hz: walks MINOR_PENTA upward from A4, wrapping into the
 *  next octave every 5 steps, capped two octaves up so deep batches (12 gaps)
 *  never climb into shrillness. */
function pentaFreq(step: number): number {
  const st = Math.min(
    MINOR_PENTA[step % MINOR_PENTA.length] + 12 * Math.floor(step / MINOR_PENTA.length),
    24,
  )
  return A4 * 2 ** (st / 12)
}

// ── The ambient bed ──────────────────────────────────────────────────────────
// Zen meditation hum: two barely-detuned low A drones whose interference
// beats at ~0.34 Hz (the binaural-style throb), a quiet octave + fifth for
// warmth, and lowpassed noise whose cutoff and level drift on sub-0.1 Hz
// LFOs — hollow, slow ocean swells. Fades in over ~2.5s, out over ~1.2s.

function startBedNodes(): void {
  if (bed || !musicOn) return
  const ac = context()
  if (!ac || !musicBus) return
  const t0 = ac.currentTime

  const out = ac.createGain()
  out.gain.setValueAtTime(0.0001, t0)
  out.gain.linearRampToValueAtTime(1, t0 + BED_FADE_IN_S)
  out.connect(musicBus)

  const sources: { stop: () => void }[] = []
  const drone = (freq: number, level: number) => {
    const osc = ac.createOscillator()
    osc.frequency.setValueAtTime(freq, t0)
    const g = ac.createGain()
    g.gain.value = level
    osc.connect(g)
    g.connect(out)
    osc.start(t0)
    sources.push(osc)
  }
  drone(110, 0.4)      // A2 — the hum
  drone(110.34, 0.4)   // …beating against it at ~0.34 Hz
  drone(220.5, 0.12)   // octave shimmer, itself slowly beating
  drone(164.8, 0.09)   // E3, a soft fifth for warmth

  // Ocean: looped noise → lowpass (cutoff drifting 200–840 Hz) → swell gain.
  const src = ac.createBufferSource()
  src.buffer = sharedNoise(ac)
  src.loop = true
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 520
  const swell = ac.createGain()
  swell.gain.value = 0.16
  src.connect(lp)
  lp.connect(swell)
  swell.connect(out)

  const lfo = (hz: number, depth: number, target: AudioParam) => {
    const osc = ac.createOscillator()
    osc.frequency.value = hz
    const g = ac.createGain()
    g.gain.value = depth
    osc.connect(g)
    g.connect(target)
    osc.start(t0)
    sources.push(osc)
  }
  lfo(0.06, 320, lp.frequency)   // the tide: cutoff drifts open and closed
  lfo(0.045, 0.09, swell.gain)   // the swell: level rises and falls

  src.start(t0)
  sources.push(src)
  bed = { out, sources }
}

function stopBedNodes(): void {
  if (!bed || !ctx) return
  const dying = bed
  bed = null
  dying.out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + BED_FADE_OUT_S)
  window.setTimeout(() => {
    dying.sources.forEach(s => { try { s.stop() } catch { /* already stopped */ } })
  }, BED_FADE_OUT_S * 1000 + 200)
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

  // ── The ambient bed (game screens call these on mount/unmount) ─────────────
  startBed(): void { bedWanted = true; startBedNodes() },
  stopBed(): void { bedWanted = false; stopBedNodes() },

  // ── Gestures ───────────────────────────────────────────────────────────────
  /** Any small UI tap (PLAY, mode switch) — a barely-there tick. */
  uiTap(): void {
    tone({ freq: 1300, dur: 0.045, gain: 0.06 })
  },

  /** Countdown beat (3 · 2 · 1) — a soft, even metronome blip. */
  count(): void {
    tone({ freq: 700, dur: 0.07, gain: 0.1 })
  },

  /** The fourth beat — GO: the decisive run-start note the 3·2·1 resolves
   *  into (E5 pickup onto a ringing A5 + octave sheen). */
  go(): void {
    tone({ freq: 659, type: 'triangle', dur: 0.09, gain: 0.14 })
    tone({ freq: 880, type: 'triangle', at: 0.09, dur: 0.35, gain: 0.16 })
    tone({ freq: 1760, at: 0.09, dur: 0.3, gain: 0.07 })
  },

  /** A gap blooming during MEMORIZE, `step` = its 0-based position in the
   *  reveal sequence. Two layers:
   *  - the NOTE: one minor-pentatonic step up per bloom, so the sequence
   *    plays as a rising melody — pitch order encodes reveal order, a real
   *    memory hook for hard mode's ordered recall;
   *  - the EDGE: a fast upward bandpassed-noise sweep + a high inharmonic
   *    partial — the "shing" of a sword drawn from its scabbard. */
  bloom(step: number): void {
    const f = pentaFreq(step)
    tone({ freq: f, dur: 0.45, attack: 0.006, gain: 0.15, lowpass: 3200 })
    tone({ freq: f * 3.02, dur: 0.16, gain: 0.045 })
    noiseSweep({ from: 1400, to: 6800, dur: 0.24, gain: 0.12, q: 2.2 })
  },

  /** A correct recall — the game-show / consecutive-stomp escalation: a
   *  chiptune coin blip (square base note + a perfect fourth above) that
   *  climbs the A MAJOR scale one degree per streak step (capped two octaves
   *  up), restarting at the root when the streak breaks — you HEAR the
   *  multiplier wind up and reset. Every 5th streak step lands a 1-Up-style
   *  rising run: the "you eventually get there" reward. */
  pickCorrect(streak: number): void {
    const step = Math.min(Math.max(streak, 1) - 1, 14)
    const base = A4 * 2 ** ((MAJOR[step % MAJOR.length] + 12 * Math.floor(step / MAJOR.length)) / 12)
    tone({ freq: base, type: 'square', dur: 0.08, gain: 0.085 })
    tone({ freq: base * 2 ** (5 / 12), type: 'square', at: 0.07, dur: 0.26, gain: 0.085 })
    tone({ freq: base * 2, at: 0.07, dur: 0.3, gain: 0.05 })
    if (streak > 0 && streak % 5 === 0) {
      // The milestone flourish: a quick six-note A-major run (1-Up energy).
      ;[880, 1109, 1319, 1760, 2217, 2637].forEach((freq, i) =>
        tone({ freq, type: 'square', at: 0.16 + i * 0.055, dur: 0.12, gain: 0.07 }))
    }
  },

  /** A miss — a short dissonant buzz falling out of the scale, under the red
   *  border flash + board shake. Deliberately unmusical (saw glide + low
   *  thud): the only "wrong" texture in the palette. */
  pickWrong(): void {
    tone({ freq: 150, endFreq: 95, type: 'sawtooth', dur: 0.22, gain: 0.26, lowpass: 420 })
    tone({ freq: 82, dur: 0.18, gain: 0.2 })
  },

  /** Batch CLEAR! — a quick rising A-major arpeggio (A5 C#6 E6) with a
   *  sparkle tail: the run's core "you did it" resolution. */
  batchClear(): void {
    tone({ freq: 880, type: 'triangle', at: 0, dur: 0.18, gain: 0.14 })
    tone({ freq: 1109, type: 'triangle', at: 0.07, dur: 0.18, gain: 0.14 })
    tone({ freq: 1319, type: 'triangle', at: 0.14, dur: 0.22, gain: 0.14 })
    tone({ freq: 1760, at: 0.21, dur: 0.4, gain: 0.08 })
  },

  /** The time → score "Lift" payoff — a gentle filtered riser under the bar
   *  draining into the score, sized to the animation window (ms). */
  bonusLift(ms: number): void {
    const dur = Math.max(0.3, (ms / 1000) * 0.75)
    tone({ freq: 260, endFreq: 1040, type: 'sawtooth', dur, attack: 0.1, gain: 0.07, lowpass: 1200 })
  },

  /** An extra life earned (every 5000 pts) — a warm two-note rise (E5 → A5)
   *  under the heart burst. */
  lifeGained(): void {
    tone({ freq: 659, type: 'triangle', at: 0, dur: 0.2, gain: 0.16 })
    tone({ freq: 880, type: 'triangle', at: 0.09, dur: 0.35, gain: 0.18 })
  },

  /** The select clock expiring — a falling "womp" (life lost, same batch
   *  replays). Downward glide: the opposite arc of every reward. */
  timeout(): void {
    tone({ freq: 330, endFreq: 110, type: 'sawtooth', dur: 0.55, gain: 0.22, lowpass: 600 })
    tone({ freq: 220, endFreq: 82, dur: 0.5, gain: 0.14 })
  },

  /** Run over — a slow descending A-minor-flavored farewell (A4 E4 A3),
   *  long releases; elegiac, not punishing. Matches "Memory Fades" — and
   *  reads as designed against the bed's hum, which keeps humming under it. */
  gameOver(): void {
    tone({ freq: 440, at: 0.12, dur: 0.5, gain: 0.16 })
    tone({ freq: 330, at: 0.34, dur: 0.55, gain: 0.16 })
    tone({ freq: 220, at: 0.6, dur: 0.9, gain: 0.16, type: 'triangle' })
  },
}
