# Game Over · Run-History Graph — Implementation Plan

## Context

The **Staggered Vanishing Shapes** game-over screen (`src/components/StaggerScreen.tsx`,
the `phase === 'gameOver'` block) currently shows a final score plus a trio of run
stats (items recalled / best combo / accuracy). We are adding an **interactive
score-over-time graph** below that trio, matching the approved mockup at
`mockups/gameover-graph-final.html`.

The graph plots one point per past run, with four switchable series (Score, Recall,
Combo, Accuracy), a personal-best rank chip on the current run, and a personal-best
ladder underneath. All data is **personal and local** (localStorage) — no backend.

Today the game tracks only the *current* run's stats (`staggerStore`); there is **no
persisted history**. This plan adds that persistence, the pure ranking math, the
component, and the integration.

**Reference the mockup `mockups/gameover-graph-final.html` for exact visuals,
geometry, colors, and interactions.** It is the source of truth for the look & feel.

## Global Constraints

These bind every task. Reviewers: treat violations as defects.

- **Stack:** React 18 + TypeScript + Zustand 5 + Tailwind + Vitest. Vite.
- **Zustand 5:** object selectors MUST use `useShallow` (`import { useShallow } from
  'zustand/shallow'`). Single-value selectors don't need it. (Inline object selectors
  cause infinite loops.)
- **Design tokens (Afterglow):** use the existing `vs-*` Tailwind classes / CSS vars.
  Series colors are fixed and MUST match the trio above the graph:
  - Score → amber `#FFC23D` (`vs-amber`)
  - Recall → magenta `#FF2D9B` (`vs-magenta`)
  - Combo → lime `#B6FF3C` (`vs-lime`)
  - Accuracy → cyan `#28F0FF` (`vs-cyan`)
- **Mobile-first:** the run card opens on **tap/click**, never hover.
- **Personal/local only:** persistence is localStorage; storage keys follow the
  existing `gapcity:...:v1` convention.
- **Record exactly once per game-over.** No double-recording (guard StrictMode / re-renders).
- **Visual parity** with `mockups/gameover-graph-final.html`.
- **Tests:** all tests pass via `npm run test` (vitest). Tests live under `tests/`
  mirroring `src/` (e.g. `src/store/x.ts` → `tests/store/x.test.ts`). Follow TDD.
- **Build clean:** `npm run build` (catches `noUnusedLocals`) and `npx tsc --noEmit`
  pass. (Note: `npm`/`npx` must be run as standalone commands, not chained with `&&`,
  due to an nvm quirk in this environment.)
- **No unrelated refactoring.** Stay within each task's files.

---

## Task 1: Run-history persistence store

**Goal:** A Zustand store that persists a capped array of completed runs to
localStorage and exposes a `recordRun` that appends one and returns it.

**File:** `src/store/runHistoryStore.ts` (new)
**Tests:** `tests/store/runHistoryStore.test.ts` (new)

**Mirror the persistence pattern in `src/store/progressStore.ts`** (try/catch
`load()`/`save()` around localStorage; tolerate unavailable storage).

**Public API (exact):**

```ts
export const RUN_HISTORY_STORAGE_KEY = 'gapcity:runhistory:v1'
export const MAX_RUN_HISTORY = 100

export type RunMetric = 'score' | 'recalled' | 'combo' | 'accuracy'

export interface RunRecord {
  id: string        // unique within the list
  score: number
  recalled: number  // shapesRecalled
  combo: number     // bestCombo
  accuracy: number  // integer 0..100
  playedAt: number  // epoch ms (Date.now())
}

export type RunStats = Pick<RunRecord, 'score' | 'recalled' | 'combo' | 'accuracy'>

interface RunHistoryStore {
  records: RunRecord[]          // chronological (oldest first)
  recordRun: (stats: RunStats) => RunRecord
  clear: () => void             // wipe history + storage (dev/admin)
}

export const useRunHistoryStore = create<RunHistoryStore>(...)
```

**Behavior:**
- `records` initialises from localStorage on store creation (via `load()`), `[]` on
  failure or empty.
- `recordRun(stats)`:
  - builds `RunRecord` with `playedAt = Date.now()` and a **unique `id`** generated
    without `Math.random()` — use a module-level monotonic counter combined with
    `playedAt`, e.g. `` `${playedAt}-${seq++}` ``.
  - appends to `records`, then **trims to the last `MAX_RUN_HISTORY`** (keep newest).
  - persists via `save()`, updates store state, and **returns the new record**.
- `clear()`: removes the storage key and sets `records: []`.

**Test cases (TDD — write first):**
- starts empty when storage is empty.
- `recordRun` appends a record and returns it with all fields populated; `records`
  now length 1 and contains it.
- returned record `id` is unique across two consecutive `recordRun` calls.
- records persist: after `recordRun`, a fresh `load()` (read the key directly, or
  re-create via the store's loader) yields the saved array.
- history is capped at `MAX_RUN_HISTORY` (record 101 times → length 100, and the
  oldest is dropped / newest retained — assert the first record's score is gone).
- `clear()` empties `records` and removes the storage key.
- tolerates unavailable storage (mock `localStorage.setItem` to throw → `recordRun`
  still returns a record and updates in-memory state without throwing).

Reset store + `localStorage` in `beforeEach` (see `tests/store/progressStore.test.ts`).

**Verify:** `npm run test` (new test file green); `npx tsc --noEmit`.

---

## Task 2: Pure ranking / derivation helpers

**Goal:** Pure functions over `RunRecord[]` that the component uses for ranking,
the ladder, axis stats, and formatting. No React, no store, no side effects.

**File:** `src/lib/runHistory.ts` (new)
**Tests:** `tests/lib/runHistory.test.ts` (new)
**Depends on:** `RunRecord`, `RunMetric` from Task 1 (`src/store/runHistoryStore`).

**Public API (exact):**

```ts
import type { RunRecord, RunMetric } from '../store/runHistoryStore'

export interface MetricDef {
  key: RunMetric
  label: string      // tab label
  hex: string        // series color
  prefix?: string    // e.g. '×' for combo
  suffix?: string    // e.g. '%' for accuracy
}

// Order = tab order. Colors per Global Constraints.
export const METRICS: MetricDef[]   // score, recalled, combo, accuracy

export function ordinal(n: number): string
  // 1→'1st', 2→'2nd', 3→'3rd', 4→'4th', 11→'11th', 21→'21st', 22→'22nd', 23→'23rd'

export function formatMetric(def: MetricDef, value: number): string
  // `${prefix ?? ''}${value}${suffix ?? ''}`  e.g. combo 12 → '×12', accuracy 91 → '91%'

export function sortByMetric(records: RunRecord[], metric: RunMetric): RunRecord[]
  // DESC by records[metric]; tie-break by playedAt DESC (newer ranks higher). Pure (no mutation).

export function rankOf(records: RunRecord[], metric: RunMetric, id: string): number
  // 1-based position of the record with `id` in sortByMetric(...). 0 if not found.

export function seriesStats(records: RunRecord[], metric: RunMetric): { min: number; max: number; avg: number }
  // over the given records' metric values. Empty → { min: 0, max: 0, avg: 0 }.

export function recentRuns(records: RunRecord[], n: number): RunRecord[]
  // last `n` records in chronological order (the trend window).

export interface LadderRow { rank: number; record: RunRecord; isCurrent: boolean }

export function ladderRows(records: RunRecord[], metric: RunMetric, currentId: string, n?: number): LadderRow[]
  // n defaults to 5. Take top-n of sortByMetric. If the current run is NOT in the
  // top-n, replace the LAST row with the current run at its TRUE rank. Each row's
  // `rank` is its 1-based position in the full sorted list; `isCurrent` flags the
  // current run.
```

**Test cases (TDD — write first):** build a small fixture of records with known
metric values + ids.
- `ordinal`: 1/2/3/4/11/12/13/21/22/23/100/101/111 → '1st','2nd','3rd','4th','11th',
  '12th','13th','21st','22nd','23rd','100th','101st','111th'.
- `formatMetric`: score 4820 → '4820'; combo 12 → '×12'; accuracy 91 → '91%';
  recalled 38 → '38'.
- `sortByMetric`: orders desc by metric; equal metric values tie-break newer-first;
  does not mutate input.
- `rankOf`: top value → 1; current run that is 4th best → 4; unknown id → 0.
- `seriesStats`: correct min/max/avg; empty array → all 0.
- `recentRuns`: returns last n chronologically; n larger than length → whole array;
  n = 0 → [].
- `ladderRows`: when current is within top 5 → exactly the top 5, current flagged,
  ranks 1..5. When current is rank 9 of 13 → returns 5 rows where rows 1-4 are the
  top 4 and row 5 is the current run carrying rank 9 (`isCurrent: true`).
- `METRICS`: has the 4 keys in order score/recalled/combo/accuracy with the exact
  hex colors from Global Constraints; combo has prefix '×', accuracy suffix '%'.

**Verify:** `npm run test`; `npx tsc --noEmit`.

---

## Task 3: `RunHistoryGraph` component

**Goal:** The interactive chart, a faithful React port of
`mockups/gameover-graph-final.html` (read it). Presentational + local UI state only.

**File:** `src/components/RunHistoryGraph.tsx` (new)
**Tests:** `tests/components/RunHistoryGraph.test.tsx` (new)
**Depends on:** Task 1 (`RunRecord`) + Task 2 (all helpers).

**Props (exact):**
```ts
interface RunHistoryGraphProps {
  records: RunRecord[]
  currentId: string      // id of the just-finished run (highlighted as "You")
  recentCount?: number   // trend window; default 14
}
```

**Structure (mirror the mockup):**
- **Series tabs** — full-width segmented row of 4 buttons from `METRICS`. Active tab
  filled with that metric's color + glow; others muted. Local state `metric`
  (default `'score'`). Switching tabs resets any open card.
- **SVG sparkline** (viewBox `0 0 320 116`, padding L8/R12/T18/B16 as in the mockup):
  - dashed **BEST** and **AVG** reference lines from `seriesStats` over the recent
    window, labelled at the left.
  - smooth line (Catmull-Rom → cubic bezier; port the mockup's `smooth()`), a
    vertical gradient area fill under it, and a soft blurred glow stroke beneath the
    crisp stroke — all in the active metric color.
  - small dots at each run; the **current run** gets a pulsing halo + a solid blip
    (port the mockup's `<animate>` pulse).
  - **Rank chip** pinned to the current run's blip: `` `${ordinal(rankOf(records,
    metric, currentId))} best` `` over `all-time`, in the metric color.
  - **Tap to inspect:** a transparent full-width overlay; tapping maps to the nearest
    run by x and toggles a **card** showing that run's `when`-ish label + the active
    metric value + a `score / ×combo / accuracy%` line. Tapping the same run again, or
    switching tabs, dismisses it. (Use click handlers — works for mouse + touch.)
- **Ladder** — `ladderRows(records, metric, currentId, 5)` rendered as rows: rank #,
  a relative time label, a proportional bar (width = value/maxValue), the formatted
  value, and a "You" tag on the current row (cyan-highlighted row treatment from the
  mockup). For the relative-time label, reuse the existing helper in
  `src/lib/relativeTime.ts` if it fits (check its signature); otherwise a short
  absolute fallback is fine.

**Robustness:** handle `records.length < 2` without crashing — a single point draws a
dot and flat/absent reference lines; never throw on empty/one-element input. If
`currentId` isn't found, render without the chip/highlight rather than crashing.

**Geometry helper:** the Catmull-Rom `smooth(points)` may live as a small module-local
function in this file (no need to export). It is presentation, not domain logic.

**Test cases (Vitest + React Testing Library — see `tests/components/` for the
existing setup/pattern):**
- renders 4 series tabs with the metric labels.
- renders one ladder row per `ladderRows` result; the current run's row shows "You".
- clicking a non-active tab switches the active series (e.g. tab gains the active
  class / the ladder values change to the new metric).
- renders without throwing for `records.length === 1` (current run only).

Keep DOM assertions resilient (query by text/role, not brittle SVG path math).

**Verify:** `npm run test`; `npm run build`.

---

## Task 4: Integrate into `StaggerScreen`

**Goal:** Record the finished run exactly once when the run ends, and render
`RunHistoryGraph` in the game-over panel below the stats trio.

**File:** `src/components/StaggerScreen.tsx` (edit only the game-over wiring/panel)
**Depends on:** Tasks 1 + 3.

**Recording (exactly once per game-over):**
- Pull `recordRun` and `records` from `useRunHistoryStore` (use `useShallow` for the
  object selector).
- The store already exposes (via the existing `useShallow` selector around line 207):
  `phase`, `score`, `shapesRecalled`, `bestCombo`, `totalPicks`, `correctPicks`.
- Add a `useRef(false)` recorded-guard and `useState<string | null>` for the current
  run id. In a `useEffect` keyed on `phase` (+ the stat values it reads):
  - when `phase === 'gameOver'` and the guard is false: set guard true, compute
    `accuracy = totalPicks ? Math.round((correctPicks / totalPicks) * 100) : 0`, call
    `recordRun({ score, recalled: shapesRecalled, combo: bestCombo, accuracy })`, and
    store the returned `id` in state.
  - when `phase !== 'gameOver'`: reset the guard to false and clear the stored id
    (so the next run records fresh).
  - Do NOT reset the guard in an effect cleanup (would re-record under StrictMode).
- This must fire for BOTH game-over paths (a fatal miss in `pickPiece`, and a fatal
  `timeoutBatch`) — keying on `phase === 'gameOver'` covers both.

**Rendering:**
- In the `phase === 'gameOver'` block, after the run-stats trio (around line 585) and
  before the action buttons, render `<RunHistoryGraph records={records}
  currentId={currentRunId} />` when `currentRunId` is set. Keep the existing buttons
  below it. Match surrounding spacing/`z-index` conventions of that overlay.

**Verify:**
- `npm run test` (full suite green) and `npm run build`.
- **Manual:** start the `mockups`-style dev server (`npm run dev`), play a Staggered
  run to game-over, confirm the graph renders with the current run highlighted, tabs
  switch series, tapping a point opens the card, and the ladder shows "You". Confirm
  the run is recorded once (history length grows by exactly 1 per game-over — check
  `localStorage['gapcity:runhistory:v1']`).

---

## Out of scope (future)

- Global / cross-player leaderboard (the ladder is personal-only for now; layout
  leaves room for a future Global tab).
- Wiring run history into Practice/Journey game-over screens.
- Any change to scoring or the stat definitions themselves.
