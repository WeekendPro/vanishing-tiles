# Multi-Round Levels — Plan 3: Sequential Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Sequential round (Round 3 of a level) — gaps carry number badges 1…N, the player builds an *ordered* queue of pieces by tapping, and the k-th pick must match the shape of the gap labelled k (wrong order = whole-round fail, no partial credit).

**Architecture:** Reuse the existing per-round phase machine and the `selection: SelectionEntry[]` array as the ordered queue — but for Sequential we append one **un-aggregated singleton entry per tap** (preserving tap order) instead of incrementing a tally. A new `orderMatters` branch in the shared `resolveSelection` validates the ordered shape-sequence against gaps sorted by `order`. Generation gains a `sequential` mode that stamps `order: 1…N` onto gaps. Two presentational additions: a number-badge overlay during viewing, and a tap-to-append queue menu (with Undo) during selecting. All pure logic lives in `supabase/functions/_shared/*` so it can later lift to the Journey server port.

**Tech Stack:** React 18, Zustand 5 (object selectors via `useShallow`), TypeScript, Vite, Vitest + jsdom, Tailwind CSS.

---

## Conventions for this codebase (read before starting)

- **Run tests:** `npm run test` (Vitest, globals on). Single file: `npx vitest run <path>`.
- **Type-check / build:** `npm run build` (this repo's `tsconfig` makes `npx tsc --noEmit` a no-op; the build also enforces `noUnusedLocals`). Never trust `tsc --noEmit` alone here.
- **nvm quirk:** this shell errors on chained commands (`a && b`) with `__init_nvm`. Run each `npm`/`npx` command as its **own** Bash call, never chained with `&&`.
- **`@shared/*`** is an alias for `supabase/functions/_shared`. Pure logic lives there; the client maps palette ids → Tailwind classes only in `src/lib/gapPalette.ts`. **Never put Tailwind class strings in the shared layer.**
- **Zustand 5:** object selectors MUST use `useShallow` from `zustand/shallow`.
- **Commit cadence:** one commit per task. Tests + build must be green before each commit.

## Key existing types (already defined — do not redefine)

From `supabase/functions/_shared/types.ts`:

```ts
export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L' | 'SINGLE'
export type Rotation = 0 | 1 | 2 | 3
export interface Gap {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: [number, number][]   // absolute [row,col]
  color?: string              // palette id (color-coded)
  // order?: number           // ← THIS PLAN adds it (Task 1)
}
export interface Placement {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: [number, number][]
  color?: string
}
export interface SelectionEntry { pieceType: PieceType; color?: string; freeCount: number }
export type RoundTheme = 'basic' | 'colorCoded' | 'sequential' | 'flashMob'
export const THEME_SEQUENCE: RoundTheme[] = ['basic', 'colorCoded', 'basic', 'basic']  // ← Task 6 flips index 2 → 'sequential'
```

From `supabase/functions/_shared/core/themeConfig.ts` (already correct, no change needed):

```ts
sequential: { orderMatters: true, colorMatters: false },
```

From `supabase/functions/_shared/engine/solver.ts`:
- `solve(pieceCount, grid, gaps): { solvable, placements: Placement[] | null }`
- `bestFit(pieceCount, grid): { placements, filledCells, totalCells }`

## File structure for this plan

| File | Responsibility | Change |
|------|----------------|--------|
| `supabase/functions/_shared/types.ts` | Add `order?: number` to `Gap` | Modify |
| `supabase/functions/_shared/engine/puzzleGenerator.ts` | `sequential` generation mode (stamp `order`) | Modify |
| `supabase/functions/_shared/core/themeResolution.ts` | `orderMatters` validation branch | Modify |
| `src/store/gameStore.ts` | `appendQueuePiece` / `popQueuePiece` actions; route `startGame` + selecting UI for Sequential | Modify |
| `src/components/SelectingPhase.tsx` | Tap-to-append queue menu + ordered queue display + Undo | Modify |
| `src/components/GapNumbers.tsx` | Number-badge overlay (1…N) on gaps during viewing | **Create** |
| `src/components/ViewingPhase.tsx` | Render `<GapNumbers>` overlay | Modify |

Tests:
- `tests/engine/puzzleGenerator.sequential.test.ts` (Create)
- `tests/core/themeResolution.sequential.test.ts` (Create)
- `tests/store/gameStore.sequential.test.ts` (Create)
- `tests/components/SelectingPhase.sequential.test.tsx` (Create)
- `tests/components/GapNumbers.test.tsx` (Create)

---

## Task 1: `Gap.order` + sequential generation mode

**Files:**
- Modify: `supabase/functions/_shared/types.ts` (Gap interface, ~line 35–42)
- Modify: `supabase/functions/_shared/engine/puzzleGenerator.ts`
- Test: `tests/engine/puzzleGenerator.sequential.test.ts` (Create)

- [ ] **Step 1: Write the failing test**

Create `tests/engine/puzzleGenerator.sequential.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { makeRng } from '@shared/core/prng'

describe('generatePuzzle — sequential mode', () => {
  it('stamps order 1..N across the gaps (a permutation, no gaps/dupes)', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 3, complexity: 'simple', sequential: true },
      makeRng(123),
    )
    expect(gaps).toHaveLength(3)
    const orders = gaps.map(g => g.order).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(orders).toEqual([1, 2, 3])
  })

  it('does not assign colors in sequential mode (monochrome)', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 3, complexity: 'simple', sequential: true },
      makeRng(123),
    )
    expect(gaps.every(g => g.color === undefined)).toBe(true)
  })

  it('leaves order undefined for non-sequential puzzles', () => {
    const { gaps } = generatePuzzle({ gapCount: 3, complexity: 'simple' }, makeRng(7))
    expect(gaps.every(g => g.order === undefined)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/engine/puzzleGenerator.sequential.test.ts`
Expected: FAIL — `sequential` is not a recognized field / `order` is always undefined.

- [ ] **Step 3: Add `order?` to `Gap`**

In `supabase/functions/_shared/types.ts`, inside the `Gap` interface, add the field after `color?`:

```ts
export interface Gap {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: PieceCells  // absolute [row, col] positions
  color?: string     // palette id (color-coded rounds); undefined for monochrome themes
  order?: number     // 1..N badge for Sequential rounds; undefined otherwise
}
```

- [ ] **Step 4: Add the `sequential` generation branch**

In `supabase/functions/_shared/engine/puzzleGenerator.ts`, extend the `PuzzleInput` type (the `colorCoded?` block, ~line 5–10) to add a sibling option:

```ts
type PuzzleInput = Pick<DifficultyConfig, 'gapCount' | 'complexity'> & {
  adjacency?: number
  /** When set, restrict the puzzle to `shapeTypeCount` shape(s) and assign each
   *  gap a distinct color from `palette` (color-coded theme). */
  colorCoded?: { shapeTypeCount: number; palette: string[] }
  /** When true, stamp order 1..N across the gaps (Sequential theme). */
  sequential?: boolean
}
```

Then, just before the final `return { grid, gaps }` (after the existing `if (input.colorCoded) { … }` block, ~line 126), add:

```ts
  // Sequential: stamp a 1..N order badge across the gaps in placement order.
  // Gaps are already placed at random board positions, so ascending order
  // numbers are spatially scattered (no trivial top-to-bottom reading).
  if (input.sequential) {
    gaps.forEach((gap, i) => { gap.order = i + 1 })
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/engine/puzzleGenerator.sequential.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Build to verify types**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/types.ts supabase/functions/_shared/engine/puzzleGenerator.ts tests/engine/puzzleGenerator.sequential.test.ts
git commit -m "feat(generator): sequential puzzle mode (stamp gap order 1..N)"
```

---

## Task 2: Sequential validation branch in `resolveSelection`

**Files:**
- Modify: `supabase/functions/_shared/core/themeResolution.ts`
- Test: `tests/core/themeResolution.sequential.test.ts` (Create)

**Behaviour:** The picked shape-sequence (selection in order) must equal the gap shapes ordered by `order`. Equal length AND positional shape match → clear (placements taken straight from the gaps). Any mismatch (wrong count, wrong shape, or right shapes in wrong order) → fail with **coverage 0 and no placements** (no partial credit). Adjacent identical shapes are naturally interchangeable because comparison is positional.

- [ ] **Step 1: Write the failing test**

Create `tests/core/themeResolution.sequential.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveSelection } from '@shared/core/themeResolution'
import type { Gap, Grid, SelectionEntry, Cell } from '@shared/types'
import { ROWS, COLS } from '@shared/types'

// Three single-cell gaps so we control shapes precisely. (SINGLE = 1 cell.)
// order is deliberately NOT in cells-reading order, to prove we sort by `order`.
const gaps: Gap[] = [
  { pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0]], order: 2 },
  { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 1, cells: [[0, 1]], order: 1 },
  { pieceType: 'T', rotation: 0, anchorRow: 0, anchorCol: 2, cells: [[0, 2]], order: 3 },
]
// Gap shapes ordered by `order`: 1→O, 2→I, 3→T.

function gridWith(gs: Gap[]): Grid {
  const g: Grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' })))
  for (const gap of gs) for (const [r, c] of gap.cells) g[r][c] = { status: 'empty' }
  return g
}

const ordered = (types: SelectionEntry['pieceType'][]): SelectionEntry[] =>
  types.map(pieceType => ({ pieceType, freeCount: 1 }))

describe('resolveSelection — sequential', () => {
  it('clears when the ordered shapes match the gaps ordered by `order`', () => {
    const res = resolveSelection({ selection: ordered(['O', 'I', 'T']), grid: gridWith(gaps), gaps, theme: 'sequential' })
    expect(res.solvable).toBe(true)
    expect(res.placements).toHaveLength(3)
    expect(res.coverage).toBe(1)
  })

  it('fails with no partial credit when shapes are right but order is wrong', () => {
    const res = resolveSelection({ selection: ordered(['I', 'O', 'T']), grid: gridWith(gaps), gaps, theme: 'sequential' })
    expect(res.solvable).toBe(false)
    expect(res.placements).toHaveLength(0)
    expect(res.coverage).toBe(0)
  })

  it('fails when the picked count does not equal the gap count', () => {
    const res = resolveSelection({ selection: ordered(['O', 'I']), grid: gridWith(gaps), gaps, theme: 'sequential' })
    expect(res.solvable).toBe(false)
    expect(res.placements).toHaveLength(0)
  })

  it('treats adjacent identical shapes as interchangeable', () => {
    const twoOsThenI: Gap[] = [
      { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0]], order: 1 },
      { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 1, cells: [[0, 1]], order: 2 },
      { pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 2, cells: [[0, 2]], order: 3 },
    ]
    const res = resolveSelection({ selection: ordered(['O', 'O', 'I']), grid: gridWith(twoOsThenI), gaps: twoOsThenI, theme: 'sequential' })
    expect(res.solvable).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/core/themeResolution.sequential.test.ts`
Expected: FAIL — sequential falls through the `!colorMatters` Basic path, which tallies by piece type and ignores order, so the wrong-order case wrongly "clears".

- [ ] **Step 3: Add the sequential branch**

In `supabase/functions/_shared/core/themeResolution.ts`:

First extend the config destructure near the top of `resolveSelection` (currently `const { colorMatters } = THEME_CONFIG[theme]`):

```ts
  const { colorMatters, orderMatters } = THEME_CONFIG[theme]
```

Then add this block **before** the `if (!colorMatters)` block (so Sequential is handled first and never reaches the tally path):

```ts
  if (orderMatters) {
    // Sequential: the k-th pick must match the shape of the gap labelled k.
    // Compare positionally against gaps sorted by `order`; any mismatch (count,
    // shape, or order) fails the whole round with zero partial credit.
    const picks: PieceType[] = []
    for (const e of selection) for (let i = 0; i < e.freeCount; i++) picks.push(e.pieceType)
    const orderedGaps = [...gaps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const totalCells = orderedGaps.reduce((sum, g) => sum + g.cells.length, 0)

    const matches =
      picks.length === orderedGaps.length &&
      orderedGaps.every((g, k) => g.pieceType === picks[k])

    if (matches) {
      const placements: Placement[] = orderedGaps.map(g => ({
        pieceType: g.pieceType,
        rotation: g.rotation,
        anchorRow: g.anchorRow,
        anchorCol: g.anchorCol,
        cells: g.cells,
      }))
      return { solvable: true, placements, coverage: 1, filledCells: totalCells, totalCells }
    }
    return { solvable: false, placements: [], coverage: 0, filledCells: 0, totalCells }
  }
```

Note: `PieceType` and `Placement` are already imported at the top of this file (line 1).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/core/themeResolution.sequential.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the existing resolver tests to confirm no regression**

Run: `npx vitest run tests/core/themeResolution.test.ts`
Expected: PASS (all existing basic + color-coded tests still pass — they use themes whose `orderMatters` is false, so the new branch is skipped).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/core/themeResolution.ts tests/core/themeResolution.sequential.test.ts
git commit -m "feat(core): sequential order-aware selection resolver"
```

---

## Task 3: Store — ordered queue actions + Sequential routing

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.sequential.test.ts` (Create)

**Design:** For Sequential, `selection` is used as an **ordered list of singleton entries** (one entry per tap, `freeCount: 1`, no `color`). `appendQueuePiece` pushes a new entry (never aggregates); `popQueuePiece` removes the last entry (Undo/backspace). `startGame` passes `sequential: true` to the generator when the round theme's `orderMatters` is set. `expandCartSlots(selection)` already yields chips in tap order, so the resolution fly-in and scoring paths work unchanged.

- [ ] **Step 1: Write the failing test**

Create `tests/store/gameStore.sequential.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../../src/store/gameStore'

beforeEach(() => {
  useGameStore.getState().resetGame()
})

describe('ordered queue actions', () => {
  it('appendQueuePiece appends one singleton entry per tap, preserving order', () => {
    const s = useGameStore.getState()
    s.appendQueuePiece('O')
    s.appendQueuePiece('I')
    s.appendQueuePiece('O')
    const sel = useGameStore.getState().selection
    expect(sel.map(e => e.pieceType)).toEqual(['O', 'I', 'O'])
    expect(sel.every(e => e.freeCount === 1 && e.color === undefined)).toBe(true)
  })

  it('popQueuePiece removes the last pick only', () => {
    const s = useGameStore.getState()
    s.appendQueuePiece('O')
    s.appendQueuePiece('I')
    s.popQueuePiece()
    expect(useGameStore.getState().selection.map(e => e.pieceType)).toEqual(['O'])
  })

  it('popQueuePiece on an empty queue is a no-op', () => {
    useGameStore.getState().popQueuePiece()
    expect(useGameStore.getState().selection).toEqual([])
  })
})

describe('round 3 is sequential', () => {
  it('startPractice→advance to round 3 generates ordered gaps with the sequential theme', () => {
    const s = useGameStore.getState()
    s.startPractice()
    // Clear rounds 1 and 2 by forcing a cleared roundScore, then advancing.
    useGameStore.setState({ roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 } })
    s.advanceRound() // → round index 1 (color-coded)
    useGameStore.setState({ roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 } })
    s.advanceRound() // → round index 2 (sequential)
    const st = useGameStore.getState()
    expect(st.roundTheme).toBe('sequential')
    expect(st.gaps.length).toBeGreaterThan(0)
    const orders = st.gaps.map(g => g.order).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(orders).toEqual(st.gaps.map((_, i) => i + 1))
  })
})

describe('sequential submitSelection', () => {
  function setupSequentialRound() {
    useGameStore.getState().startPractice()
    // Build a deterministic 2-gap sequential board: O at order 1, I at order 2.
    const gaps = [
      { pieceType: 'O' as const, rotation: 0 as const, anchorRow: 0, anchorCol: 0, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] as [number, number][], order: 1 },
      { pieceType: 'I' as const, rotation: 0 as const, anchorRow: 3, anchorCol: 0, cells: [[3, 0], [3, 1], [3, 2], [3, 3]] as [number, number][], order: 2 },
    ]
    const grid = useGameStore.getState().grid.map(row => row.map(c => ({ ...c })))
    // Reset to all-filled, then carve the two gaps.
    for (const row of grid) for (const c of row) { c.status = 'filled'; delete (c as { pieceType?: unknown }).pieceType }
    for (const g of gaps) for (const [r, c] of g.cells) grid[r][c] = { status: 'empty' }
    useGameStore.setState({
      phase: 'selecting', roundTheme: 'sequential', gaps, grid, selection: [],
      phaseStartTime: Date.now(), phaseDuration: 10000, viewTimeRemaining: 0,
      difficulty: { viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 2, complexity: 'simple' },
      livesRemaining: 3,
    })
  }

  it('clears the round when picked in the right order (O then I)', () => {
    setupSequentialRound()
    const s = useGameStore.getState()
    s.appendQueuePiece('O')
    s.appendQueuePiece('I')
    s.submitSelection()
    const st = useGameStore.getState()
    expect(st._resolution?.kind).toBe('perfect')
    expect(st.livesRemaining).toBe(3)
  })

  it('fails and spends a life when picked in the wrong order (I then O)', () => {
    setupSequentialRound()
    const s = useGameStore.getState()
    s.appendQueuePiece('I')
    s.appendQueuePiece('O')
    s.submitSelection()
    const st = useGameStore.getState()
    expect(st._resolution?.kind).toBe('partial')
    expect(st._resolution?.coverage).toBe(0)
    expect(st.livesRemaining).toBe(2)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/store/gameStore.sequential.test.ts`
Expected: FAIL — `appendQueuePiece`/`popQueuePiece` are not functions; round 3 theme is still `'basic'`.

> NOTE: the "round 3 is sequential" test depends on Task 6's `THEME_SEQUENCE` flip. It is expected to stay red until Task 6. The queue-action and submit tests must go green in this task. (If you prefer all-green per task, you may move the "round 3 is sequential" `describe` block to Task 6; either way it must exist and pass by the end of the plan.)

- [ ] **Step 3: Add the queue actions to the store interface**

In `src/store/gameStore.ts`, in the actions interface near `incrementSelection`/`decrementSelection` (~line 60–61), add:

```ts
  appendQueuePiece: (pieceType: PieceType) => void
  popQueuePiece: () => void
```

- [ ] **Step 4: Implement the queue actions**

In `src/store/gameStore.ts`, add these implementations right after `decrementSelection` (after the block ending ~line 256):

```ts
  // Sequential rounds use `selection` as an ORDERED queue: one singleton entry
  // per tap (never aggregated), so tap order is preserved for order-aware
  // validation and the in-order fly-in.
  appendQueuePiece: (pieceType: PieceType) => {
    set(state => ({ selection: [...state.selection, { pieceType, freeCount: 1 }] }))
  },

  popQueuePiece: () => {
    set(state => ({ selection: state.selection.slice(0, -1) }))
  },
```

- [ ] **Step 5: Route `startGame` generation for Sequential**

In `src/store/gameStore.ts`, `startGame` (~line 138–151). Replace the `const colorCoded = …` line and the `generatePuzzle(…)` call with theme-aware input that also handles `orderMatters`:

```ts
    const roundTheme = THEME_SEQUENCE[roundIndex]
    const difficulty = getDifficulty(round)
    const { colorMatters, orderMatters } = THEME_CONFIG[roundTheme]
    const { grid, gaps } = generatePuzzle(
      colorMatters
        ? {
            gapCount: difficulty.gapCount,
            complexity: difficulty.complexity,
            colorCoded: { shapeTypeCount: 1, palette: [...GAP_COLOR_IDS] },
          }
        : orderMatters
          ? { gapCount: difficulty.gapCount, complexity: difficulty.complexity, sequential: true }
          : difficulty
    )
```

(`THEME_CONFIG` and `GAP_COLOR_IDS` are already imported in this file.)

- [ ] **Step 6: Run the queue-action + submit tests to verify they pass**

Run: `npx vitest run tests/store/gameStore.sequential.test.ts`
Expected: the `ordered queue actions` (3) and `sequential submitSelection` (2) describes PASS. The `round 3 is sequential` test stays red until Task 6.

- [ ] **Step 7: Build to verify types**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.sequential.test.ts
git commit -m "feat(store): ordered queue actions + sequential generation routing"
```

---

## Task 4: SelectingPhase — tap-to-append queue UI

**Files:**
- Modify: `src/components/SelectingPhase.tsx`
- Test: `tests/components/SelectingPhase.sequential.test.tsx` (Create)

**Design:** Add an `orderMatters` branch. For Sequential: the menu is the 8 standard piece types; tapping one calls `appendQueuePiece`. The "Your Selection" box shows the ordered queue as numbered chips (1, 2, 3 …) and an **Undo ⌫** button calling `popQueuePiece`. Basic and Color-coded branches stay exactly as they are.

- [ ] **Step 1: Write the failing test**

Create `tests/components/SelectingPhase.sequential.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SelectingPhase } from '../../src/components/SelectingPhase'
import { useGameStore } from '../../src/store/gameStore'
import type { Gap } from '@shared/types'

const gaps: Gap[] = [
  { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0], [0, 1], [1, 0], [1, 1]], order: 1 },
  { pieceType: 'I', rotation: 0, anchorRow: 3, anchorCol: 0, cells: [[3, 0], [3, 1], [3, 2], [3, 3]], order: 2 },
]

beforeEach(() => {
  useGameStore.getState().resetGame()
  useGameStore.setState({
    phase: 'selecting', roundTheme: 'sequential', gaps, selection: [],
    phaseStartTime: Date.now(), phaseDuration: 10000,
    difficulty: { viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 2, complexity: 'simple' },
  })
})

describe('SelectingPhase — sequential queue menu', () => {
  it('renders all 8 piece-type buttons', () => {
    render(<SelectingPhase />)
    expect(document.querySelectorAll('[data-queue-option]')).toHaveLength(8)
  })

  it('appends to the queue in tap order', () => {
    render(<SelectingPhase />)
    fireEvent.click(document.querySelector('[data-queue-option="O"]') as HTMLButtonElement)
    fireEvent.click(document.querySelector('[data-queue-option="I"]') as HTMLButtonElement)
    expect(useGameStore.getState().selection.map(e => e.pieceType)).toEqual(['O', 'I'])
  })

  it('Undo removes the last queued piece', () => {
    render(<SelectingPhase />)
    fireEvent.click(document.querySelector('[data-queue-option="O"]') as HTMLButtonElement)
    fireEvent.click(document.querySelector('[data-queue-option="I"]') as HTMLButtonElement)
    fireEvent.click(document.querySelector('[data-queue-undo]') as HTMLButtonElement)
    expect(useGameStore.getState().selection.map(e => e.pieceType)).toEqual(['O'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/SelectingPhase.sequential.test.tsx`
Expected: FAIL — no `[data-queue-option]` buttons (Sequential currently falls into the Basic menu).

- [ ] **Step 3: Pull the new actions + flag into the component**

In `src/components/SelectingPhase.tsx`, extend the `useShallow` selector to also read the queue actions, and compute `orderMatters`.

Add to the destructured object in the `useGameStore(useShallow(...))` call (alongside `incrementSelection`):

```ts
    appendQueuePiece: s.appendQueuePiece,
    popQueuePiece: s.popQueuePiece,
```

And in the returned object literal of the selector, add the matching lines:

```ts
    appendQueuePiece, popQueuePiece,
```

(Destructure them in the outer `const { … } = useGameStore(...)` too.)

After `const colorMatters = …`, add:

```ts
  const orderMatters = THEME_CONFIG[roundTheme].orderMatters
```

- [ ] **Step 4: Render the Sequential selection box + menu**

In `src/components/SelectingPhase.tsx`:

**(a)** Replace the contents of the "Your Selection" chip row so the Sequential case shows numbered, ordered chips plus an Undo button. Change the selection-box body (the `<div className="flex gap-2 flex-wrap min-h-[52px] items-center">…</div>`) to:

```tsx
        <div className="flex gap-2 flex-wrap min-h-[52px] items-center">
          {orderMatters ? (
            <>
              {selection.map((entry, i) => (
                <div key={i} className="flex flex-col items-center gap-1 p-2 rounded-md border-2 border-neon-cyan bg-arcade-well text-neon-cyan">
                  <span className="font-pixel text-[9px] text-gray-400">{i + 1}</span>
                  <PieceShape pieceType={entry.pieceType} cellSize={11} />
                </div>
              ))}
              {selection.length === 0 && (
                <span className="text-xs text-gray-600 italic">Tap pieces in order</span>
              )}
              {selection.length > 0 && (
                <button
                  data-queue-undo
                  onClick={popQueuePiece}
                  className="ml-auto self-stretch px-3 rounded-md border-2 border-neon-red text-neon-red text-xs hover:bg-arcade-panel"
                >
                  Undo ⌫
                </button>
              )}
            </>
          ) : (
            <>
              {selection.filter(e => e.freeCount > 0).map(entry => (
                <button
                  key={`${entry.pieceType}:${entry.color ?? ""}`}
                  onClick={() => decrementSelection(entry.pieceType, entry.color)}
                  className="flex flex-col items-center gap-1 p-2 rounded-md border-2 text-xs
                    border-neon-cyan bg-arcade-well text-neon-cyan cursor-pointer hover:bg-arcade-panel"
                >
                  <PieceShape
                    pieceType={entry.pieceType}
                    cellSize={11}
                    colorClass={entry.color ? gapFillClass(entry.color) : undefined}
                  />
                  <span>×{entry.freeCount}</span>
                </button>
              ))}
              {selection.length === 0 && (
                <span className="text-xs text-gray-600 italic">No pieces selected</span>
              )}
            </>
          )}
        </div>
```

**(b)** Add the Sequential menu branch. The menu currently is `{colorMatters ? (<colorMenu/>) : (<basicMenu/>)}`. Change it to a three-way:

```tsx
        {colorMatters ? (
          <div className="grid grid-cols-4 gap-2">
            {/* …existing color menu, unchanged… */}
          </div>
        ) : orderMatters ? (
          <div className="grid grid-cols-4 gap-2">
            {PIECE_DEFINITIONS.map(def => (
              <button
                key={def.type}
                data-queue-option={def.type}
                onClick={() => appendQueuePiece(def.type as PieceType)}
                className="flex flex-col items-center gap-1 p-2 bg-arcade-well border-2 border-arcade-edge
                  rounded-md hover:border-neon-cyan cursor-pointer"
              >
                <PieceShape pieceType={def.type} cellSize={11} />
                <span className="font-pixel text-[9px] text-gray-400">{def.type}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {/* …existing basic menu, unchanged… */}
          </div>
        )}
```

Leave the existing color and basic menu JSX exactly as they are inside their branches.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/components/SelectingPhase.sequential.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the existing SelectingPhase color-coded test (no regression)**

Run: `npx vitest run tests/components/SelectingPhase.colorCoded.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Build to verify types**

Run: `npm run build`
Expected: build succeeds (watch for unused-import / unused-var errors from `noUnusedLocals`).

- [ ] **Step 8: Commit**

```bash
git add src/components/SelectingPhase.tsx tests/components/SelectingPhase.sequential.test.tsx
git commit -m "feat(selecting): tap-to-append ordered queue UI for sequential rounds"
```

---

## Task 5: GapNumbers overlay + viewing wiring

**Files:**
- Create: `src/components/GapNumbers.tsx`
- Modify: `src/components/ViewingPhase.tsx`
- Test: `tests/components/GapNumbers.test.tsx` (Create)

**Design:** A presentational overlay (mirrors `GapBorder`'s positioning math: `CELL=28`, `GAP=2`, `PAD=12`, `px(i)=PAD+i*STEP`) that places a small numbered badge at each gap's top-left-most cell (min row, then min col). Renders nothing for gaps without `order`. ViewingPhase renders it above the grid alongside `GapBorder`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/GapNumbers.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GapNumbers } from '../../src/components/GapNumbers'
import type { Gap } from '@shared/types'

const gaps: Gap[] = [
  { pieceType: 'O', rotation: 0, anchorRow: 1, anchorCol: 2, cells: [[1, 2], [1, 3], [2, 2], [2, 3]], order: 2 },
  { pieceType: 'I', rotation: 0, anchorRow: 5, anchorCol: 0, cells: [[5, 0], [5, 1], [5, 2], [5, 3]], order: 1 },
]

describe('GapNumbers', () => {
  it('renders one badge per ordered gap showing its order number', () => {
    const { container } = render(<GapNumbers gaps={gaps} />)
    const badges = container.querySelectorAll('[data-gap-number]')
    expect(badges).toHaveLength(2)
    const labels = [...badges].map(b => b.textContent).sort()
    expect(labels).toEqual(['1', '2'])
  })

  it('renders nothing for gaps without an order (monochrome/basic gaps)', () => {
    const noOrder: Gap[] = [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0]] }]
    const { container } = render(<GapNumbers gaps={noOrder} />)
    expect(container.querySelectorAll('[data-gap-number]')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/GapNumbers.test.tsx`
Expected: FAIL — module `../../src/components/GapNumbers` does not exist.

- [ ] **Step 3: Create the component**

Create `src/components/GapNumbers.tsx`:

```tsx
import type { Gap } from '@shared/types'

const CELL = 28
const GAP = 2
const PAD = 12
const STEP = CELL + GAP

// Pixel offset of a cell's top-left within the Grid's padded box.
const px = (i: number) => PAD + i * STEP

interface Props {
  gaps: Gap[]
}

/**
 * Absolutely-positioned overlay that drops a small numbered badge on each gap
 * that carries an `order` (Sequential rounds). The badge sits at the gap's
 * top-left-most cell (min row, then min col). Sits inside ViewingPhase's
 * relative grid wrapper, above the Grid and GapBorder.
 */
export function GapNumbers({ gaps }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {gaps.map((gap, gi) => {
        if (gap.order === undefined) return null
        const [r, c] = [...gap.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])[0]
        return (
          <div
            key={gi}
            data-gap-number
            className="absolute flex items-center justify-center font-pixel text-[11px]
              text-gray-900 bg-gray-100/90 rounded-full w-5 h-5 shadow"
            style={{ left: px(c) + 4, top: px(r) + 4 }}
          >
            {gap.order}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/GapNumbers.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire it into ViewingPhase**

In `src/components/ViewingPhase.tsx`, add the import near the other component imports:

```ts
import { GapNumbers } from './GapNumbers'
```

Then render it inside the relative grid wrapper, right after `<GapBorder gaps={gaps} />`:

```tsx
        <GapBorder gaps={gaps} />
        <GapNumbers gaps={gaps} />
        <GapShimmer containerRef={gridWrapRef} cellRects={cellRects} gaps={gaps} />
```

- [ ] **Step 6: Build to verify types**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/GapNumbers.tsx src/components/ViewingPhase.tsx tests/components/GapNumbers.test.tsx
git commit -m "feat(viewing): number-badge overlay for sequential gaps"
```

---

## Task 6: Wire Round 3 to Sequential + full verification

**Files:**
- Modify: `supabase/functions/_shared/types.ts` (`THEME_SEQUENCE`, ~line 81)
- Test: `tests/store/gameStore.sequential.test.ts` (the `round 3 is sequential` describe from Task 3 goes green here)

- [ ] **Step 1: Flip the theme sequence**

In `supabase/functions/_shared/types.ts`, change `THEME_SEQUENCE` so index 2 is `'sequential'`:

```ts
export const THEME_SEQUENCE: RoundTheme[] = ['basic', 'colorCoded', 'sequential', 'basic']
```

(Index 3 stays `'basic'` until Plan 4 ships Flash Mob.)

- [ ] **Step 2: Run the store sequential tests — all green now**

Run: `npx vitest run tests/store/gameStore.sequential.test.ts`
Expected: PASS — including `round 3 is sequential` (theme is now `'sequential'` and gaps carry `order`).

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: ALL tests pass (no regressions in the existing 282).

- [ ] **Step 4: Build + lint**

Run: `npm run build`
Expected: build succeeds, no `noUnusedLocals` errors.

- [ ] **Step 5: Manual browser smoke (record findings)**

Start the dev server (Preview MCP config `puzzle-game`, port 5173). Enter **Training Mode** via the menu (the nav route only changes through the UI). Then in the browser console / Preview eval, drive to round index 2:

```js
const st = window.__store
st.getState().startLevel()
st.setState({ roundIndex: 2 })
st.getState().startGame()
st.getState().beginViewing()
```

Verify in **viewing**: the board shows monochrome dashed gap borders **and** a numbered badge (1…N) on each gap. Then `st.getState().endViewing()` and verify **selecting** shows the 8-piece tap-to-append menu, the ordered numbered queue, and a working **Undo ⌫**. Tap the shapes in the order the gaps were numbered, hit Done, and confirm a **Perfect** clear with the in-order fly-in. Re-run and tap a **wrong order** → confirm a failure that spends one life and shows **no partial fill** (coverage 0).

> Browser-smoke caveat (known artifacts from earlier rounds): driving the store via eval between screenshots lets the select-phase auto-submit timer fire (empty selection → spurious life loss) and can desync `window.__store` from the React tree across Vite HMR. If state looks wrong, **hard reload** and re-drive in one tight eval. The 🐢 Speed icon during eval-driven smoke is an idle-time artifact, not a bug.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/types.ts
git commit -m "feat(level): round 3 plays the Sequential theme"
```

---

## Self-Review (completed during planning)

**1. Spec coverage (spec §5 Round 3, §6, §7, §8):**
- Number badges 1…N on gaps → Task 1 (generation) + Task 5 (overlay). ✓
- Tap-to-append ordered queue with undo → Task 3 (actions) + Task 4 (UI). ✓
- k-th pick matches gap labelled k; wrong order = fail, no partial credit → Task 2. ✓
- Monochrome dashed borders → already shipped (Plan 1, `GapBorder` default `border-gray-300/70`); Sequential gaps have no `color`, so borders render monochrome with no change. ✓
- `Gap.order` field + sequential generation → Task 1. ✓
- `orderMatters` validator branch → Task 2 (`THEME_CONFIG.sequential.orderMatters` already true). ✓
- Cart = ordered shape list → Task 3 reuses `selection` as an ordered singleton list; `expandCartSlots` yields chips in tap order (already in place from Plan 2). ✓
- Identical adjacent shapes interchangeable → Task 2 positional comparison + explicit test. ✓
- Wire Round 3 → Task 6. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows full code; every command has an expected result. ✓

**3. Type consistency:** Action names `appendQueuePiece`/`popQueuePiece` used identically in Tasks 3 and 4. `Gap.order` (Task 1) consumed by Tasks 2 and 5. `sequential?: boolean` on `PuzzleInput` (Task 1) consumed by `startGame` (Task 3). `orderMatters` read from `THEME_CONFIG` in Tasks 2, 3, 4. Resolver return shape `{ solvable, placements, coverage, filledCells, totalCells }` matches the existing `ResolveResult` interface. ✓

**Out of scope (per spec §11 and the agreed scope):** Flash Mob (Plan 4), the Journey/server port of Sequential, and difficulty tuning beyond Vacant Heights.
