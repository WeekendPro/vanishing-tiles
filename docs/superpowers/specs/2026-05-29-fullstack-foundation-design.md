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

1. **A "level" is a difficulty profile, not a fixed board.** The puzzle re-rolls every **new session** (each fresh replay of the level), but stays fixed across the 3 tries within a session (see §3); what is pinned is the difficulty. A per-level global high score therefore means "the best score anyone posted on this difficulty profile" — an intentionally **slightly imperfect** grading model the product owner is comfortable with. (We do **not** seed deterministic per-level puzzles.)
2. **Backend = Supabase.** Postgres + Auth + Row-Level Security (RLS) + Edge Functions (Deno/TypeScript). Chosen for the relational fit (scores-over-time, leaderboards), first-class React Native SDK, and built-in Apple/Google + anonymous auth. The same backend will serve the future RN app.
3. **Auth = Apple + Google + anonymous guest**, with guest accounts upgradable via identity linking. (Apple sign-in is effectively required for the eventual App Store release.)
4. **Trust model = client-trusted + server bounds-check.** The client computes scores and posts attempts; a server-side validation step rejects impossible values before insert. Raw attempt inputs (seed, timings, selection) are stored so we can flip to fully server-authoritative scoring later **with no schema change**.
5. **Out-of-tries = no score, replayable.** Failing all 3 tries leaves the level uncleared, adds nothing to the journey total, and is replayable (tries reset). Every attempt is still logged. **No negative point penalties** — the cost of extra tries is a smaller attempts bonus, not lost points. (This replaces today's negative-accuracy penalty model.)
6. **Theme unlock = threshold of previous theme cleared** (e.g. ≥70% of its levels cleared; threshold stored per-theme, tunable).
7. **Schema reserves room for: Streaks & Daily Challenge, and Stars & Achievements.** Per-level **global high score** stays in (a simple max query, no friend graph). **Out:** friend relationships, sharing infrastructure, and the meta-economy (XP / currency / cosmetics / power-ups).

---

## 3. Scoring & "tries" model

Replaces "3 lives total" with **3 tries per level session**.

### Session & try lifecycle

- A **level session** is one play of a level and grants `maxTries = 3`. A fresh puzzle is generated **once, when the session starts.**
- All three tries face the **same puzzle.** A failed try **consumes a try** and replays the *identical* board (only the player's selection is cleared). This is intentional: the puzzle is memorizable, so a 1st-try clear is the real achievement; a 2nd try feels cheap and a 3rd cheaper — the diminishing attempts bonus reinforces that, and the pressure to "get it first try" becomes the hook as levels get harder.
- A perfect clear ends the session as **cleared**.
- Running out of tries → **not cleared, no points, replayable.** Starting a **new session** (replaying the level) generates a **new** puzzle and resets tries. Every try is logged regardless.

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

### `attempts` (time-series fact table — powers graphs & leaderboards)
- `id` uuid PK
- `user_id` uuid FK → profiles
- `level_id` uuid FK → levels
- `session_id` uuid — groups the (up to 3) tries of one level session
- `try_number` int (1..3)
- `solved` boolean
- `coverage` numeric (0..1)
- `accuracy` int
- `speed_bonus` int
- `efficiency_bonus` int
- `attempts_bonus` int
- `total` int
- `stars` int (0..3; meaningful when solved)
- `view_ms_remaining` int
- `select_ms_remaining` int
- `puzzle_seed` text — recorded for future server-authoritative verification
- `created_at`

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
- `profiles`, `attempts`, `level_progress`, `daily_results`, `user_achievements`: **owner-only** (`auth.uid() = user_id` / `id`).
- `themes`, `levels`, `achievements`, `daily_challenges`: **world-readable**, writes restricted to service role.
- Leaderboard / global-best exposed via a **SECURITY DEFINER** view or RPC returning only `display_name` + score (never raw user rows).

---

## 6. API surface

Reads go directly through Supabase (PostgREST / RPC) under RLS. Writes that need validation go through an Edge Function or `SECURITY DEFINER` RPC.

### Reads
- `get_journey()` → themes (in order) → their levels → each level's `{ my_pr, my_stars, cleared, last_played, locked, global_best }`. One call drives the journey screen. `locked` is computed from the previous theme's clear-ratio vs `unlock_threshold`.
- `get_level(level_id)` → `{ theme_name, display_number, my_pr, global_high, last_played }`. Drives the level-detail screen.
- `get_stats()` → the caller's attempts over time (for the future score-over-time graph) + streak summary.

### Writes
- `submit_attempt(payload)` — Edge Function / RPC. Steps:
  1. **Bounds-check**: total ≤ theoretical max for that level's config; coverage ∈ [0,1]; `try_number` ≤ 3; pillar values within their maxes; piece counts sane. Reject on violation.
  2. Insert the `attempts` row.
  3. Recompute `level_progress` (PR, best_stars, best_try_count, cleared, times_played, last_played_at).
  4. Update streak fields on `profiles` (current/longest/last_played_date).
  5. Evaluate `achievements` against the new state; insert any newly unlocked `user_achievements`.
  6. Return `{ progress, new_achievements, theme_unlocked }`.

> The client generates the puzzle locally (reusing the shared core), creates the `session_id`, and reports `puzzle_seed` + timings per try. Because scoring is client-trusted-with-bounds-check today, the server does not regenerate the puzzle yet — but storing the seed keeps the door open.

### Auth
- `signInWithOAuth({ provider: 'apple' | 'google' })`
- `signInAnonymously()` for guest play
- `linkIdentity(...)` to upgrade a guest into a permanent account (preserving their progress)

---

## 7. Shared core extraction (targeted refactor)

Move the framework-agnostic domain logic out of the Zustand store into `src/core/` (no React, no Zustand):

- `core/pieces.ts`, `core/puzzleGenerator.ts` (now accepts `adjacency`), `core/solver.ts`
- `core/scoring.ts` — pillar math + `maxScoreFor(levelConfig)` and per-pillar maxes (single source of truth used by both the client and the bounds-check Edge Function)
- `core/difficulty.ts` — the `LevelConfig` type

Benefits: the Edge Function imports the **same** scoring/max logic (no drift between client score and server check), and the future RN app reuses the core unchanged. The Zustand store becomes a thin consumer of `core`.

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
- `get_journey()`, `get_level(id)`, `get_stats()`, `submit_attempt(payload)` (shapes in §6).
- Per-pillar raw values + maxes are available on each attempt for the bar visuals.

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

---

## 11. Testing strategy

- **Core unit tests:** attempts-bonus formula, stars thresholds, `maxScoreFor`, no-negative behavior; generator `adjacency` parameter.
- **Bounds-check tests:** `submit_attempt` rejects impossible scores / coverage / try numbers; accepts valid ones.
- **RLS tests:** owners can read/write only their own rows; leaderboard view leaks no private data.
- **Progress/streak tests:** `level_progress` recompute (PR, stars, cleared) and streak transitions across day boundaries.
- **Migration/seed sanity:** Beginner/Intermediate levels seed with sane difficulty values; stub themes locked.
- All existing client tests continue to pass (`npm run test`); verify with `npm run build` + lint per project convention.
