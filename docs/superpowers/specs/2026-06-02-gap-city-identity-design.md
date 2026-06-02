# Gap City — Identity & Journey IA Design

**Date:** 2026-06-02
**Branch:** `feat/gap-city-identity` (off `feat/arcade-visual-overhaul`)
**Status:** Approved design — ready for implementation plan

---

## 1. Summary

Rename the game from **Mind The Gap** to **Gap City**, and re-theme Journey mode's
progression around a real city's neighborhoods instead of generic skill tiers
("Beginner / Intermediate / Advanced"). The arcade visual system (cyan neon, Press
Start 2P, scanlines) already shipped; this builds the *brand and information
architecture* on top of it.

Journey mode becomes a tour of a city by **district** (a theme/group) and
**neighborhood** (a level). The first city is **New York**, with three districts
re-slicing the existing 15 levels:

| District (theme) | Levels | Neighborhoods (in order) |
|---|---|---|
| **The Bronx** | 1–5 | Castle Hill, East Tremont, Hunts Point, Melrose, City Island |
| **Brooklyn** | 6–10 | Bed-Stuy, Canarsie, Bushwick, Flatbush, Red Hook |
| **Manhattan** | 11–15 | Harlem, Chelsea, SoHo, Washington Heights, Tribeca |

This is a presentational + data-model change. **No game logic, scoring, solver,
or difficulty-curve changes.** Difficulty climbs continuously across districts
exactly as it does today — we are only relabeling the existing 15 levels and
adding a per-level neighborhood name.

### Scope boundary

- **In scope (this spec):** the rename, the "Gap City" wordmark on the auth screen
  and Journey header, the data-model change (add `levels.name`, re-group the 15
  levels into 3 districts), surfacing neighborhood names through the RPCs and UI.
- **Out of scope (deferred to Spec 2 — "the Map"):** the immersive city-grid Map
  redesign (direction **F**'s perspective floor / isometric district view), any
  *new* districts or levels beyond the existing 15, and multi-city expansion. The
  `JourneyScreen` here gets only the minimal label/header changes needed for the
  rename and neighborhood names — not a visual redesign.

---

## 2. Design decisions (locked during brainstorming)

- **Identity direction:** **F — "the grid IS the city."** Reads the 12×12 board as
  a city seen from above. This spec ships only the **wordmark** half of F (the
  `GAP CITY` pixel lockup, white core + cyan glow); the immersive perspective-floor
  Map is Spec 2.
- **World model:** **One city (New York), two naming tiers** — district = theme,
  neighborhood = level. Long runway: future cities/boroughs become new themes.
- **Difficulty:** **Climbs across districts.** The Bronx is the easy on-ramp,
  Manhattan the hardest. We keep the existing per-level timing/gap configs; only
  the grouping labels change.
- **Seed plan:** **Re-slice the existing 15 levels into 3 districts of 5.** Today
  they are split 7 (beginner) + 8 (intermediate). We move to 5 + 5 + 5 and rename.

---

## 3. Current state (what exists today)

- **`themes` table** (`supabase/migrations/0001_core_schema.sql:13`): `id, slug,
  name, description, sort_order, unlock_threshold, piece_set, mechanic`.
- **`levels` table** (`0001_core_schema.sql:25`): `id, theme_id, index_in_theme,
  display_number, view_duration_ms, select_duration_ms, gap_count, shape_complexity,
  adjacency, modifiers`. **No `name` column** — this is the one real schema gap.
  `unique (theme_id, index_in_theme)`.
- **`supabase/seed.sql`** seeds 5 themes (`beginner` sort 1 unlock 0.0,
  `intermediate` 2 unlock 0.7, `advanced` 3, `numbered` 4, `flashmob` 5) and 15
  levels: 1–7 → `beginner`, 8–15 → `intermediate`. Uses `on conflict do nothing`.
- **`supabase/migrations/0007_recalibrate_level_durations.sql`** UPDATEs
  `view_duration_ms` / `select_duration_ms` per `display_number` (1→4000/10000 …
  15→17000/23000). **These recalibrated values must be preserved** — the
  re-grouping migration must not clobber them. We re-point `theme_id` /
  `index_in_theme` / `name` only, never the durations.
- **`get_journey()`** (`0006_read_rpcs.sql:2`) returns per-theme objects with a
  `levels` array of `{level_id, display_number, my_pr, my_stars, cleared,
  last_played, global_best}` ordered by `index_in_theme`.
- **`get_level(p_level_id)`** (`0006_read_rpcs.sql:38`) returns `{level_id,
  display_number, theme_name, view_duration_ms, select_duration_ms, gap_count,
  shape_complexity, adjacency, my_pr, my_stars, global_high, last_played}`.
- **Frontend:**
  - `JourneyScreen.tsx` — header literal `"Mind The Gap"` (line 60); level cards
    render `Level {display_number}` (line 79); section header renders `theme.name`.
  - `LevelDetailScreen.tsx` — modal shows `theme_name` (magenta) then `Level
    {display_number}` (cyan heading); `play()` calls
    `startJourneySession(level.level_id, level.my_pr ?? 0, level.display_number)`.
  - `GameShell.tsx` (lines 51–53) — journey header renders `LEVEL
    {levelDisplayNumber}`; practice renders `ROUND {round}`.
  - `gameStore.ts` — `startJourneySession(levelId, priorPr, displayNumber)` sets
    `levelDisplayNumber`. There is **no** level-name field in the store today.
  - `AuthScreen.tsx` (line 42) — `<PixelHeading>Mind The Gap</PixelHeading>`.
  - `index.html`, `package.json` — title/name strings.

---

## 4. Data model changes

### 4.1 New migration `0008_gap_city_districts.sql`

A single forward migration. Idempotent where practical. Steps:

1. **Add the column:**
   ```sql
   alter table public.levels add column if not exists name text;
   ```

2. **Insert/ensure the three district themes** (idempotent via `on conflict (slug)
   do update` so re-runs keep them correct). Slugs: `the_bronx`, `brooklyn`,
   `manhattan`. `sort_order` 1/2/3.

   **Unlock-threshold semantics (important):** `get_journey()` locks theme *t* when
   the *previous* theme's clear ratio is below **the previous theme's**
   `unlock_threshold` (`0006_read_rpcs.sql:19-22` joins `prev` and compares
   `prev.unlock_threshold`). So a district's `unlock_threshold` gates the district
   *after* it, and the first theme (`rn = 1`) is always unlocked regardless of its
   own value. We mirror the existing seed pattern (first theme `0.0`, the rest
   `0.7`): **the_bronx `0.0`, brooklyn `0.7`, manhattan `0.7`**. Resulting behavior,
   identical in spirit to today's beginner→intermediate gate: The Bronx always open;
   Brooklyn always open (Bronx's `0.0` gate is a no-op, matching how `beginner`'s
   `0.0` left `intermediate` open today); Manhattan unlocks once ≥70% of Brooklyn is
   cleared. Manhattan's own `0.7` is inert (no district follows it). If the plan
   wants Brooklyn actually gated behind The Bronx, set the_bronx to `0.7` — but
   that is a *behavior change* from today and must be called out explicitly; the
   default here preserves shipped gating.

   `mechanic` / `piece_set` / `description` carry sensible defaults consistent with
   the existing themes (reuse the current `beginner`/`intermediate` values; exact
   text decided in the plan).

3. **Re-point the 15 levels to the new themes, set `index_in_theme`, set `name`.**
   Keyed by `display_number` so we never touch durations/gap configs. Example shape
   (full 15-row VALUES list written out in the plan):
   ```sql
   update public.levels as l set
     theme_id       = th.id,
     index_in_theme = v.idx,
     name           = v.name
   from (values
     (1,  'the_bronx', 1, 'Castle Hill'),
     (2,  'the_bronx', 2, 'East Tremont'),
     (3,  'the_bronx', 3, 'Hunts Point'),
     (4,  'the_bronx', 4, 'Melrose'),
     (5,  'the_bronx', 5, 'City Island'),
     (6,  'brooklyn',  1, 'Bed-Stuy'),
     (7,  'brooklyn',  2, 'Canarsie'),
     (8,  'brooklyn',  3, 'Bushwick'),
     (9,  'brooklyn',  4, 'Flatbush'),
     (10, 'brooklyn',  5, 'Red Hook'),
     (11, 'manhattan', 1, 'Harlem'),
     (12, 'manhattan', 2, 'Chelsea'),
     (13, 'manhattan', 3, 'SoHo'),
     (14, 'manhattan', 4, 'Washington Heights'),
     (15, 'manhattan', 5, 'Tribeca')
   ) as v(display_number, slug, idx, name)
   join public.themes th on th.slug = v.slug
   where l.display_number = v.display_number;
   ```
   **Unique-constraint note:** the `levels` table has `unique (theme_id,
   index_in_theme)`. Because the three destination themes (`the_bronx` / `brooklyn`
   / `manhattan`) are **brand-new rows** whose ids never overlap the source themes
   (`beginner` / `intermediate`), no `(theme_id, index_in_theme)` pair in the new
   space can collide with an existing row, and each destination pair is unique by
   construction. So a single `UPDATE … FROM (values …)` is collision-free on a fresh
   DB *and* on a DB already seeded with the old grouping (re-runs re-point the same
   rows to the same place). The plan still wraps it in a transaction and verifies via
   pgTAP.

4. **Remove ALL five legacy themes, seed only the three districts.** After the
   re-point, `beginner` / `intermediate` have no levels. The seed also created three
   *other* empty themes — `advanced`, `numbered`, `flashmob` — which were never
   populated. **Decision (refines the spec): delete all five legacy themes**
   (`beginner, intermediate, advanced, numbered, flashmob`) so the journey shows
   exactly the three districts.

   **Why delete the empties too, not just `beginner`/`intermediate`:** `get_journey()`
   assigns `row_number()` (`rn`) over *all* themes ordered by `sort_order`, and the
   per-theme lock test reads the **previous** theme's clear ratio via `prev.rn =
   t.rn - 1`. If empty legacy themes remain interleaved, (a) `advanced`'s
   `sort_order = 3` collides with `manhattan`'s `sort_order = 3`, making `rn`
   nondeterministic, and (b) the district unlock chain could read a `prev` that is an
   empty theme — corrupting lock state. Leaving them would also render empty,
   level-less district headers in the journey. Deleting them yields exactly three
   themes with `rn = 1/2/3` and a clean unlock chain. This is safe: no levels
   reference them post-update; `level_progress` / `attempts` reference `level_id`,
   not `theme_id`; the cascade `on delete cascade` on `levels.theme_id` only matters
   for the now-empty themes. The `numbered` / `flashmob` *mechanics* can be
   re-introduced as real districts when actually built (YAGNI — don't keep
   speculative empty rows that break the lock chain).

### 4.2 Keep `seed.sql` in sync

`seed.sql` is the fresh-DB source of truth. Update it so a brand-new database comes
up already in the Gap City grouping (3 district themes, 15 levels with `name` and
correct `theme_id`/`index_in_theme`), preserving the recalibrated durations from
0007. After this, the 0007 recalibration UPDATE still applies cleanly (it keys on
`display_number`, which is unchanged).

> **Keep in sync** (the 0007 comment already names these): `DIFFICULTY_TABLE`
> (`src/store/gameStore.ts`), `LEVEL_CONFIGS`
> (`supabase/functions/_shared/core/levelConfig.ts`), `seed.sql`. The neighborhood
> names are *new* metadata; durations/gap configs are unchanged, so those three
> stay valid. We add the district/neighborhood labels to `seed.sql`.

`levelConfig.ts` carries a vestigial `theme: 'beginner' | 'intermediate'` field and a
`themeForLevel(n)` helper that splits 1–7/8–15. It is **not consumed by any runtime
code** — only by its own test (`tests/core/levelConfig.test.ts`); the server serves
durations from the DB `levels` table. To honor the "keep in sync" rule, update
`themeForLevel` to return the district slug for the 5/5/5 split and widen the union
type to `'the_bronx' | 'brooklyn' | 'manhattan'`, then update its test. Durations/gap
configs in `RAW` are untouched.

### 4.3 RPC changes — add `name` to both reads

- **`get_journey()`** — add `'name', l.name` to each level object in the inner
  `jsonb_agg` (`0006_read_rpcs.sql:24-29`). Ship as a `create or replace` inside
  `0008` (or a sibling migration `0009_journey_name.sql` — plan's call; one
  migration is fine).
- **`get_level()`** — add `'name', l.name` to the returned object
  (`0006_read_rpcs.sql:40-45`). `theme_name` stays (it's the district name).

No signature change; both still return `jsonb`. Re-grant is unnecessary for
`create or replace`.

---

## 5. Frontend changes

### 5.1 Rename Mind The Gap → Gap City

- `index.html` `<title>` → `Gap City`.
- `package.json` `"name"` → `gap-city`.
- `AuthScreen.tsx:42` — replace `<PixelHeading>Mind The Gap</PixelHeading>` with the
  Gap City wordmark (see 5.2).
- `JourneyScreen.tsx:60` — header `Mind The Gap` → `Gap City` wordmark (see 5.2).
- `CLAUDE.md` — update the project title/intro to "Gap City" and note the New York
  district theming. (Mechanics description unchanged.)

### 5.2 "Gap City" wordmark (direction F, type half)

A small presentational component, e.g. `src/components/ui/Wordmark.tsx`, exported
from the `ui` barrel. Renders `GAP CITY` in `font-pixel`, uppercase, with the F
look: **white letter core + cyan glow** (`text-white` + `text-glow-cyan`, or a
layered text-shadow matching the mockup). Props: `size` (at least `sm` for the
Journey header and `lg` for the auth screen) and optional `className`. No animation
required for v1. It replaces the raw `PixelHeading` text on `AuthScreen` and the
`<h1>` string on `JourneyScreen`.

This is the *only* visual-design addition. Everything else reuses shipped
primitives.

### 5.3 Surface neighborhood names

- **`JourneyScreen.tsx`:**
  - `JourneyLevel` interface: add `name: string`.
  - Section header keeps `theme.name` (now the district, e.g. "The Bronx").
  - Level card: replace `Level {display_number}` with `{lvl.name}` as the primary
    label (the neighborhood). Keep `display_number` available if a small "Level N"
    sub-label is wanted, but the **neighborhood name is the headline**. (Accessible
    button name becomes the neighborhood — update tests accordingly, see §6.)
- **`LevelDetailScreen.tsx`:**
  - `LevelDetail` interface: add `name: string`.
  - District label (magenta, line 75) keeps `theme_name`.
  - Heading (cyan, line 76): replace `Level {display_number}` with `{level.name}`
    (the neighborhood). Add a small muted meta row showing `Level {display_number}`
    (e.g. in the `<dl>` or just above it) so the absolute level number is still
    visible.
  - `play()` now needs to pass the neighborhood name into the session (see 5.4).

### 5.4 Plumb the neighborhood name into the in-game header

- **`gameStore.ts`:**
  - Add `levelName: string | null` to state (next to `levelDisplayNumber`), default
    `null`, reset in `resetGame`/`INITIAL_STATE`.
  - `startJourneySession` signature gains the name:
    `startJourneySession(levelId, priorPr, displayNumber, levelName)` — set
    `levelName` in the `set({...})` block.
- **`LevelDetailScreen.tsx`** `play()` — pass `level.name`:
  `startJourneySession(level.level_id, level.my_pr ?? 0, level.display_number,
  level.name)`.
- **`GameShell.tsx`** (lines 51–53) — journey branch renders the **neighborhood
  name** instead of `LEVEL {levelDisplayNumber}`:
  ```tsx
  {mode === 'journey'
    ? <strong className="text-white">{levelName}</strong>
    : <>ROUND <strong className="text-white">{round}</strong></>}
  ```
  Keep the same `font-pixel` chrome. Practice mode is unchanged. (If `levelName` is
  null for any reason, fall back to `LEVEL {levelDisplayNumber}` so the header never
  renders empty.)

---

## 6. Tests

All 220 existing tests must stay green; update the ones whose fixtures/assertions
encode the old labels:

- **`tests/components/JourneyScreen.test.tsx`** — fixtures (`MOCK` themes/levels)
  gain `name` on each level; `name` on themes becomes a district (e.g. "The
  Bronx"); the `getByRole('button', { name: /Level 1/i })` / `/Level 9/i`
  assertions change to the neighborhood names (e.g. `/Castle Hill/i`). Locked-theme
  behavior assertion is unchanged in spirit.
- **`tests/components/LevelDetailScreen.test.tsx`** — `LEVEL` fixture gains `name`;
  `theme_name` becomes a district; assert the neighborhood heading renders and the
  PLAY click still calls `startJourneySession` (now with the extra `name` arg).
- **`gameStore` test(s)** that call `startJourneySession` — update the call to pass
  the new `levelName` arg and assert `levelName` is set. (Check
  `tests/store/*.test.ts` for the journey-session path.)
- **Wordmark** — a light render test asserting `GAP CITY` appears, mirroring
  `tests/components/ui/PixelHeading.test.tsx`.
- **Supabase RPC tests** (`supabase/tests/*read_rpcs*`) — if they assert the
  `get_journey` / `get_level` JSON shape, add `name` to expected output and update
  any theme/level fixtures to the new grouping.
- **Rename greps** — any test asserting the literal `Mind The Gap` updates to `Gap
  City`.

Run `npm run test` (all green), `npm run build` (catches `noUnusedLocals`), and
`npx tsc --noEmit`. Per project convention, verify with the build, not just `tsc`.

---

## 7. Out of scope / deferred (Spec 2)

- The immersive **Map** redesign: F's perspective city-grid floor, isometric
  district view, animated streets/blocks. `JourneyScreen` here only gets the
  rename + neighborhood-name relabel.
- **New districts / cities** beyond New York's three (Bronx/Brooklyn/Manhattan) and
  the existing 15 levels. The data model (`themes` + `levels.name`) is built to
  scale to them, but no new content ships here.
- Any gameplay, scoring, solver, or difficulty-curve change.

---

## 8. Implementation order (for the plan)

1. Migration `0008` (add `levels.name`, create 3 district themes, re-point + name
   the 15 levels preserving durations, retire empty legacy themes) + RPC
   `create or replace` for `name`.
2. Update `seed.sql` to match (fresh-DB parity).
3. `Wordmark` component + barrel export + test.
4. Rename strings (`index.html`, `package.json`, `AuthScreen`, `JourneyScreen`
   header, `CLAUDE.md`).
5. Store: add `levelName`, extend `startJourneySession`.
6. `LevelDetailScreen`: add `name`, show neighborhood heading + "Level N" meta, pass
   `name` into `play()`.
7. `JourneyScreen`: add `name`, render neighborhoods on cards.
8. `GameShell`: render neighborhood name in journey header.
9. Update tests; full green run + build.
