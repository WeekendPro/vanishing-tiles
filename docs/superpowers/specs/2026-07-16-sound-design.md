# Sound Design — the Afterglow audio layer

**Date:** 2026-07-16
**Status:** Shipped for web (v1 palette). Haptics deferred to the React Native port.
**Code:** `src/lib/sfx.ts` (engine + palette) · toggle in `GlobalMenu` · setting in `settingsStore` (`soundEnabled`)

## The technology decision

We evaluated the React Native audio ecosystem for the eventual mobile port and
chose to standardize on the **Web Audio API** as the game's audio contract:

- **Today (web POC):** the browser's built-in `AudioContext` — no npm package,
  no assets, no hosting.
- **At RN port time:** [`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api)
  (Software Mansion), a native implementation of the *same* Web Audio spec.
  The synthesis code in `sfx.ts` is written against only that spec and imports
  nothing from the app, so it carries over essentially verbatim.

Libraries considered and passed on for SFX: `expo-audio` (real latency on
short sounds — buffering starts at `play()`; fine for a future music bed),
`react-native-track-player` (music-app machinery), `react-native-sound`
(unmaintained).

### Files vs. synthesis

The Web Audio API ships **no sounds** — it is an engine, not a soundbank. The
two ways to make noise with it:

1. **Load audio files** — `fetch` → `decodeAudioData` → play the buffer. Files
   would live in the repo (`/public`) and ship with the bundle; no external
   hosting or infra needed even on this path.
2. **Synthesize** — build tones from oscillators + gain envelopes + filters at
   trigger time. Zero assets, zero bytes, zero latency, endlessly tweakable in
   code.

**We chose synthesis.** It fits the Afterglow aesthetic (clean phosphor tones,
not sampled foley), keeps the bundle empty of assets, and makes every sound a
few lines of reviewable code. If a future sound genuinely needs production
polish (e.g. a licensed music bed), path 1 slots in beside the synth palette
without changing the gesture API.

## The musical system

Everything is rooted on **A** so the whole game stays in one key:

- **Reveals** walk the **A minor pentatonic** (tense, neon, unresolved).
- **Rewards** land on the **A major triad** (resolution, warmth).
- **Failures** live *below* the root as inharmonic saw buzzes and downward
  glides — consequence reads as pitch falling out of the scale.

Two load-bearing pitch rules (not just polish):

- **Reveal blooms climb one pentatonic step per gap** — the memorize sequence
  plays as a rising melody, so pitch order *encodes reveal order*. That's a
  real memory hook for Hard mode's ordered recall.
- **Correct picks climb one semitone per streak step** (capped +1 octave) and
  restart at the root when the streak breaks — you *hear* the streak wind up
  and reset, mirroring the ×N scoring rule.

## Gesture → sound map

| Gesture | Trigger point | Sound |
|---|---|---|
| UI tap (PLAY, mode switch) | `HomeScreen` | 1.3 kHz tick, 45 ms — barely there |
| Countdown beat (3·2·1) | `StaggerCountdown` | soft 700 Hz metronome blip |
| Gap bloom (memorize) | reveal driver, per gap | airy lowpassed sine + octave shimmer, pentatonic ascent per step |
| Correct recall | `pickPiece` ok (also Training) | bright triangle blip, +1 semitone per streak |
| Miss / wrong pick | `pickPiece` miss (also Training) | saw glide 150→95 Hz + 82 Hz thud, under the red flash + shake |
| Batch CLEAR! | batch cleared | rising A-major arpeggio (A5–C#6–E6) + sparkle tail |
| Speed-bonus Lift | lift payoff (bonus > 0) | filtered saw riser sized to the 1.3 s drain window |
| Extra life earned | life delta > 0 while selecting | warm two-note rise E5→A5 under the heart burst |
| Select clock timeout | expiry before `timeoutBatch` | falling "womp" 330→110 Hz — life lost, batch replays |
| Game over | once-per-run guard | slow descending farewell A4–E4–A3; elegiac ("Memory Fades"), not punishing |

Deliberately silent: pause/resume (a pause should *remove* stimulation),
board taps, and the reveal→recall handoff (the amber bar carries it).

## Constraints & mechanics

- **Autoplay unlock:** browsers refuse audio before a user gesture. The PLAY
  tap (and mode-switch taps) call `sfx.unlock()`; every trigger also retries a
  `resume()`. A missed unlock degrades to silence, never an error. This
  constraint disappears on React Native.
- **Mute:** `settingsStore.soundEnabled` (persisted, default on) mirrors into
  the engine; checked at trigger time so muting mid-run silences instantly.
  Toggle lives in the global menu ("Sound: On/Off").
- **Tests:** `tests/lib/sfx.test.ts` fakes `AudioContext` and pins the
  contract — lazy context, mute gate, streak climb + cap, bloom ascent + cap,
  jsdom no-op safety.

## Deferred / next

- **Haptics** (RN port): map the same semantic gestures to `expo-haptics`
  presets — `selectionAsync` on picks, `notificationAsync(Success/Error)` on
  clear/miss, impact on game over. No web equivalent worth shipping
  (`navigator.vibrate` is Android-Chrome-only).
- Volume slider (single master gain already exists — `MASTER_GAIN`).
- Optional ambient music bed (this is where `expo-audio`/files would enter).
- Per-piece-type notes in Training (bind pitch → tetromino name while learning).
