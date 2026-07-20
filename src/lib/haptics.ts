/**
 * Haptics — the game's TOUCH layer, spoken in the SAME semantic game gestures
 * as sound (`haptics.pickCorrect(streak)`, `haptics.bloom()`, …). It is the
 * tactile twin of `src/lib/sfx.ts`: screens/stores fire a gesture and BOTH the
 * sound and the buzz that belong to it happen. How a gesture FEELS lives only
 * here, exactly as how it SOUNDS lives only in sfx.
 *
 * Every gesture is a PATTERN — plain data (a vibration duration, or a
 * buzz/pause/buzz array in milliseconds) handed to the one web primitive for
 * this: `navigator.vibrate`. That API is a blunt on/off motor pulse — we author
 * TIMING, never texture/intensity (the web has no access to iOS's light/medium/
 * heavy Taptic flavors). Rich per-event haptics arrive with the React Native
 * port; see PORTABILITY below.
 *
 * PLATFORM REACH — this is the load-bearing caveat:
 *   • Android (Chrome, installed PWA): fully supported, buzzes as authored.
 *   • iOS (Safari, installed PWA): `navigator.vibrate` is UNSUPPORTED. Apple has
 *     never shipped the Vibration API, standalone PWA included, so every call
 *     here is a silent no-op on iPhone/iPad. Nothing is felt — and nothing
 *     breaks. `isSupported()` reports this so the UI can hide a dead toggle.
 *
 * PORTABILITY: like sfx, this module imports nothing from the app and touches
 * only one platform primitive (`navigator.vibrate`). The React Native port
 * swaps the `fire()` sink for `expo-haptics` / `react-native-audio-api`'s haptic
 * peer (the Taptic Engine on iOS, the vibrator on Android) — the gesture surface
 * and the per-gesture patterns below carry over as-is, and iPhone finally buzzes.
 *
 * BACKGROUNDING: a backgrounded page can't (and shouldn't) vibrate; `fire()`
 * bails when the document is hidden so a stray timer-driven buzz never fires
 * into a pocketed phone.
 *
 * The gesture set + intent map mirrors the sound design doc
 * (docs/superpowers/specs/2026-07-16-sound-design.md) — every sound that marks a
 * felt moment has a buzz here; ambient/among-the-noise sounds are left silent.
 */

/** A vibration pattern: a single buzz length in ms, or a [buzz, pause, buzz, …]
 *  sequence (odd indices are pauses), as `navigator.vibrate` accepts. */
export type HapticPattern = number | number[]

/** The shipped feel palette — one pattern per felt gesture. `pickCorrect` and
 *  `urgentTick` are voiced at their gentlest here (streak 1 / heat 0) and scaled
 *  up per-call, mirroring how sfx transposes the coin and the urgency tick. */
export const HAPTIC_PATTERNS = {
  /** Any small UI tap (PLAY, mode switch, a toggle) — a barely-there tick. */
  uiTap: 8,
  /** Countdown beat (3 · 2 · 1) — a soft, even blip per number. */
  count: 10,
  /** GO — the decisive run-start hit: a short pickup into a firmer strike. */
  go: [24, 40, 40],
  /** A gap blooming during MEMORIZE — a light tick per reveal, so the sequence
   *  is felt as well as seen/heard (the tactile echo of the rising bloom). */
  bloom: 8,
  /** A correct recall at streak 1 — a clean confirm tap. Scaled up with the
   *  streak (see `pickScale`) so a deep streak lands with more weight. */
  pickCorrect: 12,
  /** A miss — a jarring double buzz, the one "wrong" texture in the palette,
   *  paired with the red flash + board shake. */
  pickWrong: [40, 30, 40],
  /** Batch CLEAR! — a bright ascending triple: the core "you did it" payoff. */
  batchClear: [20, 40, 20, 40, 40],
  /** The speed-bonus lift — a rolling flutter under the bar draining to score. */
  bonusLift: [14, 30, 18, 30, 22],
  /** An extra life earned — a warm, rounded double under the heart burst. */
  lifeGained: [22, 50, 22],
  /** One urgency tick at heat 0 — a faint pulse, growing firmer toward expiry
   *  (see `urgentScale`), the tactile side of the accelerating clock. */
  urgentTick: 8,
  /** The select clock expiring — a single heavy "womp" (a life lost). */
  timeout: 70,
  /** Run over — a long, fading farewell cadence; elegiac, not punishing. */
  gameOver: [80, 60, 55, 60, 35, 60, 20],
} as const satisfies Record<string, HapticPattern>

export type HapticId = keyof typeof HAPTIC_PATTERNS

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** The correct-pick buzz grows with the streak — a clean 12ms tap at streak 1,
 *  lengthening ~2ms per step up to a firm 26ms cap so deep streaks feel meatier
 *  without ever turning into a long rumble (the tactile echo of the coin's pitch
 *  climb; the streak-break resets it to the root just like the sound). */
export function pickScale(streak: number): number {
  return Math.min(26, 10 + 2 * Math.max(1, streak))
}

/** The urgency tick winds UP toward expiry: an 8ms whisper at heat 0 climbing to
 *  a 22ms jolt at heat 1 — the tactile accelerando under the ticking clock. */
export function urgentScale(heat: number): number {
  return Math.round(8 + 14 * clamp01(heat))
}

// ── Engine state ─────────────────────────────────────────────────────────────

/** On/off, checked at trigger time so toggling mid-run is instant (mirrors sfx's
 *  `sfxOn`). Driven by settingsStore; defaults on where haptics exist. */
let hapticsOn = true

/** True where the Vibration API exists at all — Android/Chromium yes, iOS no.
 *  Feature-detected once per call (cheap) so SSR/jsdom and iOS all report false
 *  and every gesture degrades to a clean no-op. */
function supported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** The single sink: gate on the channel + platform + foreground, then buzz.
 *  Wrapped so a browser that rejects vibration (no user activation yet, private
 *  mode, an experimental engine) degrades to silence, never an error — exactly
 *  sfx's "a missed unlock degrades to silence" contract. */
function fire(pattern: HapticPattern): void {
  if (!hapticsOn || !supported()) return
  // A backgrounded page can't vibrate (and a buzz into a pocketed phone from a
  // stray timer would be noise) — most engines ignore it, we make it explicit.
  if (typeof document !== 'undefined' && document.hidden) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* vibration unavailable / blocked — silent, like a muted sound */
  }
}

export const haptics = {
  // ── Channel control (driven by settingsStore, paralleling sfx) ──────────────
  /** Haptics on/off. Checked at trigger time, so muting mid-run is instant. */
  setEnabled(on: boolean): void { hapticsOn = on },
  isEnabled(): boolean { return hapticsOn },

  /** Whether this device has the Vibration API at all (Android yes, iOS no).
   *  The menu hides its Haptics toggle where this is false — a control that
   *  could never do anything is worse than no control. */
  isSupported(): boolean { return supported() },

  /** Stop any in-progress pattern (pause / exit). No-op where unsupported. */
  cancel(): void { if (supported()) { try { navigator.vibrate(0) } catch { /* ignore */ } } },

  // ── Gestures (the tactile twins of sfx's) ───────────────────────────────────
  uiTap(): void { fire(HAPTIC_PATTERNS.uiTap) },
  count(): void { fire(HAPTIC_PATTERNS.count) },
  go(): void { fire(HAPTIC_PATTERNS.go) },
  bloom(): void { fire(HAPTIC_PATTERNS.bloom) },
  pickCorrect(streak: number): void { fire(pickScale(streak)) },
  pickWrong(): void { fire(HAPTIC_PATTERNS.pickWrong) },
  batchClear(): void { fire(HAPTIC_PATTERNS.batchClear) },
  bonusLift(): void { fire(HAPTIC_PATTERNS.bonusLift) },
  lifeGained(): void { fire(HAPTIC_PATTERNS.lifeGained) },
  urgentTick(heat: number): void { fire(urgentScale(heat)) },
  timeout(): void { fire(HAPTIC_PATTERNS.timeout) },
  gameOver(): void { fire(HAPTIC_PATTERNS.gameOver) },
}
