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

Players memorize the shape of empty gaps in a pre-filled grid, then pick the Tetris-style pieces needed to fill them — all under time pressure. The shipped MVP is a single endless mode, **Infinite Stagger**; the earlier Journey (transit-map level hub) and Practice (4-round gauntlet) modes still exist in code but are hidden — see "Legacy modes" below.

### Entry flow

`src/App.tsx` gates on a Supabase session (`getSession()`): no session → `AuthScreen`, session present → `HomeScreen`. `AuthScreen` offers email/password (sign in + create account), Google OAuth, and a "Continue as guest" anonymous sign-in (`supabase.auth.signInAnonymously()`); a `signInWithApple` helper exists in `src/lib/auth.ts` but isn't wired into any button yet. `HomeScreen` is one decision + one action: a four-segment **Mode** switch — **Training / Easy / Medium / Hard** — above a single **PLAY** button. The three difficulties persist via `useSettingsStore` (localStorage); **Training is "mode zero"** on the same switch but deliberately EPHEMERAL (component state only — selecting it never overwrites the persisted difficulty, and it resets when the screen unmounts, so a returning player's PLAY always starts Infinite Stagger). PLAY launches whatever the switch says: a Stagger run (`src/components/StaggerScreen.tsx`) at the selected difficulty, or Training mode (see below) — the label always reads PLAY; only its glow goes cyan while Training is selected. Training's ONLY entry point is this switch — it was removed from the global hamburger menu (`GlobalMenu.tsx`), which is now just the profile header + Logout (Settings and Reset Journey were removed; guests get a generic person-icon avatar instead of initials). An "Experimental Modes" entry point (Practice, the legacy gauntlet + the three Journey map styles) exists in `HomeScreen.tsx` but is hidden behind `SHOW_EXPERIMENTAL = false`.

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

### Legacy modes (hidden)

Journey (tap a station on a transit/brain/git map to open a `LevelScreen` level hub: main puzzle + 4 opt-in badges) and Practice (the old 4-round gauntlet, `src/store/gameStore.ts`) are still fully present in the codebase — `src/components/JourneyScreen.tsx`, `LevelScreen.tsx`, `JourneyMap/`, `GameShell.tsx`, `ResolutionPhase/`, `SelectingPhase.tsx`, `ViewingPhase.tsx`, `CountdownPhase.tsx`, etc. — but are reachable only by flipping `SHOW_EXPERIMENTAL` to `true` in `HomeScreen.tsx`. This code was deliberately left untouched by the three-mode MVP work, so treat any pre-existing scoring/UI detail for Journey/Practice as unverified unless you re-check it against the current source — it has drifted from earlier docs (e.g. the "efficiency" scoring pillar described below is now retired). The mechanics removed entirely from the codebase during the MVP simplification (named levels SOLOS/TWINS/TRIPLETS/TRANSFORMERS/CRAWLERS, pairs/triples reveal chunking, inverted reveal, the calibration sandbox) survive only at the git tag `pre-mvp-simplification`. Background: `docs/superpowers/specs/2026-06-08-journey-rework-design.md`, `docs/superpowers/plans/2026-07-15-three-mode-mvp-simplification.md`.

### Piece types

`I, O, T, S, Z, J, L` — the seven standard tetrominoes (4 cells each). The `SINGLE` (1-cell decoy) piece type has been removed from `PieceType`; the "efficiency" scoring pillar it existed to drive is retired (see Critical rules below).

---

## Architecture

### File map

Shared game engine + types live OUTSIDE `src/`, at `supabase/functions/_shared/` (so the Supabase Edge Functions can import the same code as the client); Vite/Vitest alias `@shared` → `supabase/functions/_shared` (see `vite.config.ts`).

```
supabase/functions/_shared/
  types.ts             — PieceType (I/O/T/S/Z/J/L — no SINGLE), Rotation, Cell, Grid, Gap, DifficultyConfig
  engine/
    pieces.ts          — PIECE_DEFINITIONS, getRotatedCells(), getPieceColor()
    puzzleGenerator.ts — generatePuzzle({ gapCount, complexity, allowedTypes, lockedRotations, ... }) → { grid, gaps }
    solver.ts          — solve(pieceCount, grid, gaps) backtracking solver
  core/
    scoring.ts         — Legacy Journey/Practice scoring (scoreClear, scoreRound, levelTotal, levelStars); "efficiency" pillar is retired (hardcoded 0)
    levelConfig.ts     — LEVEL_CONFIGS server-side difficulty table (legacy Journey/Practice only)

src/
  App.tsx              — Auth-gates on Supabase session, then routes appView → screen (auth/home/journey/levelDetail/results/stagger/playing/practice)
  store/
    staggerStore.ts        — Infinite Stagger's Zustand store: phase/mode/batchIndex/gaps/score/lives/streak; startRun / pickPiece / advanceBatch / timeoutBatch
    trainingStore.ts       — Training mode's Zustand store: current piece / round / streak / selection-speed clock; start / guess / nextPiece / exit
    settingsStore.ts       — localStorage user settings (key: gapcity:settings:v1): Difficulty ('easy'|'medium'|'hard'), map style, briefing opt-outs
    navStore.ts            — appView routing state (auth/home/journey/levelDetail/playing/results/practice/stagger/training)
    runHistoryStore.ts     — Recent Infinite Stagger run history (for the post-run graph)
    gameStore.ts       (legacy) — Journey/Practice Zustand store; all game state + actions (startComponent / retryComponent / replayComponent for Journey; startLevel/startPractice for Practice); also owns the legacy DIFFICULTY_TABLE
    progressStore.ts   (legacy) — localStorage store for per-component best scores and level progress (key: gapcity:progress:v1)
  lib/
    staggerCurve.ts        — Infinite Stagger's single difficulty/scoring ramp: STAGGER constants, gapCountForBatch(), selectDurationForBatch(), batchSpeedBonus(), etc.
    auth.ts                — Supabase auth helpers: signInWithApple/Google, sign up/in with email, signInAsGuest (anonymous), signOut
    components.ts      (legacy) — ComponentKey types, LEVEL_COMPONENTS, BADGE_COMPONENTS, COMPONENT_THEME, COMPONENT_LABEL, isPlayable helpers
    journeyScoring.ts  (legacy) — componentScore(), levelStarsFromTotal(), difficultyPips(), sumBests() — Journey scoring math
  components/
    StaggerScreen.tsx      — Infinite Stagger's screen: HUD (score/lives/streak), reveal-bloom board (own inline board, not Grid.tsx), piece tray, pause overlay, game-over summary
    TrainingScreen.tsx     — Training mode's screen: streak/avg-speed HUD, single held-bloom piece board, letter-name tray, exit button
    HomeScreen.tsx         — Landing screen after sign-in: PLAY (→ Infinite Stagger) + Easy/Medium/Hard switch; Experimental Modes pane hidden behind SHOW_EXPERIMENTAL
    AuthScreen.tsx         — Email/password + Google OAuth + guest sign-in
    PieceShape.tsx         — Renders a single piece at a given rotation + cell size (used by both StaggerScreen and legacy SelectingPhase)
    Grid.tsx           (legacy) — 12×12 inline-grid, 28px cells; onCellClick / onCellHover props
    ProgressBar.tsx    (legacy) — Animated countdown bar
    GameShell.tsx      (legacy) — Top bar (component label/score/lives), phase router, idle screen; TrickleBar shown while submitting
    CountdownPhase.tsx (legacy) — Pre-round "Round N" + 3-2-1 fade countdown, then beginViewing
    GapShimmer.tsx     (legacy) — One-time glare sweep masked to the gap shapes; overlaid on the viewing grid (no game-state change)
    ViewingPhase.tsx   (legacy) — Grid + GapShimmer overlay + Ready button (timer bar lives in GameShell)
    SelectingPhase.tsx (legacy) — Piece menu + selection cart + Done button
    ResolutionPhase/   (legacy) — Auto-placement animation; perfect/failure badge; Try Again / Back to Level CTA
    LevelScreen.tsx    (legacy) — Journey level hub: main puzzle + 4 badge tiles, level progress (stars/total), badge lock state
    JourneyScreen.tsx  (legacy) — Journey "Map" screen: loads get_journey, owns loading/error; renders the selected map style
    JourneyMap/        (legacy) — Map renderers: index.tsx (transit map), MentalMapBrain.tsx, GitMap.tsx + layout.ts (hand-authored coords/paths)
```

### Grid dimensions

Grid is `inline-grid`, 12 cols × 28px cells + 2px gaps + 12px padding ≈ **382px wide** — this sizing is shared by the legacy `Grid.tsx` component and Infinite Stagger's own inline board in `StaggerScreen.tsx` (same `CELL`/`ROWS`/`COLS` constants, just not the same component). UI buttons that should match the board width go inside an `inline-flex flex-col items-stretch` wrapper (legacy) or use `w-full max-w-sm` (Infinite Stagger) so they auto-size to the grid.

### Difficulty tables

**Infinite Stagger** (the shipped game) has no per-level DB table or server config — its whole ramp is the hand-authored `STAGGER_CURVE` + `SHAPE_SCHEDULE` in `src/lib/staggerCurve.ts` (see "Infinite Stagger" above for the current curve). It's pure client-side math, keyed by `batchIndex`, with nothing to keep in sync across services.

**Legacy Journey/Practice** still use the older per-round `DIFFICULTY_TABLE` in `gameStore.ts` — keyed by round number, controls view duration, select duration, and number/type of gaps generated. Spans **15 rounds** (round 15+ uses the last entry). The view (memorize) timer **rises monotonically with `gapCount`** on a comfortable **~1.2–1.33s per gap** budget so every level stays solvable — the challenge is *how fast* you clear it, not *whether* you can. It runs **4000ms → 17000ms** across rounds 1–15, tapering toward ~1.06s/gap at the top tier where adjacent shapes chunk in memory. `selectDuration` also rises (10000 → 23000ms) and is always longer than the view window, so picking pieces is never the bottleneck. `gapCount` climbs from 3 to 16 so the larger board stays meaningfully empty deep into a run. Speed scoring is **ratio-based** (`scoring.ts` uses `timeRemaining / duration`), so these absolute durations self-normalize and don't change the score ceiling — leaving more time on the clock (hitting **Ready →** early) banks more speed bonus.

**Three sources must stay in sync for legacy Journey/Practice:** the client fallback `DIFFICULTY_TABLE` (`gameStore.ts`), the server config `LEVEL_CONFIGS` (`supabase/functions/_shared/core/levelConfig.ts`), and the DB seed (`supabase/seed.sql`). When running against Supabase, the served durations come from the `levels` **DB table** — the seed uses `on conflict … do nothing`, so an existing DB must be re-seeded/migrated for new values to take effect. The three districts use the fictional slugs `the_hollows` / `the_stacks` / `the_grid` (renamed from the NYC slugs by migration `0009_gap_city_fictional_names.sql`); keep these in sync across `levelConfig.ts`, `seed.sql`, and the migrations.

---

## Critical rules for agents

### Zustand 5 — always use `useShallow` for object selectors

```ts
// ✅ correct
import { useShallow } from 'zustand/shallow'
const { foo, bar } = useGameStore(useShallow(s => ({ foo: s.foo, bar: s.bar })))

// ✅ also fine (single value, no object)
const foo = useGameStore(s => s.foo)

// ❌ will cause infinite loop in Zustand 5
const { foo, bar } = useGameStore(s => ({ foo: s.foo, bar: s.bar }))
```

Zustand 5 uses `useSyncExternalStore` internally. Inline object selectors return a new reference every render → React infinite loop. `useShallow` memoizes by shallow equality.

### Solver correctness

`solver.ts` uses backtracking. The outer piece-type loop must **not** `break` early — it must try all piece types for each empty cell, otherwise the solver is order-dependent and misses valid solutions.

### Efficiency scoring pillar is retired

`roundEfficiency()` / the `efficiency` field in `supabase/functions/_shared/core/scoring.ts` are hardcoded to `0` and kept only so the return shape and the DB's `efficiency` column stay stable — they were retired when the `SINGLE` decoy piece type was removed (every gap clear now always uses exactly `minPieces`, so the old piece-count-vs-minimum ratio flatlined to a constant). Its points were folded into the Speed pillar. Don't resurrect a live efficiency ratio without first re-adding a decoy piece type — and if you do, guard `selectedPieces === 0` so the ratio doesn't become `minPieces / minPieces = 1.0`.

### Tests

All tests must pass before committing. Run `npm run test`. Do not skip or modify tests to make them pass unless the spec has genuinely changed.

---

## Design decisions (agreed upon)

- **Grid size:** 12 rows × 12 columns (square)
- **Placement UX:** Click-to-place (drag-and-drop is deferred)
- **Scoring philosophy (Infinite Stagger):** Streak is the only multiplier — `100 × currentStreak` per correct pick, plus a per-batch speed bonus (≤500) on clear. A miss breaks the streak and costs a life; a select-clock timeout costs a life and replays the same batch.
- **Lives (Infinite Stagger):** 5 shared lives for the whole run, +1 per 5000 cumulative points; the run ends at 0.
- **Legacy (Journey/Practice, hidden):** Journey scored per-component 0–100 (completion + time, unsolved = 0), 3 lives per component. Practice scored per-round speed+efficiency bonuses (efficiency now retired, see above), 3 lives pooled across 4 rounds.
- **Button style:** Full-width, centered, matching grid width — consistent across all phases

---

## Deferred (post-POC)

- Drag-and-drop piece placement
- React Native port → Apple App Store
- Sound effects and animations
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
- **Journey rework (level hub + badges), now legacy/hidden:** `docs/superpowers/specs/2026-06-08-journey-rework-design.md`
