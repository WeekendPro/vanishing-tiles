# Gap City — Per-Station Sequential Gating Design (gameplay change)

**Date:** 2026-06-02
**Status:** Finalized design — ready for an implementation plan.
**Depends on:** Spec 2 (the transit-map Map, `2026-06-02-gap-city-map-design.md`) being
merged to `main` — its station-state visuals were deliberately designed to slot into this
gating.
**Branch:** build on top of `main` (Spec 2 is merged there).

---

## 1. Why this is its own spec

Spec 2 (the transit-map Map) is **presentational only** and kept the old lock behavior.
During Spec 2 brainstorming the user decided the *real* progression model should change —
but changing what's playable is a gameplay change, so it was split out here.

## 2. The change

**Replace district-level unlocking with per-station sequential gating.**

- **Ditch the 70% district-unlock rule** entirely (today: a line unlocks when the previous
  district is ≥70% cleared; surfaced as a per-*theme* `locked` flag from `get_journey`,
  derived from `themes.unlock_threshold`).
- **New rule:** progression is a single linear path across **all** levels in
  `display_number` order (Hollows 1–5 → Stacks 6–10 → Grid 11–15). Districts become a
  purely visual/thematic grouping, not a gating unit.

## 3. The gating model

Defined generically over the level set (not hardcoded to 15), so adding levels later
"just works".

Let **`frontier`** = the lowest `display_number` among levels with `cleared = false`.

- A level is **current** ⟺ `display_number = frontier`. This is the single playable
  frontier ("next stop").
- A level is **locked** ⟺ `display_number > frontier`. No skipping ahead.
- A level is **cleared** ⟺ `cleared = true`. Cleared levels are all below the frontier and
  remain **revisitable** (replayable).
- If every level is cleared, `frontier` is null → **no current, nothing locked** (the
  "all-clear" end state).

### Resolved questions

- **Why a hard wall is acceptable:** a station you keep failing becomes a hard gate (no
  skipping). The user accepted this because the project guarantees **every level is
  solvable** — view/select timers rise with `gap_count`, so the challenge is *speed, not
  feasibility* (CLAUDE.md "Difficulty table"). A stuck player can always eventually clear
  the current station. The old "go play an easier level in the district" release valve is
  intentionally removed.
- **Internal-contradiction resolution:** the old 70% rule (lets you advance without
  clearing every level) and per-station gating (forbids skipping) disagree. **Per-station
  gating wins; the 70% rule is removed**, not layered.
- **"Current" definition:** first uncleared station by `display_number`. A station that was
  attempted but not cleared is still the current station.
- **Gating is display-only**, matching today's architecture: the old 70% lock was never
  enforced in `start_session` (verified). `start_session` still serves any valid level id.
  Server-side enforcement is **out of scope** (see §8).

## 4. Backend — `get_journey` RPC

New migration **`0010_per_station_gating.sql`**:

1. **Redefine `public.get_journey()`** to compute `frontier` once (min `display_number`
   where `coalesce(lp.cleared, false) = false`, across all levels for `auth.uid()`), then
   emit, **per level**:
   - `locked` boolean — `frontier is not null and display_number > frontier`.
   - `current` boolean — `display_number = frontier`.
   - (Keep existing per-level keys: `level_id`, `display_number`, `name`, `my_pr`,
     `my_stars`, `cleared`, `last_played`, `global_best`.)
2. **Remove `locked` from the theme object.** Drop the `prev.unlock_threshold` join and the
   `theme_clear` CTE that fed it. Themes keep `theme_id`, `slug`, `name`, `mechanic`,
   `sort_order`, `levels` — visual grouping only.
3. **`alter table public.themes drop column unlock_threshold;`** in the same migration.
   - Edit `supabase/seed.sql` to stop inserting `unlock_threshold` (seed runs *after*
     migrations on `db:reset`, so it must not reference a dropped column).
   - Leave migration `0008` untouched — its `unlock_threshold` insert runs *before* `0010`
     drops the column, so the historical migration chain stays valid.
   - Grep for any other reader of `unlock_threshold` (RLS policies, `0001_schema.test.sql`)
     and update/remove as needed.

## 5. Frontend — `JourneyMap` + `JourneyScreen`

- `JourneyLevel` (in `src/components/JourneyMap/index.tsx`) gains `locked: boolean` and
  `current: boolean`. `JourneyTheme` **loses** `locked`.
- `FlatStation.locked` now comes from `level.locked` (not `theme.locked`).
- Station state collapses from four values to **`'locked' | 'cleared' | 'next'`**. The old
  `'ahead'` treatment (de-emphasized stations on an unlocked line) is **promoted to the
  real locked style** — exactly what Spec 2 anticipated.
  - `next` = the single station with `current === true`. Drop the client-side
    "lowest uncleared on an unlocked line" derivation; trust the RPC flag.
  - Cleared stations stay enabled and tappable (revisit/replay).
  - Locked stations are rendered with the locked style (dimmed + a 🔒 glyph) and
    carry `aria-disabled`, but **stay tappable**: clicking one opens the level detail
    like any other station. `onSelect(levelId, locked)` forwards the station's `locked`
    flag (via `navStore.openLevel(id, locked)`) so the detail can surface the locked
    state. The level detail shows a "🔒 Locked — clear the current station to unlock"
    message and replaces PLAY with a disabled control, so a locked level can be
    inspected but not started (consistent with display-only, no-skip gating).
- **All-clear:** when no station is `current`, render no "next" marker and show a subtle
  **"Gap City cleared"** badge in the `JourneyScreen` header (derived from "every level
  across all themes is cleared"). Minimal for now; a richer ending is a future feature as
  more levels are added.

## 6. Tests

- **pgTAP** (extend `supabase/tests/0004_read_rpcs.test.sql`; needs Docker + local
  Supabase, `npm run db:reset` / `npm run db:test`):
  - No progress → display_number 1 is `current`; 2+ are `locked`; none cleared.
  - After clearing levels 1–3 (insert `level_progress` rows) → 4 is `current`, 5+ `locked`,
    1–3 `cleared` and **not** `locked`.
  - All cleared → no level is `current` or `locked`.
- **Frontend** (`tests/components/JourneyMap.test.tsx`,
  `tests/components/JourneyScreen.test.tsx`,
  `tests/components/LevelDetailScreen.test.tsx`): rewrite fixtures to carry per-level
  `locked` / `current` and drop `theme.locked`. Assert:
  - stations after current stay enabled but carry `aria-disabled`;
  - the current station has `aria-current="step"`;
  - cleared stations are enabled and fire `onSelect(id, false)` when tapped;
  - clicking a locked station fires `onSelect(id, true)` and opens the level detail
    flagged as locked;
  - the locked level detail shows the lock message and offers no PLAY action;
  - the all-clear badge renders when every level is cleared.
- Remove/replace any test asserting the old 70%-threshold lock.

**Baseline to keep green:** 237 frontend tests + 39 pgTAP (updating the obsolete
70%-rule-shaped tests as above).

## 7. Files touched (summary)

- `supabase/migrations/0010_per_station_gating.sql` (new) — RPC redefinition + column drop.
- `supabase/seed.sql` — drop `unlock_threshold` from the themes insert.
- `src/components/JourneyMap/index.tsx` — per-level flags, state collapse, locked
  stations stay tappable and forward `locked` through `onSelect`.
- `src/components/JourneyScreen.tsx` — all-clear badge.
- `src/store/navStore.ts` — `openLevel(id, locked)` carries `selectedLevelLocked`.
- `src/components/LevelDetailScreen.tsx` — locked state: lock message + disabled PLAY.
- `tests/components/JourneyMap.test.tsx`, `tests/components/JourneyScreen.test.tsx`,
  `tests/components/LevelDetailScreen.test.tsx`,
  `supabase/tests/0004_read_rpcs.test.sql` — updated/added.

## 8. Explicitly NOT in scope

- **Server-side enforcement** of gating in `start_session` (gating stays display-only, as
  today). Noted as possible future hardening.
- Any change to scoring, the solver, or the difficulty table.
- A richer "you beat the city" ending — deferred until more levels exist.
