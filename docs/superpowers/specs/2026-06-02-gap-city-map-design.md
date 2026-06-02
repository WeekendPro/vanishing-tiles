# Gap City — The Map (Immersive Journey Redesign) Design

**Date:** 2026-06-02
**Branch:** `feat/gap-city-identity` (Spec 2 builds directly on Spec 1; do NOT branch from `main`)
**Status:** Approved design — ready for implementation plan
**Supersedes:** the real-NYC neighborhood naming shipped by Spec 1 (see §2.1)

---

## 1. Summary

Spec 1 renamed the game to **Gap City**, shipped the `GAP CITY` wordmark, and built the
data model (districts = themes, neighborhoods = levels) — but deliberately left the
Journey screen ("the Map") as a plain vertical list of district sections with
neighborhood cards. **Spec 2 is the immersive Map redesign** promised in Spec 1 §7.

The Journey screen becomes a **neon transit map of a fictional city, Gap City** — three
subway-style lines you climb from the sleepy outskirts up to the dense downtown, with
each station a level. This is **presentational only**: no gameplay, scoring, solver, or
gating changes. The one data change is a **rename** of the existing 3 districts / 15
levels from real NYC names to fictional, pun-forward names (still exactly 3 districts /
15 levels — no new content).

### Why fictional names (the core creative decision)

A stylized map labelled with *real* toponyms (Castle Hill, Bed-Stuy, Manhattan) invites
the brain to fact-check the geography — "is Bed-Stuy really uphill from Castle Hill?" —
and the abstract layout can never satisfy that, so it reads as a lossy, slightly-wrong
projection of a real place. A **map uncanny valley.**

Going fictional flips the map from *lossy projection* to **canonical**: whatever
geography we draw simply *is* the truth of Gap City, with nothing real to contradict it.
That is exactly what lets a transit map be its best self. It is also more coherent with
the brand ("Gap City" was never really New York) and unlocks a thematic hook: the
**gaps** you fill each round are the empty lots of a city you build out block by block —
the gameplay grid and the city grid become the same object. This is direction **F**
("the grid IS the city") finally earned, via a readable map rather than a literal 3D
floor.

### Scope boundary

- **In scope (this spec):** the transit-map Map screen; the fictional/pun rename of the
  3 districts + 15 levels; the static map layout; station-state visuals; tasteful
  v1 animation; tests.
- **Out of scope (→ the gating spec, `2026-06-02-gap-city-station-gating-design.md`):**
  per-station sequential gating and removal of the 70% district-unlock rule. Those are a
  **gameplay change** and are documented separately for a future instance. Spec 2's lock
  behavior is **identical to today's** (whole-line lock via the existing `get_journey`
  `locked` flag).
- **Also out of scope:** any new districts/levels beyond the existing 15; multi-city
  expansion; any gameplay/scoring/solver/difficulty-curve change.

---

## 2. Design decisions (locked during brainstorming)

### 2.1 The fictional world & names

Gap City is a fictional metropolis. The district arc mirrors a Tetris board filling up:
**empty → stacking → dense.** This **replaces** Spec 1's real-NYC names. It is a rename
of existing rows only — still 3 districts, 15 levels, same difficulty curve.

| Line (district) — slug | Levels | Stations (neighborhoods, `index_in_theme` order) |
|---|---|---|
| **The Hollows** — `the_hollows` (sleepy outskirts, all gaps; easy on-ramp) | 1–5 | Vacant Heights · Open Lots · Holloway · Gapstead · Nilsen Park |
| **The Stacks** — `the_stacks` (blocks piling up; mid) | 6–10 | Brickfall · Tetra Heights · Four Corners · Jaywick · Snug Harbor |
| **The Grid** — `the_grid` (dense downtown, locked-in; hard) | 11–15 | Highrise Row · Gridlock · Tight Corners · Clearway · Perfect Square |

Pun logic: *Four Corners* (a tetromino is 4 cells), *Jaywick* (J-piece), *Gridlock*
(city + grid + the downtown difficulty spike), *Clearway* (line clears), *Perfect
Square* (perfect-clear + the O-piece) as the summit / final level.

**Exact mapping** (`display_number` → slug, `index_in_theme`, name):

```
1  the_hollows 1 Vacant Heights
2  the_hollows 2 Open Lots
3  the_hollows 3 Holloway
4  the_hollows 4 Gapstead
5  the_hollows 5 Nilsen Park
6  the_stacks  1 Brickfall
7  the_stacks  2 Tetra Heights
8  the_stacks  3 Four Corners
9  the_stacks  4 Jaywick
10 the_stacks  5 Snug Harbor
11 the_grid    1 Highrise Row
12 the_grid    2 Gridlock
13 the_grid    3 Tight Corners
14 the_grid    4 Clearway
15 the_grid    5 Perfect Square
```

District display names: **The Hollows / The Stacks / The Grid**. Descriptions (reuse the
Spec-1 style short strings): "Sleepy outskirts — all gaps." / "Blocks piling up." /
"Dense downtown — locked in." (final text decided in the plan).

### 2.2 The Map metaphor

**A neon transit map (subway-style).** Chosen over an isometric city and a literal
perspective-grid floor: the transit map is the most readable, the most accessible, the
most scalable (trivial to add a 4th line later), pun-friendly (line names are puns too),
and survives the eventual React Native port. Direction F's "grid is the city" is honored
through the *fictional canonical city* concept rather than literal 3D.

### 2.3 Layout & navigation

- **Ascending climb:** Vacant Heights (level 1) at the bottom, Perfect Square (level 15)
  at the top — ascending the map = rising difficulty.
- **Hand-authored static layout:** 15 station coordinates + 3 line paths drawn once
  (fictional geography is canonical). No procedural placement.
- **Vertical scroll**, auto-centered on the player's next stop on mount.

### 2.4 Lock & progression (presentational — unchanged from today)

- Whole **lines** lock/unlock via the existing `get_journey` `locked` flag (the 70%
  district rule). **Within an unlocked line every station is tappable** (replay cleared,
  jump to any uncleared). Locked-line stations are disabled.
- **"Next stop" is a visual hint only** — the lowest-`display_number` uncleared station
  on an unlocked line (so if the player skipped an earlier level it points back to that
  gap) — and does NOT restrict tapping.
- The station-state visuals are designed one step from "locked" so the future gating
  spec slots in with minimal rework.

### 2.5 Palette (arcade tokens)

- The Hollows = `neon.cyan` (#22d3ee)
- The Stacks = `neon.magenta` (#ff2d95)
- The Grid = `neon.green` (#39d98a)
- Yellow (`neon.yellow`) reserved for ★ ratings — not used for a line.

---

## 3. Station-state visual vocabulary

| State | Treatment |
|---|---|
| **Cleared** | Solid line-color dot + the player's ★ rating beside the label. Tappable (replay). |
| **Next stop** | Pulsing white node — the obvious "go here." (One per map: the lowest-`display_number` uncleared station on an unlocked line.) |
| **Ahead (unlocked line)** | De-emphasized dot (dim line-color, no glow), readable but clearly "later." Still tappable. Becomes the locked node in the gating spec. |
| **Locked line** | Dashed dim line + 🔒 + "clear <prev line> to open." Stations not tappable. |
| **Interchange** | Ringed node where one line hands off to the next (the last station of a line). |

Header chrome: `GAP CITY` wordmark (the Spec-1 `Wordmark` primitive) + a total ★ count
(client-side sum of `my_stars`). Scanline overlay (`ScanlineOverlay` / `.arcade-scanlines`)
over the whole map. **No streak counter** — no such data exists; do not invent it.

Tap a tappable station → `openLevel(level_id)` (existing `navStore` action) → the
existing `LevelDetailScreen` modal (PLAY / PR / stars), unchanged from Spec 1.

---

## 4. Animation scope

**Ship in v1** (tasteful, cheap, RN-portable later):
1. **Next-stop pulse** — the white node gently breathes.
2. **Cleared-route draw-on** — on mount, each line's *cleared* portion animates drawing
   from its start up to the current station (one-time `stroke-dashoffset` sweep).
3. **Scanline overlay** — the existing static arcade primitive.

**Honor `prefers-reduced-motion`** — disable the pulse and the draw-on (cheap CSS media
query).

**Deferred** (note, do not build): a moving "train"/pip riding the line; parallax;
per-station entrance stagger.

---

## 5. Architecture & components

Keep `JourneyScreen` thin; isolate the map.

- **`src/components/JourneyMap/index.tsx`** — `TransitMap`. Props: the `getJourney`
  themes array and an `onSelect(levelId)` callback. Responsibilities: render the SVG
  (lines + stations) by joining the themes/levels data to the static layout, compute the
  next-stop hint, render station states, fire `onSelect` on a tappable station. It does
  NOT fetch data and does NOT own loading/error state.
- **`src/components/JourneyMap/layout.ts`** — the static, hand-authored geometry: 15
  station coordinates and 3 line path definitions, keyed by `display_number` and district
  slug. Geometry lives here, fully decoupled from data, so a designer can nudge a station
  without touching the renderer. Also defines the slug → line-color mapping.
- **`src/components/JourneyScreen.tsx`** — keeps the data load (`getJourney`),
  loading/error states, and the `Wordmark` header (+ total ★). Its success body swaps the
  card grid for `<TransitMap themes={themes} onSelect={openLevel} />`.

If the SVG render in `TransitMap` grows unwieldy, split out small presentational helpers
(`MapLine`, `MapStation`) in the same folder — decided in the plan; 15 stations may not
warrant it.

### Data contract (no RPC change)

`get_journey()` already returns, per theme: `theme_id, slug, name, mechanic, sort_order,
locked, levels[]`, and per level: `level_id, display_number, name, my_pr, my_stars,
cleared, last_played, global_best` (Spec 1 added `name`). `TransitMap` consumes this as-is.
Slugs change value (to `the_hollows`/`the_stacks`/`the_grid`) but the shape is identical.

---

## 6. Data / name change

The only DB change in this spec. A rename — durations/gap configs are untouched.

### 6.1 Migration `0009_gap_city_fictional_names.sql`

A single forward migration, wrapped in a transaction. Steps:

1. **Re-point theme identity.** Update the three district themes' `slug`, `name`, and
   `description`:
   - `the_bronx` → slug `the_hollows`, name `The Hollows`
   - `brooklyn` → slug `the_stacks`, name `The Stacks`
   - `manhattan` → slug `the_grid`, name `The Grid`

   Keyed by the *old* slug. `sort_order` / `unlock_threshold` / `piece_set` / `mechanic`
   are unchanged (preserves the existing lock chain and difficulty). This is safe: `levels`
   reference `theme_id` (not slug), so changing the slug value breaks no FK.

2. **Rename the 15 levels.** `UPDATE public.levels SET name = v.name FROM (values …)`
   keyed by `display_number`, using the §2.1 mapping. `theme_id` / `index_in_theme` /
   durations / gap configs are **not** in this UPDATE.

3. The migration must be idempotent on re-run (use the old slug for theme matching; if a
   DB is already on the new slugs, the theme UPDATE is a no-op match — the plan decides
   whether to also match on new slugs or guard with a WHERE). Verified via pgTAP.

**Note on Spec 1's `0008`:** `0008` is committed on this branch and still uses the NYC
names. `0009` supersedes it forward. Do NOT rewrite `0008` history; add `0009`.

### 6.2 `supabase/seed.sql` (fresh-DB parity)

Update the themes block (slugs + names + descriptions) and the levels block (`name`
column values) to the fictional set. **Every duration / gap_count / shape_complexity /
adjacency value stays byte-for-byte identical** to the current seed (those are the 0007
recalibration). Only slug/name/description strings change.

### 6.3 Keep-in-sync rule (CLAUDE.md)

- `DIFFICULTY_TABLE` (`src/store/gameStore.ts`) — **untouched** (durations unchanged).
- `LEVEL_CONFIGS` / `themeForLevel` (`supabase/functions/_shared/core/levelConfig.ts`) —
  update the `theme` union to `'the_hollows' | 'the_stacks' | 'the_grid'` and
  `themeForLevel(n)` to return the new slugs on the same 5/5/5 split. (Still not consumed
  by runtime code; only its own test.)
- `seed.sql` — updated per §6.2.

### 6.4 GameShell in-game header

**No code change.** It already renders `levelName` (Spec 1, §5.4); the displayed names
change automatically via the data.

---

## 7. Tests

All existing tests stay green; update fixtures/assertions that encode the old names, and
add a render test for the map. Verify with `npm run build` + `npm run test` +
`npx tsc --noEmit` (build catches `noUnusedLocals`). Run each `npm`/`npx` as its own
command (nvm quirk).

- **New `tests/components/JourneyMap.test.tsx`** — with a themes fixture (fictional names):
  renders the station labels; marks exactly one next-stop node; renders ★ on cleared
  stations; a locked-line station is disabled / non-interactive; tapping a tappable
  station calls the `onSelect`/`openLevel` spy with the right `level_id`.
- **`tests/components/JourneyScreen.test.tsx`** — fixtures → fictional names/slugs;
  assertions updated for the map render (e.g. `findByText('The Hollows')`, tap
  `Vacant Heights` opens level detail, a `The Grid` station is locked). Keep the
  fetch-failure retry test.
- **`tests/components/LevelDetailScreen.test.tsx`** — fixture `name`/`theme_name` →
  fictional (e.g. `Vacant Heights` / `The Hollows`); PLAY still calls
  `startJourneySession(..., name)`.
- **`tests/core/levelConfig.test.ts`** — grouping assertions to the new slugs.
- **`supabase/tests/0004_read_rpcs.test.sql`** — the `get_level` name assertion changes
  from `Castle Hill` to `Vacant Heights` (display_number 1); journey-level `name`
  presence assertion unchanged in spirit.
- **Rename greps** — no `the_bronx`/`brooklyn`/`manhattan` or NYC neighborhood names left
  in `src/`, `seed.sql`, `levelConfig.ts`.

pgTAP needs Docker + local Supabase (`npm run db:reset`, `npm run db:test`). If
unavailable, write the migration + pgTAP exactly as specified, run the full vitest suite
+ build, and flag in the final report that pgTAP was not executed locally.

---

## 8. Implementation order (for the plan)

1. Migration `0009_gap_city_fictional_names.sql` (rename themes + levels) + extend the
   pgTAP read-RPC name assertion.
2. `seed.sql` fictional-name parity.
3. `levelConfig.ts` slugs/union + its test.
4. `JourneyMap/layout.ts` (static geometry) — pure data, unit-trivial.
5. `JourneyMap/index.tsx` (`TransitMap`) + `JourneyMap.test.tsx`.
6. `JourneyScreen.tsx` — swap the success body for `<TransitMap>`, keep header/loader/
   error; update `JourneyScreen.test.tsx`.
7. `LevelDetailScreen.test.tsx` fixture rename (component itself unchanged).
8. v1 animations (pulse, cleared draw-on, reduced-motion) — CSS in `index.css` +
   component wiring.
9. `CLAUDE.md` — update the district/neighborhood names and add a line describing the
   transit-map Map screen.
10. Full verification sweep (test + build + tsc + greps; pgTAP if available); then
    `superpowers:finishing-a-development-branch`.

---

## 9. Out of scope / deferred

- **Per-station sequential gating + removal of the 70% district rule** → see the gating
  spec, `docs/superpowers/specs/2026-06-02-gap-city-station-gating-design.md`. This is a
  gameplay change for a future instance, NOT part of Spec 2.
- New districts / cities / levels beyond the existing 15.
- Deferred animations (moving train, parallax, entrance stagger).
- Any gameplay, scoring, solver, or difficulty-curve change.
