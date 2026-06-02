# Gap City — Map (Spec 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain vertical-list Journey screen with an immersive transit-map "Map" of Gap City — three colored subway lines (The Hollows, The Stacks, The Grid) whose stations are the 15 levels, renamed to fictional pun-forward neighborhoods.

**Architecture:** Presentational only. A new `JourneyMap` component renders an SVG transit map (lines, connectors, labels) with absolutely-positioned HTML `<button>` station overlays for accessibility and test compatibility. A rename-only DB migration + seed/config update swaps the NYC toponyms for fictional names. Lock behavior, scoring, solver, and the difficulty curve are unchanged.

**Tech Stack:** React + TypeScript + Vite + Tailwind v3 + Zustand; Vitest + React Testing Library; Supabase Postgres (SQL migrations + pgTAP).

**Base branch:** `feat/gap-city-identity` (do NOT branch from or commit to `main`).

**Verification rule (CLAUDE.md):** run `npm run build` (catches `noUnusedLocals`) AND `npm run test`. nvm errors on chained `a && b` shell commands — run each npm/npx invocation as its own Bash call.

---

## File Structure

**Create:**
- `supabase/migrations/0009_gap_city_fictional_names.sql` — rename-only migration (themes + levels).
- `src/components/JourneyMap/layout.ts` — pure geometry: station coords, line paths, colors, labels, viewbox.
- `src/components/JourneyMap/index.tsx` — `TransitMap` component + exported `JourneyLevel`/`JourneyTheme` interfaces.
- `tests/components/JourneyMap/layout.test.ts` — unit tests for the geometry module.
- `tests/components/JourneyMap.test.tsx` — component tests (station states, lock disabling, next-stop, onSelect).

**Modify:**
- `supabase/seed.sql` — rename themes + 15 level names (durations byte-for-byte unchanged).
- `supabase/tests/0004_read_rpcs.test.sql` — `Castle Hill` → `Vacant Heights`.
- `supabase/functions/_shared/core/levelConfig.ts` — theme slug union + `themeForLevel` slugs.
- `tests/core/levelConfig.test.ts` — assert new slugs.
- `src/components/JourneyScreen.tsx` — swap the card grid for `<TransitMap>`.
- `tests/components/JourneyScreen.test.tsx` — fixtures + assertions to fictional names.
- `tests/components/LevelDetailScreen.test.tsx` — fixtures + `startJourneySession` arg rename.
- `src/index.css` — map pulse + draw-on keyframes, reduced-motion guard.
- `CLAUDE.md` — Journey section + districts wording.

---

## The fictional rename (single source of truth for every task)

District themes (rename by OLD slug):

| old slug    | new slug      | new name      | new mechanic/description     |
|-------------|---------------|---------------|------------------------------|
| the_bronx   | the_hollows   | The Hollows   | Sleepy outskirts — all gaps. |
| brooklyn    | the_stacks    | The Stacks    | Blocks piling up.            |
| manhattan   | the_grid      | The Grid      | Dense downtown — locked in.  |

Level names (rename by `display_number`):

| # | name           | district    |
|---|----------------|-------------|
| 1 | Vacant Heights | the_hollows |
| 2 | Open Lots      | the_hollows |
| 3 | Holloway       | the_hollows |
| 4 | Gapstead       | the_hollows |
| 5 | Nilsen Park    | the_hollows |
| 6 | Brickfall      | the_stacks  |
| 7 | Tetra Heights  | the_stacks  |
| 8 | Four Corners   | the_stacks  |
| 9 | Jaywick        | the_stacks  |
| 10| Snug Harbor    | the_stacks  |
| 11| Highrise Row   | the_grid    |
| 12| Gridlock       | the_grid    |
| 13| Tight Corners  | the_grid    |
| 14| Clearway       | the_grid    |
| 15| Perfect Square | the_grid    |

---

### Task 1: Rename migration + pgTAP assertion

**Files:**
- Create: `supabase/migrations/0009_gap_city_fictional_names.sql`
- Modify: `supabase/tests/0004_read_rpcs.test.sql`

- [ ] **Step 1: Update the pgTAP assertion to expect the new name (failing first)**

In `supabase/tests/0004_read_rpcs.test.sql`, find the assertion that checks `get_level(...) ->> 'name'` equals `'Castle Hill'` for `display_number` 1 and change the expected value to `'Vacant Heights'`:

```sql
select is(
  (select get_level((select id from levels where display_number = 1)) ->> 'name'),
  'Vacant Heights',
  'get_level returns the fictional level name'
);
```

(Keep the surrounding `plan(...)` count unchanged — this is an edit to an existing assertion, not a new one.)

- [ ] **Step 2: Run pgTAP to verify it fails**

Run: `supabase test db`
Expected: FAIL on the renamed assertion (DB still seeded with `Castle Hill`) — confirms the test is live. (If Docker/local Supabase is unavailable, note it and proceed; CI runs pgTAP.)

- [ ] **Step 3: Write the rename migration**

Create `supabase/migrations/0009_gap_city_fictional_names.sql`:

```sql
-- Gap City Spec 2: rename NYC toponyms to fictional pun-forward neighborhoods.
-- Rename-only. No schema or RPC changes.
-- IMPORTANT: themes.mechanic is a GAMEPLAY field (value 'standard') surfaced by
-- get_journey — do NOT touch it. Flavor text goes in themes.description (DB-only;
-- get_journey does not expose description today). slug + name are the renames.
begin;

update themes set slug = 'the_hollows', name = 'The Hollows', description = 'Sleepy outskirts — all gaps.' where slug = 'the_bronx';
update themes set slug = 'the_stacks',  name = 'The Stacks',  description = 'Blocks piling up.'             where slug = 'brooklyn';
update themes set slug = 'the_grid',    name = 'The Grid',    description = 'Dense downtown — locked in.'    where slug = 'manhattan';

update levels set name = 'Vacant Heights' where display_number = 1;
update levels set name = 'Open Lots'      where display_number = 2;
update levels set name = 'Holloway'       where display_number = 3;
update levels set name = 'Gapstead'       where display_number = 4;
update levels set name = 'Nilsen Park'    where display_number = 5;
update levels set name = 'Brickfall'      where display_number = 6;
update levels set name = 'Tetra Heights'  where display_number = 7;
update levels set name = 'Four Corners'   where display_number = 8;
update levels set name = 'Jaywick'        where display_number = 9;
update levels set name = 'Snug Harbor'    where display_number = 10;
update levels set name = 'Highrise Row'   where display_number = 11;
update levels set name = 'Gridlock'       where display_number = 12;
update levels set name = 'Tight Corners'  where display_number = 13;
update levels set name = 'Clearway'       where display_number = 14;
update levels set name = 'Perfect Square' where display_number = 15;

commit;
```

> NOTE (verified against 0008): `themes` columns are `(slug, name, description, sort_order, unlock_threshold, piece_set, mechanic)`. `get_journey` returns `t.mechanic` (value `'standard'`) as the JSON `mechanic` field and does NOT expose `description`. So: rename `slug` + `name`; put flavor text in `description`; leave `mechanic`, `piece_set`, `sort_order`, `unlock_threshold` untouched. The 5/5/5 level→theme mapping and all durations are unchanged.

- [ ] **Step 4: Re-run pgTAP to verify it passes**

Run: `supabase db reset` (re-applies migrations + seed)
Then run: `supabase test db`
Expected: PASS — `get_level` for display_number 1 now returns `Vacant Heights`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0009_gap_city_fictional_names.sql supabase/tests/0004_read_rpcs.test.sql
git commit -m "feat(db): rename districts/levels to fictional Gap City names"
```

---

### Task 2: Seed rename

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Rename the three themes in the seed**

The seed themes insert is `insert into public.themes (slug,name,description,sort_order,unlock_threshold,piece_set,mechanic) values (...)`. Update each row's **`slug`, `name`, and `description`** columns: `the_bronx`→`the_hollows` 'The Hollows' 'Sleepy outskirts — all gaps.'; `brooklyn`→`the_stacks` 'The Stacks' 'Blocks piling up.'; `manhattan`→`the_grid` 'The Grid' 'Dense downtown — locked in.'. **Leave `mechanic` (`'standard'`), `piece_set`, `sort_order`, `unlock_threshold` exactly as-is** — `mechanic` is a gameplay field surfaced by `get_journey`, not flavor text.

- [ ] **Step 2: Rename the 15 level names + their theme-slug refs in the seed**

The levels insert references themes via `(select id from t where slug='the_bronx')` etc. (a `with t as (...)` CTE selecting themes by slug). Two edits:
1. In the level rows, replace each `name` (last column) by `display_number` per the table above (1 `Vacant Heights` … 15 `Perfect Square`).
2. Update every `slug='the_bronx'` → `'the_hollows'`, `'brooklyn'` → `'the_stacks'`, `'manhattan'` → `'the_grid'` in those `select id from t where slug=...` refs **and** in the CTE `t` definition if it lists slugs, so they match the renamed themes from Step 1.

**Do NOT touch any duration, gap_count, index, difficulty, or other column — those must stay byte-for-byte identical** (CLAUDE.md three-sources rule; durations are unchanged in Spec 2).

- [ ] **Step 3: Re-seed and verify schema integrity**

Run: `supabase db reset`
Expected: completes with no FK or constraint errors; seed applies cleanly on top of migration 0009.

- [ ] **Step 4: Run pgTAP again to confirm seed + migration agree**

Run: `supabase test db`
Expected: all pgTAP tests PASS (39 + the unchanged count).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql
git commit -m "chore(seed): fictional Gap City district and level names"
```

---

### Task 3: levelConfig slugs

**Files:**
- Modify: `supabase/functions/_shared/core/levelConfig.ts`
- Modify: `tests/core/levelConfig.test.ts`

- [ ] **Step 1: Update the test to expect new slugs (failing first)**

In `tests/core/levelConfig.test.ts`, change the `themeForLevel` assertions so levels 1–5 → `'the_hollows'`, 6–10 → `'the_stacks'`, 11–15 → `'the_grid'`. Example:

```ts
expect(themeForLevel(1)).toBe('the_hollows')
expect(themeForLevel(5)).toBe('the_hollows')
expect(themeForLevel(6)).toBe('the_stacks')
expect(themeForLevel(10)).toBe('the_stacks')
expect(themeForLevel(11)).toBe('the_grid')
expect(themeForLevel(15)).toBe('the_grid')
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- levelConfig`
Expected: FAIL — `themeForLevel` still returns `the_bronx`/`brooklyn`/`manhattan`.

- [ ] **Step 3: Update the slug union and `themeForLevel`**

In `supabase/functions/_shared/core/levelConfig.ts`, change the theme union type and the returned slugs:

```ts
theme: 'the_hollows' | 'the_stacks' | 'the_grid'
```

and in `themeForLevel(n)` return `'the_hollows'` for 1–5, `'the_stacks'` for 6–10, `'the_grid'` for 11–15 (keep the existing 5/5/5 split logic; only the returned string literals change).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- levelConfig`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/core/levelConfig.ts tests/core/levelConfig.test.ts
git commit -m "chore(config): fictional district slugs in levelConfig"
```

---

### Task 4: Map geometry module

**Files:**
- Create: `src/components/JourneyMap/layout.ts`
- Test: `tests/components/JourneyMap/layout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/JourneyMap/layout.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { STATIONS, LINES, LINE_COLOR, VIEWBOX } from '../../../src/components/JourneyMap/layout'

describe('JourneyMap layout', () => {
  it('has a coordinate for all 15 stations', () => {
    for (let n = 1; n <= 15; n++) {
      expect(STATIONS[n], `station ${n}`).toBeDefined()
      expect(typeof STATIONS[n].x).toBe('number')
      expect(typeof STATIONS[n].y).toBe('number')
    }
  })

  it('marks the two interchange stations (5 and 10)', () => {
    expect(STATIONS[5].interchange).toBe(true)
    expect(STATIONS[10].interchange).toBe(true)
    expect(STATIONS[1].interchange).toBeUndefined()
  })

  it('ascends: each station sits higher (smaller y) than the previous', () => {
    for (let n = 2; n <= 15; n++) {
      expect(STATIONS[n].y, `station ${n} above ${n - 1}`).toBeLessThan(STATIONS[n - 1].y)
    }
  })

  it('defines a colored line per district slug', () => {
    expect(LINE_COLOR.the_hollows).toBe('#22d3ee')
    expect(LINE_COLOR.the_stacks).toBe('#ff2d95')
    expect(LINE_COLOR.the_grid).toBe('#39d98a')
    expect(LINES.map(l => l.slug)).toEqual(['the_hollows', 'the_stacks', 'the_grid'])
  })

  it('exposes a viewbox', () => {
    expect(VIEWBOX.w).toBeGreaterThan(0)
    expect(VIEWBOX.h).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- JourneyMap/layout`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the layout module**

Create `src/components/JourneyMap/layout.ts`:

```ts
export type DistrictSlug = 'the_hollows' | 'the_stacks' | 'the_grid'

export interface StationCoord { x: number; y: number; interchange?: boolean }

// Transit-map coordinate space. L1 sits at the bottom, L15 at the top (ascending climb).
export const VIEWBOX = { w: 390, h: 1120 } as const

export const STATIONS: Record<number, StationCoord> = {
  1:  { x: 70,  y: 1050 },
  2:  { x: 70,  y: 960 },
  3:  { x: 140, y: 890 },
  4:  { x: 140, y: 800 },
  5:  { x: 80,  y: 730, interchange: true },
  6:  { x: 160, y: 660 },
  7:  { x: 160, y: 570 },
  8:  { x: 240, y: 510 },
  9:  { x: 240, y: 430 },
  10: { x: 170, y: 370, interchange: true },
  11: { x: 260, y: 300 },
  12: { x: 260, y: 220 },
  13: { x: 320, y: 170 },
  14: { x: 320, y: 100 },
  15: { x: 250, y: 60 },
}

export const LINE_COLOR: Record<DistrictSlug, string> = {
  the_hollows: '#22d3ee',
  the_stacks: '#ff2d95',
  the_grid: '#39d98a',
}

export interface LineDef {
  slug: DistrictSlug
  color: string
  path: string        // the line itself (through its 5 stations)
  connector?: string  // dashed transfer from the previous line's interchange
  label: { x: number; y: number }
}

// Paths trace the station coords above, in display order.
export const LINES: LineDef[] = [
  {
    slug: 'the_hollows',
    color: LINE_COLOR.the_hollows,
    path: 'M70,1050 L70,960 L140,890 L140,800 L80,730',
    label: { x: 12, y: 1062 },
  },
  {
    slug: 'the_stacks',
    color: LINE_COLOR.the_stacks,
    path: 'M160,660 L160,570 L240,510 L240,430 L170,370',
    connector: 'M80,730 L160,660',
    label: { x: 258, y: 654 },
  },
  {
    slug: 'the_grid',
    color: LINE_COLOR.the_grid,
    path: 'M260,300 L260,220 L320,170 L320,100 L250,60',
    connector: 'M170,370 L260,300',
    label: { x: 150, y: 286 },
  },
]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- JourneyMap/layout`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/JourneyMap/layout.ts tests/components/JourneyMap/layout.test.ts
git commit -m "feat(map): transit-map geometry module"
```

---

### Task 5: TransitMap component

**Files:**
- Create: `src/components/JourneyMap/index.tsx`
- Test: `tests/components/JourneyMap.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/JourneyMap.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransitMap, type JourneyTheme } from '../../src/components/JourneyMap'

function lvl(n: number, name: string, cleared: boolean) {
  return {
    level_id: `l${n}`, display_number: n, name,
    my_pr: cleared ? 900 : null, my_stars: cleared ? 2 : 0,
    cleared, last_played: null, global_best: null,
  }
}

const themes: JourneyTheme[] = [
  {
    theme_id: 't1', slug: 'the_hollows', name: 'The Hollows', mechanic: '',
    sort_order: 1, locked: false,
    levels: [lvl(1, 'Vacant Heights', true), lvl(2, 'Open Lots', false),
             lvl(3, 'Holloway', false), lvl(4, 'Gapstead', false), lvl(5, 'Nilsen Park', false)],
  },
  {
    theme_id: 't2', slug: 'the_stacks', name: 'The Stacks', mechanic: '',
    sort_order: 2, locked: true,
    levels: [lvl(6, 'Brickfall', false), lvl(7, 'Tetra Heights', false),
             lvl(8, 'Four Corners', false), lvl(9, 'Jaywick', false), lvl(10, 'Snug Harbor', false)],
  },
]

describe('TransitMap', () => {
  it('renders a button for every station', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Snug Harbor/i })).toBeInTheDocument()
  })

  it('disables stations on a locked line', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Brickfall/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeEnabled()
  })

  it('marks the next stop with aria-current=step (lowest uncleared on an unlocked line)', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    // L1 is cleared, so L2 "Open Lots" is the next stop.
    expect(screen.getByRole('button', { name: /Open Lots/i })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).not.toHaveAttribute('aria-current')
  })

  it('calls onSelect with the level id when a playable station is clicked', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    screen.getByRole('button', { name: /Open Lots/i }).click()
    expect(onSelect).toHaveBeenCalledWith('l2')
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

Run: `npm run test -- JourneyMap.test`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Write the TransitMap component**

Create `src/components/JourneyMap/index.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { STATIONS, LINES, LINE_COLOR, VIEWBOX, type DistrictSlug } from './layout'

export interface JourneyLevel {
  level_id: string; display_number: number; name: string
  my_pr: number | null; my_stars: number; cleared: boolean
  last_played: string | null; global_best: number | null
}
export interface JourneyTheme {
  theme_id: string; slug: string; name: string; mechanic: string
  sort_order: number; locked: boolean; levels: JourneyLevel[]
}

interface FlatStation extends JourneyLevel {
  slug: DistrictSlug
  locked: boolean
  x: number
  y: number
  interchange: boolean
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-[10px] tracking-tight" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <span key={i} className={i < n ? 'text-yellow-400' : 'text-gray-700'}>★</span>
      ))}
    </span>
  )
}

export function TransitMap({ themes, onSelect }: { themes: JourneyTheme[]; onSelect: (levelId: string) => void }) {
  const nextRef = useRef<HTMLButtonElement | null>(null)

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

  useEffect(() => {
    nextRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [next?.level_id])

  return (
    <div className="relative w-full max-w-md mx-auto">
      <svg
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        className="w-full block"
        aria-hidden="true"
      >
        {LINES.map(line => {
          const lineCleared = stations
            .filter(s => s.slug === line.slug)
            .every(s => s.cleared)
          return (
            <g key={line.slug}>
              {line.connector && (
                <path d={line.connector} fill="none" stroke="#33406b" strokeWidth={3} strokeDasharray="2 6" />
              )}
              <path
                d={line.path}
                fill="none"
                stroke={line.color}
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={lineCleared ? 1 : 0.85}
              />
              <text x={line.label.x} y={line.label.y} fill={line.color} fontSize={9} fontWeight={700}>
                {/* district name shown as a line key */}
              </text>
            </g>
          )
        })}
      </svg>

      {stations.map(s => {
        const isNext = next?.level_id === s.level_id
        const state = s.locked ? 'locked' : s.cleared ? 'cleared' : isNext ? 'next' : 'ahead'
        const color = LINE_COLOR[s.slug]
        const dotClass =
          state === 'next'
            ? 'map-next bg-white'
            : state === 'cleared'
              ? ''
              : state === 'locked'
                ? 'bg-arcade-bg'
                : 'bg-arcade-bg'
        return (
          <button
            key={s.level_id}
            ref={isNext ? nextRef : undefined}
            type="button"
            disabled={s.locked}
            aria-current={isNext ? 'step' : undefined}
            onClick={() => { if (!s.locked) onSelect(s.level_id) }}
            className="absolute flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2
              disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{ left: `${(s.x / VIEWBOX.w) * 100}%`, top: `${(s.y / VIEWBOX.h) * 100}%` }}
          >
            <span
              className={`block rounded-full border-[3px] ${dotClass}`}
              style={{
                width: s.interchange ? 18 : 16,
                height: s.interchange ? 18 : 16,
                borderColor: color,
                opacity: state === 'locked' || state === 'ahead' ? 0.5 : 1,
                background: state === 'cleared' ? color : undefined,
              }}
            />
            <span className="flex flex-col items-start leading-tight whitespace-nowrap">
              <span className={`text-[11px] ${state === 'next' ? 'text-white font-bold' : state === 'locked' || state === 'ahead' ? 'text-gray-500' : 'text-gray-200'}`}>
                {s.name}{s.interchange ? ' ⇄' : ''}{isNext ? ' ▶' : ''}
              </span>
              {s.cleared && <Stars n={s.my_stars} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

> NOTE: `bg-arcade-bg` assumes the Tailwind token from the arcade design system. If the token name differs, read `tailwind.config.*` and use the correct one (or an inline `style` background). The dot's visual treatment is the one place to lavish polish during execution — the test only asserts roles, disabled, aria-current, and onSelect, so iterate freely on styling against the `mockups/map-final.html` reference.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- JourneyMap.test`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/JourneyMap/index.tsx tests/components/JourneyMap.test.tsx
git commit -m "feat(map): TransitMap station component"
```

---

### Task 6: Swap JourneyScreen to the map

**Files:**
- Modify: `src/components/JourneyScreen.tsx`
- Modify: `tests/components/JourneyScreen.test.tsx`

- [ ] **Step 1: Update JourneyScreen tests to the fictional names + map (failing first)**

In `tests/components/JourneyScreen.test.tsx`, update the fixture theme/level names to the fictional set (e.g. district `The Hollows`, level 1 `Vacant Heights`, a locked second district `The Stacks` with `Brickfall` etc.) and update assertions:

```tsx
// a playable cleared/early station is tappable
expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeEnabled()
// a station on the locked line is disabled
expect(screen.getByRole('button', { name: /Brickfall/i })).toBeDisabled()
// clicking a playable station opens the level
screen.getByRole('button', { name: /Open Lots/i }).click()
expect(openLevelMock).toHaveBeenCalledWith('l2')
```

Keep the existing loading/error-state tests as-is (those behaviors are unchanged). If the existing test mocks `getJourney`, keep that mock but return the fictional fixture.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- JourneyScreen`
Expected: FAIL — screen still renders the old card grid / NYC names.

- [ ] **Step 3: Swap the card grid for the TransitMap**

Edit `src/components/JourneyScreen.tsx`: remove the local `Stars` helper and the `theme.map(...)` card grid. Keep the data load (`getJourney` + `track`), error state, and blank-loading state exactly as they are. Import the map and its types, and render it in place of the card grid:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { getJourney } from '../lib/api'
import { useNavStore } from '../store/navStore'
import { track } from '../store/asyncStatus'
import { Wordmark } from './ui/Wordmark'
import { TransitMap, type JourneyTheme } from './JourneyMap'

export function JourneyScreen() {
  const openLevel = useNavStore(s => s.openLevel)
  const [themes, setThemes] = useState<JourneyTheme[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    setThemes(null)
    try {
      setThemes((await track(getJourney())) as JourneyTheme[])
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (error) {
    return (
      <div className="min-h-dvh bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Couldn’t load the journey.</p>
        <button onClick={load} className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 font-bold">Retry</button>
      </div>
    )
  }

  if (!themes) {
    return <div className="min-h-dvh bg-gray-950" />
  }

  return (
    <div className="min-h-dvh bg-arcade-bg text-white arcade-scanlines">
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
           style={{ background: 'linear-gradient(to bottom, #06080f, transparent)' }}>
        <Wordmark size="sm" />
      </div>
      <div className="px-4 pb-10">
        <TransitMap themes={themes} onSelect={openLevel} />
      </div>
    </div>
  )
}
```

> NOTE: the `JourneyLevel`/`JourneyTheme` interfaces now live in `./JourneyMap`. Delete the duplicate local interface declarations from this file. If `bg-arcade-bg`/`arcade-scanlines` token names differ, match the real ones (see `src/index.css` / `tailwind.config.*`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- JourneyScreen`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/JourneyScreen.tsx tests/components/JourneyScreen.test.tsx
git commit -m "feat(journey): render the Gap City transit map"
```

---

### Task 7: LevelDetailScreen test rename

**Files:**
- Modify: `tests/components/LevelDetailScreen.test.tsx`

> The component itself already renders `theme_name` + `level.name` generically — no source change needed. Only the test fixtures/assertions reference NYC names.

- [ ] **Step 1: Update fixtures + assertion to fictional names**

In `tests/components/LevelDetailScreen.test.tsx`, change the fixture level so `name` is `Vacant Heights`, `theme_name` is `The Hollows`, and update the `startJourneySession` assertion's name arg:

```tsx
expect(startJourneySessionMock).toHaveBeenCalledWith('l1', 1820, 1, 'Vacant Heights')
```

Update any other `Castle Hill` / `The Bronx` string assertions in this file to `Vacant Heights` / `The Hollows`.

- [ ] **Step 2: Run the test to verify it passes**

Run: `npm run test -- LevelDetailScreen`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/components/LevelDetailScreen.test.tsx
git commit -m "test(level-detail): fictional level/district names in fixtures"
```

---

### Task 8: Map animations (CSS)

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the keyframes + classes**

Append to `src/index.css` (after the existing arcade utilities):

```css
@keyframes mapPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.35); }
}
.map-next {
  animation: mapPulse 1.3s ease-in-out infinite;
  box-shadow: 0 0 8px #fff, 0 0 14px #ff2d95;
}

@keyframes mapDrawOn {
  from { stroke-dashoffset: var(--draw, 100); }
  to { stroke-dashoffset: 0; }
}
.map-progress {
  animation: mapDrawOn 0.9s ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  .map-next, .map-progress { animation: none; }
}
```

> NOTE: `.map-next` is already wired to the next-stop dot in Task 5. The `.map-progress` / `mapDrawOn` class is the cleared-route draw-on hook — apply it to a cleared line's `<path>` during polish if desired; it is not required by any test, so it's optional v1 flourish. Verify the pulse visually in the browser per Step 2.

- [ ] **Step 2: Verify in the browser**

Run the dev server (`npm run dev`) and load the Journey screen. Confirm: the next-stop node pulses; cleared stations show solid line-color dots + stars; locked-line stations are dimmed and not clickable; the map scrolls and auto-centers on the next stop. Toggle OS "reduce motion" and confirm the pulse stops. Capture a screenshot as proof.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(map): next-stop pulse + reduced-motion guard"
```

---

### Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update district names + Journey description**

In `CLAUDE.md`, update the Journey-mode prose so districts read **The Hollows → The Stacks → The Grid** (not The Bronx / Brooklyn / Manhattan). Add a short bullet under the architecture/file-map area noting `src/components/JourneyMap/` renders the transit-map Journey (SVG lines + HTML station buttons; geometry in `layout.ts`). Note that the three-sources sync rule now uses the fictional slugs `the_hollows`/`the_stacks`/`the_grid`. Do NOT change the difficulty-table prose (durations unchanged).

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Gap City fictional districts + transit-map Journey"
```

---

### Task 10: Full verification sweep + branch finish

**Files:** none (verification only)

- [ ] **Step 1: Type-check + build (catches noUnusedLocals)**

Run: `npm run build`
Expected: succeeds with no type or unused-local errors. (Watch for a stale `Stars`/interface left in `JourneyScreen.tsx`.)

- [ ] **Step 2: Full frontend test suite**

Run: `npm run test`
Expected: all frontend tests green (the prior 225 baseline ± the cases this plan adds/edits).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: pgTAP (if Docker/local Supabase available)**

Run: `supabase db reset`
Then run: `supabase test db`
Expected: all pgTAP tests pass. If Docker is unavailable, note it explicitly and rely on CI.

- [ ] **Step 5: Manual browser pass**

With `npm run dev`, click through: tap a cleared station → Level Detail opens with the fictional name; tap the next stop → opens; confirm locked-line stations are not tappable; confirm the back/nav flow still works. Screenshot the final map as proof.

- [ ] **Step 6: Finish the branch**

This is presentational Spec 2 work on `feat/gap-city-identity`. Do NOT merge to `main` without confirming with the user first (per workspace prefs). Summarize the diff, then ask whether to merge + push or leave the branch for review.

---

## Self-review notes

- **Spec coverage:** rename (Tasks 1-3), transit-map render (4-6), Level Detail name flow (7), animations + reduced-motion (8), docs (9), verification (10) — covers every Spec 2 section. Lock model unchanged (verified: `TransitMap` reads `theme.locked` and disables, identical semantics to today). Per-station gating intentionally NOT here (separate deferred spec).
- **Type consistency:** `JourneyLevel`/`JourneyTheme` defined once in `JourneyMap/index.tsx`, imported by `JourneyScreen.tsx` and the tests. `DistrictSlug` defined in `layout.ts`, reused by the component. `onSelect: (levelId: string) => void` matches `openLevel`.
- **Durations untouched:** no task edits any duration/gap_count — three-sources rule preserved.
