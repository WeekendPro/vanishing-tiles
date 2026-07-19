# Vanishing Tiles — Project Context

**Vanishing Tiles** is a memory-and-speed puzzle game (a Tetris × Streets of Rage mashup). The web POC is
complete and playable. The eventual goal is a React Native mobile app published to
the Apple App Store. (Vanishing Tiles was formerly named "Vanishing Shapes", before that "Phosphor", and
originally codenamed "Gap City"; those earlier names survive only in internal identifiers — district slugs,
localStorage keys, applied migrations, and the `phos`/`vs`-derived names in dated specs/plans. The
phosphor-inspired *visual* system is still called **Afterglow**; the runtime design tokens were renamed
`phos-*` → `vs-*` → `vt-*`.)

**Run the app:** `npm run dev` → http://localhost:5173  
**Run tests:** `npm run test` (all must pass before any commit)  
**Type check:** `npx tsc --noEmit` (or `npm run build`, which also catches `noUnusedLocals`)

---

## The Game

Players memorize the shape of empty gaps in a pre-filled grid, then pick the Tetris-style pieces needed to fill them — all under time pressure. The shipped MVP is a single endless mode, **Infinite Stagger** (plus a consequence-free **Training** drill). The earlier Journey (transit-map level hub) and Practice (4-round gauntlet) modes have been **fully removed** from the codebase — see "Legacy modes (removed)" below.

### Entry flow

`src/App.tsx` gates on a Supabase session (`getSession()`): no session → `AuthScreen`; session present → `routeAfterAuth()` (`src/store/profileStore.ts`), which loads the caller's `profiles` row and routes: non-guest with no `display_name` → `ClaimNameScreen` (a mandatory "Choose your display name" gate — no skip), otherwise → `HomeScreen`. AuthScreen's email/guest sign-ins route through the same helper (Google OAuth re-enters via the mount effect after its redirect). Display names are handle-style — `^[A-Za-z][A-Za-z0-9_]{2,15}$`, case-insensitively unique across non-guests — claimed/edited via the `set_display_name` RPC (migration `0015`); `src/lib/displayName.ts` mirrors the exact validation client-side, and `profileStore` is the single source of identity truth (the menu no longer derives names from auth metadata). Guests skip the gate entirely and stay unnamed/unranked. `AuthScreen` offers email/password (sign in + create account), Google OAuth, and a "Continue as guest" anonymous sign-in (`supabase.auth.signInAnonymously()`); a `signInWithApple` helper exists in `src/lib/auth.ts` but isn't wired into any button yet. `HomeScreen` is one decision + one action: a three-segment difficulty switch — **Easy / Medium / Hard** — plus a single **PLAY** button pinned to the bottom thumb arc, under the vertically centered wordmark. The difficulty persists via `useSettingsStore` (localStorage); PLAY always starts an Infinite Stagger run (`src/components/StaggerScreen.tsx`) at the selected difficulty. Training's ONLY entry point is the global hamburger menu (`GlobalMenu.tsx`) — its "Training" action (directly after Leaderboard) fires `sfx.unlock()` (the menu tap is the audio-unlock gesture) then starts the drill; it's no longer a "mode zero" segment on the Home switch. The menu is the profile header (initials avatar + display name; for non-guests it's TAP-TO-EDIT with a pencil glyph next to the name — opens the shared `DisplayNameForm` in an overlay) + **Leaderboard** + **Training** + a **Sound** row (on/off toggle + volume slider) + **Sound Design** (the calibration lab, `SoundDesignScreen.tsx`) + Logout (Settings and Reset Journey were removed; guests get a generic person-icon avatar instead of initials, and "Sign up" instead of Logout). Leaderboard opens the global rankings screen (`LeaderboardScreen.tsx`): per-mode Easy/Medium/Hard boards (tabs echo the Home mode switch), a "you-hero" card with the caller's rank + per-metric ranks, and a top-50 table where the caller's row wears a YOU tag. Data comes from the `get_stagger_leaderboard` RPC (migration `0014`, layered on `0013`'s `stagger_stats`; re-created by `0015` to hide profiles that haven't claimed a display name yet — their stats reappear once they claim); guests see the board but rank as null and get a dashed sign-up nudge instead of the hero card. The Stagger game-over summary links straight to the leaderboard (it lands on the finished run's mode tab for free — the board opens on the persisted difficulty, which is what the run was started with), and the in-run/Training pause buttons are icon-only (two-bar glyph, `aria-label="Pause"`). (There is no longer any "Experimental Modes" entry point or `SHOW_EXPERIMENTAL` toggle — the legacy Journey/Practice modes it once gated have been removed.)

### Infinite Stagger

One continuous run: each **batch** reveals `N` gaps one at a time (a "bloom" flash-then-decay per gap, `src/store/staggerStore.ts` + `src/components/StaggerScreen.tsx`), then the player recalls them from a piece tray under a select clock. Clearing a batch immediately starts the next, slightly harder batch — there's no level/round framing, briefing, or "Done" button. The run ends when lives hit 0.

**Three player-selected modes** (`mode`, a `Difficulty` from `src/store/settingsStore.ts`, snapshotted into `staggerStore.mode` at `startRun(mode)` — that snapshot, not the live setting, drives all in-run visuals/ordering):

- **Easy** — gaps reveal in their own piece color; recall in any order.
- **Medium** — gaps reveal monochrome neon pink (`#FF2D9B`); recall in any order.
- **Hard** — gaps reveal monochrome neon pink; picks must match the **order the gaps were revealed in** (enforced in `pickPiece` against `revealPlan`), with an "IN ORDER" chip shown above the tray as a reminder.

The recall tray always shows pieces in their own piece colors, in every mode — only the reveal phase goes monochrome on Medium/Hard.

**Difficulty ramp** (`src/lib/staggerCurve.ts`, `STAGGER_CURVE` + `SHAPE_SCHEDULE`) — a single infinite ramp, not per-level tables: gap count holds at 3 for levels 1–4, then climbs one gap every three levels up to a cap of 12 at level 29+ (terminal rung for the endless tail). The shape pool opens on O + I, then adds one shape at a time — L (L2), J (L3), T (L6), S (L7), Z (L10) — so all seven tetrominoes are in play by level 10. Gap rotation is locked to the tray's display rotation until orientation frees at level 9 (`ORIENTATION_FREE_FROM = 8`, 0-based). Exactly one of these levers (gap count / shape variety / orientation) moves per level. Reveal pacing (flash/hold/decay timing) is **constant** across the whole run — the ramp never speeds up the reveal itself. The select clock is `(6000 + gaps × 1400) × max(0.7, 1 − 0.005 × batchIndex)` ms — it grows with gap count but slowly tightens (floor 70% of nominal) as the run goes on, so late-run batches stay tense even after the gap count caps out.

**Scoring** — streak is the only score multiplier: each correct pick is worth `100 × currentStreak` points, where `currentStreak` is the run of consecutive correct picks (broken by any miss). A miss both breaks the streak **and** costs a life. Clearing a batch banks a separate speed bonus (up to 500 points, ratio of select-clock time remaining) via `bankSpeedBonus`. The run starts with 5 lives (`STAGGER.START_LIVES`); one extra life is earned per 5000 cumulative points (`STAGGER.LIFE_EVERY`). Letting the select clock expire also costs a life and **replays the same batch** (same gaps, unfilled) rather than advancing. The run ends at 0 lives; otherwise it's endless.

### Training (learn the piece names)

A consequence-free naming drill (`src/store/trainingStore.ts` + `src/components/TrainingScreen.tsx`): one tetromino at a time blooms onto the same 12×12 void board in its own piece color (the game's exact reveal flash-in, but HELD lit — CSS `.vt-bloom-hold`), and the player taps the letter that names it from a 7-letter tray (white uppercase I/O/T/S/Z/J/L). A correct pick flips the prompt to a lime "CORRECT", floats the **selection time** (appearance → correct pick, e.g. "3.7s") off the piece in the game's bubbly "+points" style, and fades the piece out with the reveal's ghost-tail decay (`.vt-bloom-decay`) at a much brisker clip than in-game (420ms + 90ms wave — training has no clock, so inter-piece downtime is kept short), then the next piece (always a different type, always at the tray's `DISPLAY_ROTATION`, random board position) blooms in. A wrong pick gives the in-game miss feedback (red border flash + board shake) and breaks the streak — and the speed clock keeps running, so fumbles surface in the eventual correct pick's time. **No score, no select clock, no lives** — the HUD tracks the current streak (left) plus the running **average selection speed** and best streak (right). An "Exit Training" button below the tray leaves at any moment. Nothing persists.

### Legacy modes (removed)

Journey (a transit/brain/git-map level hub: main puzzle + 4 opt-in badges) and Practice (the old 4-round gauntlet) have been **completely removed** from the codebase — there is no live or hidden code path to either. Removal happened in two passes:

- **Frontend** (commit `0ed1fa9`): every Journey/Practice screen, phase, and store — `JourneyScreen`, `LevelScreen`, `JourneyMap/`, `GameShell`, `ResolutionPhase/`, `SelectingPhase`, `ViewingPhase`, `CountdownPhase`, `BriefingPhase`, the `level/`+`briefing/` dirs, `gameStore.ts`, `progressStore.ts`, `journeyScoring.ts`, and the `SHOW_EXPERIMENTAL` toggle.
- **Backend + shared** (this follow-up): the `start_session`/`submit_attempt` edge functions and the `_shared` engine code only they used (`cors.ts`, `core/scoring.ts`, `core/levelConfig.ts`, `core/themeResolution.ts`, `engine/solver.ts`, `engine/cartSlots.ts`), plus the last dead client trims (`lib/components.ts`; `settingsStore`'s `hideBriefing`/`mapStyle`; `navStore`'s journey/level/practice routes; `api.ts`'s `getJourney`/`getLevel`/`getStats`/`submitLevelResult`).

The legacy Journey/Practice **DB schema** (the `levels` / `level_sessions` tables + `seed.sql`) still exists but is fully dormant — no remaining code path reads or writes it. All of the removed code is recoverable from git history (frontend prior to `0ed1fa9`; earlier-removed mechanics — SOLOS/TWINS/TRIPLETS/TRANSFORMERS/CRAWLERS levels, pairs/triples reveal chunking, inverted reveal, the calibration sandbox — at the git tag `pre-mvp-simplification`). Background: `docs/superpowers/specs/2026-06-08-journey-rework-design.md`, `docs/superpowers/plans/2026-07-15-three-mode-mvp-simplification.md`.

### Piece types

`I, O, T, S, Z, J, L` — the seven standard tetrominoes (4 cells each). The `SINGLE` (1-cell decoy) piece type has been removed from `PieceType`; the "efficiency" scoring pillar it existed to drive was retired with the legacy Journey/Practice scoring code.

---

## Architecture

### File map

Shared game engine + types live OUTSIDE `src/`, at `supabase/functions/_shared/`. This was originally so Supabase Edge Functions could import the same code as the client; those edge functions are gone now, so `_shared` is imported only by the client — but the directory + the Vite/Vitest `@shared` → `supabase/functions/_shared` alias (see `vite.config.ts`) are kept as-is.

```
supabase/functions/_shared/
  types.ts             — PieceType (I/O/T/S/Z/J/L — no SINGLE), Rotation, Cell, Grid, Gap, DifficultyConfig
  engine/
    pieces.ts          — PIECE_DEFINITIONS, getRotatedCells(), getPieceColor()
    puzzleGenerator.ts — generatePuzzle({ gapCount, complexity, allowedTypes, lockedRotations, ... }) → { grid, gaps }; the live game (staggerStore) is its only caller
  core/
    prng.ts            — makeRng()/randomSeed() seeded RNG; now used only by the puzzleGenerator tests (the live game passes the default Math.random)
    themeConfig.ts     — THEME_CONFIG + GAP_COLOR_IDS; now referenced only by the puzzleGenerator colorCoded test
```

(`prng.ts` + `themeConfig.ts` survive only because the puzzleGenerator tests still exercise `generatePuzzle`'s legacy `adjacency`/`colorCoded`/`sequential`/`seed` option branches, which remain in the live generator. Everything else that used to live under `_shared/core` + `_shared/engine` — `scoring.ts`, `levelConfig.ts`, `themeResolution.ts`, `solver.ts`, `cartSlots.ts`, `cors.ts` — was removed with the legacy backend.)

```
src/
  App.tsx              — Auth-gates on Supabase session, then routes appView → screen (auth/home/stagger/training/leaderboard/soundDesign/claimName)
  store/
    staggerStore.ts        — Infinite Stagger's Zustand store: phase/mode/batchIndex/gaps/score/lives/streak; startRun / pickPiece / advanceBatch / timeoutBatch
    trainingStore.ts       — Training mode's Zustand store: current piece / round / streak / selection-speed clock; start / guess / nextPiece / exit
    settingsStore.ts       — localStorage user settings (key: gapcity:settings:v1): Difficulty ('easy'|'medium'|'hard'), soundEnabled, sfxVolume, hideDemo
    navStore.ts            — appView routing state (auth/home/stagger/training/leaderboard/soundDesign/claimName)
    profileStore.ts        — Single source of identity truth: display name (from public.profiles) + email/avatar/authName (from auth metadata); claimDisplayName action; routeAfterAuth() post-auth router (claim gate vs home)
    soundLabStore.ts       — Sound Design lab persistence (localStorage key vt:soundlab:v1): active per-sound patch OVERRIDES (applied into sfx at boot — the game plays the tweaked palette) + labeled PRESETS + exportJson() for pasting tuned values back into a design conversation
    runHistoryStore.ts     — Recent Infinite Stagger run history (for the post-run graph)
  lib/
    staggerCurve.ts        — Infinite Stagger's single difficulty/scoring ramp: STAGGER constants, gapCountForBatch(), selectDurationForBatch(), batchSpeedBonus(), etc.
    sfx.ts                 — Sound: semantic game-gesture API (pickCorrect/bloom/go/batchClear/…), all pure Web Audio synth (no audio files/assets); portable as-is to react-native-audio-api. Every sound is a PATCH (data: tone/noise layers) — DEFAULT_PATCHES is the shipped palette (bonusLift is lab-tuned by the designer), overridable live via setPatch (the Sound Design lab drives this). SFX toggle + volume in settingsStore; unlock() must fire from a tap (HomeScreen PLAY does). Music/ambient bed was CUT (synth zen hum didn't land) — returns later as a produced audio file (designer will supply via Logic Pro)
    auth.ts                — Supabase auth helpers: signInWithApple/Google, sign up/in with email, signInAsGuest (anonymous), signOut
    api.ts                 — Supabase RPC wrappers: record_stagger_run, erase_stagger_records, get_stagger_leaderboard, set_display_name, getOwnProfile
    displayName.ts         — Display-name rules: validateDisplayName (regex ^[A-Za-z][A-Za-z0-9_]{2,15}$, per-rule messages) + sanitizeSuggestion prefill helper; mirrored verbatim by the set_display_name RPC (migration 0015)
    pwa.ts                 — PWA install helpers (pure, unit-tested): isStandalone / isIOSSafari platform detection + isInstallDismissed/setInstallDismissed (localStorage key vt:pwa-install-dismissed:v1) + the BeforeInstallPromptEvent type. Backs InstallPrompt.tsx
  components/
    StaggerScreen.tsx      — Infinite Stagger's screen: HUD (score/lives/streak), reveal-bloom board (its own inline 12×12 board), piece tray, pause overlay, game-over summary
    TrainingScreen.tsx     — Training mode's screen: streak/avg-speed HUD, single held-bloom piece board, letter-name tray, exit button
    LeaderboardScreen.tsx  — Global rankings: Easy/Medium/Hard tabs (Home switch styling), you-hero card (rank + per-metric ranks), top-50 table with YOU tag, guest sign-up footer
    SoundDesignScreen.tsx  — The sound calibration lab (menu → "Sound Design", deliberately visible pre-launch, desktop-width workbench): every game sound as knob panels (per-layer pitch/length/loudness/attack/glide/lowpass, noise sweeps), ▶ replay + ⟳ loop toggle (hands-free auditioning) with gameplay context (streak/reveal-step), labeled presets, Copy-JSON export
    HomeScreen.tsx         — Landing screen after sign-in: PLAY (→ Infinite Stagger) + Easy/Medium/Hard switch
    AuthScreen.tsx         — Email/password + Google OAuth + guest sign-in
    ClaimNameScreen.tsx    — Post-auth display-name gate (no skip); prefills a sanitized suggestion from the Google name / email prefix
    DisplayNameForm.tsx    — Shared name form (live per-rule validation, initials-avatar preview, taken/invalid server errors); used by ClaimNameScreen + the menu's edit overlay
    PieceShape.tsx         — Renders a single piece at a given rotation + cell size (used by StaggerScreen and TrainingScreen)
    InstallPrompt.tsx      — Dismissible PWA "install this game" banner (App.tsx renders it on non-gameplay screens only). Chrome/Android: captures beforeinstallprompt → native install; iOS Safari: manual "Share → Add to Home Screen" hint. Dismissal persists to localStorage; self-hides when already installed. Logic in lib/pwa.ts
```

### PWA / installability

The app is a full installable PWA. `vite-plugin-pwa` (Workbox, configured in `vite.config.ts` next to the Vitest `test` block) generates a service worker with `registerType: 'autoUpdate'` — clients auto-upgrade to the newest deploy, no manual cache clear. It precaches the built app shell (`navigateFallback: '/index.html'`) so the game opens offline, and runtime-caches Google Fonts. `manifest: false` — the hand-authored `public/manifest.webmanifest` (name "Vanishing Tiles", `display: standalone`, theme `#06060B`, 192/512/maskable icons) stays the single source of truth; the plugin only builds the SW. `index.html` carries the manifest link, iOS `apple-mobile-web-app-*` meta (status bar `black`), and OG/Twitter share tags (image = `public/social-preview.png`, referenced by absolute prod URL). `devOptions.enabled: true` lets the SW run under `vite dev`. Verify offline by building + `npm run preview`, then killing the server and reloading.

### Grid dimensions

Grid is `inline-grid`, 12 cols × 28px cells + 2px gaps + 12px padding ≈ **382px wide** — the `CELL`/`ROWS`/`COLS` constants live in Infinite Stagger's own inline board (`StaggerScreen.tsx`), reused by `TrainingScreen.tsx`. UI buttons that should match the board width use `w-full max-w-sm` so they auto-size to the grid.

### Difficulty tables

**Infinite Stagger** (the shipped game) has no per-level DB table or server config — its whole ramp is the hand-authored `STAGGER_CURVE` + `SHAPE_SCHEDULE` in `src/lib/staggerCurve.ts` (see "Infinite Stagger" above for the current curve). It's pure client-side math, keyed by `batchIndex`, with nothing to keep in sync across services.

The old per-round legacy Journey/Practice difficulty machinery (`DIFFICULTY_TABLE`, `LEVEL_CONFIGS`, the `levels` DB table, and its `seed.sql` seed with the `the_hollows`/`the_stacks`/`the_grid` slugs) is gone or dormant — the client tables and server config were deleted with the legacy modes, and while the DB tables + seed still physically exist, no remaining code path reads them.

---

## Critical rules for agents

### Zustand 5 — always use `useShallow` for object selectors

```ts
// ✅ correct
import { useShallow } from 'zustand/shallow'
const { foo, bar } = useStaggerStore(useShallow(s => ({ foo: s.foo, bar: s.bar })))

// ✅ also fine (single value, no object)
const foo = useStaggerStore(s => s.foo)

// ❌ will cause infinite loop in Zustand 5
const { foo, bar } = useStaggerStore(s => ({ foo: s.foo, bar: s.bar }))
```

Zustand 5 uses `useSyncExternalStore` internally. Inline object selectors return a new reference every render → React infinite loop. `useShallow` memoizes by shallow equality.

### Tests

All tests must pass before committing. Run `npm run test`. Do not skip or modify tests to make them pass unless the spec has genuinely changed.

---

## Design decisions (agreed upon)

- **Grid size:** 12 rows × 12 columns (square)
- **Placement UX:** Click-to-place (drag-and-drop is deferred)
- **Scoring philosophy (Infinite Stagger):** Streak is the only multiplier — `100 × currentStreak` per correct pick, plus a per-batch speed bonus (≤500) on clear. A miss breaks the streak and costs a life; a select-clock timeout costs a life and replays the same batch.
- **Lives (Infinite Stagger):** 5 shared lives for the whole run, +1 per 5000 cumulative points; the run ends at 0.
- **Button style:** Full-width, centered, matching grid width — consistent across all phases

---

## Deferred (post-POC)

- Drag-and-drop piece placement
- React Native port → Apple App Store
- Haptic feedback (RN port; sound effects SHIPPED for web — synth palette in `src/lib/sfx.ts`, design map in `docs/superpowers/specs/2026-07-16-sound-design.md`)
- Music bed: a produced audio file (designer-supplied, Logic Pro; gapless-looped via Web Audio decodeAudioData) — the synth zen bed was tried and cut 2026-07-17
- Leaderboard / high score persistence
- Accessibility (ARIA, keyboard nav)
- Difficulty scaling tuning

---

## Docs

- **Original design spec:** `docs/superpowers/specs/2026-05-26-puzzle-game-design.md`
- **Original implementation plan:** `docs/superpowers/plans/2026-05-26-puzzle-game-poc.md`
- **Gameplay polish (12×12 board, retry flow, failure penalty, turtle):** `docs/superpowers/specs/2026-05-28-gameplay-polish-design.md` + `docs/superpowers/plans/2026-05-28-gameplay-polish.md`
- **Infinite Stagger, original design:** `docs/superpowers/specs/2026-06-16-infinite-stagger-design.md`
- **Three-mode MVP simplification (current shipped shape — modes, single ramp, streak-only scoring, legacy removal):** `docs/superpowers/plans/2026-07-15-three-mode-mvp-simplification.md`
- **Journey rework (level hub + badges), now removed:** `docs/superpowers/specs/2026-06-08-journey-rework-design.md`
