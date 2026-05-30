# Journey Spine — Design

**Date:** 2026-05-30
**Status:** Approved (brainstorming), ready for implementation planning
**Predecessor:** `docs/superpowers/specs/2026-05-29-fullstack-foundation-design.md` (§9 handoff brief)

**Scope:** The first slice of the Journey UI — the **playable spine**: the smallest change that turns the tested backend into an end-to-end, online-playable journey. Auth → sectioned-grid journey map → level detail → server-wired gameplay → server-scored results. Free-play is preserved as an unscored **Practice** mode. The remaining Journey-UI screens (stats dashboard, daily challenge, achievements gallery) are explicitly deferred to later increments.

---

## 1. Goal & context

The foundation built the backend (schema, RLS, RPCs, two Edge Functions) and a thin client API layer, but **no UI consumes it** — the app still boots straight into the client-only free-play loop. This slice wires the existing gameplay components to the server-authoritative journey path and adds the screens around it.

The binding constraints from the foundation carry forward unchanged:
- **Seed-based server authority.** The client never generates/solves/scores on the journey path; the seed is never returned to the client.
- **3 tries per session, same puzzle across all 3 tries.** A fresh session re-rolls the seed.
- **No negative score penalties.** A failed/exhausted level scores 0, never below.
- **Online is a hard requirement** for journey; offline is deferred (Practice mode remains usable offline).

## 2. Decisions (locked during brainstorming)

1. **Scope = playable spine** (auth, journey map, level detail, server-wired loop, results). Stats/daily/achievements deferred.
2. **Free-play → unscored Practice mode.** Journey is the main experience; Practice stays as a no-stakes, offline-capable warmup using the existing client engine.
3. **Auth = full sign-in screen** with Apple / Google / Guest buttons, all present and clickable. Guest works end-to-end today; Apple/Google call the existing `auth.ts` helpers and surface an inline error if the provider isn't configured yet (they are `enabled=false` in `config.toml`). The buttons ship live (not hidden) per the product decision to build the complete screen now; a `PROVIDERS_ENABLED` flag exists only as an optional switch to later add a "coming soon" affordance if desired — it does **not** hide the buttons by default.
4. **Journey map = sectioned grid.** Each theme is a titled section; levels are cards in a grid. (Mockups compared linear-path / grid / branching; grid chosen for smallest build and compact scan.)
5. **App-shell architecture = navigation store + mode-aware game loop.** No routing library (React Native-portable). The existing phase machine is reused for in-game; the data source switches by `mode`.
6. **Score display = per-pillar % fill bars against each pillar's own max**, with raw points shown (e.g. Speed 158/500 ≈ 32% bar). Swappable to a flat 0–1000 scale later with no backend change.

## 3. Architecture

### 3.1 Navigation
A new **navigation slice** (in the Zustand store, or a small dedicated store) owns:
- `appView: 'auth' | 'journey' | 'levelDetail' | 'playing' | 'results' | 'practice'`
- `selectedLevelId: string | null`
- actions: `goAuth()`, `goJourney()`, `openLevel(id)`, `enterPlaying()`, `showResults()`, `backToMap()`, `goPractice()`.

`App` boot sequence: call `getSession()`. If a session exists → `goJourney()`, else → `goAuth()`. Sign-out → `goAuth()`. `GameShell` is demoted from app root to the **in-game host** (renders the phase machine) used by both Practice and Journey.

### 3.2 Mode-aware game loop
`gameStore` gains `mode: 'practice' | 'journey'`.

- **Practice** (`mode='practice'`): unchanged from today — local `generatePuzzle`/`solve`/`scoreClear`, existing `ResolutionPhase` renders client-computed scoring. No auth/session needed. Works offline.
- **Journey** (`mode='journey'`): server-driven, described in §4.

The existing phases (countdown → viewing → selecting → resolution) are reused verbatim for rendering and input; only the *source* of the puzzle and the *source* of the score differ by mode.

## 4. Journey play flow (data + state)

All API functions already exist in `src/lib/api.ts`. Shapes below are the **implemented** contracts (verified against the Edge Functions and RPCs).

### 4.1 Start a session
`startJourneySession(levelId)`:
1. `api.startSession(levelId)` → `{ session_id, puzzle: { grid, gaps }, view_duration_ms, select_duration_ms, max_tries }`.
2. Store `session_id`, `puzzle`, the two durations, `max_tries`, set `mode='journey'`, `triesUsed=0`.
3. Enter `appView='playing'`, run countdown → viewing (on `puzzle.grid`/`puzzle.gaps`) → selecting, exactly as Practice does. **No client generation/solve.**

### 4.2 Submit an attempt
On **Done ✓** (or select-timer expiry), `submitJourneyAttempt()`:
1. Build `selection: { pieceType, count }[]` from the cart (already how the store tracks picks).
2. `api.submitAttempt({ sessionId, selection, viewMsRemaining, selectMsRemaining })`. Timings are clamped server-side (Speed = bounded-trust), so the client just sends its remaining values.
3. Response:
   ```ts
   {
     attempt: {
       solved: boolean,
       coverage: number,                 // 0..1
       pillars: { accuracy, speed, efficiency, attempts, total, stars },
       total: number,
       stars: number,                    // 0..3
     },
     placements,                          // solver/bestFit placements for the fly-in animation
     session_status: 'cleared' | 'exhausted' | 'active',
     progress,                            // level_progress row (PR/cleared/...) or null
   }
   ```
4. Store the result; set `triesUsed` from the response context (increment locally, but **`session_status` is authoritative** for what the player may do next). Transition `appView='results'`.

### 4.3 The 3-tries / same-puzzle invariant
- "Try Again" (shown only when `session_status === 'active'`) **replays the same `session_id` and the same in-memory `puzzle`** — it re-enters countdown→viewing→selecting and calls `submit_attempt` again. It does **not** call `start_session` (which would re-roll the seed and violate "same puzzle across 3 tries").
- When `session_status` is `'cleared'` or `'exhausted'`, there is no Try Again — the only CTA is **Back to Map**. Replaying the level later from the map calls `startJourneySession` fresh (new seed) — the intended per-session re-roll.
- The server enforces the cap (`record_attempt` rejects a non-active or tries-exhausted session); the client UI mirrors it but never out-runs it.

### 4.4 Placement animation seam
The server returns `placements` from the same solver/`bestFit` the client uses, so the shape matches what `FlyerOverlay` already consumes in Practice. The journey resolution feeds these server placements into the existing fly-in overlay. If the shapes differ in any field, normalize in the store at ingest (one small adapter), keeping a single rendering path.

## 5. Screens (new components)

Follow existing component conventions (Tailwind, full-width grid-matching buttons, dark theme). Files live in `src/components/`.

1. **`AuthScreen.tsx`** — three live buttons: **Sign in with Apple**, **Sign in with Google**, **Play as Guest**. Guest → `signInAsGuest()` → `goJourney()`. Apple/Google → `signInWithApple()`/`signInWithGoogle()`; on error (provider not yet configured) show an inline message rather than crashing. All three buttons render and are clickable now (the provider ones simply error until credentials land). The optional `PROVIDERS_ENABLED` flag in `config.ts` is available if you later want a softer "coming soon" treatment, but is not required for this slice.

2. **`JourneyScreen.tsx`** — `getJourney()` → array of themes:
   ```ts
   { theme_id, slug, name, mechanic, sort_order, locked,
     levels: [{ level_id, display_number, my_pr, my_stars, cleared, last_played, global_best }] }
   ```
   Render each theme as a titled section; **unlocked** themes show their level cards in a grid (number, stars 0–3, PR badge if cleared, cleared check); **locked** themes show a lock + unlock hint and disabled cards. Tap a card in an unlocked theme → `openLevel(level_id)`.

3. **`LevelDetailScreen.tsx`** (modal/sheet over the map) — `getLevel(id)`:
   ```ts
   { level_id, display_number, theme_name, view_duration_ms, select_duration_ms,
     gap_count, shape_complexity, adjacency, my_pr, my_stars, global_high, last_played }
   ```
   Show theme name, level number, my PR, global high, last played, and a **PLAY** button → `startJourneySession(level_id)`.

4. **`ResultsScreen.tsx`** — renders `attempt` from `submit_attempt`:
   - Per-pillar **% fill bars**: accuracy/800, speed/500, efficiency/300, attempts/400, each labeled with raw points.
   - Stars earned (0–3), tries used / max, coverage for a failed attempt.
   - **PR-break celebration**: carry the level's pre-attempt `my_pr` (from the level-detail fetch) into the session; on a clear, it's a PR break when `attempt.total > priorPr` (a first clear, where `priorPr` is 0, always counts).
   - CTAs by `session_status`: `active` → **Try Again ↺** + Back to Map; `cleared` → **Back to Map** (celebratory); `exhausted` → **Back to Map** (no score kept).
   - Reuses existing badge/score sub-components where practical, fed by server values (no client scoring on this path).

## 6. Error handling

- **Journey API failures** (network/5xx): show a retry affordance on the relevant screen (map load, session start, submit). Journey is intentionally unplayable offline; **do not** fall back to local scoring (that would break server authority). Practice remains available offline.
- **`submit_attempt` 409 `session not playable`**: the client and server disagree on tries — refetch/return to map rather than retry blindly.
- **Provider sign-in errors**: inline message on `AuthScreen`; never crash.
- **No silent fallbacks, no fabricated data.**

## 7. File map

```
src/
  store/
    gameStore.ts        — add `mode`, journey session state, journey actions; navigation slice
                          (or split navigation into src/store/navStore.ts if gameStore grows unwieldy)
  lib/
    api.ts              — (exists) startSession/submitAttempt/getJourney/getLevel/getStats
    auth.ts             — (exists) signInAsGuest/signInWithApple/signInWithGoogle/signOut/getSession
    config.ts           — NEW: PROVIDERS_ENABLED flag (+ any client flags)
  components/
    App routing host    — App.tsx (or GameShell parent) switches on appView
    AuthScreen.tsx      — NEW
    JourneyScreen.tsx   — NEW (sectioned grid)
    LevelDetailScreen.tsx — NEW (sheet)
    ResultsScreen.tsx   — NEW (server-scored bars + CTAs)
    GameShell.tsx       — refactor to in-game host (phase machine), mode-agnostic
    ResolutionPhase/    — Practice keeps client scoring; Journey routes to ResultsScreen
tests/
  store/                — navigation transitions; journey-mode actions (mocked api)
  components/            — JourneyScreen, ResultsScreen, AuthScreen (mocked api/auth)
```

No backend changes — migrations, RPCs, Edge Functions, and pgTAP are untouched by this slice.

## 8. Testing

- **Store unit tests** (Vitest, mock `src/lib/api` and `src/lib/auth`):
  - navigation transitions (`auth→journey→levelDetail→playing→results→map`).
  - `startJourneySession` stores puzzle/timings/session_id and enters playing without calling the local generator.
  - `submitJourneyAttempt` stores the server result and sets `appView='results'`.
  - **same-puzzle invariant:** Try Again reuses `session_id` + `puzzle` and does not call `startSession`; after `cleared`/`exhausted` there is no Try Again.
- **Component tests** (Testing Library, mocked data):
  - `JourneyScreen` renders unlocked vs locked themes, stars, PR badges from a mock `get_journey` payload.
  - `ResultsScreen` renders the four pillar bars and stars from a mock `submit_attempt` payload (clear and fail cases).
  - `AuthScreen` guest button calls `signInAsGuest`; provider buttons reflect `PROVIDERS_ENABLED`.
- **Practice regression:** existing free-play tests stay green (the local path is unchanged).
- **Optional integration:** extend `scripts/journey-smoke.ts` to assert a *fail-then-clear within one session* flow (two `submit_attempt` calls, same session, second one clears).
- All gates green before done: `npm run test`, `npm run build`, `npm run lint` (per project rules).

## 9. Out of scope (this slice)

- **Stats dashboard** (score-over-time graph from `get_stats()`), **daily challenge** entry/streak flame, **achievements gallery** — each a later increment.
- **Real Apple/Google credentials** — buttons ship gated; wiring real OAuth is a small follow-up once secrets exist.
- **Achievement / theme-unlock toasts** on the results screen — `submit_attempt` does not currently return `new_achievements`/`theme_unlocked` (the foundation handoff brief anticipated them, but they are not implemented). Adding them is a backend + UI follow-up.
- **Offline journey play** (the seed/pack model is designed-for but deferred).
- **Map polish** — animations, branching/linear styles, illustrated paths.

## 10. Execution handoff

Recommended execution: a **fresh Claude instance** picks up this spec plus the implementation plan (to be produced next via the writing-plans skill) and executes it with **subagent-driven-development** — keeping the planning context out of the execution context. This spec and the plan are written to be self-contained for that handoff.
