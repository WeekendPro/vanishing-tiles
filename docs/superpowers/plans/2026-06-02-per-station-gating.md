# Per-Station Sequential Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Gap City's 70% district-unlock rule with per-station sequential gating, where the single playable frontier is the first uncleared level by `display_number`, everything before it is revisitable, and everything after is locked.

**Architecture:** The backend `get_journey` RPC becomes the single source of truth — it computes a per-level `current` and `locked` boolean from `display_number` + the player's cleared set, and the theme object no longer carries a `locked` flag. The frontend transit map just renders those flags (locked stations disabled, the `current` station is the "next stop", cleared stations stay tappable). The `themes.unlock_threshold` column is dropped. Gating is display-only, matching today's architecture (`start_session` never enforced the lock).

**Tech Stack:** Supabase Postgres (SQL migrations + pgTAP), React + TypeScript, Vitest + Testing Library, Zustand 5.

---

## Background the implementer needs

- **nvm quirk (from CLAUDE.md):** chained Bash commands like `a && b` error with `__init_nvm`. Run **each** `npm`/`npx` invocation as its **own** Bash call. Never chain them with `&&`.
- **Verification:** run `npm run build` (catches `noUnusedLocals`, which `tsc --noEmit` misses) **and** `npm run test`. pgTAP needs Docker + local Supabase: `npm run db:reset` then `npm run db:test`.
- **Zustand 5:** object selectors must use `useShallow`. (Not needed in this plan — no new store selectors — but don't regress it.)
- **Branch:** work is on `feat/per-station-gating` (already created off `main`, spec already committed there). Do NOT commit to `main`. Confirm with the user before any merge/push.
- **Baseline currently green:** 237 frontend tests + 39 pgTAP. Keep them green.

### Current data contract (before this change)

`get_journey()` returns a JSON array of themes. Today each **theme** has a `locked` boolean (derived from the previous theme clearing ≥ `unlock_threshold`), and each **level** has: `level_id`, `display_number`, `name`, `my_pr`, `my_stars`, `cleared`, `last_played`, `global_best`.

The live RPC definition is in migration `0008_gap_city_districts.sql` (lines 69–103); migration `0006` defines an earlier version. The frontend types live in `src/components/JourneyMap/index.tsx` (`JourneyLevel`, `JourneyTheme`).

### Target data contract (after this change)

- **Theme object:** loses `locked`. Keeps `theme_id`, `slug`, `name`, `mechanic`, `sort_order`, `levels`.
- **Level object:** gains `current: boolean` and `locked: boolean`. Keeps all existing keys.
- `frontier` = lowest `display_number` with `cleared = false`. `current` ⟺ `display_number = frontier`; `locked` ⟺ `display_number > frontier`. If all cleared, `frontier` is null → no level is `current` or `locked`.

---

## Task 1: Backend — rewrite `get_journey` for per-station gating + drop `unlock_threshold`

**Files:**
- Create: `supabase/migrations/0010_per_station_gating.sql`
- Create: `supabase/tests/0006_station_gating.test.sql`
- Modify: `supabase/seed.sql:4-8` (themes insert — drop the `unlock_threshold` column/value)

> **Note on migration ordering:** Leave migrations `0001`, `0006`, and `0008` untouched. Their `unlock_threshold` references all run *before* `0010` drops the column, so the historical chain stays valid. Only `seed.sql` must change, because it runs *after* all migrations on `db:reset`. A grep confirmed these are the only readers: `seed.sql:4`, `0001:19`, `0008` (insert + RPC), `0006` (RPC). No RLS policy or schema test references it.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0006_station_gating.test.sql`:

```sql
-- supabase/tests/0006_station_gating.test.sql
-- Per-station sequential gating: get_journey emits per-level current/locked from
-- display_number + the player's cleared set (replaces the old 70% theme rule).
-- `supabase test db` loads seed.sql during reset, so the 15 seeded levels exist.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'gate@test.dev');

-- Read a single level's flag (current/locked) by display_number from get_journey.
create or replace function pg_temp.flag(p_dn int, p_flag text)
returns boolean language sql as $$
  select (lv->>p_flag)::boolean
  from jsonb_array_elements(public.get_journey()) th,
       jsonb_array_elements(th->'levels') lv
  where (lv->>'display_number')::int = p_dn
$$;

-- Count levels where a boolean flag is true.
create or replace function pg_temp.flag_count(p_flag text)
returns bigint language sql as $$
  select count(*)
  from jsonb_array_elements(public.get_journey()) th,
       jsonb_array_elements(th->'levels') lv
  where (lv->>p_flag)::boolean
$$;

-- (A) No progress: level 1 is the frontier.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(pg_temp.flag(1,'current'), true,  'dn1 is current with no progress');
select is(pg_temp.flag(1,'locked'),  false, 'dn1 is not locked');
select is(pg_temp.flag(2,'current'), false, 'dn2 is not current');
select is(pg_temp.flag(2,'locked'),  true,  'dn2 is locked behind dn1');
reset role;

-- (B) Clear levels 1-3 → frontier advances to 4.
insert into public.level_progress (user_id, level_id, cleared)
select '00000000-0000-0000-0000-0000000000b1', id, true
from public.levels where display_number in (1,2,3);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(pg_temp.flag(4,'current'), true,  'dn4 is current after clearing 1-3');
select is(pg_temp.flag(4,'locked'),  false, 'the current station is never locked');
select is(pg_temp.flag(5,'locked'),  true,  'dn5 is locked beyond the frontier');
select is(pg_temp.flag(1,'current'), false, 'cleared dn1 is not current');
select is(pg_temp.flag(1,'locked'),  false, 'cleared dn1 stays revisitable (not locked)');
reset role;

-- (C) Clear everything → no frontier.
insert into public.level_progress (user_id, level_id, cleared)
select '00000000-0000-0000-0000-0000000000b1', id, true
from public.levels
on conflict (user_id, level_id) do update set cleared = true;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(pg_temp.flag_count('current'), 0::bigint, 'no current station when all cleared');
select is(pg_temp.flag_count('locked'),  0::bigint, 'nothing locked when all cleared');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run (own Bash call): `npm run db:reset`
Then (own Bash call): `npm run db:test`
Expected: FAIL — the seeded `get_journey` (from `0008`) emits no `current`/`locked` per level, so `pg_temp.flag(1,'current')` returns NULL → assertions fail. (`0006_station_gating` should appear in the failing output.)

- [ ] **Step 3: Write the migration that redefines the RPC and drops the column**

Create `supabase/migrations/0010_per_station_gating.sql`:

```sql
-- supabase/migrations/0010_per_station_gating.sql
-- Per-station sequential gating. Replaces the 70% theme-unlock rule with a single
-- linear frontier across all levels (ordered by display_number). get_journey now
-- emits per-level `current`/`locked`; the theme object no longer carries `locked`.
-- The unlock_threshold column is removed (no longer read by any RPC).
begin;

create or replace function public.get_journey()
returns jsonb language sql security definer set search_path = public stable as $$
  with prog as (
    select l.id, l.theme_id, l.display_number, l.index_in_theme, l.name,
           coalesce(lp.cleared, false) as cleared,
           coalesce(lp.best_total, 0)  as my_pr,
           coalesce(lp.best_stars, 0)  as my_stars,
           lp.last_played_at,
           gb.best_total as global_best
    from public.levels l
    left join public.level_progress lp
      on lp.level_id = l.id and lp.user_id = auth.uid()
    left join public.level_global_best gb on gb.level_id = l.id
  ),
  frontier as (
    select min(display_number) as dn from prog where not cleared
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'theme_id', t.id, 'slug', t.slug, 'name', t.name, 'mechanic', t.mechanic,
    'sort_order', t.sort_order,
    'levels', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'level_id', p.id, 'display_number', p.display_number, 'name', p.name,
        'my_pr', p.my_pr, 'my_stars', p.my_stars,
        'cleared', p.cleared, 'last_played', p.last_played_at,
        'global_best', p.global_best,
        'current', (f.dn is not null and p.display_number = f.dn),
        'locked',  (f.dn is not null and p.display_number > f.dn)
      ) order by p.index_in_theme), '[]'::jsonb)
      from prog p, frontier f
      where p.theme_id = t.id)
  ) order by t.sort_order), '[]'::jsonb)
  from public.themes t;
$$;

alter table public.themes drop column unlock_threshold;

commit;
```

- [ ] **Step 4: Stop seeding the dropped column**

In `supabase/seed.sql`, replace the themes insert (lines 4–8) so it no longer references `unlock_threshold`:

```sql
insert into public.themes (slug,name,description,sort_order,piece_set,mechanic) values
 ('the_hollows','The Hollows','Sleepy outskirts — all gaps.',1,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
 ('the_stacks','The Stacks','Blocks piling up.',2,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
 ('the_grid','The Grid','Dense downtown — locked in.',3,'{I,O,T,S,Z,J,L,SINGLE}','standard')
on conflict (slug) do nothing;
```

- [ ] **Step 5: Run the test to verify it passes**

Run (own Bash call): `npm run db:reset`
Then (own Bash call): `npm run db:test`
Expected: PASS — `0006_station_gating` all green, and the existing `0004_read_rpcs` / other pgTAP suites still pass (39 + 11 new assertions).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0010_per_station_gating.sql supabase/tests/0006_station_gating.test.sql supabase/seed.sql
git commit -m "feat(gating): per-station current/locked in get_journey; drop unlock_threshold"
```

---

## Task 2: Frontend — transit map renders per-level flags

**Files:**
- Modify: `src/components/JourneyMap/index.tsx`
- Test: `tests/components/JourneyMap.test.tsx`

The component currently derives lock state from `theme.locked` and computes "next" as the lowest uncleared station on an unlocked line, with a four-value state machine (`'locked' | 'cleared' | 'next' | 'ahead'`). After this task it trusts the RPC's per-level flags and collapses to three states — the old `'ahead'` look becomes the real locked look.

- [ ] **Step 1: Rewrite the test to assert per-level gating**

Replace the entire contents of `tests/components/JourneyMap.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransitMap, type JourneyTheme } from '../../src/components/JourneyMap'

function lvl(
  n: number,
  name: string,
  opts: { cleared?: boolean; current?: boolean; locked?: boolean } = {},
) {
  return {
    level_id: `l${n}`, display_number: n, name,
    my_pr: opts.cleared ? 900 : null, my_stars: opts.cleared ? 2 : 0,
    cleared: !!opts.cleared, current: !!opts.current, locked: !!opts.locked,
    last_played: null, global_best: null,
  }
}

// Frontier at dn2: dn1 cleared, dn2 current, dn3-5 + the whole next district locked.
const themes: JourneyTheme[] = [
  {
    theme_id: 't1', slug: 'the_hollows', name: 'The Hollows', mechanic: '', sort_order: 1,
    levels: [
      lvl(1, 'Vacant Heights', { cleared: true }),
      lvl(2, 'Open Lots', { current: true }),
      lvl(3, 'Holloway', { locked: true }),
      lvl(4, 'Gapstead', { locked: true }),
      lvl(5, 'Nilsen Park', { locked: true }),
    ],
  },
  {
    theme_id: 't2', slug: 'the_stacks', name: 'The Stacks', mechanic: '', sort_order: 2,
    levels: [
      lvl(6, 'Brickfall', { locked: true }),
      lvl(7, 'Tetra Heights', { locked: true }),
      lvl(8, 'Four Corners', { locked: true }),
      lvl(9, 'Jaywick', { locked: true }),
      lvl(10, 'Snug Harbor', { locked: true }),
    ],
  },
]

describe('TransitMap', () => {
  it('renders a button for every station', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Snug Harbor/i })).toBeInTheDocument()
  })

  it('disables every locked station (after the current frontier)', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Holloway/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Brickfall/i })).toBeDisabled()
  })

  it('marks the current station with aria-current=step', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Open Lots/i })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).not.toHaveAttribute('aria-current')
  })

  it('calls onSelect when the current station is clicked', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    screen.getByRole('button', { name: /Open Lots/i }).click()
    expect(onSelect).toHaveBeenCalledWith('l2')
  })

  it('keeps cleared stations tappable (revisitable)', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeEnabled()
    screen.getByRole('button', { name: /Vacant Heights/i }).click()
    expect(onSelect).toHaveBeenCalledWith('l1')
  })

  it('does not fire onSelect for a locked station', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    screen.getByRole('button', { name: /Brickfall/i }).click()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/components/JourneyMap.test.tsx`
Expected: FAIL — `JourneyTheme` still requires `locked` (type error / fixtures omit it) and the component reads `theme.locked`, so locked-station and current-station assertions don't hold.

- [ ] **Step 3: Update the types**

In `src/components/JourneyMap/index.tsx`, change the `JourneyLevel` interface to add the two flags and `JourneyTheme` to drop `locked`:

```tsx
export interface JourneyLevel {
  level_id: string
  display_number: number
  name: string
  my_pr: number | null
  my_stars: number
  cleared: boolean
  current: boolean
  locked: boolean
  last_played: string | null
  global_best: number | null
}

export interface JourneyTheme {
  theme_id: string
  slug: string
  name: string
  mechanic: string
  sort_order: number
  levels: JourneyLevel[]
}
```

- [ ] **Step 4: Source `locked` from the level and pick `next` from `current`**

In the same file, change the `stations` mapping so `locked` comes from the level (not the theme), and replace the `next` derivation. Replace this block:

```tsx
  const stations: FlatStation[] = themes.flatMap(theme =>
    theme.levels.map(lvl => {
      const coord = STATIONS[lvl.display_number]
      return {
        ...lvl,
        slug: theme.slug as DistrictSlug,
        locked: theme.locked,
        x: coord.x,
        y: coord.y,
        interchange: coord.interchange ?? false,
      }
    }),
  )

  // Next stop = lowest display_number uncleared station on an unlocked line.
  const next = stations
    .filter(s => !s.locked && !s.cleared)
    .sort((a, b) => a.display_number - b.display_number)[0]
```

with:

```tsx
  const stations: FlatStation[] = themes.flatMap(theme =>
    theme.levels.map(lvl => {
      const coord = STATIONS[lvl.display_number]
      return {
        ...lvl,
        slug: theme.slug as DistrictSlug,
        x: coord.x,
        y: coord.y,
        interchange: coord.interchange ?? false,
      }
    }),
  )

  // Next stop = the single current station (the frontier), straight from the RPC.
  const next = stations.find(s => s.current)
```

> Note: `FlatStation extends JourneyLevel` already has `locked`, so spreading `...lvl` now supplies it. Remove the now-redundant `locked: boolean` re-declaration from the `FlatStation` interface if (and only if) it shadows nothing else — leaving `extends JourneyLevel` to provide it. Concretely, change the interface to:

```tsx
interface FlatStation extends JourneyLevel {
  slug: DistrictSlug
  x: number
  y: number
  interchange: boolean
}
```

- [ ] **Step 5: Collapse the state machine to three states**

In the same file, replace the per-station `state` computation:

```tsx
        const isNext = next?.level_id === s.level_id
        const state: 'locked' | 'cleared' | 'next' | 'ahead' = s.locked
          ? 'locked'
          : s.cleared
          ? 'cleared'
          : isNext
          ? 'next'
          : 'ahead'
```

with:

```tsx
        const isNext = next?.level_id === s.level_id
        const state: 'locked' | 'cleared' | 'next' = s.cleared
          ? 'cleared'
          : isNext
          ? 'next'
          : 'locked'
```

Then update the two conditionals that referenced `'ahead'` so the locked styling applies to plain `'locked'`:

- The dot `style.opacity`: change `state === 'locked' || state === 'ahead' ? 0.5 : 1` to `state === 'locked' ? 0.5 : 1`.
- The label `className`: change `state === 'locked' || state === 'ahead'` to `state === 'locked'`.

(The `disabled={s.locked}` on the button already does the right thing — locked stations are non-interactive; cleared and current stay tappable.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- tests/components/JourneyMap.test.tsx`
Expected: PASS (all 6 cases).

- [ ] **Step 7: Type-check the whole frontend**

Run: `npm run build`
Expected: PASS — no `noUnusedLocals` error (the `'ahead'` branch and `theme.locked` reads are gone).

- [ ] **Step 8: Commit**

```bash
git add src/components/JourneyMap/index.tsx tests/components/JourneyMap.test.tsx
git commit -m "feat(map): render per-level locked/current; drop the ahead state"
```

---

## Task 3: Frontend — JourneyScreen all-clear badge + updated fixtures

**Files:**
- Modify: `src/components/JourneyScreen.tsx`
- Test: `tests/components/JourneyScreen.test.tsx`

- [ ] **Step 1: Update the test fixtures and assertions**

Replace the entire contents of `tests/components/JourneyScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({ getJourney: vi.fn() }))
import * as api from '../../src/lib/api'
import { JourneyScreen } from '../../src/components/JourneyScreen'
import { useNavStore } from '../../src/store/navStore'

const JOURNEY = [
  { theme_id: 't1', slug: 'the_hollows', name: 'The Hollows', mechanic: 'standard', sort_order: 1,
    levels: [
      { level_id: 'l1', display_number: 1, name: 'Vacant Heights', my_pr: 1820, my_stars: 3, cleared: true, current: false, locked: false, last_played: null, global_best: 1900 },
      { level_id: 'l2', display_number: 2, name: 'Open Lots', my_pr: null, my_stars: 0, cleared: false, current: true, locked: false, last_played: null, global_best: null },
    ] },
  { theme_id: 't3', slug: 'the_grid', name: 'The Grid', mechanic: 'standard', sort_order: 2,
    levels: [
      { level_id: 'l11', display_number: 11, name: 'Highrise Row', my_pr: null, my_stars: 0, cleared: false, current: false, locked: true, last_played: null, global_best: null },
    ] },
]

// Every level cleared → all-clear end state.
const ALL_CLEAR = JOURNEY.map(t => ({
  ...t,
  levels: t.levels.map(l => ({ ...l, cleared: true, current: false, locked: false })),
}))

beforeEach(() => {
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('JourneyScreen', () => {
  it('renders the transit map with district labels and station buttons', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    expect(await screen.findByText('The Hollows')).toBeInTheDocument()
    expect(screen.getByText('The Grid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeInTheDocument()
  })

  it('opens the level detail when a tappable station is clicked', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    const user = userEvent.setup()
    render(<JourneyScreen />)
    await screen.findByText('The Hollows')
    await user.click(screen.getByRole('button', { name: /Vacant Heights/i }))
    const s = useNavStore.getState()
    expect(s.appView).toBe('levelDetail')
    expect(s.selectedLevelId).toBe('l1')
  })

  it('does not open locked stations', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    await screen.findByText('The Grid')
    expect(screen.getByRole('button', { name: /Highrise Row/i })).toBeDisabled()
  })

  it('shows the all-clear badge when every level is cleared', async () => {
    ;(api.getJourney as any).mockResolvedValue(ALL_CLEAR)
    render(<JourneyScreen />)
    expect(await screen.findByText(/Gap City cleared/i)).toBeInTheDocument()
  })

  it('does not show the all-clear badge while levels remain', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    await screen.findByText('The Hollows')
    expect(screen.queryByText(/Gap City cleared/i)).not.toBeInTheDocument()
  })

  it('shows a retry affordance when the journey fetch fails', async () => {
    ;(api.getJourney as any).mockRejectedValue(new Error('network'))
    render(<JourneyScreen />)
    expect(await screen.findByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/components/JourneyScreen.test.tsx`
Expected: FAIL — the "all-clear badge" case fails (no such text rendered yet). The other cases should pass.

- [ ] **Step 3: Render the all-clear badge**

In `src/components/JourneyScreen.tsx`, compute the all-clear state from the loaded themes and render a subtle badge in the sticky header. Replace the header `<div>` block (the `sticky top-0 …` element wrapping `<Wordmark size="sm" />`) with:

```tsx
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
           style={{ background: 'linear-gradient(to bottom, #06080f, transparent)' }}>
        <Wordmark size="sm" />
        {themes.every(t => t.levels.every(l => l.cleared)) && (
          <span className="text-[11px] font-bold tracking-wide text-emerald-400">
            Gap City cleared
          </span>
        )}
      </div>
```

> `themes` is the non-null array in the rendered branch (the function already returns early for `error` and `!themes`), so `themes.every(...)` is safe here.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/components/JourneyScreen.test.tsx`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/JourneyScreen.tsx tests/components/JourneyScreen.test.tsx
git commit -m "feat(journey): all-clear 'Gap City cleared' badge"
```

---

## Task 4: Full verification + visual check

**Files:** none (verification only).

- [ ] **Step 1: Run the full frontend suite**

Run: `npm run test`
Expected: PASS — all frontend tests green (the two rewritten suites + the previously-passing 237 baseline).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS — type-clean, no `noUnusedLocals`.

- [ ] **Step 3: Run the full pgTAP suite**

Run (own Bash call): `npm run db:reset`
Then (own Bash call): `npm run db:test`
Expected: PASS — original suites + the new `0006_station_gating` (11 assertions).

- [ ] **Step 4: Visual smoke test of the map**

Run the app (`npm run dev` → http://localhost:5173) and, using the preview tools, confirm on the Journey screen: cleared stations are tappable, the current station shows the "next stop" treatment, stations after it are visibly locked/disabled, and (if a fully-cleared account is available) the "Gap City cleared" badge appears in the header. If you can't reach an authenticated journey state locally, say so explicitly rather than claiming success.

- [ ] **Step 5: Commit (only if Step 4 required a fix)**

If the visual check surfaced a fix, commit it:

```bash
git add -A
git commit -m "fix(map): <describe the visual fix>"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** §3 gating model → Task 1 (RPC `frontier` logic) + Task 2 (`next = current`). §4 backend (RPC redefine, theme `locked` removed, column dropped, seed edited) → Task 1. §5 frontend (per-level flags, state collapse, all-clear badge) → Tasks 2 & 3. §6 tests (pgTAP three states, frontend disabled/tappable/aria-current/all-clear) → Tasks 1–3. §8 out-of-scope (no `start_session` change, no scoring/solver/difficulty change) → respected; none of those files are touched.
- **Placeholder scan:** none — every code/SQL/command step is concrete.
- **Type consistency:** `current`/`locked` booleans on `JourneyLevel` are produced by the RPC (Task 1), typed in Task 2, and supplied by every fixture in Tasks 2 & 3. `JourneyTheme.locked` is removed in Task 2 and absent from all fixtures. `next = stations.find(s => s.current)` matches the `current` flag name used end to end.
```
