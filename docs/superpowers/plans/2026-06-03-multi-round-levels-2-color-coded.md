# Multi-Round Levels — Plan 2: Color-coded Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Round 2 of a practice level the **Color-coded** theme — gaps drawn with dashed *colored* borders, where the player must pick pieces matching each gap's **shape AND color**.

**Architecture:** Additive, behind the existing `RoundTheme` machinery from Plan 1. We (a) give `Gap` an optional `color`, (b) teach the puzzle generator a color-coded mode (single shape type, distinct palette colors at Vacant Heights), (c) add a `color` dimension to the selection cart and a single theme-aware resolver `resolveSelection` that partitions by color and reuses today's `solve`/`bestFit` per color group, and (d) render a color palette menu + per-gap colored borders. The Basic/Journey paths are preserved unchanged (color is always `undefined` there, so every new branch is a no-op for them). The ordered-token generalization from the design §6 is deliberately **deferred to Plan 3 (Sequential)**, where order actually matters — Plan 2 only needs the color dimension (DRY/YAGNI).

**Tech Stack:** React 18, Zustand 5 (object selectors via `useShallow`), TypeScript, Vite, Vitest + jsdom, Tailwind CSS. `@shared/*` alias → `supabase/functions/_shared`. Pure logic lives in `_shared/core` and `_shared/engine` so it can lift to the server later.

**Environment constraints (read before running anything):**
- The repo uses **nvm**: chained bash commands (`a && b`) fail with `__init_nvm` errors. Run each command as a **separate** Bash call.
- `npx tsc --noEmit` is a **no-op** here (solution-style tsconfig with project references). Type-check with **`npm run build`** (which also enforces `noUnusedLocals`) or `npx tsc -b`.
- Tests: `npm run test -- <path>` (Vitest, globals enabled, jsdom).
- Lint: `npm run lint` (eslint; unused imports/vars fail the build).

---

## File Structure

**Created:**
- `supabase/functions/_shared/core/themeConfig.ts` — `ThemeConfig`, `THEME_CONFIG` (`orderMatters`/`colorMatters` per theme), and `GAP_COLOR_IDS` (the 8 palette ids). Pure, shared.
- `supabase/functions/_shared/core/themeResolution.ts` — `resolveSelection(...)`: the single theme-aware validator. Colorblind passthrough for non-color themes; per-color partition for color-coded. Reuses `solve`/`bestFit`. Pure, shared.
- `src/lib/gapPalette.ts` — maps a palette id (`'green'`, …) to literal Tailwind class strings (`border-green-400`, `bg-green-400`). Client-only; keeps Tailwind class strings out of shared logic.
- `tests/core/themeResolution.test.ts`, `tests/engine/puzzleGenerator.colorCoded.test.ts`, `tests/store/gameStore.colorCoded.test.ts`, `tests/components/SelectingPhase.colorCoded.test.tsx`, additions to `tests/components/GapBorder.test.tsx`.

**Modified:**
- `supabase/functions/_shared/types.ts` — `Gap.color?: string`; `SelectionEntry.color?: string`.
- `supabase/functions/_shared/engine/puzzleGenerator.ts` — `colorCoded?: { shapeTypeCount; palette }` input knob; single-shape restriction + distinct color assignment.
- `src/store/gameStore.ts` — `incrementSelection`/`decrementSelection` keyed by `(pieceType, color?)`; `submitSelection` routes through `resolveSelection`; `startGame` generates a color-coded board for color-coded rounds; flip `THEME_SEQUENCE`.
- `src/components/PieceShape.tsx` — optional `colorClass` override.
- `src/components/SelectingPhase.tsx` — color-coded palette menu + color-aware cart.
- `src/components/GapBorder.tsx` — per-gap border color from `gap.color`.

---

## Task 1: Types, theme config, and color-coded generation

**Files:**
- Modify: `supabase/functions/_shared/types.ts`
- Create: `supabase/functions/_shared/core/themeConfig.ts`
- Modify: `supabase/functions/_shared/engine/puzzleGenerator.ts`
- Test: `tests/engine/puzzleGenerator.colorCoded.test.ts`

- [ ] **Step 1: Add the optional `color` fields to the shared types**

In `supabase/functions/_shared/types.ts`, add `color?` to `Gap` (after `cells`) and to `SelectionEntry`:

```ts
/** A set of cells that form one tetromino-shaped gap in the grid */
export interface Gap {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: PieceCells  // absolute [row, col] positions
  color?: string     // palette id (color-coded rounds); undefined for monochrome themes
}
```

```ts
export interface SelectionEntry {
  pieceType: PieceType
  color?: string        // palette id when the theme is color-coded; undefined otherwise
  freeCount: number     // freely added this round — can decrement to 0
}
```

- [ ] **Step 2: Create the theme config module**

Create `supabase/functions/_shared/core/themeConfig.ts`:

```ts
import type { RoundTheme } from '../types.ts'

/** Per-theme interpretation flags for the unified selection resolver. */
export interface ThemeConfig {
  /** Sequential: the k-th pick must match the gap labelled k. (Plan 3.) */
  orderMatters: boolean
  /** Color-coded: a piece must match its gap's color as well as its shape. */
  colorMatters: boolean
}

export const THEME_CONFIG: Record<RoundTheme, ThemeConfig> = {
  basic:       { orderMatters: false, colorMatters: false },
  colorCoded:  { orderMatters: false, colorMatters: true },
  sequential:  { orderMatters: true,  colorMatters: false },
  flashMob:    { orderMatters: false, colorMatters: false },
}

/** The 8-color palette for color-coded gaps. Stored on gaps as plain ids so the
 *  shared logic stays free of Tailwind class strings; the client maps ids →
 *  classes in src/lib/gapPalette.ts. Decoupled from piece-type colors by design. */
export const GAP_COLOR_IDS = [
  'green', 'red', 'blue', 'yellow', 'orange', 'purple', 'pink', 'indigo',
] as const
```

- [ ] **Step 3: Write the failing generator test**

Create `tests/engine/puzzleGenerator.colorCoded.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { GAP_COLOR_IDS } from '@shared/core/themeConfig'
import { makeRng } from '@shared/core/prng'

describe('generatePuzzle color-coded mode', () => {
  it('uses a single shape type across all gaps when shapeTypeCount is 1', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 3, complexity: 'simple', colorCoded: { shapeTypeCount: 1, palette: [...GAP_COLOR_IDS] } },
      makeRng('cc-seed'),
    )
    expect(gaps).toHaveLength(3)
    const shapes = new Set(gaps.map(g => g.pieceType))
    expect(shapes.size).toBe(1)
  })

  it('assigns a distinct palette color to each gap (Vacant Heights)', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 3, complexity: 'simple', colorCoded: { shapeTypeCount: 1, palette: [...GAP_COLOR_IDS] } },
      makeRng('cc-seed'),
    )
    const colors = gaps.map(g => g.color)
    expect(colors.every(c => c !== undefined)).toBe(true)
    expect(new Set(colors).size).toBe(gaps.length) // all distinct
    colors.forEach(c => expect(GAP_COLOR_IDS).toContain(c))
  })

  it('leaves gaps uncolored when colorCoded is omitted (basic back-compat)', () => {
    const { gaps } = generatePuzzle({ gapCount: 3, complexity: 'simple' }, makeRng('cc-seed'))
    expect(gaps.every(g => g.color === undefined)).toBe(true)
  })
})
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm run test -- tests/engine/puzzleGenerator.colorCoded.test.ts`
Expected: FAIL — `colorCoded` input not handled; colors are `undefined`.

- [ ] **Step 5: Implement the color-coded generator mode**

In `supabase/functions/_shared/engine/puzzleGenerator.ts`, extend the input type and add a single-shape restriction + color assignment. Replace the `PuzzleInput` type and the body of `generatePuzzle` as follows (helpers added above `generatePuzzle`):

```ts
type PuzzleInput = Pick<DifficultyConfig, 'gapCount' | 'complexity'> & {
  adjacency?: number
  /** When set, restrict the puzzle to `shapeTypeCount` shape(s) and assign each
   *  gap a distinct color from `palette` (color-coded theme). */
  colorCoded?: { shapeTypeCount: number; palette: string[] }
}

// Fisher–Yates shuffle of a COPY, driven by the seeded rng.
function shuffled<T>(items: T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

Then inside `generatePuzzle`, after `const allowedTypes = COMPLEXITY_PIECES[complexity]`, narrow the types when color-coded, and after the placement loop assign colors. The full edited function:

```ts
export function generatePuzzle(
  input: PuzzleInput,
  rng: () => number = Math.random
): { grid: Grid; gaps: Gap[] } {
  const { gapCount, complexity } = input
  const adjacency = input.adjacency ?? 0
  const allowedTypes = input.colorCoded
    ? shuffled(COMPLEXITY_PIECES[complexity], rng).slice(0, Math.max(1, input.colorCoded.shapeTypeCount))
    : COMPLEXITY_PIECES[complexity]
  const grid = makeFullGrid()
  const gaps: Gap[] = []

  let attempts = 0
  while (gaps.length < gapCount && attempts < 4000) {
    attempts++
    const pieceType = allowedTypes[Math.floor(rng() * allowedTypes.length)]
    const rotations = getAllRotations(pieceType)
    const { rotation, cells } = rotations[Math.floor(rng() * rotations.length)]

    const maxRow = ROWS - Math.max(...cells.map(([r]) => r)) - 1
    const maxCol = COLS - Math.max(...cells.map(([, c]) => c)) - 1
    if (maxRow < 0 || maxCol < 0) continue

    const candidates: [number, number][] = []
    for (let r = 0; r <= maxRow; r++) {
      for (let c = 0; c <= maxCol; c++) {
        if (cellsAreFree(grid, cells, r, c)) candidates.push([r, c])
      }
    }
    if (candidates.length === 0) continue

    const near =
      adjacency > 0
        ? candidates.filter(([r, c]) => anchorTouchesEmpty(grid, cells, r, c))
        : []
    const pool = near.length > 0 ? near : candidates
    const [anchorRow, anchorCol] = pool[Math.floor(rng() * pool.length)]

    const absoluteCells = cells.map(([r, c]) => [r + anchorRow, c + anchorCol] as [number, number])
    placeGap(grid, cells, anchorRow, anchorCol)
    gaps.push({ pieceType, rotation, anchorRow, anchorCol, cells: absoluteCells })
  }

  // Color-coded: assign each gap a distinct palette color (shuffled by rng).
  if (input.colorCoded) {
    const palette = shuffled(input.colorCoded.palette, rng)
    gaps.forEach((gap, i) => { gap.color = palette[i % palette.length] })
  }

  return { grid, gaps }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test -- tests/engine/puzzleGenerator.colorCoded.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Type-check + commit**

Run: `npm run build`
Expected: clean.

```bash
git add supabase/functions/_shared/types.ts supabase/functions/_shared/core/themeConfig.ts supabase/functions/_shared/engine/puzzleGenerator.ts tests/engine/puzzleGenerator.colorCoded.test.ts
git commit -m "feat(generator): color-coded puzzle mode (single shape, distinct gap colors)"
```

---

## Task 2: The theme-aware selection resolver

**Files:**
- Create: `supabase/functions/_shared/core/themeResolution.ts`
- Test: `tests/core/themeResolution.test.ts`

Background: today `submitSelection` builds a `pieceType → count` tally and calls `solve(tally, grid, gaps)` for the clear, `bestFit(tally, grid)` for the fail/coverage. We generalize that into one function that the store calls for every theme. For color-coded, it partitions gaps and selection by color, builds a per-color subgrid (only that color's gap cells stay `empty`), and runs `solve`/`bestFit` per color group. A clear requires **every** color group to solve exactly.

- [ ] **Step 1: Write the failing resolver test**

Create `tests/core/themeResolution.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveSelection } from '@shared/core/themeResolution'
import type { Grid, Gap, Cell, SelectionEntry } from '@shared/types'
import { ROWS, COLS } from '@shared/types'

// Build a full grid, then carve the given gaps as empty cells.
function gridWith(gaps: Gap[]): Grid {
  const grid: Grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' })))
  for (const g of gaps) for (const [r, c] of g.cells) grid[r][c] = { status: 'empty' }
  return grid
}

// Two O-gaps of different colors.
const greenO: Gap = { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
  cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: 'green' }
const redO: Gap = { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 4,
  cells: [[0, 4], [0, 5], [1, 4], [1, 5]], color: 'red' }
const gaps = [greenO, redO]

describe('resolveSelection — color-coded', () => {
  it('clears when each gap is matched by a same-color piece', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'O', color: 'green', freeCount: 1 },
      { pieceType: 'O', color: 'red', freeCount: 1 },
    ]
    const res = resolveSelection({ selection, grid: gridWith(gaps), gaps, theme: 'colorCoded' })
    expect(res.solvable).toBe(true)
    expect(res.coverage).toBe(1)
    expect(res.placements).toHaveLength(2)
  })

  it('fails when colors are swapped even though shapes fit', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'O', color: 'red', freeCount: 1 },
      { pieceType: 'O', color: 'blue', freeCount: 1 },
    ]
    const res = resolveSelection({ selection, grid: gridWith(gaps), gaps, theme: 'colorCoded' })
    expect(res.solvable).toBe(false)
  })

  it('reports partial coverage when only one color is satisfied', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'O', color: 'green', freeCount: 1 },
    ]
    const res = resolveSelection({ selection, grid: gridWith(gaps), gaps, theme: 'colorCoded' })
    expect(res.solvable).toBe(false)
    expect(res.filledCells).toBe(4)   // green O placed
    expect(res.totalCells).toBe(8)    // both gaps
    expect(res.coverage).toBeCloseTo(0.5)
  })
})

describe('resolveSelection — basic (colorblind passthrough)', () => {
  const basicGaps = [{ ...greenO, color: undefined }, { ...redO, color: undefined }]
  it('clears on shape-only tally, ignoring color', () => {
    const selection: SelectionEntry[] = [{ pieceType: 'O', freeCount: 2 }]
    const res = resolveSelection({ selection, grid: gridWith(basicGaps), gaps: basicGaps, theme: 'basic' })
    expect(res.solvable).toBe(true)
    expect(res.coverage).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/core/themeResolution.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the resolver**

Create `supabase/functions/_shared/core/themeResolution.ts`:

```ts
import type { Grid, Gap, PieceType, Placement, SelectionEntry, RoundTheme } from '../types.ts'
import { solve, bestFit } from '../engine/solver.ts'
import { THEME_CONFIG } from './themeConfig.ts'

export interface ResolveResult {
  solvable: boolean
  placements: Placement[]
  coverage: number      // 1 on a clear; filledCells/totalCells otherwise
  filledCells: number
  totalCells: number
}

type PieceCount = Partial<Record<PieceType, number>>

function emptyCount(grid: Grid): number {
  return grid.flat().filter(c => c.status === 'empty').length
}

function tally(entries: SelectionEntry[]): PieceCount {
  const t: PieceCount = {}
  for (const e of entries) if (e.freeCount > 0) t[e.pieceType] = (t[e.pieceType] ?? 0) + e.freeCount
  return t
}

// A clone of `grid` where only `color`'s gap cells remain empty — every other
// gap's cells are refilled, so solve/bestFit see one color group in isolation.
function subgridForColor(grid: Grid, gaps: Gap[], color: string | undefined): Grid {
  const g = grid.map(row => row.map(cell => ({ ...cell })))
  for (const gap of gaps) {
    if (gap.color !== color) for (const [r, c] of gap.cells) g[r][c] = { status: 'filled' }
  }
  return g
}

export function resolveSelection(args: {
  selection: SelectionEntry[]
  grid: Grid
  gaps: Gap[]
  theme: RoundTheme
}): ResolveResult {
  const { selection, grid, gaps, theme } = args
  const { colorMatters } = THEME_CONFIG[theme]

  if (!colorMatters) {
    const pieceCount = tally(selection)
    const total = emptyCount(grid)
    const res = solve(pieceCount, grid, gaps)
    if (res.solvable) {
      return { solvable: true, placements: res.placements ?? [], coverage: 1, filledCells: total, totalCells: total }
    }
    const fit = bestFit(pieceCount, grid)
    return {
      solvable: false,
      placements: fit.placements,
      coverage: fit.totalCells === 0 ? 0 : fit.filledCells / fit.totalCells,
      filledCells: fit.filledCells,
      totalCells: fit.totalCells,
    }
  }

  // Color-coded: solve each color group independently against its subgrid.
  const colors = [...new Set([
    ...gaps.map(g => g.color),
    ...selection.map(s => s.color),
  ])].filter((c): c is string => c !== undefined)

  const placements: Placement[] = []
  let allSolvable = true
  let filled = 0
  let total = 0

  for (const color of colors) {
    const colorGaps = gaps.filter(g => g.color === color)
    const colorGrid = subgridForColor(grid, gaps, color)
    const colorTally = tally(selection.filter(s => s.color === color))
    total += emptyCount(colorGrid)

    const res = solve(colorTally, colorGrid, colorGaps)
    if (res.solvable) {
      filled += emptyCount(colorGrid)
      placements.push(...(res.placements ?? []))
    } else {
      allSolvable = false
      const fit = bestFit(colorTally, colorGrid)
      filled += fit.filledCells
      placements.push(...fit.placements)
    }
  }

  return {
    solvable: allSolvable,
    placements,
    coverage: total === 0 ? 0 : filled / total,
    filledCells: filled,
    totalCells: total,
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/core/themeResolution.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check + commit**

Run: `npm run build`
Expected: clean.

```bash
git add supabase/functions/_shared/core/themeResolution.ts tests/core/themeResolution.test.ts
git commit -m "feat(core): theme-aware selection resolver (color partition + colorblind passthrough)"
```

---

## Task 3: Color-aware selection cart + route the store through the resolver

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.colorCoded.test.ts`

- [ ] **Step 1: Write the failing store test**

Create `tests/store/gameStore.colorCoded.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../../src/store/gameStore'
import type { Gap, Cell, Grid } from '@shared/types'
import { ROWS, COLS } from '@shared/types'

function gridWith(gaps: Gap[]): Grid {
  const grid: Grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' })))
  for (const g of gaps) for (const [r, c] of g.cells) grid[r][c] = { status: 'empty' }
  return grid
}

const greenO: Gap = { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
  cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: 'green' }
const redO: Gap = { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 4,
  cells: [[0, 4], [0, 5], [1, 4], [1, 5]], color: 'red' }

beforeEach(() => { useGameStore.getState().resetGame() })

describe('color-aware selection cart', () => {
  it('keys selection entries by (pieceType, color)', () => {
    const { incrementSelection } = useGameStore.getState()
    incrementSelection('O', 'green')
    incrementSelection('O', 'green')
    incrementSelection('O', 'red')
    const sel = useGameStore.getState().selection
    expect(sel).toHaveLength(2)
    expect(sel.find(e => e.color === 'green')?.freeCount).toBe(2)
    expect(sel.find(e => e.color === 'red')?.freeCount).toBe(1)
  })

  it('decrements the matching (pieceType, color) entry only', () => {
    const { incrementSelection, decrementSelection } = useGameStore.getState()
    incrementSelection('O', 'green')
    incrementSelection('O', 'red')
    decrementSelection('O', 'green')
    const sel = useGameStore.getState().selection
    expect(sel).toHaveLength(1)
    expect(sel[0].color).toBe('red')
  })

  it('clears a color-coded round when shapes AND colors match', () => {
    const gaps = [greenO, redO]
    useGameStore.setState({
      phase: 'selecting', roundTheme: 'colorCoded', grid: gridWith(gaps), gaps,
      difficulty: { viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 2, complexity: 'simple' },
      phaseStartTime: Date.now(), viewTimeRemaining: 0, livesRemaining: 3,
      selection: [
        { pieceType: 'O', color: 'green', freeCount: 1 },
        { pieceType: 'O', color: 'red', freeCount: 1 },
      ],
    })
    useGameStore.getState().submitSelection()
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('perfect')
    expect(s.livesRemaining).toBe(3) // a clear costs no life
    expect(s.roundScore?.total).toBeGreaterThan(0)
  })

  it('fails a color-coded round on wrong colors and spends a life', () => {
    const gaps = [greenO, redO]
    useGameStore.setState({
      phase: 'selecting', roundTheme: 'colorCoded', grid: gridWith(gaps), gaps,
      difficulty: { viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 2, complexity: 'simple' },
      phaseStartTime: Date.now(), viewTimeRemaining: 0, livesRemaining: 3,
      selection: [
        { pieceType: 'O', color: 'blue', freeCount: 1 },
        { pieceType: 'O', color: 'pink', freeCount: 1 },
      ],
    })
    useGameStore.getState().submitSelection()
    const s = useGameStore.getState()
    expect(s._resolution?.kind).toBe('partial')
    expect(s.livesRemaining).toBe(2)
    expect(s.roundScore?.total).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/store/gameStore.colorCoded.test.ts`
Expected: FAIL — `incrementSelection` ignores the color arg; `submitSelection` is colorblind.

- [ ] **Step 3: Update the store interface signatures**

In `src/store/gameStore.ts`, change the `GameStore` interface lines for increment/decrement:

```ts
  incrementSelection: (pieceType: PieceType, color?: string) => void
  decrementSelection: (pieceType: PieceType, color?: string) => void
```

- [ ] **Step 4: Make increment/decrement color-aware**

Replace the `incrementSelection` and `decrementSelection` implementations:

```ts
  incrementSelection: (pieceType: PieceType, color?: string) => {
    set(state => {
      const existing = state.selection.find(e => e.pieceType === pieceType && e.color === color)
      if (existing) {
        return {
          selection: state.selection.map(e =>
            e.pieceType === pieceType && e.color === color ? { ...e, freeCount: e.freeCount + 1 } : e
          ),
        }
      }
      return { selection: [...state.selection, { pieceType, color, freeCount: 1 }] }
    })
  },

  decrementSelection: (pieceType: PieceType, color?: string) => {
    set(state => ({
      selection: state.selection
        .map(e =>
          e.pieceType === pieceType && e.color === color
            ? { ...e, freeCount: Math.max(0, e.freeCount - 1) }
            : e
        )
        .filter(e => e.freeCount > 0),
    }))
  },
```

- [ ] **Step 5: Route `submitSelection` through `resolveSelection`**

Add the import near the other `@shared` imports at the top of `src/store/gameStore.ts`:

```ts
import { resolveSelection } from '@shared/core/themeResolution'
```

Replace the entire `submitSelection` implementation with:

```ts
  submitSelection: () => {
    const { selection, grid, gaps, difficulty, phaseStartTime, viewTimeRemaining, roundTheme } = get()

    const selectElapsed = Date.now() - phaseStartTime
    const selectTimeRemaining = Math.max(0, difficulty.selectDuration - selectElapsed)
    const res = resolveSelection({ selection, grid, gaps, theme: roundTheme })
    const selectedPieces = selection.reduce((s, e) => s + e.freeCount, 0)

    if (res.solvable) {
      // Per-round scoring: Speed + Efficiency only (no Accuracy/Attempts).
      const minPieces = gaps.length
      const r = scoreRound({
        viewTimeRemaining,
        viewDuration: difficulty.viewDuration,
        selectTimeRemaining,
        selectDuration: difficulty.selectDuration,
        minPieces,
        selectedPieces,
        selectOnly: roundTheme === 'flashMob',
      })
      set({
        phase: 'resolving',
        _resolution: { kind: 'perfect', placements: res.placements, coverage: 1 },
        roundScore: {
          accuracy: 0, speedBonus: r.speed, efficiencyBonus: r.efficiency,
          attemptsBonus: 0, stars: 0, total: r.total,
        },
      })
    } else {
      const uncovered = res.totalCells - res.filledCells
      const selectedCells = selection.reduce(
        (sum, e) => sum + e.freeCount * (e.pieceType === 'SINGLE' ? 1 : 4), 0)
      let reason: ResolutionReason
      if (uncovered === 0) reason = 'too-many'
      else if (selectedCells >= res.totalCells) reason = 'wrong-shapes'
      else reason = Math.max(1, Math.round(uncovered / 4)) === 1 ? 'missed-one' : 'missed-many'

      // A failed round spends one pooled life (retry replays the same board).
      get().loseLife()
      set({
        phase: 'resolving',
        _resolution: { kind: 'partial', placements: res.placements, coverage: res.coverage, reason },
        roundScore: {
          accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0,
        },
      })
    }
  },
```

Note: the unused `solve`/`bestFit`/`PieceType`-tally code that used to live in `submitSelection` is now gone. `solve`/`bestFit` may still be imported if used elsewhere — check the import line `import { solve, bestFit } from '@shared/engine/solver'`. If `npm run build` flags them as unused after this change, remove the now-dead import (search the file for `solve(` / `bestFit(` first; Journey's `submitJourneyAttempt` does **not** use them — it calls the server). Keep `scoreRound`, `MAX_TRIES`, `levelTotal`, `ROUNDS_PER_LEVEL`, `MAX_LIVES`.

- [ ] **Step 6: Run the store tests**

Run: `npm run test -- tests/store/gameStore.colorCoded.test.ts`
Expected: PASS (4 tests).

Run: `npm run test -- tests/store/`
Expected: PASS — confirms the existing Basic store tests (`gameStore.test.ts`, `gameStore.level.test.ts`) still pass with the colorblind passthrough.

- [ ] **Step 7: Type-check + commit**

Run: `npm run build`
Expected: clean.

```bash
git add src/store/gameStore.ts tests/store/gameStore.colorCoded.test.ts
git commit -m "feat(store): color-aware selection cart; submitSelection via resolveSelection"
```

---

## Task 4: Color palette styling + per-gap colored borders

**Files:**
- Create: `src/lib/gapPalette.ts`
- Modify: `src/components/GapBorder.tsx`
- Test: `tests/components/GapBorder.test.tsx`

- [ ] **Step 1: Create the palette class map**

Create `src/lib/gapPalette.ts`. Class strings are **full literals** so Tailwind's content scanner keeps them in the bundle (templated class names would be purged):

```ts
// Maps a palette id (stored on Gap.color) to literal Tailwind classes.
// Kept client-side so shared logic never references Tailwind class strings.

const BORDER: Record<string, string> = {
  green: 'border-green-400',
  red: 'border-red-400',
  blue: 'border-blue-400',
  yellow: 'border-yellow-400',
  orange: 'border-orange-400',
  purple: 'border-purple-400',
  pink: 'border-pink-400',
  indigo: 'border-indigo-400',
}

const FILL: Record<string, string> = {
  green: 'bg-green-400',
  red: 'bg-red-400',
  blue: 'bg-blue-400',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-400',
  purple: 'bg-purple-400',
  pink: 'bg-pink-400',
  indigo: 'bg-indigo-400',
}

/** Border-color class for a gap's palette id (falls back to a neutral border). */
export function gapBorderClass(id: string | undefined): string {
  return (id && BORDER[id]) || 'border-gray-300/70'
}

/** Fill (bg) class for a gap's palette id (falls back to neutral gray). */
export function gapFillClass(id: string | undefined): string {
  return (id && FILL[id]) || 'bg-gray-400'
}
```

- [ ] **Step 2: Write the failing GapBorder test (append to the existing file)**

In `tests/components/GapBorder.test.tsx`, add inside the existing `describe('GapBorder', () => { ... })` block:

```tsx
  it('applies the per-gap palette border color when gap.color is set', () => {
    const colored: Gap = {
      pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: 'green',
    }
    const { container } = render(<GapBorder gaps={[colored]} />)
    const wrapper = container.querySelector('[data-gap-border]')!
    // every drawn edge cell carries the green border class
    const cells = wrapper.querySelectorAll('div')
    expect([...cells].some(el => el.className.includes('border-green-400'))).toBe(true)
  })
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -- tests/components/GapBorder.test.tsx`
Expected: FAIL — borders use the default gray, not `border-green-400`.

- [ ] **Step 4: Make GapBorder color each gap by `gap.color`**

In `src/components/GapBorder.tsx`, import the palette helper and use it per gap. Replace the import line and the `gaps.map` body:

```tsx
import type { Gap } from '@shared/types'
import { gapBorderClass } from '../lib/gapPalette'
```

```tsx
      {gaps.map((gap, gi) => {
        const inGap = new Set(gap.cells.map(([r, c]) => `${r},${c}`))
        const borderColor = gap.color ? gapBorderClass(gap.color) : colorClass
        return (
          <div key={gi} data-gap-border>
            {gap.cells.map(([r, c]) => {
              const edges: string[] = []
              if (!inGap.has(`${r - 1},${c}`)) edges.push('border-t-2')
              if (!inGap.has(`${r + 1},${c}`)) edges.push('border-b-2')
              if (!inGap.has(`${r},${c - 1}`)) edges.push('border-l-2')
              if (!inGap.has(`${r},${c + 1}`)) edges.push('border-r-2')
              return (
                <div
                  key={`${r},${c}`}
                  className={`absolute border-dashed ${borderColor} ${edges.join(' ')}`}
                  style={{ left: px(c), top: px(r), width: CELL, height: CELL }}
                />
              )
            })}
          </div>
        )
      })}
```

(The `colorClass` prop is retained as the default for monochrome themes.)

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/components/GapBorder.test.tsx`
Expected: PASS (3 tests — the 2 originals + the new colored one).

- [ ] **Step 6: Type-check + commit**

Run: `npm run build`
Expected: clean.

```bash
git add src/lib/gapPalette.ts src/components/GapBorder.tsx tests/components/GapBorder.test.tsx
git commit -m "feat(viewing): per-gap palette border colors for color-coded gaps"
```

---

## Task 5: Color palette selection menu + color-aware cart

**Files:**
- Modify: `src/components/PieceShape.tsx`
- Modify: `src/components/SelectingPhase.tsx`
- Test: `tests/components/SelectingPhase.colorCoded.test.tsx`

- [ ] **Step 1: Add a `colorClass` override to PieceShape**

In `src/components/PieceShape.tsx`, add the prop and use it instead of the piece's own color when provided:

```tsx
interface Props {
  pieceType: PieceType
  rotation?: Rotation
  cellSize?: number  // px
  dim?: boolean
  colorClass?: string  // override the piece-type color (e.g. color-coded palette)
}

export function PieceShape({ pieceType, rotation = 0, cellSize = 14, dim = false, colorClass }: Props) {
  const cells = getRotatedCells(pieceType, rotation)
  const maxRow = Math.max(...cells.map(([r]) => r))
  const maxCol = Math.max(...cells.map(([, c]) => c))
  const color = colorClass ?? getPieceColor(pieceType)
  const occupied = new Set(cells.map(([r, c]) => `${r},${c}`))
```

(The rest of the component is unchanged — it already renders `${color} rounded-sm`.)

- [ ] **Step 2: Write the failing SelectingPhase test**

Create `tests/components/SelectingPhase.colorCoded.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectingPhase } from '../../src/components/SelectingPhase'
import { useGameStore } from '../../src/store/gameStore'
import { GAP_COLOR_IDS } from '@shared/core/themeConfig'
import type { Gap } from '@shared/types'

const greenO: Gap = { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
  cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: 'green' }

beforeEach(() => {
  useGameStore.getState().resetGame()
  useGameStore.setState({
    phase: 'selecting', roundTheme: 'colorCoded', gaps: [greenO], selection: [],
    phaseStartTime: Date.now(),
    phaseDuration: 10000,
    difficulty: { viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 1, complexity: 'simple' },
  })
})

describe('SelectingPhase — color-coded menu', () => {
  it('renders the round shape once per palette color (one shape × 8 colors)', () => {
    render(<SelectingPhase />)
    // The color-coded menu buttons carry a data-color attribute per palette id.
    const buttons = document.querySelectorAll('[data-color-option]')
    expect(buttons).toHaveLength(GAP_COLOR_IDS.length)
  })

  it('adds a colored token to the cart when a palette button is tapped', () => {
    render(<SelectingPhase />)
    const greenBtn = document.querySelector('[data-color-option="green"]') as HTMLButtonElement
    fireEvent.click(greenBtn)
    const sel = useGameStore.getState().selection
    expect(sel).toHaveLength(1)
    expect(sel[0]).toMatchObject({ pieceType: 'O', color: 'green', freeCount: 1 })
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -- tests/components/SelectingPhase.colorCoded.test.tsx`
Expected: FAIL — no `[data-color-option]` buttons (the basic menu renders).

- [ ] **Step 4: Branch the menu and color the cart in SelectingPhase**

Rewrite `src/components/SelectingPhase.tsx`. Add `roundTheme` + `gaps` to the selector, import the theme config + palette, derive `colorMatters` and the round's unique shapes, branch the menu, and render the cart with the per-entry palette color:

```tsx
import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useNavStore } from '../store/navStore'
import { useShallow } from 'zustand/shallow'
import { PIECE_DEFINITIONS } from '@shared/engine/pieces'
import { THEME_CONFIG, GAP_COLOR_IDS } from '@shared/core/themeConfig'
import { gapFillClass } from '../lib/gapPalette'
import { PieceShape } from './PieceShape'
import { NeonButton, ArcadePanel } from './ui'
import type { PieceType } from '@shared/types'

export function SelectingPhase() {
  const {
    selection, incrementSelection, decrementSelection,
    submit, phaseStartTime, phaseDuration, roundTheme, gaps,
  } = useGameStore(useShallow(s => ({
    selection: s.selection,
    incrementSelection: s.incrementSelection,
    decrementSelection: s.decrementSelection,
    submit: s.submit,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
    roundTheme: s.roundTheme,
    gaps: s.gaps,
  })))
  const journeyError = useGameStore(s => s.journeyError)
  const backToMap = useNavStore(s => s.backToMap)

  useEffect(() => {
    const remaining = Math.max(0, phaseStartTime + phaseDuration - Date.now())
    const timer = setTimeout(submit, remaining)
    return () => clearTimeout(timer)
  }, [phaseStartTime, phaseDuration, submit])

  const colorMatters = THEME_CONFIG[roundTheme].colorMatters
  // The shapes that actually appear in this round's gaps (1 at Vacant Heights).
  const roundShapes = [...new Set(gaps.map(g => g.pieceType))]

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      {journeyError && (
        <div className="bg-arcade-panel border-2 border-neon-red rounded-md p-3 text-sm text-neon-red flex items-center justify-between gap-3">
          <span>Couldn’t submit: {journeyError}</span>
          <NeonButton variant="danger" size="sm" onClick={backToMap} className="shrink-0">
            Back to Map
          </NeonButton>
        </div>
      )}

      {/* Selection box */}
      <ArcadePanel className="p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan">Your Selection</span>
          <span className="text-[10px] text-gray-500">tap selected to decrement</span>
        </div>
        <div className="flex gap-2 flex-wrap min-h-[52px] items-center">
          {selection.filter(e => e.freeCount > 0).map(entry => (
            <button
              key={`${entry.pieceType}:${entry.color ?? ''}`}
              onClick={() => decrementSelection(entry.pieceType, entry.color)}
              className="flex flex-col items-center gap-1 p-2 rounded-md border-2 text-xs
                border-neon-cyan bg-arcade-well text-neon-cyan cursor-pointer hover:bg-arcade-panel"
            >
              <PieceShape pieceType={entry.pieceType} cellSize={11}
                colorClass={entry.color ? gapFillClass(entry.color) : undefined} />
              <span>×{entry.freeCount}</span>
            </button>
          ))}
          {selection.length === 0 && (
            <span className="text-xs text-gray-600 italic">No pieces selected</span>
          )}
        </div>
      </ArcadePanel>

      {/* Piece menu */}
      <ArcadePanel className="p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan">Pieces</span>
          <span className="text-[10px] text-gray-500">tap to increment</span>
        </div>
        {colorMatters ? (
          <div className="grid grid-cols-4 gap-2">
            {roundShapes.flatMap(shape =>
              GAP_COLOR_IDS.map(colorId => (
                <button
                  key={`${shape}:${colorId}`}
                  data-color-option={colorId}
                  onClick={() => incrementSelection(shape, colorId)}
                  className="flex items-center justify-center p-2 bg-arcade-well border-2 border-arcade-edge
                    rounded-md hover:border-neon-cyan cursor-pointer"
                >
                  <PieceShape pieceType={shape} cellSize={11} colorClass={gapFillClass(colorId)} />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {PIECE_DEFINITIONS.map(def => (
              <button
                key={def.type}
                onClick={() => incrementSelection(def.type as PieceType)}
                className="flex flex-col items-center gap-1 p-2 bg-arcade-well border-2 border-arcade-edge
                  rounded-md hover:border-neon-cyan cursor-pointer"
              >
                <PieceShape pieceType={def.type} cellSize={11} />
                <span className="font-pixel text-[9px] text-gray-400">{def.type}</span>
              </button>
            ))}
          </div>
        )}
      </ArcadePanel>

      <NeonButton fullWidth variant="go" onClick={submit}>
        Done ✓
      </NeonButton>
    </div>
  )
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/components/SelectingPhase.colorCoded.test.tsx`
Expected: PASS (2 tests).

Run: `npm run test -- tests/components/`
Expected: PASS — confirms the Basic menu still renders for non-color themes.

- [ ] **Step 6: Type-check + commit**

Run: `npm run build`
Expected: clean.

```bash
git add src/components/PieceShape.tsx src/components/SelectingPhase.tsx tests/components/SelectingPhase.colorCoded.test.tsx
git commit -m "feat(selecting): color palette menu + color-aware selection cart"
```

---

## Task 6: Wire Round 2 to the Color-coded theme

**Files:**
- Modify: `supabase/functions/_shared/types.ts`
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.colorCoded.test.ts` (append an integration test)

- [ ] **Step 1: Write the failing integration test**

Append to `tests/store/gameStore.colorCoded.test.ts` (inside a new describe at the end of the file):

```ts
describe('round 2 is color-coded', () => {
  it('startLevel→advance to round 2 generates colored gaps of a single shape', () => {
    const store = useGameStore.getState()
    store.startPractice()             // round 1 (basic)
    // Force a clear of round 1 by advancing with a scored round.
    useGameStore.setState({ roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 100 } })
    useGameStore.getState().advanceRound()  // → round 2
    const s = useGameStore.getState()
    expect(s.roundIndex).toBe(1)
    expect(s.roundTheme).toBe('colorCoded')
    expect(s.gaps.length).toBeGreaterThan(0)
    expect(s.gaps.every(g => g.color !== undefined)).toBe(true)
    expect(new Set(s.gaps.map(g => g.pieceType)).size).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/store/gameStore.colorCoded.test.ts`
Expected: FAIL — `roundTheme` for round 2 is still `'basic'`; gaps have no color.

- [ ] **Step 3: Flip the theme sequence**

In `supabase/functions/_shared/types.ts`, change `THEME_SEQUENCE`:

```ts
export const THEME_SEQUENCE: RoundTheme[] = ['basic', 'colorCoded', 'basic', 'basic']
```

- [ ] **Step 4: Generate a color-coded board in `startGame`**

In `src/store/gameStore.ts`, add the imports (extend the existing themeConfig import or add a new one):

```ts
import { THEME_CONFIG, GAP_COLOR_IDS } from '@shared/core/themeConfig'
```

Replace the `startGame` implementation so it reads the round theme up front and feeds the color-coded knob to the generator:

```ts
  startGame: () => {
    const { round, roundIndex } = get()
    const roundTheme = THEME_SEQUENCE[roundIndex]
    const difficulty = getDifficulty(round)
    const colorCoded = THEME_CONFIG[roundTheme].colorMatters
    const { grid, gaps } = generatePuzzle(
      colorCoded
        ? {
            gapCount: difficulty.gapCount,
            complexity: difficulty.complexity,
            colorCoded: { shapeTypeCount: 1, palette: [...GAP_COLOR_IDS] },
          }
        : difficulty
    )

    // The round opens with a 3-2-1 countdown; the view timer starts only
    // once beginViewing fires, so memorization time isn't eaten by the count.
    // sessionGrid keeps the pristine board so a retry replays the same puzzle.
    set({
      phase: 'countdown',
      paused: false,
      grid,
      sessionGrid: grid.map(row => row.map(cell => ({ ...cell }))),
      gaps,
      selection: [],
      difficulty,
      sessionId: crypto.randomUUID(),
      triesUsed: 1,
      roundScore: null,
      phaseStartTime: 0,
      phaseDuration: 0,
      viewTimeRemaining: 0,
      _resolution: null,
      roundTheme,
    })
  },
```

(This replaces the previous `roundTheme: THEME_SEQUENCE[get().roundIndex]` line — `roundTheme` is now computed once at the top and reused for both generation and the `set`.)

- [ ] **Step 5: Run the store tests**

Run: `npm run test -- tests/store/gameStore.colorCoded.test.ts`
Expected: PASS (all, including the new integration test).

Run: `npm run test -- tests/store/`
Expected: PASS — Basic-round store tests unaffected (rounds 1, 3, 4 stay `'basic'`).

- [ ] **Step 6: Type-check + commit**

Run: `npm run build`
Expected: clean.

```bash
git add supabase/functions/_shared/types.ts src/store/gameStore.ts tests/store/gameStore.colorCoded.test.ts
git commit -m "feat(level): round 2 plays the Color-coded theme"
```

---

## Task 7: Full verification & manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npm run build`
Expected: clean (no type errors, no `noUnusedLocals` failures).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Full test suite**

Run: `npm run test`
Expected: all suites pass (Plan-1's 263 + the new color-coded tests).

- [ ] **Step 4: Manual smoke (practice mode)**

Run: `npm run dev` (or use the running dev server). In the browser:
1. Open the menu → **Training Mode**.
2. **Round 1 (Basic):** clear it (pick the exact pieces) → advances to Round 2.
3. **Round 2 (Color-coded):** confirm the countdown title reads "Round 2 · Color-coded", gaps have **colored** dashed borders, the piece menu shows the round's shape in 8 palette colors, and the cart shows colored pieces. Pick the exact shape+color per gap → clears. Pick a wrong color → fails and spends a life.
4. Confirm the Results screen still shows the per-round breakdown + Lives Bonus on level complete / game over.

- [ ] **Step 5: Commit any fixups discovered during smoke**

If the smoke surfaces a bug, fix it with a focused commit referencing the task it belongs to. Otherwise, no commit.

---

## Self-Review

**1. Spec coverage (design §5 Round 2, §6, §7, §9):**
- §5 colored dashed borders → Task 4 (`GapBorder` per-gap color) + Task 1 (`Gap.color`).
- §5 menu shows the shape in each palette color → Task 5 (color-coded menu).
- §5 cart matches shape AND color → Task 3 (color-keyed cart) + Task 2 (per-color resolver).
- §5 Vacant Heights = 1 shape type, distinct colors, 3 gaps → Task 1 (generator) + Task 6 (wiring, `gapCount` from the difficulty table = 3 at Vacant Heights, `shapeTypeCount: 1`).
- §6 theme config (`orderMatters`/`colorMatters`) + single validator → Task 1 (`THEME_CONFIG`) + Task 2 (`resolveSelection`). Color-coded solver = partition by color, independent Basic solve per group → Task 2.
- §6 8-color palette separate from piece colors → Task 1 (`GAP_COLOR_IDS`) + Task 4 (`gapPalette.ts`).
- §7 `Gap.color`, theme-aware generation → Tasks 1, 6.
- §9 Vacant Heights timing/knobs reused → Task 6 (uses today's `getDifficulty(round)` unchanged).
- **Correctly deferred:** the ordered-token model (§6 "ordered list of tokens"), Sequential, and Flash Mob → Plans 3–4. Plan 2 keeps the `SelectionEntry + color` tally because order is irrelevant to color-coded (YAGNI).

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows full code; every run step shows the command and expected result.

**3. Type consistency:** `Gap.color?: string`, `SelectionEntry.color?: string` (Task 1) are consumed consistently — `resolveSelection` (Task 2), store increment/decrement/submit (Task 3), `gapBorderClass`/`gapFillClass` (Task 4), `SelectingPhase` (Task 5). `incrementSelection(pieceType, color?)`/`decrementSelection(pieceType, color?)` signatures match interface (Task 3) and call sites (Task 5). `resolveSelection` returns `{ solvable, placements, coverage, filledCells, totalCells }` and the store reads exactly those fields. `colorCoded: { shapeTypeCount, palette }` defined in the generator (Task 1) matches the store call (Task 6). `GAP_COLOR_IDS` is `as const`; the store spreads it (`[...GAP_COLOR_IDS]`) to pass a `string[]`.
