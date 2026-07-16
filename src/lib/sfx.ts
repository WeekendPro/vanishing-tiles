/**
 * Sound effects — the game's audio layer, spoken entirely in SEMANTIC game
 * gestures (`sfx.pickCorrect(streak)`, `sfx.bloom(step)`, …), never in audio
 * tech. Screens/stores call these; how a gesture SOUNDS lives only here.
 *
 * Every sound is SYNTHESIZED on a Web Audio graph at trigger time — there are
 * no audio files, nothing to host, nothing to preload, zero bytes of assets.
 * That fits the Afterglow aesthetic (clean neon tones, not sampled foley) and
 * keeps the whole palette tweakable in code.
 *
 * PORTABILITY: this module deliberately uses ONLY the standard Web Audio API
 * (AudioContext / OscillatorNode / GainNode / BiquadFilterNode) and imports
 * nothing from the app. The planned React Native port swaps the context
 * source for `react-native-audio-api` (Software Mansion), which implements
 * this same spec — the synthesis code carries over as-is.
 *
 * BROWSER AUTOPLAY: browsers refuse to start audio until a user gesture.
 * `unlock()` must be called from a tap handler (the Home screen's PLAY does
 * this) before any timer-driven sounds (reveal blooms, timeouts) can play;
 * afterwards the context stays running. Every trigger also retries a resume,
 * so a missed unlock degrades to silence, never an error.
 *
 * The design map (which gesture gets which sound, and why) is documented in
 * docs/superpowers/specs/2026-07-16-sound-design.md.
 */

// The musical spine: everything is rooted on A so the whole game stays in one
// key. Reveals walk the A MINOR pentatonic (tense, neon); rewards land on the
// A MAJOR triad (resolution). Misses/failures live below the root as
// inharmonic buzzes — consequence reads as pitch falling out of the scale.
const A4 = 440
const MINOR_PENTA = [0, 3, 5, 7, 10] // semitone offsets: A C D E G

const MASTER_GAIN = 0.5

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = true

/** Lazily create (and re-resume) the shared context. Returns null wherever
 *  Web Audio doesn't exist (jsdom tests, SSR) — every sound no-ops safely. */
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
  }
  // Autoplay policy: a suspended context resumes silently on the next
  // gesture-driven trigger. Fire-and-forget — failure just means silence.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
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

/** The single synthesis primitive: one oscillator through an (optional)
 *  lowpass and a percussive gain envelope. Every gesture below is a phrase of
 *  these. Exponential ramps can't touch zero, so envelopes float on 0.0001. */
function tone(spec: ToneSpec): void {
  if (!enabled) return
  const ac = context()
  if (!ac || !master) return
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
  env.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
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

export const sfx = {
  /** Master mute — flipped by the Sound setting. Sounds check this at trigger
   *  time, so muting mid-run silences instantly. */
  setEnabled(on: boolean): void { enabled = on },
  isEnabled(): boolean { return enabled },

  /** Create/resume the audio context from a USER GESTURE (autoplay policy).
   *  The Home screen's PLAY tap calls this so the run's timer-driven sounds
   *  (blooms, timeout) are already unlocked when they fire. */
  unlock(): void { if (enabled) context() },

  /** Any small UI tap (PLAY, mode switch) — a barely-there tick. */
  uiTap(): void {
    tone({ freq: 1300, dur: 0.045, gain: 0.06 })
  },

  /** Countdown beat (3 · 2 · 1) — a soft, even metronome blip. */
  count(): void {
    tone({ freq: 700, dur: 0.07, gain: 0.1 })
  },

  /** A gap blooming during MEMORIZE, `step` = its 0-based position in the
   *  reveal sequence. Each bloom climbs one minor-pentatonic step, so the
   *  sequence plays as a rising melody — pitch order encodes reveal order,
   *  a genuine memory hook for hard mode's ordered recall. Airy and soft:
   *  lowpassed fundamental + a quiet octave shimmer. */
  bloom(step: number): void {
    const f = pentaFreq(step)
    tone({ freq: f, dur: 0.5, attack: 0.008, gain: 0.18, lowpass: 2400 })
    tone({ freq: f * 2, dur: 0.3, attack: 0.008, gain: 0.05 })
  },

  /** A correct recall — a bright blip that climbs one semitone per streak
   *  step (capped an octave up), so a hot streak audibly winds tighter.
   *  Streak 1 restarts at the root: you HEAR a broken streak reset. */
  pickCorrect(streak: number): void {
    const f = 659 * 2 ** (Math.min(Math.max(streak, 1) - 1, 12) / 12) // E5 + streak semitones
    tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.16 })
    tone({ freq: f * 2, dur: 0.22, gain: 0.07 })
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
   *  long releases; elegiac, not punishing. Matches "Memory Fades". */
  gameOver(): void {
    tone({ freq: 440, at: 0.12, dur: 0.5, gain: 0.16 })
    tone({ freq: 330, at: 0.34, dur: 0.55, gain: 0.16 })
    tone({ freq: 220, at: 0.6, dur: 0.9, gain: 0.16, type: 'triangle' })
  },
}
