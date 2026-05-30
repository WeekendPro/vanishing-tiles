# Mind The Gap — Full-Stack Foundation (Design Spec)

**Date:** 2026-05-29
**Status:** Approved (design); implementation plan to follow
**Scope:** Backend foundation only. Ends with a handoff brief so a future agent can run a focused Journey-UI design discussion. Does **not** build the Journey UI or author new theme mechanics.

---

## 1. Motivation

The web POC is a single-session, client-only game: puzzles are generated randomly per round, the player has **3 lives total**, and nothing persists. To make the game "real" we are adding a backend so we can:

- Let players **sign in** and persist progress across sessions/devices.
- Turn the game into a **journey**: themes group levels; clearing levels unlocks the next theme.
- Track a **per-level scoring history** (accuracy / speed / efficiency / attempts) with timestamps, so a future UI can plot a player's scores over time, show personal records (PR), and a per-level global high score.
- Shift from "3 lives total" to **3 tries per level**, where fewer tries earns more.

This spec defines the data model, auth, scoring model, API surface, and the targeted client refactor needed to support all of the above — and hands the **Journey UI** off to a future design discussion.

---

## 2. Key reframing decisions

These decisions shape everything downstream and are settled:

1. **A "level" is a difficulty profile, not a fixed board.** The puzzle is determined by a **server-issued seed** chosen fresh every **new session** (each fresh replay of the level), but stays fixed across the 3 tries within a session (see §3); what is pinned is the difficulty. A per-level global high score therefore means "the best score anyone posted on this difficulty profile" — an intentionally **slightly imperfect** grading model the product owner is comfortable with. (Per-session puzzles are deterministic *given the seed*, but the seed re-rolls each session, so we do **not** pin one fixed puzzle per level.)
2. **Backend = Supabase.** Postgres + Auth + Row-Level Security (RLS) + Edge Functions (Deno/TypeScript). Chosen for the relational fit (scores-over-time, leaderboards), first-class React Native SDK, and built-in Apple/Google + anonymous auth. The same backend will serve the future RN app.
3. **Auth = Apple + Google + anonymous guest**, with guest accounts upgradable via identity linking. (Apple sign-in is effectively required for the eventual App Store release.)
4. **Trust model = seed-based server authority (online-only).** The server chooses the puzzle seed, generates the puzzle from it, solves it, and scores every attempt — the client never computes a score during normal play. Generation is **deterministic from the seed** (a seeded PRNG replaces `Math.random` in the generator), so the server can regenerate the exact board a client played from `(seed, level config)` and verify it. The client is a **thin renderer + input collector**: it receives the puzzle for a session, collects the player's selection and timings, and posts them. Accuracy / efficiency / attempts are **fully server-verifiable** (recomputed from authoritative state); the **Speed** pillar is **bounded-trust** — the server clamps client-reported timings to the session's issued window — because the server can't observe wall-clock interaction latency. Online is a hard requirement; an offline pack-cache is a designed-for but deferred nice-to-have (§10).
5. **Out-of-tries = no score, replayable.** Failing all 3 tries leaves the level uncleared, adds nothing to the journey total, and is replayable (tries reset). Every attempt is still logged. **No negative point penalties** — the cost of extra tries is a smaller attempts bonus, not lost points. (This replaces today's negative-accuracy penalty model.)
6. **Theme unlock = threshold of previous theme cleared** (e.g. ≥70% of its levels cleared; threshold stored per-theme, tunable).
7. **Schema reserves room for: Streaks & Daily Challenge, and Stars & Achievements.** Per-level **global high score** stays in (a simple max query, no friend graph). **Out:** friend relationships, sharing infrastructure, and the meta-economy (XP / currency / cosmetics / power-ups).

---

## 3. Scoring & "tries" model

Replaces "3 lives total" with **3 tries per level session**.

### Session & try lifecycle

- A **level session** is one play of a level and grants `maxTries = 3`. When the session starts, the **server** chooses a seed, generates the puzzle from it, and persists the session (seed + the level's timing window) so it can re-derive and score every try. The client renders the puzzle the server returns.
- All three tries face the **same puzzle** (same seed). A failed try **consumes a try** and replays the *identical* board (only the player's selection is cleared). This is intentional: the puzzle is memorizable, so a 1st-try clear is the real achievement; a 2nd try feels cheap and a 3rd cheaper — the diminishing attempts bonus reinforces that, and the pressure to "get it first try" becomes the hook as levels get harder.
- Each try posts its selection + timings to the server, which **regenerates the puzzle from the session seed, solves it, scores the attempt, and persists it.** A perfect clear ends the session as **cleared**.
- Running out of tries → **not cleared, no points, replayable.** Starting a **new session** (replaying the level) gets a **new seed** (new puzzle) and resets tries. Every try is logged regardless.

### Scoring pillars (computed on a clear)

Each pillar is stored separately so the future graph can break a score down.

| Pillar | Max | Source |
|---|---|---|
| Accuracy | 800 | flat, awarded on clear |
| Speed | 500 | existing view-time + select-time model |
| Efficiency | 300 | existing piece-count-vs-minimum model |
| **Attempts (new)** | 400 | `round(400 × (maxTries − triesUsed) / (maxTries − 1))` → try 1 = 400, try 2 = 200, try 3 = 0 |

- **Per-level max total = 2000.** (Matches the product owner's narrative: a strong 1-try clear ≈ 1500–2000, a 2-try clear ≈ 1200.)
- There are **no negative penalties** anymore. The existing "grand total floored at 0" rule is retained but becomes a no-op in normal play.

### Display normalization (deferred to FE discussion)

Each pillar must be presentable as a **percentage-fill bar**. The product owner prefers thinking of each category against a **clean round max (100 or 1000)** so a bar reads as "% filled." The data model therefore stores both the **raw pillar value** and enough context to compute a **0–1 fill ratio** per pillar (raw value ÷ pillar max). The exact display scale (0–100 vs 0–1000) and bar visuals are **deferred to the Journey-UI / FE discussion** — see the handoff brief (§9). No backend decision is blocked by this.

### Stars (0–3, new)

- Derived from the clear's total relative to the per-level max: **≥75% → 3★, ≥50% → 2★, any clear → 1★, no clear → 0★.** Thresholds are tunable.
- Stars drive replay motivation ("go back and 3-star it"). They do **not** gate theme unlocks — unlocking is by levels cleared (≥1★), per decision #6.

### Journey total

- `journey_total = Σ best_total` across the player's cleared levels (each level contributes its PR).
- The `attempts` table's `created_at` timestamps power the future **score-over-time** graph.

---

## 4. Level / difficulty model

A **level** is a difficulty profile. Difficulty levers:

- `view_duration_ms`, `select_duration_ms` — timers (as today).
- `gap_count` — number of tetromino-shaped gaps.
- `shape_complexity` — which piece set / complexity tier is allowed (e.g. Advanced theme trims the menu to T, S, Z, J, L).
- **`adjacency` (new)** — how clustered/contiguous the gaps are (gaps touching one another are harder to memorize). The puzzle generator gains an adjacency parameter; the *algorithmic detail* of honoring it is an implementation concern, but the schema and generator signature reserve it now.
- `modifiers` (jsonb) — per-level room for future theme mechanics (Numbered ordering, Flash-mob reveal) **without designing them now**.

**Deterministic generation.** The generator is pure: `generatePuzzle(config, seed) → { grid, gaps }`. A seeded PRNG (e.g. mulberry32/xmur3) replaces `Math.random`, so the same `(config, seed)` always yields the same board. This is what lets the server hand a client a puzzle and later re-derive it for scoring/verification. Same input → same output is asserted in core unit tests.

The current `DIFFICULTY_TABLE` (15 rows in `gameStore.ts`) migrates into seeded `levels` rows: **Beginner** = rounds 1–7, **Intermediate** = rounds 8–15. Advanced / Numbered / Flash-mob are seeded as **locked stub themes** for the future agent.

---

## 5. Data model (Postgres / Supabase)

> Conventions: all timestamps `timestamptz default now()`. User-owned rows reference `profiles.id` (= `auth.users.id`). `jsonb` used where shape is intentionally open for future themes.

### `profiles` (1:1 with `auth.users`)
- `id` uuid PK (= auth uid)
- `display_name` text
- `avatar_url` text null
- `is_guest` boolean default true
- `current_streak` int default 0
- `longest_streak` int default 0
- `last_played_date` date null
- `created_at`

### `themes`
- `id` uuid PK
- `slug` text unique (e.g. `beginner`)
- `name` text
- `description` text
- `sort_order` int
- `unlock_threshold` numeric default 0.7 — fraction of the *previous* theme's levels that must be cleared to unlock this one
- `piece_set` text[] — allowed piece types (e.g. `{T,S,Z,J,L}`)
- `mechanic` text — enum-like: `standard | advanced | numbered | flashmob` (extensible)
- `created_at`

### `levels` (the difficulty profile)
- `id` uuid PK
- `theme_id` uuid FK → themes
- `index_in_theme` int
- `display_number` int — global level number shown to the player
- `view_duration_ms` int
- `select_duration_ms` int
- `gap_count` int
- `shape_complexity` text
- `adjacency` int (or numeric) — new clustering lever
- `modifiers` jsonb default `'{}'`
- `created_at`
- unique (`theme_id`, `index_in_theme`)

### `level_sessions` (server-issued puzzle — the source of truth for a session)
- `id` uuid PK — the `session_id` referenced by attempts
- `user_id` uuid FK → profiles
- `level_id` uuid FK → levels
- `seed` text — the server-chosen seed the puzzle was generated from
- `view_duration_ms` int — timing window snapshot at issue time (so scoring is stable even if the level row is later retuned)
- `select_duration_ms` int
- `tries_used` int default 0
- `max_tries` int default 3
- `status` text — `active | cleared | exhausted`
- `started_at` timestamptz default now()
- `ended_at` timestamptz null

> The server never trusts a client-supplied seed or config — it reads them back from this row when scoring an attempt. Issued once by `start_session`; mutated only by `submit_attempt`.

### `attempts` (time-series fact table — powers graphs & leaderboards)
- `id` uuid PK
- `user_id` uuid FK → profiles
- `level_id` uuid FK → levels
- `session_id` uuid FK → level_sessions — groups the (up to 3) tries of one level session
- `try_number` int (1..3)
- `solved` boolean
- `coverage` numeric (0..1)
- `accuracy` int
- `speed_bonus` int
- `efficiency_bonus` int
- `attempts_bonus` int
- `total` int
- `stars` int (0..3; meaningful when solved)
- `view_ms_remaining` int — client-reported, **server-clamped** to the session window
- `select_ms_remaining` int — client-reported, **server-clamped** to the session window
- `created_at`

> The puzzle seed lives on `level_sessions`, not here — every attempt in a session shares it. The server reads it back from the session when scoring, so it never depends on a client-supplied value.

### `level_progress` (1 row per user×level — denormalized current state for the level page)
- `user_id` uuid FK → profiles
- `level_id` uuid FK → levels
- `best_total` int — **PR**
- `best_stars` int
- `best_try_count` int — fewest tries used on a clear
- `cleared` boolean default false
- `times_played` int default 0
- `last_played_at` timestamptz
- PK (`user_id`, `level_id`)

### `daily_challenges`
- `id` uuid PK
- `date` date unique
- `level_id` uuid FK null **or** inline difficulty columns (mirror of `levels` profile fields) — implementation may reference an existing level or store an inline profile
- `created_at`

### `daily_results`
- `user_id` uuid FK → profiles
- `daily_challenge_id` uuid FK → daily_challenges
- `best_total` int
- `best_attempt_id` uuid FK → attempts null
- `created_at`
- PK (`user_id`, `daily_challenge_id`)

### `achievements`
- `id` uuid PK
- `slug` text unique
- `name` text
- `description` text
- `criteria` jsonb — machine-checkable definition (e.g. `{"type":"first_try_clears","count":10}`)

### `user_achievements`
- `user_id` uuid FK → profiles
- `achievement_id` uuid FK → achievements
- `unlocked_at` timestamptz
- PK (`user_id`, `achievement_id`)

### Derived: global high score per level
- View `level_global_best`: `max(total)` per `level_id` plus the holder's `display_name`. (Plain view first; can be materialized later for scale.) PR is read from `level_progress.best_total`.

### RLS policies
- `profiles`, `level_sessions`, `attempts`, `level_progress`, `daily_results`, `user_achievements`: **owner-only** (`auth.uid() = user_id` / `id`). The client may **read** its own `level_sessions` but never **insert/update** them — sessions are written only by the `start_session` / `submit_attempt` Edge Functions (service role), so the client can't forge a seed or reset `tries_used`.
- `themes`, `levels`, `achievements`, `daily_challenges`: **world-readable**, writes restricted to service role.
- Leaderboard / global-best exposed via a **SECURITY DEFINER** view or RPC returning only `display_name` + score (never raw user rows).

---

## 6. API surface

Reads go directly through Supabase (PostgREST / RPC) under RLS. The two write paths that own game integrity — issuing a puzzle and scoring an attempt — are **Edge Functions** (Deno) that import `src/core` and run with the service role, so the same generation/solving/scoring code runs server-side.

### Reads
- `get_journey()` → themes (in order) → their levels → each level's `{ my_pr, my_stars, cleared, last_played, locked, global_best }`. One call drives the journey screen. `locked` is computed from the previous theme's clear-ratio vs `unlock_threshold`.
- `get_level(level_id)` → `{ theme_name, display_number, my_pr, global_high, last_played }`. Drives the level-detail screen.
- `get_stats()` → the caller's attempts over time (for the future score-over-time graph) + streak summary.

### Writes (Edge Functions — server-authoritative)
- `start_session(level_id)` — Edge Function. Steps:
  1. Load the level's difficulty config.
  2. Choose a **fresh random seed** (server-side).
  3. `generatePuzzle(config, seed)` using the shared core → the board.
  4. Insert a `level_sessions` row (seed, timing-window snapshot, `tries_used = 0`, `status = 'active'`).
  5. Return `{ session_id, puzzle: { grid, gaps }, view_duration_ms, select_duration_ms, max_tries }`. **The seed is not returned to the client** — the client only needs the rendered puzzle.

- `submit_attempt({ session_id, selection, view_ms_remaining, select_ms_remaining })` — Edge Function. Steps:
  1. Load the `level_sessions` row (must belong to the caller, `status = 'active'`, `tries_used < max_tries`). Reject otherwise.
  2. `try_number = tries_used + 1`.
  3. **Regenerate** the puzzle from the session's stored `seed` + level config (shared core) — the authoritative board.
  4. **Solve / best-fit** the player's `selection` against that board (shared core) → `solved`, `coverage`, placements.
  5. **Score** with the shared core: accuracy + efficiency + attempts from authoritative state; **Speed** from client timings **clamped** to `[0, session.view_duration_ms]` / `[0, session.select_duration_ms]`.
  6. Insert the `attempts` row; bump `level_sessions.tries_used`; set session `status` (`cleared` on solve, `exhausted` when tries run out, else stays `active`).
  7. On a clear: recompute `level_progress` (PR, best_stars, best_try_count, cleared, times_played, last_played_at); update streak fields on `profiles`; evaluate `achievements` and insert newly unlocked `user_achievements`.
  8. Return `{ attempt: { solved, coverage, pillars, total, stars }, placements, session_status, progress, new_achievements, theme_unlocked }`.

> The client never generates, solves, or scores during normal play — it renders the server's puzzle, collects the selection + timings, and posts them. Generation and solving stay in `src/core` (§7) precisely so the Edge Functions can run the identical logic. The only client-influenced input the score depends on is the (clamped) Speed timing.

### Auth
- `signInWithOAuth({ provider: 'apple' | 'google' })`
- `signInAnonymously()` for guest play
- `linkIdentity(...)` to upgrade a guest into a permanent account (preserving their progress)

---

## 7. Shared core extraction (targeted refactor)

Move the framework-agnostic domain logic out of the Zustand store into `src/core/` (no React, no Zustand). This is the code the **Edge Functions import and run server-side**, so it must stay pure TS with no browser/Node-only deps:

- `core/prng.ts` — seeded PRNG (e.g. mulberry32 + a string→seed hash); the single source of game randomness
- `core/pieces.ts`, `core/puzzleGenerator.ts` (now pure: accepts `adjacency` **and a seed/PRNG**, no `Math.random`), `core/solver.ts`
- `core/scoring.ts` — pillar math + `maxScoreFor(levelConfig)` and per-pillar maxes (single source of truth for server scoring)
- `core/difficulty.ts` — the `LevelConfig` type

Benefits: the `start_session` / `submit_attempt` Edge Functions import the **same** generation/solving/scoring code, so there is **no second implementation to keep in sync** — the server is authoritative *and* drift-free. The future RN app reuses the core unchanged (for an offline pack-cache, §10). The Zustand store becomes a thin consumer that no longer needs the solver/scoring in the gameplay path — it calls `start_session`, renders, and posts to `submit_attempt`.

This is a focused improvement of code we're already touching — not a broad refactor.

---

## 8. Seeding & migration

- Seed **Beginner** (display levels 1–7) and **Intermediate** (8–15) from the current `DIFFICULTY_TABLE`, mapping each row to a `levels` row (with `adjacency` defaulted from the existing complexity tier).
- Seed **Advanced**, **Numbered**, and **Flash mob** as **locked stub themes** (correct `mechanic`, `piece_set`, `unlock_threshold`) with no playable levels yet — placeholders for the future agent.
- Seed an initial set of `achievements` (slugs + criteria) covering the chosen bundles (e.g. first-try clears, streak milestones).

---

## 9. Handoff brief — Journey UI (for a future design discussion)

This spec deliberately stops at the backend. The following is the context package so a future agent can run a focused Journey-UI brainstorming.

### Screens to design
1. **Journey map** — levels as nodes on a themed path; locked vs unlocked themes; per-level stars + PR badge.
2. **Level detail** — theme name, level number, PR, global high score, last-played timestamp, **PLAY** button (which starts the countdown → game). (Already specified by the product owner.)
3. **Results screen** — per-pillar **percentage-fill bars** (accuracy / speed / efficiency / attempts), stars earned, tries used, PR-break celebration.
4. **Stats dashboard** — score-over-time graph (from `get_stats()`), tries distribution, streak/longest streak.
5. **Daily challenge** entry + streak flame.
6. **Achievements** gallery.

### Data contracts already available
- Reads: `get_journey()`, `get_level(id)`, `get_stats()`. Gameplay writes: `start_session(level_id)` → `{ session_id, puzzle, timings, max_tries }` and `submit_attempt({ session_id, selection, timings })` → `{ attempt, placements, session_status, progress, new_achievements, theme_unlocked }` (shapes in §6).
- The results screen renders the **server's** scored attempt — per-pillar raw values + maxes come back on `submit_attempt` for the bar visuals; no client-side scoring.

### UX north-star (product-owner-curated)
- **In schema now (build when ready):** Streaks + Daily Challenge; Stars + Achievements; per-level global high score.
- **Recommended polish (no schema impact):** juice — confetti on PR-break, satisfying piece-snap, screen shake, haptics (RN), sound/music.
- **Explicitly deferred / out:** friends graph & leaderboards, shareable result cards, XP / cosmetics / power-ups, RN port.

### Open questions for that discussion
- Journey-map visual style (linear path vs. branching map vs. grid).
- **Score display normalization** — present each pillar against a clean 0–100 or 0–1000 max as a % bar; pick the scale and bar treatment.
- Star-threshold tuning (the 75% / 50% defaults).
- Results-card layout and PR-break celebration.
- First-run onboarding / interactive tutorial.

---

## 10. Out of scope (this spec)

- Building any Journey UI screen.
- Authoring the new theme **mechanics** (Advanced menu-trim logic, Numbered ordering, Flash-mob reveal) — only schema room (`themes.mechanic`, `levels.modifiers`) is reserved.
- Friend graph, sharing, XP / currency / cosmetics / power-ups.
- The React Native port itself (the backend and `core/` are built to enable it).
- **Offline play (designed-for, deferred).** Online is a hard requirement for this foundation. The seed model leaves a clean path for a later offline mode: the server pre-issues a **pack** of `(level_id, seed)` pairs the client caches; the client runs the same `core/` generate→solve→score locally while disconnected, and the attempts sync + re-verify (re-score from seed) on reconnect. No work now — but the architecture is chosen so this needs no rewrite of generation, scoring, or schema.

---

## 11. Testing strategy

- **Core unit tests:** attempts-bonus formula, stars thresholds, `maxScoreFor`, no-negative behavior; generator `adjacency` parameter; **determinism — `generatePuzzle(config, seed)` returns an identical board for the same input and differs across seeds.**
- **Edge Function tests:** `start_session` issues a session + renders a puzzle and **never leaks the seed**; `submit_attempt` regenerates from the stored seed and scores correctly; rejects sessions that aren't the caller's / aren't `active` / are out of tries; **clamps** out-of-window Speed timings; bumps `tries_used` and flips `status` correctly across a 3-try exhaust and a mid-session clear.
- **RLS tests:** owners can read/write only their own rows; the client **cannot insert or update `level_sessions`** (only the service-role functions can); leaderboard view leaks no private data.
- **Progress/streak tests:** `level_progress` recompute (PR, stars, cleared) and streak transitions across day boundaries.
- **Migration/seed sanity:** Beginner/Intermediate levels seed with sane difficulty values; stub themes locked.
- All existing client tests continue to pass (`npm run test`); verify with `npm run build` + lint per project convention.
