# Gap City Identity & Journey IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "Mind The Gap" → "Gap City" and re-theme Journey mode around New York districts (The Bronx / Brooklyn / Manhattan) with per-level neighborhood names — presentational + data-model only, no gameplay change.

**Architecture:** A single forward SQL migration adds `levels.name`, replaces the five legacy themes with three district themes, re-points the existing 15 levels (preserving durations) and names them, and extends the `get_journey` / `get_level` RPCs with `name`. The frontend adds one `Wordmark` UI primitive, swaps rename strings, threads a `levelName` through the game store, and renders neighborhood names on the Journey cards, Level Detail modal, and in-game header. All existing tests stay green; fixtures and label assertions are updated to the new naming.

**Tech Stack:** React + TypeScript + Vite + Tailwind v3 + Zustand + Vitest/React Testing Library; Supabase Postgres (SQL migrations + pgTAP).

**Spec:** `docs/superpowers/specs/2026-06-02-gap-city-identity-design.md`

**Branch:** `feat/gap-city-identity` (already checked out, off `feat/arcade-visual-overhaul`).

**Important environment notes (read before starting):**
- Run `npm run test` (vitest) for all TS/React tests. All must pass before each commit.
- Run `npm run build` (catches `noUnusedLocals`/`noUnusedParameters`) and `npx tsc --noEmit` to verify types. Per project convention, **verify with the build, not just `tsc`**.
- **nvm quirk:** chained shell commands like `npm run x && npm run y` can error with `__init_nvm`. Run each `npm`/`npx` invocation as its **own** separate command.
- The SQL migration is tested with pgTAP via `npm run db:reset` then `npm run db:test`. These require Docker + local Supabase (`npm run db:start`). If the local DB stack is unavailable in your environment, still write the migration + pgTAP test exactly as specified, run the full vitest suite + build (which exercise the frontend against mocked APIs), and **flag in your final report that the pgTAP suite could not be executed locally** so a human runs it before merge.

---

## File Structure

**Created:**
- `supabase/migrations/0008_gap_city_districts.sql` — add `levels.name`; replace 5 legacy themes with 3 districts; re-point + name the 15 levels (durations preserved); `create or replace` `get_journey` / `get_level` to include `name`.
- `src/components/ui/Wordmark.tsx` — the "GAP CITY" pixel wordmark (white core + cyan glow), sizes `sm`/`lg`.
- `tests/components/ui/Wordmark.test.tsx` — render test for the wordmark.

**Modified:**
- `supabase/seed.sql` — fresh-DB parity: seed the 3 district themes + 15 named levels.
- `supabase/tests/0004_read_rpcs.test.sql` — assert `name` present in `get_journey` levels and `get_level`.
- `src/components/ui/index.ts` — export `Wordmark`.
- `src/components/AuthScreen.tsx` — wordmark instead of `PixelHeading "Mind The Gap"`.
- `src/components/JourneyScreen.tsx` — `Gap City` wordmark header; `JourneyLevel.name`; render neighborhood on cards.
- `src/components/LevelDetailScreen.tsx` — `LevelDetail.name`; neighborhood heading + "Level N" meta; pass `name` into `play()`.
- `src/components/GameShell.tsx` — journey header shows neighborhood name (fallback to `LEVEL N`).
- `src/store/gameStore.ts` — add `levelName` state; extend `startJourneySession` signature.
- `supabase/functions/_shared/core/levelConfig.ts` — `themeForLevel` → district slugs (5/5/5); widen union type.
- `tests/core/levelConfig.test.ts` — update grouping assertions.
- `tests/components/JourneyScreen.test.tsx` — fixtures + assertions to district/neighborhood naming.
- `tests/components/LevelDetailScreen.test.tsx` — fixture `name`; assert neighborhood heading + 4-arg `startJourneySession`.
- `tests/store/gameStore.journey.test.ts` — pass + assert `levelName`.
- `index.html` — `<title>Gap City</title>`.
- `package.json` — `"name": "gap-city"`.
- `CLAUDE.md` — title/intro → Gap City; note district theming.

**Reference data — the 3 districts and their neighborhoods (display_number → district, index_in_theme, name):**

```
1  the_bronx 1 Castle Hill
2  the_bronx 2 East Tremont
3  the_bronx 3 Hunts Point
4  the_bronx 4 Melrose
5  the_bronx 5 City Island
6  brooklyn  1 Bed-Stuy
7  brooklyn  2 Canarsie
8  brooklyn  3 Bushwick
9  brooklyn  4 Flatbush
10 brooklyn  5 Red Hook
11 manhattan 1 Harlem
12 manhattan 2 Chelsea
13 manhattan 3 SoHo
14 manhattan 4 Washington Heights
15 manhattan 5 Tribeca
```

---

## Task 1: Migration — `levels.name`, district themes, re-point + RPCs

**Files:**
- Create: `supabase/migrations/0008_gap_city_districts.sql`
- Test: `supabase/tests/0004_read_rpcs.test.sql` (extend)

Context: This is the data backbone. It must (a) add `levels.name`, (b) replace the five legacy themes with three districts, (c) re-point all 15 levels to the new themes with fresh `index_in_theme` and neighborhood `name`, **without touching `view_duration_ms` / `select_duration_ms` / `gap_count` / `shape_complexity` / `adjacency`** (those were recalibrated by `0007`), and (d) add `name` to both read RPCs. The destination theme ids are new, so the single re-point `UPDATE` cannot collide with the `unique (theme_id, index_in_theme)` constraint.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0008_gap_city_districts.sql`:

```sql
-- 0008_gap_city_districts.sql
-- Gap City identity: re-theme Journey progression around New York districts.
-- Adds a per-level neighborhood name, replaces the five legacy skill-tier themes
-- with three district themes, and re-points the existing 15 levels into a 5/5/5
-- split — preserving the durations/gap configs recalibrated by 0007 (this only
-- touches theme_id, index_in_theme, name). Also extends the read RPCs with `name`.
--
-- Keep in sync with: supabase/seed.sql, DIFFICULTY_TABLE (src/store/gameStore.ts),
-- LEVEL_CONFIGS (supabase/functions/_shared/core/levelConfig.ts).

begin;

-- 1. Per-level neighborhood name.
alter table public.levels add column if not exists name text;

-- 2. The three district themes. Upsert so re-runs stay correct.
--    unlock_threshold lives on a theme and gates the theme AFTER it (get_journey
--    reads prev.unlock_threshold). First theme is always unlocked. We mirror the
--    prior pattern (first 0.0, rest 0.7): the_bronx always open, brooklyn always
--    open (bronx 0.0 gate is a no-op, as beginner's was), manhattan needs >=70%
--    of brooklyn cleared. manhattan's 0.7 is inert (no district follows it).
insert into public.themes (slug,name,description,sort_order,unlock_threshold,piece_set,mechanic) values
  ('the_bronx','The Bronx','Where the run begins',1,0.0,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
  ('brooklyn','Brooklyn','Picking up speed',2,0.7,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
  ('manhattan','Manhattan','The big leagues',3,0.7,'{I,O,T,S,Z,J,L,SINGLE}','standard')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  unlock_threshold = excluded.unlock_threshold,
  piece_set = excluded.piece_set,
  mechanic = excluded.mechanic;

-- 3. Re-point + name the 15 levels by display_number. Destination theme ids are
--    new, so no (theme_id, index_in_theme) collision is possible. Durations and
--    gap configs are deliberately NOT in this UPDATE.
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

-- 4. Remove the now-empty legacy themes (incl. advanced/numbered/flashmob, which
--    were never populated). Keeping empties would collide on sort_order and corrupt
--    get_journey's row_number() lock chain. Safe: no levels reference them now;
--    progress/attempts reference level_id, not theme_id.
delete from public.themes
where slug in ('beginner','intermediate','advanced','numbered','flashmob');

-- 5. RPCs: add `name` to each journey level and to the level detail.
create or replace function public.get_journey()
returns jsonb language sql security definer set search_path = public stable as $$
  with themes_ord as (
    select t.*, row_number() over (order by t.sort_order) as rn from public.themes t
  ),
  theme_clear as (
    select l.theme_id,
      count(*) as total_levels,
      count(*) filter (where lp.cleared) as cleared_levels
    from public.levels l
    left join public.level_progress lp
      on lp.level_id = l.id and lp.user_id = auth.uid()
    group by l.theme_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'theme_id', t.id, 'slug', t.slug, 'name', t.name, 'mechanic', t.mechanic,
    'sort_order', t.sort_order,
    'locked', case when t.rn = 1 then false else
      coalesce((select (tc.cleared_levels::numeric / nullif(tc.total_levels,0)) >= prev.unlock_threshold
                from themes_ord prev join theme_clear tc on tc.theme_id = prev.id
                where prev.rn = t.rn - 1), false) = false end,
    'levels', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'level_id', l.id, 'display_number', l.display_number, 'name', l.name,
        'my_pr', coalesce(lp.best_total, 0), 'my_stars', coalesce(lp.best_stars, 0),
        'cleared', coalesce(lp.cleared, false), 'last_played', lp.last_played_at,
        'global_best', gb.best_total
      ) order by l.index_in_theme), '[]'::jsonb)
      from public.levels l
      left join public.level_progress lp on lp.level_id = l.id and lp.user_id = auth.uid()
      left join public.level_global_best gb on gb.level_id = l.id
      where l.theme_id = t.id)
  ) order by t.sort_order), '[]'::jsonb)
  from themes_ord t;
$$;

create or replace function public.get_level(p_level_id uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'level_id', l.id, 'display_number', l.display_number, 'name', l.name,
    'theme_name', t.name,
    'view_duration_ms', l.view_duration_ms, 'select_duration_ms', l.select_duration_ms,
    'gap_count', l.gap_count, 'shape_complexity', l.shape_complexity, 'adjacency', l.adjacency,
    'my_pr', coalesce(lp.best_total, 0), 'my_stars', coalesce(lp.best_stars, 0),
    'global_high', gb.best_total, 'last_played', lp.last_played_at)
  from public.levels l
  join public.themes t on t.id = l.theme_id
  left join public.level_progress lp on lp.level_id = l.id and lp.user_id = auth.uid()
  left join public.level_global_best gb on gb.level_id = l.id
  where l.id = p_level_id;
$$;

commit;
```

- [ ] **Step 2: Extend the pgTAP read-RPC test**

Edit `supabase/tests/0004_read_rpcs.test.sql`. Change the `plan(3)` count and add two assertions that `name` is surfaced. Replace the body between `set local request.jwt.claims …` and `reset role;`:

```sql
select plan(5);
```

(change `plan(3)` → `plan(5)`)

and add, after the existing three `select … ok` lines:

```sql
-- Gap City: neighborhood name flows through both reads.
select isnt_empty(
  $$ select 1 from jsonb_array_elements(public.get_journey()) th,
         jsonb_array_elements(th->'levels') lv
     where lv ? 'name' and (lv->>'name') is not null $$,
  'get_journey levels carry a neighborhood name');
select is(
  (select public.get_level((select id from public.levels order by display_number limit 1)) ->> 'name'),
  'Castle Hill',
  'get_level returns the neighborhood name for display_number 1');
```

- [ ] **Step 3: Run the migration + pgTAP suite**

Run (each as its own command):
- `npm run db:reset`  — applies all migrations onto a fresh DB seeded by `seed.sql` (note: `seed.sql` is updated in Task 2; if running Task 1 before Task 2, the seed still has old themes — that's fine, the migration UPDATE keys on `display_number` which is unchanged, and the legacy-theme `delete` cleans up).
- `npm run db:test`

Expected: `0004_read_rpcs` reports `ok` for all 5 assertions.

If Docker/Supabase is unavailable, skip execution and note it in your report (see environment notes at top).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_gap_city_districts.sql supabase/tests/0004_read_rpcs.test.sql
git commit -m "feat(db): add levels.name + NY district themes; surface name in read RPCs"
```

---

## Task 2: Seed parity — fresh DB comes up as Gap City

**Files:**
- Modify: `supabase/seed.sql`

Context: `seed.sql` is the fresh-DB source of truth and uses `on conflict do nothing`. A brand-new DB must come up already in the Gap City grouping so the journey is correct without depending on the 0008 migration's re-point. The durations/gap configs MUST stay identical to the current seed (they are what 0007 recalibrated to).

- [ ] **Step 1: Replace the themes insert**

In `supabase/seed.sql`, replace the existing themes block (currently the 5 legacy themes) with the three districts:

```sql
insert into public.themes (slug,name,description,sort_order,unlock_threshold,piece_set,mechanic) values
 ('the_bronx','The Bronx','Where the run begins',1,0.0,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
 ('brooklyn','Brooklyn','Picking up speed',2,0.7,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
 ('manhattan','Manhattan','The big leagues',3,0.7,'{I,O,T,S,Z,J,L,SINGLE}','standard')
on conflict (slug) do nothing;
```

- [ ] **Step 2: Replace the levels insert**

Replace the levels block. Add `name` to the column list and set district `theme_id` + `index_in_theme` + `name` per level, keeping every duration/gap/complexity/adjacency value byte-for-byte as today:

```sql
-- The Bronx (1-5), Brooklyn (6-10), Manhattan (11-15). Durations/gaps from
-- DIFFICULTY_TABLE / 0007 recalibration — DO NOT change these numbers here.
with t as (select id, slug from public.themes)
insert into public.levels (theme_id,index_in_theme,display_number,name,view_duration_ms,select_duration_ms,gap_count,shape_complexity,adjacency) values
 ((select id from t where slug='the_bronx'),1,1,'Castle Hill',4000,10000,3,'simple',0),
 ((select id from t where slug='the_bronx'),2,2,'East Tremont',5000,11000,4,'simple',0),
 ((select id from t where slug='the_bronx'),3,3,'Hunts Point',6500,12000,5,'simple',0),
 ((select id from t where slug='the_bronx'),4,4,'Melrose',8000,14000,6,'medium',1),
 ((select id from t where slug='the_bronx'),5,5,'City Island',9000,15000,7,'medium',1),
 ((select id from t where slug='brooklyn'),1,6,'Bed-Stuy',10000,16000,8,'medium',1),
 ((select id from t where slug='brooklyn'),2,7,'Canarsie',11000,17000,9,'complex',2),
 ((select id from t where slug='brooklyn'),3,8,'Bushwick',12000,18000,10,'complex',2),
 ((select id from t where slug='brooklyn'),4,9,'Flatbush',13000,19000,11,'complex',2),
 ((select id from t where slug='brooklyn'),5,10,'Red Hook',14000,20000,12,'complex',2),
 ((select id from t where slug='manhattan'),1,11,'Harlem',15000,21000,13,'complex',2),
 ((select id from t where slug='manhattan'),2,12,'Chelsea',16000,22000,14,'complex',2),
 ((select id from t where slug='manhattan'),3,13,'SoHo',16500,22000,15,'complex',2),
 ((select id from t where slug='manhattan'),4,14,'Washington Heights',17000,23000,16,'complex',2),
 ((select id from t where slug='manhattan'),5,15,'Tribeca',17000,23000,16,'complex',2)
on conflict (theme_id,index_in_theme) do nothing;
```

(Note: the original seed had `('beginner',6,6,...,8,'medium',1)` and `('beginner',7,7,...,9,'complex',2)` — i.e. display 6 = medium/8 gaps, display 7 = complex/9 gaps. The values above preserve that exactly; only the theme/index/name changed.)

- [ ] **Step 3: Re-seed and sanity-check**

Run (own commands):
- `npm run db:reset`
- `npm run db:test`

Expected: all suites `ok`, including `0004_read_rpcs` (5 assertions). If DB stack unavailable, skip + flag.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): seed three NY districts with named neighborhoods (fresh-DB parity)"
```

---

## Task 3: `Wordmark` UI primitive

**Files:**
- Create: `src/components/ui/Wordmark.tsx`
- Create: `tests/components/ui/Wordmark.test.tsx`
- Modify: `src/components/ui/index.ts`

Context: Direction F's "type" half — the `GAP CITY` lockup in the pixel font with a white letter core and cyan glow. Reused on the auth screen (`lg`) and the journey header (`sm`). Mirrors the existing `PixelHeading` primitive's shape and its test.

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/Wordmark.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wordmark } from '../../../src/components/ui/Wordmark'

describe('Wordmark', () => {
  it('renders GAP CITY as a heading with pixel + cyan-glow classes', () => {
    render(<Wordmark />)
    const h = screen.getByRole('heading', { name: /gap city/i })
    expect(h.className).toContain('font-pixel')
    expect(h.className).toContain('text-glow-cyan')
    expect(h.className).toContain('text-white')
  })

  it('applies the lg size class when size="lg"', () => {
    render(<Wordmark size="lg" />)
    expect(screen.getByRole('heading', { name: /gap city/i }).className).toContain('text-3xl')
  })

  it('applies the sm size class by default', () => {
    render(<Wordmark />)
    expect(screen.getByRole('heading', { name: /gap city/i }).className).toContain('text-lg')
  })

  it('merges a passed className', () => {
    render(<Wordmark className="mb-3" />)
    expect(screen.getByRole('heading', { name: /gap city/i }).className).toContain('mb-3')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- Wordmark`
Expected: FAIL — cannot resolve `../../../src/components/ui/Wordmark`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/Wordmark.tsx`:

```tsx
interface WordmarkProps {
  size?: 'sm' | 'lg'
  as?: 'h1' | 'h2'
  className?: string
}

const SIZE: Record<NonNullable<WordmarkProps['size']>, string> = {
  sm: 'text-lg',
  lg: 'text-3xl',
}

export function Wordmark({ size = 'sm', as: Tag = 'h1', className = '' }: WordmarkProps) {
  return (
    <Tag
      className={[
        'font-pixel uppercase tracking-[0.08em] leading-none text-white text-glow-cyan',
        SIZE[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      Gap City
    </Tag>
  )
}
```

- [ ] **Step 4: Export from the barrel**

Edit `src/components/ui/index.ts` — add the export line:

```ts
export { NeonButton } from './NeonButton'
export { ArcadePanel } from './ArcadePanel'
export { PixelHeading } from './PixelHeading'
export { ScanlineOverlay } from './ScanlineOverlay'
export { Wordmark } from './Wordmark'
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- Wordmark`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Wordmark.tsx tests/components/ui/Wordmark.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): add Gap City wordmark primitive"
```

---

## Task 4: Rename strings — Mind The Gap → Gap City

**Files:**
- Modify: `index.html`
- Modify: `package.json`
- Modify: `src/components/AuthScreen.tsx`
- Modify: `CLAUDE.md`

Context: Mechanical rename of the four non-Journey string sites (JourneyScreen header is handled in Task 6). `AuthScreen` swaps its `PixelHeading` text for the new `Wordmark`. No test asserts the literal "Mind The Gap" except `PixelHeading.test.tsx`, which uses it only as sample text — leave that test alone (the primitive is unchanged).

- [ ] **Step 1: Update the document title**

Edit `index.html` line 10: `<title>Mind The Gap</title>` → `<title>Gap City</title>`.

- [ ] **Step 2: Update the package name**

Edit `package.json` line 2: `"name": "mind-the-gap",` → `"name": "gap-city",`.

- [ ] **Step 3: Swap AuthScreen heading for the Wordmark**

Edit `src/components/AuthScreen.tsx`:

Change the import (line 7) — remove `PixelHeading`, add `Wordmark`:

```tsx
import { Wordmark } from './ui/Wordmark'
```

(Delete the line `import { PixelHeading } from './ui/PixelHeading'`.)

Replace line 42:

```tsx
        <Wordmark size="lg" className="mb-3" />
```

(was `<PixelHeading className="mb-3 text-2xl">Mind The Gap</PixelHeading>`)

- [ ] **Step 4: Update CLAUDE.md title/intro**

Edit `CLAUDE.md`. Change the top heading and first line:

```markdown
# Gap City — Project Context

A memory-and-speed puzzle game (a Tetris × Streets of Rage mashup). The web POC is
complete and playable. The eventual goal is a React Native mobile app published to
the Apple App Store.
```

(was `# Mind The Gap — Project Context` and the original first paragraph; keep the rest of that paragraph's run/test/typecheck lines unchanged.) Then add one line under the **The Game** intro noting Journey mode is themed as a tour of New York districts (The Bronx, Brooklyn, Manhattan), each a group of neighborhood levels.

- [ ] **Step 5: Verify build + full test suite**

Run (own commands):
- `npm run build`
- `npm run test`

Expected: build succeeds (no unused `PixelHeading` import lint error in AuthScreen), all tests pass.

- [ ] **Step 6: Commit**

```bash
git add index.html package.json src/components/AuthScreen.tsx CLAUDE.md
git commit -m "feat: rename Mind The Gap to Gap City (title, package, auth, docs)"
```

---

## Task 5: Store — thread `levelName` through the journey session

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.journey.test.ts`

Context: The in-game header (Task 7) needs the neighborhood name. Add a `levelName: string | null` field alongside `levelDisplayNumber`, and extend `startJourneySession` to accept and store it. Follow the existing pattern: `levelDisplayNumber` is declared in the `GameStore` interface (not `INITIAL_STATE`/`GameState`), initialized in the store object, and reset in `resetGame`.

- [ ] **Step 1: Update the journey-session test**

Edit `tests/store/gameStore.journey.test.ts`. Change the first `startJourneySession` call (line ~36) to pass a name, and assert it lands in state. Replace lines 36 and add an assertion after line 46:

```ts
      await useGameStore.getState().startJourneySession('lvl-1', 1200, 5, 'Castle Hill')
```

and, right after `expect(s.levelDisplayNumber).toBe(5)`:

```ts
    expect(s.levelName).toBe('Castle Hill')
```

(Leave the other `startJourneySession('lvl-1', 0, 1)` calls as-is — the new 4th param is optional.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- gameStore.journey`
Expected: FAIL — `s.levelName` is `undefined` (and TS may flag the 4th arg).

- [ ] **Step 3: Add `levelName` to the interface**

Edit `src/store/gameStore.ts`. After the `levelDisplayNumber: number | null` line in the `GameStore` interface (line ~70), add:

```ts
  levelName: string | null
```

And change the `startJourneySession` signature (line ~73) to:

```ts
  startJourneySession: (levelId: string, priorPr: number, displayNumber: number, levelName?: string | null) => Promise<void>
```

- [ ] **Step 4: Initialize and reset `levelName`**

In the store object initializer, after `levelDisplayNumber: null,` (line ~107) add:

```ts
  levelName: null,
```

In `resetGame` (line ~110), add `levelName: null,` to the `set({ ... })` payload (next to `levelDisplayNumber: null`):

```ts
  resetGame: () => set({ ...INITIAL_STATE, _resolution: null, journeyResult: null, journeyError: null, priorPr: 0, levelDisplayNumber: null, levelName: null, submitting: false }),
```

- [ ] **Step 5: Set `levelName` in `startJourneySession`**

In `startJourneySession` (the `async (levelId, priorPr, displayNumber) => {` arrow, line ~326), add the new param and set it. Change the signature line to:

```ts
  startJourneySession: async (levelId, priorPr, displayNumber, levelName = null) => {
```

and in the `set({ ... })` block, after `levelDisplayNumber: displayNumber,` (line ~341) add:

```ts
      levelName,
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- gameStore.journey`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.journey.test.ts
git commit -m "feat(store): thread neighborhood name through startJourneySession"
```

---

## Task 6: JourneyScreen — Gap City header + neighborhood cards

**Files:**
- Modify: `src/components/JourneyScreen.tsx`
- Test: `tests/components/JourneyScreen.test.tsx`

Context: Minimal IA change to the (otherwise deferred) Map screen: header becomes the `Gap City` wordmark, the section header stays the district name (`theme.name`, now "The Bronx" etc.), and each level card's headline becomes the **neighborhood name** (`lvl.name`) instead of `Level {display_number}`. The accessible button name therefore becomes the neighborhood — update the test's `getByRole` queries to match.

- [ ] **Step 1: Update the test fixtures + assertions**

Edit `tests/components/JourneyScreen.test.tsx`. Replace the `JOURNEY` fixture (lines 10–20) with district/neighborhood data including `name` on each level:

```tsx
const JOURNEY = [
  { theme_id: 't1', slug: 'the_bronx', name: 'The Bronx', mechanic: 'standard', sort_order: 1, locked: false,
    levels: [
      { level_id: 'l1', display_number: 1, name: 'Castle Hill', my_pr: 1820, my_stars: 3, cleared: true, last_played: null, global_best: 1900 },
      { level_id: 'l2', display_number: 2, name: 'East Tremont', my_pr: null, my_stars: 0, cleared: false, last_played: null, global_best: null },
    ] },
  { theme_id: 't3', slug: 'manhattan', name: 'Manhattan', mechanic: 'standard', sort_order: 2, locked: true,
    levels: [
      { level_id: 'l11', display_number: 11, name: 'Harlem', my_pr: null, my_stars: 0, cleared: false, last_played: null, global_best: null },
    ] },
]
```

Update the assertions: the `findByText('Beginner')`/`getByText('Advanced')` (lines 31–32) → `findByText('The Bronx')` / `getByText('Manhattan')`; the unlocked-card click (line 41) → `getByRole('button', { name: /Castle Hill/i })`; the locked-card query (line 51) → `getByRole('button', { name: /Harlem/i })`. The `selectedLevelId` expectation stays `'l1'`. Full updated assertions:

```tsx
  it('renders unlocked theme sections with level cards and PR badges', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    expect(await screen.findByText('The Bronx')).toBeInTheDocument()
    expect(screen.getByText('Manhattan')).toBeInTheDocument()
    expect(screen.getByText(/1820/)).toBeInTheDocument()
  })

  it('opens the level detail when an unlocked card is tapped', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    const user = userEvent.setup()
    render(<JourneyScreen />)
    await screen.findByText('The Bronx')
    await user.click(screen.getByRole('button', { name: /Castle Hill/i }))
    const s = useNavStore.getState()
    expect(s.appView).toBe('levelDetail')
    expect(s.selectedLevelId).toBe('l1')
  })

  it('does not open locked-theme levels', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    await screen.findByText('Manhattan')
    const locked = screen.getByRole('button', { name: /Harlem/i })
    expect(locked).toBeDisabled()
  })
```

(Leave the fourth test — the fetch-failure retry — unchanged.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- JourneyScreen`
Expected: FAIL — cards still render `Level 1`, and `JourneyLevel` has no `name` (TS error).

- [ ] **Step 3: Add `name` to the level interface**

Edit `src/components/JourneyScreen.tsx`. In the `JourneyLevel` interface (lines 6–10), add `name`:

```tsx
interface JourneyLevel {
  level_id: string; display_number: number; name: string
  my_pr: number | null; my_stars: number; cleared: boolean
  last_played: string | null; global_best: number | null
}
```

- [ ] **Step 4: Swap the header for the Wordmark**

Add the import near the top (after line 4):

```tsx
import { Wordmark } from './ui/Wordmark'
```

Replace the header `<h1>` (line 60) inside the header row:

```tsx
        <Wordmark size="sm" />
```

(was `<h1 className="text-xl font-bold">Mind The Gap</h1>`)

- [ ] **Step 5: Render the neighborhood name on cards**

Replace the card title line (line 79):

```tsx
                  <div className="font-bold text-sm">{lvl.name}</div>
```

(was `<div className="font-bold text-sm">Level {lvl.display_number}</div>`)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- JourneyScreen`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/JourneyScreen.tsx tests/components/JourneyScreen.test.tsx
git commit -m "feat(journey): Gap City header + neighborhood-named level cards"
```

---

## Task 7: LevelDetailScreen — neighborhood heading + pass name to play()

**Files:**
- Modify: `src/components/LevelDetailScreen.tsx`
- Test: `tests/components/LevelDetailScreen.test.tsx`

Context: The modal currently shows `theme_name` (district, magenta) then `Level {display_number}` (cyan). Change the cyan heading to the **neighborhood name**, demote the absolute level number to a small meta row, and pass `level.name` into `startJourneySession` so the in-game header (Task 8) can show it.

- [ ] **Step 1: Update the test fixture + assertions**

Edit `tests/components/LevelDetailScreen.test.tsx`. Add `name` to the `LEVEL` fixture (line 15) and set `theme_name` to a district:

```tsx
const LEVEL = {
  level_id: 'l1', display_number: 1, name: 'Castle Hill', theme_name: 'The Bronx',
  view_duration_ms: 7000, select_duration_ms: 9000,
  gap_count: 4, shape_complexity: 'simple', adjacency: 'low',
  my_pr: 1820, my_stars: 3, global_high: 1950, last_played: null,
}
```

Update the metadata test (lines 28–34) to also assert the neighborhood heading, and the PLAY test (line 42) to expect the 4-arg call:

```tsx
  it('shows the level metadata once loaded', async () => {
    ;(api.getLevel as any).mockResolvedValue(LEVEL)
    render(<LevelDetailScreen />)
    expect(await screen.findByText(/Castle Hill/)).toBeInTheDocument()
    expect(screen.getByText(/The Bronx/)).toBeInTheDocument()
    expect(screen.getByText(/1820/)).toBeInTheDocument()
    expect(screen.getByText(/1950/)).toBeInTheDocument()
  })

  it('PLAY starts a journey session and enters playing', async () => {
    ;(api.getLevel as any).mockResolvedValue(LEVEL)
    const user = userEvent.setup()
    render(<LevelDetailScreen />)
    await screen.findByText(/Castle Hill/)
    await user.click(screen.getByRole('button', { name: /PLAY/i }))
    expect(startJourneySession).toHaveBeenCalledWith('l1', 1820, 1, 'Castle Hill')
    expect(useNavStore.getState().appView).toBe('playing')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- LevelDetailScreen`
Expected: FAIL — heading still renders `Level 1`; `startJourneySession` called with 3 args; `LevelDetail` lacks `name` (TS).

- [ ] **Step 3: Add `name` to the interface**

Edit `src/components/LevelDetailScreen.tsx`. In the `LevelDetail` interface (line 10), add `name`:

```tsx
interface LevelDetail {
  level_id: string; display_number: number; name: string; theme_name: string
  view_duration_ms: number; select_duration_ms: number
  gap_count: number; shape_complexity: string; adjacency: string
  my_pr: number | null; my_stars: number; global_high: number | null; last_played: string | null
}
```

- [ ] **Step 4: Pass the name into play()**

In `play()` (line 41), add the 4th arg:

```tsx
      await track(startJourneySession(level.level_id, level.my_pr ?? 0, level.display_number, level.name))
```

- [ ] **Step 5: Show neighborhood heading + level-number meta**

Replace the cyan heading (line 76) with the neighborhood name:

```tsx
            <h2 className="font-pixel text-lg uppercase tracking-[0.08em] text-neon-cyan text-glow-cyan mb-4 pr-8">{level.name}</h2>
```

Then add a "Level N" row to the `<dl>` meta block. Insert as the first `<div>` inside the `<dl>` (before the "Your Best" row at line 78):

```tsx
              <div className="flex justify-between"><dt className="text-gray-500">Level</dt><dd>{level.display_number}</dd></div>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- LevelDetailScreen`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/LevelDetailScreen.tsx tests/components/LevelDetailScreen.test.tsx
git commit -m "feat(level-detail): neighborhood heading, Level N meta, pass name to session"
```

---

## Task 8: GameShell — neighborhood name in the in-game header

**Files:**
- Modify: `src/components/GameShell.tsx`

Context: In journey mode the sticky header currently shows `LEVEL {levelDisplayNumber}`. Show the neighborhood name instead, falling back to `LEVEL N` if `levelName` is null so the header never renders empty. Pull `levelName` from the store via the existing `useShallow` selector. Practice mode (`ROUND {round}`) is unchanged. There is no dedicated GameShell test; verify via build + the running app.

- [ ] **Step 1: Select `levelName` from the store**

Edit `src/components/GameShell.tsx`. In the destructured selector (lines 25–38), add `levelName`:

In the destructuring assignment (line 25), add `levelName`:

```tsx
  const { phase, paused, round, score, triesUsed, maxTries, phaseStartTime, phaseDuration, mode, levelDisplayNumber, levelName, submitting } =
```

In the selector object (after `levelDisplayNumber: s.levelDisplayNumber,`, line 36), add:

```tsx
      levelName: s.levelName,
```

- [ ] **Step 2: Render the neighborhood name**

Replace the journey branch of the header label (lines 51–53):

```tsx
          {mode === 'journey'
            ? <strong className="text-white">{levelName ?? `LEVEL ${levelDisplayNumber}`}</strong>
            : <>ROUND <strong className="text-white">{round}</strong></>}
```

- [ ] **Step 3: Verify build + full suite**

Run (own commands):
- `npm run build`
- `npm run test`

Expected: build clean (no unused-var error for `levelDisplayNumber`, still used in the fallback), all tests pass.

- [ ] **Step 4: Visual check in the running app**

Start the dev server and confirm the journey header shows a neighborhood name. Since journey mode requires a Supabase session and a level launch, if the local stack isn't running, at minimum confirm the practice-mode header still reads `ROUND N` and the app builds/loads without console errors. Note in your report whether the journey path was exercised live.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameShell.tsx
git commit -m "feat(shell): show neighborhood name in journey header"
```

---

## Task 9: Sync `levelConfig.ts` to the district split

**Files:**
- Modify: `supabase/functions/_shared/core/levelConfig.ts`
- Test: `tests/core/levelConfig.test.ts`

Context: `levelConfig.ts` holds a reference `LEVEL_CONFIGS` table with a `theme` field and a `themeForLevel(n)` helper that still splits 1–7/8–15 into `beginner`/`intermediate`. It is not consumed by runtime code (only its own test), but the CLAUDE.md "keep in sync" rule covers it. Move it to the district slugs with the 5/5/5 split. Durations in `RAW` are untouched.

- [ ] **Step 1: Update the test**

Edit `tests/core/levelConfig.test.ts`. Replace the grouping test (the `it('groups levels 1-7 …')` block):

```ts
  it('groups levels into the three NY districts (5/5/5)', () => {
    expect(themeForLevel(1)).toBe('the_bronx')
    expect(themeForLevel(5)).toBe('the_bronx')
    expect(themeForLevel(6)).toBe('brooklyn')
    expect(themeForLevel(10)).toBe('brooklyn')
    expect(themeForLevel(11)).toBe('manhattan')
    expect(themeForLevel(15)).toBe('manhattan')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- levelConfig`
Expected: FAIL — `themeForLevel(1)` returns `'beginner'`.

- [ ] **Step 3: Update the type + helper**

Edit `supabase/functions/_shared/core/levelConfig.ts`. Change the `theme` field type in the `LevelConfig` interface (line 5):

```ts
  theme: 'the_bronx' | 'brooklyn' | 'manhattan'
```

Replace `themeForLevel` (lines 39–41):

```ts
export function themeForLevel(n: number): 'the_bronx' | 'brooklyn' | 'manhattan' {
  if (n <= 5) return 'the_bronx'
  if (n <= 10) return 'brooklyn'
  return 'manhattan'
}
```

(The `LEVEL_CONFIGS` map at line 43 already calls `themeForLevel(r.displayNumber)`, so it picks up the new mapping automatically.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- levelConfig`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/core/levelConfig.ts tests/core/levelConfig.test.ts
git commit -m "chore(config): move levelConfig theme grouping to NY districts (5/5/5)"
```

---

## Task 10: Full verification sweep

**Files:** none (verification only)

Context: Final green-light across the whole suite, types, and lint before finishing the branch.

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all tests pass (the suite was 220 before this work; the net count is unchanged or +4 from the Wordmark test — confirm zero failures).

- [ ] **Step 2: Type-check + build**

Run (own commands):
- `npx tsc --noEmit`
- `npm run build`

Expected: no type errors, no `noUnusedLocals`/`noUnusedParameters` failures, build succeeds.

- [ ] **Step 3: Grep for stragglers**

Run: `grep -rn "Mind The Gap\|mind-the-gap" src/ index.html package.json`
Expected: no matches (the only remaining "Mind The Gap" is sample text inside `tests/components/ui/PixelHeading.test.tsx`, which is fine — the primitive is generic).

Run: `grep -rn "beginner\|intermediate" supabase/seed.sql supabase/functions/_shared/core/levelConfig.ts`
Expected: no matches (all moved to district slugs).

- [ ] **Step 4: DB suite (if stack available)**

Run (own commands):
- `npm run db:reset`
- `npm run db:test`

Expected: all pgTAP suites `ok`. If the stack is unavailable, explicitly flag in the final report that migration `0008` + seed changes were not exercised against a live DB and must be run by a human before merge.

- [ ] **Step 5: Finish the branch**

Invoke the **superpowers:finishing-a-development-branch** skill to present merge/PR options to the user.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Rename (§5.1) → Task 4 (+ JourneyScreen header in Task 6). ✓
- Wordmark / direction F type half (§5.2) → Task 3, applied in Tasks 4 & 6. ✓
- `levels.name` + 3 districts + re-point preserving 0007 (§4.1) → Task 1. ✓
- Remove all five legacy themes (§4.1 step 4) → Task 1 step 1 (delete). ✓
- Seed parity (§4.2) → Task 2. ✓
- `name` in get_journey + get_level (§4.3) → Task 1. ✓
- `levelConfig.ts` sync (§4.2 note) → Task 9. ✓
- Journey cards show neighborhood (§5.3) → Task 6. ✓
- LevelDetail district + neighborhood heading + Level N meta (§5.3) → Task 7. ✓
- Store `levelName` + extended `startJourneySession` (§5.4) → Task 5. ✓
- GameShell neighborhood header w/ fallback (§5.4) → Task 8. ✓
- Tests stay green; fixtures updated (§6) → Tasks 5–9 each update their test; Task 10 sweeps. ✓
- pgTAP `name` assertions (§6) → Task 1 step 2. ✓

**Placeholder scan:** No TBD/TODO/"add error handling"/"similar to Task N"; every code step shows concrete code. ✓

**Type consistency:** `levelName: string \| null` and the optional 4th param `levelName?: string \| null` are used identically in store (Task 5), LevelDetail `play()` call (Task 7), and GameShell selector (Task 8). `JourneyLevel.name` (Task 6) and `LevelDetail.name` (Task 7) are both `string`. RPC `name` key matches the frontend `name` fields. `themeForLevel` return union matches the `theme` field union (Task 9). District slugs (`the_bronx`/`brooklyn`/`manhattan`) are identical across migration (Task 1), seed (Task 2), and levelConfig (Task 9). ✓
