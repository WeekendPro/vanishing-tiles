# Best-Fit Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual-placement + carry-over punishment for a wrong selection with an automatic best-fit placement (max-coverage), partial-credit scoring, and a playful red-X on unused pieces; next round is always a clean slate.

**Architecture:** A new `bestFit()` solver maximizes covered empty cells from the player's selection. The `auto-placing` phase is renamed `resolving` and handles both the perfect path (unchanged) and the new partial path. The shared fly→badge→score→cta animation sequence is reused; only the badge, the red-X on unclaimed cart chips, and the score values differ. Manual placement, carry-overs, and locked pieces are deleted.

**Tech Stack:** TypeScript, React, Zustand 5 (`useShallow` for object selectors), framer-motion, Vitest + Testing Library, Vite.

**Conventions (read before starting):**
- Run a single test file: `npx vitest run tests/path/file.test.ts`
- Run all tests: `npm run test` — Type check: `npx tsc --noEmit`
- Zustand object selectors MUST use `useShallow` (see CLAUDE.md). Single-value selectors don't.
- Every commit must leave `npm run test` and `npx tsc --noEmit` green.
- Note: `SelectionEntry.freeCount` is kept as the field name even after `lockedCount` is removed (minimizes diff); it is now simply "the count."

---

## File map

| File | Responsibility | Touched in |
|---|---|---|
| `src/engine/solver.ts` | Add `bestFit()` + `BestFitResult` next to `solve()`. | Task 1 |
| `src/types.ts` | Rename phase `auto-placing`→`resolving`; remove `manual-placing` & `scoring` literals; add `Resolution`; drop `lockedCount`, `carryOvers`, `heldPiece`, `HeldPiece`, `CarryOver` usage. | Tasks 2, 3, 7 |
| `src/store/gameStore.ts` | Resolution branching, partial scoring, `endGame`; remove manual/carry-over actions & state. | Tasks 2, 3, 7 |
| `src/components/ResolutionPhase/` (was `AutoPlacingPhase/`) | Renamed dir/component; branch on `kind`; amber badge; bad-piece red-X (two variants behind `?badfx`). | Tasks 2, 3, 4, 5, 6 |
| `src/components/ResolutionPhase/PartialBadge.tsx` | New amber badge with coverage-flexed copy. | Task 4 |
| `src/components/ResolutionPhase/SelectionCart.tsx` | Stamp-variant red-X overlay on bad chips; later drop locked styling. | Tasks 5, 7 |
| `src/components/ResolutionPhase/BadFlyerOverlay.tsx` | New fly-variant overlay (deleted in Task 6 if not chosen). | Tasks 5, 6 |
| `src/components/GameShell.tsx` | Route `resolving`; drop `manual-placing`/`PlacingPhase`; simplify game-over route. | Tasks 2, 7 |
| `src/components/SelectingPhase.tsx` | Remove locked-chip UI. | Task 7 |
| `src/components/Grid.tsx` | Remove `heldPiece` read + cursor block. | Task 7 |
| `src/components/PlacingPhase.tsx` | **Deleted.** | Task 7 |
| `src/engine/cartSlots.ts` | `expandCartSlots` uses only `freeCount`. | Task 7 |
| `tests/...` | Update phase literals, rewrite incorrect-selection tests, add `bestFit`/partial tests, drop carry-over/manual tests. | All tasks |

---

## Task 1: `bestFit()` max-coverage solver

**Files:**
- Modify: `src/engine/solver.ts`
- Test: `tests/engine/solver.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine/solver.test.ts` (add `bestFit` to the existing import from `../../src/engine/solver`, and import grid helpers):

```ts
import { bestFit } from '../../src/engine/solver'
import { ROWS, COLS } from '../../src/types'
import type { Grid, Cell } from '../../src/types'

function fullGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' })))
}
function emptyAt(grid: Grid, cells: [number, number][]): Grid {
  for (const [r, c] of cells) grid[r][c] = { status: 'empty' }
  return grid
}

describe('bestFit', () => {
  it('fills a gap exactly and leaves the extra piece unused', () => {
    const grid = emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]) // one O gap
    const res = bestFit({ O: 1, T: 1 }, grid)
    expect(res.totalCells).toBe(4)
    expect(res.filledCells).toBe(4)
    expect(res.placements).toHaveLength(1)
    expect(res.placements[0].pieceType).toBe('O')
  })

  it('covers as many cells as possible when pieces are insufficient', () => {
    const grid = emptyAt(fullGrid(), [
      [0, 0], [0, 1], [1, 0], [1, 1],   // O gap A
      [5, 5], [5, 6], [6, 5], [6, 6],   // O gap B
    ])
    const res = bestFit({ O: 1 }, grid) // only enough for one
    expect(res.totalCells).toBe(8)
    expect(res.filledCells).toBe(4)
    expect(res.placements).toHaveLength(1)
  })

  it('tie-breaks equal coverage toward the fewest pieces', () => {
    const grid = emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]) // one O gap
    const res = bestFit({ O: 1, SINGLE: 4 }, grid)
    expect(res.filledCells).toBe(4)
    expect(res.placements).toHaveLength(1)          // O (1 piece) beats 4 SINGLEs
    expect(res.placements[0].pieceType).toBe('O')
  })

  it('leaves genuinely unfillable cells uncovered', () => {
    const grid = emptyAt(fullGrid(), [[0, 0], [0, 1], [0, 2]]) // 3-cell row, no 2x2
    const res = bestFit({ O: 1 }, grid)                        // O cannot fit
    expect(res.filledCells).toBe(0)
    expect(res.placements).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/engine/solver.test.ts`
Expected: FAIL — `bestFit is not a function` / `bestFit is not exported`.

- [ ] **Step 3: Implement `bestFit`**

Append to `src/engine/solver.ts` (reuses the existing `cloneGrid`, `findFirstEmpty`, `canPlace`, `applyPlacement`, `getAllRotations`, and `PieceCount`):

```ts
export interface BestFitResult {
  placements: Placement[]   // the winning packing — the "good" pieces
  filledCells: number       // empty cells covered by `placements`
  totalCells: number        // empty cells before placement
}

/**
 * Find the placement of a SUBSET of the given pieces that covers the most
 * empty cells (max-coverage). Tie-break: fewest pieces used. Pieces not in
 * `placements` are the "bad" pieces (caller derives them from the selection).
 */
export function bestFit(pieceCount: PieceCount, grid: Grid): BestFitResult {
  const totalCells = grid.flat().filter(c => c.status === 'empty').length
  const workGrid = cloneGrid(grid)
  const remaining: PieceCount = { ...pieceCount }

  let best: Placement[] = []
  let bestFilled = -1
  let bestPieces = Infinity

  const current: Placement[] = []
  let currentFilled = 0
  let currentPieces = 0

  function record(): void {
    if (currentFilled > bestFilled ||
        (currentFilled === bestFilled && currentPieces < bestPieces)) {
      bestFilled = currentFilled
      bestPieces = currentPieces
      best = current.map(p => ({ ...p, cells: p.cells.map(([r, c]) => [r, c] as [number, number]) }))
    }
  }

  function search(): void {
    const empty = findFirstEmpty(workGrid)
    if (!empty) { record(); return }

    // Branch-and-bound: best achievable from here = currentFilled + all
    // remaining empties. If that can't beat the best, prune.
    const remainingEmpty = workGrid.flat().filter(c => c.status === 'empty').length
    if (currentFilled + remainingEmpty < bestFilled) return

    const [targetRow, targetCol] = empty

    // Branch A: cover this cell with each available piece/rotation.
    for (const [pieceTypeKey, count] of Object.entries(remaining)) {
      if ((count ?? 0) <= 0) continue
      const pieceType = pieceTypeKey as PieceType
      for (const { rotation, cells } of getAllRotations(pieceType)) {
        for (const [dr, dc] of cells) {
          const anchorRow = targetRow - dr
          const anchorCol = targetCol - dc
          if (!canPlace(workGrid, cells, anchorRow, anchorCol)) continue

          const absoluteCells = cells.map(([r, c]) => [r + anchorRow, c + anchorCol] as [number, number])
          applyPlacement(workGrid, cells, anchorRow, anchorCol, 'placed')
          remaining[pieceType] = (count ?? 0) - 1
          current.push({ pieceType, rotation, anchorRow, anchorCol, cells: absoluteCells })
          currentFilled += cells.length
          currentPieces += 1

          search()

          currentPieces -= 1
          currentFilled -= cells.length
          current.pop()
          remaining[pieceType] = count
          applyPlacement(workGrid, cells, anchorRow, anchorCol, 'empty')
        }
      }
    }

    // Branch B: leave this cell uncovered, then continue with the rest.
    workGrid[targetRow][targetCol] = { status: 'filled' }
    search()
    workGrid[targetRow][targetCol] = { status: 'empty' }
  }

  search()
  return { placements: best, filledCells: Math.max(bestFilled, 0), totalCells }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/engine/solver.test.ts`
Expected: PASS (all bestFit tests + existing solver tests).

- [ ] **Step 5: Type check & commit**

```bash
npx tsc --noEmit
git add src/engine/solver.ts tests/engine/solver.test.ts
git commit -m "feat(solver): add bestFit max-coverage packing for partial placement"
```

---

## Task 2: Rename `auto-placing` phase → `resolving` (mechanical refactor)

Pure rename + directory move. No behavior change. Existing tests stay green after updating literals/imports.

**Files:**
- Modify: `src/types.ts`, `src/store/gameStore.ts`, `src/components/GameShell.tsx`
- Move: `src/components/AutoPlacingPhase/` → `src/components/ResolutionPhase/`
- Move: `tests/components/AutoPlacingPhase.test.tsx` → `tests/components/ResolutionPhase.test.tsx`

- [ ] **Step 1: Move the component directory and test, rename the component**

```bash
git mv src/components/AutoPlacingPhase src/components/ResolutionPhase
git mv tests/components/AutoPlacingPhase.test.tsx tests/components/ResolutionPhase.test.tsx
```

In `src/components/ResolutionPhase/index.tsx` rename the function:
```ts
export function ResolutionPhase() {
```

- [ ] **Step 2: Update the phase literal in types**

In `src/types.ts`, change the `GamePhase` union member `'auto-placing'` to `'resolving'`:
```ts
export type GamePhase =
  | 'idle'
  | 'viewing'
  | 'selecting'
  | 'resolving'
  | 'manual-placing'
  | 'scoring'
  | 'game-over'
```

- [ ] **Step 3: Update the store**

In `src/store/gameStore.ts`, in `submitSelection`'s solvable branch change `phase: 'auto-placing'` to `phase: 'resolving'`. (The unsolvable branch's `'manual-placing'` is left for Task 3.)

- [ ] **Step 4: Update GameShell**

In `src/components/GameShell.tsx`:
- Change the import `import { AutoPlacingPhase } from './AutoPlacingPhase'` to `import { ResolutionPhase } from './ResolutionPhase'`.
- Change the route line `{phase === 'auto-placing'   && <AutoPlacingPhase />}` to `{phase === 'resolving'      && <ResolutionPhase />}`.

- [ ] **Step 5: Update tests' literals & imports**

- In `tests/components/ResolutionPhase.test.tsx`: change import to `import { ResolutionPhase } from '../../src/components/ResolutionPhase'`, replace `<AutoPlacingPhase />` with `<ResolutionPhase />` (3 occurrences), and the `describe('AutoPlacingPhase with reduced motion'...)` title to `'ResolutionPhase with reduced motion'`.
- In `tests/store/gameStore.test.ts`: replace the two `expect(...).toBe('auto-placing')` assertions with `'resolving'` (in `submitSelection — correct` and `applyPlacement` → "does not change phase", and `commitRoundScore` → "does not change phase").

- [ ] **Step 6: Run all tests & type check**

Run: `npm run test && npx tsc --noEmit`
Expected: PASS, clean. (Confirm no remaining `auto-placing` / `AutoPlacingPhase` references: `grep -rn "auto-placing\|AutoPlacingPhase" src tests` returns nothing.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: rename auto-placing phase + component to resolving/ResolutionPhase"
```

---

## Task 3: Store resolution model + partial scoring

**Files:**
- Modify: `src/types.ts`, `src/store/gameStore.ts`, `src/components/ResolutionPhase/index.tsx`
- Test: `tests/store/gameStore.test.ts`

- [ ] **Step 1: Write the failing store tests**

In `tests/store/gameStore.test.ts`, **replace** the entire `describe('submitSelection — incorrect', ...)` and `describe('lives and game over', ...)` blocks with:

```ts
describe('submitSelection — perfect', () => {
  it('sets resolution kind "perfect" with coverage 1', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('perfect')
    expect(s._resolution?.coverage).toBe(1)
  })
})

describe('submitSelection — partial', () => {
  it('goes to resolving, deducts a life, and awards partial credit', () => {
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().incrementSelection('SINGLE')) // 1 cell, never a full fill
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('partial')
    expect(s.lives).toBe(2)
    expect(s._resolution!.placements.length).toBeGreaterThan(0) // the SINGLE lands somewhere
    expect(s._resolution!.coverage).toBeGreaterThan(0)
    expect(s.roundScore!.correctness).toBeGreaterThan(0)        // partial credit, not zero
    expect(s._resolution!.coverage).toBeLessThan(1)
  })
})

describe('lives and game over', () => {
  it('a wrong selection on the last life routes through resolving (not game-over)', () => {
    useGameStore.setState({ lives: 1 })
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().incrementSelection('SINGLE'))
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s.lives).toBe(0)
    expect(s._resolution?.kind).toBe('partial')
  })

  it('endGame transitions to game-over', () => {
    useGameStore.setState({ lives: 0, phase: 'resolving' })
    act(() => useGameStore.getState().endGame())
    expect(useGameStore.getState().phase).toBe('game-over')
  })
})
```

Also in this file, update `describe('applyPlacement', ...)` — the two tests read `useGameStore.getState()._autoPlaceSolution`. Replace both with `useGameStore.getState()._resolution!.placements` (i.e. `const solution = useGameStore.getState()._resolution!.placements`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/store/gameStore.test.ts`
Expected: FAIL — `_resolution` undefined, `endGame` not a function, etc.

- [ ] **Step 3: Add the `Resolution` type**

In `src/types.ts`, add after the `RoundScore` interface:
```ts
// ── Resolution (drives the resolving phase animation) ─────────────────────────

export interface Resolution {
  kind: 'perfect' | 'partial'
  placements: import('./engine/solver').Placement[]
  coverage: number   // 1 for perfect; filledCells/totalCells for partial
}
```
> If the inline `import(...)` type is awkward, instead add `import type { Placement } from './engine/solver'` at the top of `types.ts` and use `Placement[]`. (`solver.ts` already imports types from `types.ts`; a type-only back-import does not create a runtime cycle.)

- [ ] **Step 4: Update the store interface, state, and `submitSelection`**

In `src/store/gameStore.ts`:

Add import: `import { solve, bestFit } from '../engine/solver'` (replace the existing `import { solve } from '../engine/solver'`). Add `import type { Resolution } from '../types'` to the existing type import.

In the `GameStore` interface, replace `_autoPlaceSolution: Placement[] | null` with:
```ts
endGame: () => void
_resolution: Resolution | null
```

In the store creator, replace `_autoPlaceSolution: null` (both in the object literal and in `resetGame`) with `_resolution: null`. In `startGame`'s `set({...})`, replace `_autoPlaceSolution: null` with `_resolution: null`.

Replace the whole `if (result.solvable) { ... } else { ... }` block in `submitSelection` with:
```ts
    if (result.solvable) {
      const minPieces = gaps.length
      const selectedPieces = Object.values(pieceCount).reduce((s, n) => s + (n ?? 0), 0)
      const speedBonus = Math.round(MAX_SPEED_BONUS * (timeRemaining / difficulty.selectDuration))
      const efficiencyBonus = Math.round(MAX_EFFICIENCY_BONUS * (minPieces / Math.max(selectedPieces, minPieces)))

      set({
        phase: 'resolving',
        _resolution: { kind: 'perfect', placements: result.placements ?? [], coverage: 1 },
        roundScore: {
          correctness: CORRECTNESS_POINTS,
          speedBonus,
          efficiencyBonus,
          total: CORRECTNESS_POINTS + speedBonus + efficiencyBonus,
        },
      })
    } else {
      const newLives = lives - 1
      const fit = bestFit(pieceCount, grid)
      const coverage = fit.totalCells === 0 ? 0 : fit.filledCells / fit.totalCells

      const minPieces = gaps.length
      const selectedPieces = Object.values(pieceCount).reduce((s, n) => s + (n ?? 0), 0)
      const efficiencyRatio = selectedPieces === 0 ? 0 : minPieces / Math.max(selectedPieces, minPieces)

      const correctness = Math.round(CORRECTNESS_POINTS * coverage)
      const speedBonus = Math.round(MAX_SPEED_BONUS * (timeRemaining / difficulty.selectDuration) * coverage)
      const efficiencyBonus = Math.round(MAX_EFFICIENCY_BONUS * efficiencyRatio)

      set({
        phase: 'resolving',
        lives: Math.max(0, newLives),
        _resolution: { kind: 'partial', placements: fit.placements, coverage },
        roundScore: {
          correctness,
          speedBonus,
          efficiencyBonus,
          total: correctness + speedBonus + efficiencyBonus,
        },
      })
    }
```

Add the `endGame` action (e.g. next to `nextRound`):
```ts
  endGame: () => set({ phase: 'game-over' }),
```

- [ ] **Step 5: Update the ResolutionPhase component to read `_resolution`**

In `src/components/ResolutionPhase/index.tsx`, in the `useShallow` selector replace `solution: s._autoPlaceSolution,` with `resolution: s._resolution,` and destructure `resolution` instead of `solution`. Immediately after the selector, derive:
```ts
  const solution = resolution?.placements ?? null
```
The rest of the component (which uses `solution`) is unchanged for now.

- [ ] **Step 6: Run tests & type check**

Run: `npm run test && npx tsc --noEmit`
Expected: PASS, clean. (`grep -rn "_autoPlaceSolution" src tests` returns nothing.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(store): perfect/partial resolution model + partial-credit scoring"
```

---

## Task 4: Partial badge + game-over CTA on last life

**Files:**
- Create: `src/components/ResolutionPhase/PartialBadge.tsx`
- Modify: `src/components/ResolutionPhase/index.tsx`
- Test: `tests/components/ResolutionPhase.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Append to `tests/components/ResolutionPhase.test.tsx`:

```ts
import type { Grid, Cell } from '../../src/types'

function fullGrid(): Grid {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 8 }, (): Cell => ({ status: 'filled' })))
}
function emptyAt(grid: Grid, cells: [number, number][]): Grid {
  for (const [r, c] of cells) grid[r][c] = { status: 'empty' }
  return grid
}

describe('ResolutionPhase — partial (reduced motion)', () => {
  it('shows the amber "So close!" badge for high coverage', () => {
    useGameStore.setState({
      phase: 'resolving',
      lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', lockedCount: 0, freeCount: 1 }],
      roundScore: { correctness: 600, speedBonus: 0, efficiencyBonus: 100, total: 700 },
      _resolution: {
        kind: 'partial',
        coverage: 0.75,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    expect(screen.getByText(/So close/i)).toBeInTheDocument()
    expect(screen.getByText(/Next Round/)).toBeInTheDocument()
  })

  it('shows "Game Over" CTA when the partial resolution happened on the last life', () => {
    useGameStore.setState({
      phase: 'resolving',
      lives: 0,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', lockedCount: 0, freeCount: 1 }],
      roundScore: { correctness: 600, speedBonus: 0, efficiencyBonus: 100, total: 700 },
      _resolution: {
        kind: 'partial',
        coverage: 0.75,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    expect(screen.getByText(/Game Over/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: FAIL — no "So close" / "Game Over" text.

- [ ] **Step 3: Create `PartialBadge`**

Create `src/components/ResolutionPhase/PartialBadge.tsx`:
```tsx
import { motion } from 'framer-motion'

interface Props {
  show: boolean
  coverage: number   // 0..1
}

export function PartialBadge({ show, coverage }: Props) {
  if (!show) return null
  const label = coverage >= 0.66 ? 'So close!' : 'Nice try'

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-20">
      <motion.div
        className="flex items-center justify-center"
        style={{
          width: 84, height: 84, borderRadius: 22,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          boxShadow: '0 8px 24px rgba(245,158,11,.35), 0 0 0 4px rgba(245,158,11,.15)',
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: [0, 1.15, 1] }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <span className="text-4xl font-extrabold text-white">{Math.round(coverage * 100)}%</span>
      </motion.div>
      <motion.span
        className="mt-3 text-sm font-bold tracking-widest uppercase text-amber-400"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.2 }}
      >
        {label}
      </motion.span>
    </div>
  )
}
```

- [ ] **Step 4: Branch the badge and CTA in `index.tsx`**

In `src/components/ResolutionPhase/index.tsx`:

Add to the `useShallow` selector: `lives: s.lives,` and `endGame: s.endGame,` (and destructure them). Add the import: `import { PartialBadge } from './PartialBadge'` and keep the existing `CelebrationBadge` import.

Replace the `<CelebrationBadge show={badgeShown} />` line with:
```tsx
        {resolution?.kind === 'partial'
          ? <PartialBadge show={badgeShown} coverage={resolution.coverage} />
          : <CelebrationBadge show={badgeShown} />}
```

Add a CTA handler before the `return`:
```ts
  const isFinalLife = resolution?.kind === 'partial' && lives === 0
  const handleCta = () => { if (isFinalLife) endGame(); else nextRound() }
```

Replace `<NextRoundButton show={stage === 'cta'} onClick={nextRound} />` with:
```tsx
      <NextRoundButton show={stage === 'cta'} onClick={handleCta} label={isFinalLife ? 'Game Over →' : 'Next Round →'} />
```

- [ ] **Step 5: Add the `label` prop to `NextRoundButton`**

Read `src/components/ResolutionPhase/NextRoundButton.tsx`. It currently renders the hardcoded text "Next Round →". Add an optional prop:
```ts
interface Props { show: boolean; onClick: () => void; label?: string }
```
Default `label = 'Next Round →'` and render `{label}` instead of the hardcoded string. (Keep its existing idempotent-click guard intact.)

- [ ] **Step 6: Run tests & type check**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx && npx tsc --noEmit`
Expected: PASS, clean. Then `npm run test` (all green).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(resolution): amber partial badge + game-over CTA on final life"
```

---

## Task 5: Bad-piece red-X — both variants behind `?badfx`

Render a red X on the cart chips NOT used by the winning packing. Two variants, switchable by `?badfx=stamp|fly` (default `stamp`).

**Files:**
- Create: `src/components/ResolutionPhase/badFx.ts` (mode helper)
- Create: `src/components/ResolutionPhase/BadFlyerOverlay.tsx` (fly variant)
- Modify: `src/components/ResolutionPhase/SelectionCart.tsx` (stamp variant + expose bad slots)
- Modify: `src/components/ResolutionPhase/index.tsx` (compute bad slots, wire both variants)
- Test: `tests/components/ResolutionPhase.test.tsx`

- [ ] **Step 1: Write the failing test (stamp default)**

Append to `tests/components/ResolutionPhase.test.tsx`:
```ts
describe('ResolutionPhase — bad pieces (stamp, reduced motion)', () => {
  it('renders a red X on each unused (bad) chip', () => {
    useGameStore.setState({
      phase: 'resolving',
      lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      // O is used; T is left over (bad)
      selection: [{ pieceType: 'O', lockedCount: 0, freeCount: 1 }, { pieceType: 'T', lockedCount: 0, freeCount: 1 }],
      roundScore: { correctness: 400, speedBonus: 0, efficiencyBonus: 50, total: 450 },
      _resolution: {
        kind: 'partial',
        coverage: 0.5,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    expect(screen.getAllByLabelText('rejected piece')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: FAIL — no element labeled "rejected piece".

- [ ] **Step 3: Add the mode helper**

Create `src/components/ResolutionPhase/badFx.ts`:
```ts
export type BadFxMode = 'stamp' | 'fly'

export function getBadFxMode(): BadFxMode {
  if (typeof window === 'undefined') return 'stamp'
  return new URLSearchParams(window.location.search).get('badfx') === 'fly' ? 'fly' : 'stamp'
}
```

- [ ] **Step 4: Compute bad slots in `index.tsx`**

In `src/components/ResolutionPhase/index.tsx`, after `placementToSlot` is computed, derive the unclaimed (bad) slot indices:
```ts
  const badSlots = useMemo(() => {
    const claimed = new Set(placementToSlot.filter(i => i >= 0))
    return new Set(slots.map(s => s.slotIndex).filter(i => !claimed.has(i)))
  }, [placementToSlot, slots])
```
Import the mode: `import { getBadFxMode } from './badFx'` and `const badFx = getBadFxMode()`.

- [ ] **Step 5: Stamp variant in `SelectionCart`**

In `src/components/ResolutionPhase/SelectionCart.tsx`, extend `Props` with:
```ts
  badSlots?: ReadonlySet<number>
  showBadX?: boolean   // true only for the stamp variant
```
For each chip, when `showBadX && badSlots?.has(slot.slotIndex)`, wrap the chip with a shake + red-X overlay. Replace the chip render with:
```tsx
        {slots.map((slot) => {
          const dim = consumed.has(slot.slotIndex)
          const bad = !!props.showBadX && !!props.badSlots?.has(slot.slotIndex)
          return (
            <motion.div
              key={slot.slotIndex}
              ref={el => { chipRefs.current[slot.slotIndex] = el }}
              className={`relative p-1 transition-opacity duration-150 ${dim ? 'opacity-25' : 'opacity-100'}`}
              animate={bad ? { x: [0, -3, 3, -2, 2, 0] } : undefined}
              transition={bad ? { duration: 0.35 } : undefined}
            >
              <PieceShape pieceType={slot.pieceType} cellSize={11} />
              {bad && (
                <span
                  aria-label="rejected piece"
                  className="absolute inset-0 flex items-center justify-center text-red-500 font-black text-2xl pointer-events-none"
                >
                  ✕
                </span>
              )}
            </motion.div>
          )
        })}
```
Add `import { motion } from 'framer-motion'` and accept `props` (destructure `{ slots, consumed, badSlots, showBadX }` or reference via `props.`). Keep the `forwardRef`/`useImperativeHandle` and the empty-state span.

- [ ] **Step 6: Fly variant overlay**

Create `src/components/ResolutionPhase/BadFlyerOverlay.tsx`:
```tsx
import { motion } from 'framer-motion'
import { PieceShape } from '../PieceShape'
import type { PieceType } from '../../types'

export interface BadFlyer {
  pieceType: PieceType
  sourceX: number
  sourceY: number
  /** A point toward the grid the chip lunges at before being rejected. */
  towardX: number
  towardY: number
}

interface Props {
  containerRect: DOMRect
  flyers: BadFlyer[]
}

// Cart chips render at cellSize=11; lunge toward the grid then bounce back + X.
export function BadFlyerOverlay({ containerRect, flyers }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
      {flyers.map((f, i) => {
        const sx = f.sourceX - containerRect.left
        const sy = f.sourceY - containerRect.top
        const mx = (f.towardX - containerRect.left) * 0.5 + sx * 0.5
        const my = (f.towardY - containerRect.top) * 0.5 + sy * 0.5
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: 0, top: 0, transformOrigin: 'top left' }}
            initial={{ x: sx, y: sy, scale: 1, opacity: 1 }}
            animate={{ x: [sx, mx, sx], y: [sy, my, sy], opacity: [1, 1, 0] }}
            transition={{ duration: 0.6, times: [0, 0.5, 1], ease: 'easeInOut', delay: i * 0.1 }}
          >
            <div className="relative">
              <PieceShape pieceType={f.pieceType} cellSize={11} />
              <motion.span
                aria-label="rejected piece"
                className="absolute inset-0 flex items-center justify-center text-red-500 font-black text-2xl"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0, 1], scale: [0.5, 1.2] }}
                transition={{ delay: i * 0.1 + 0.3, duration: 0.25 }}
              >
                ✕
              </motion.span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 7: Wire both variants in `index.tsx`**

- Pass stamp props to the cart: `<SelectionCart ref={cartRef} slots={slots} consumed={consumed} badSlots={badSlots} showBadX={badFx === 'stamp'} />`
- For the fly variant, after the good-piece flight finishes (reuse the same measuring infra), build `BadFlyer[]` from `badSlots` (source = `cartRef.current.getChipRect(slotIdx)`, toward = center of `rootRef`/grid rect) and render `<BadFlyerOverlay>` when `badFx === 'fly'` during/after the `flying` stage. A minimal correct wiring: build the bad flyers in the same `useLayoutEffect` that builds the good flyers (guarded by `badFx === 'fly'`), store them in state, and render the overlay while `stage === 'flying' || stage === 'badge'`. Reduced-motion path: skip fly, the cart already shows nothing for fly mode — so in reduced motion, force stamp rendering (`showBadX={badFx === 'stamp' || reduceMotion}`) so bad pieces are still visible.

> The fly variant is a prototype to be judged in Task 6; keep its wiring simple and correct rather than elaborate. The unit test pins the stamp variant (default + reduced motion).

- [ ] **Step 8: Run tests & type check**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx && npx tsc --noEmit`
Expected: PASS, clean. Then `npm run test`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(resolution): red-X on bad pieces — stamp + fly variants behind ?badfx"
```

---

## Task 6: Browser comparison of FX variants → pick one → delete the loser

This task is interactive: it produces screenshots/recordings of both variants for the user, gets the decision, then deletes the unused variant and the `?badfx` switch.

**Files:** `src/components/ResolutionPhase/*`, `tests/components/ResolutionPhase.test.tsx`

- [ ] **Step 1: Start the dev server and force a partial resolution**

Start the dev server (`preview_start`, project runs on http://localhost:5173). To deterministically reach a partial resolution with at least one bad piece, drive the store via the dev `window.__store` hook (exposed in `src/main.tsx` under `import.meta.env.DEV`). Example to run in the browser (`preview_eval`):
```js
const s = window.__store.getState()
const full = Array.from({length:10},()=>Array.from({length:8},()=>({status:'filled'})))
;[[0,0],[0,1],[1,0],[1,1]].forEach(([r,c])=>full[r][c]={status:'empty'})
window.__store.setState({
  phase:'resolving', lives:2, grid:full,
  selection:[{pieceType:'O',lockedCount:0,freeCount:1},{pieceType:'T',lockedCount:0,freeCount:1}],
  roundScore:{correctness:400,speedBonus:120,efficiencyBonus:50,total:570},
  _resolution:{kind:'partial',coverage:0.5,placements:[{pieceType:'O',rotation:0,anchorRow:0,anchorCol:0,cells:[[0,0],[0,1],[1,0],[1,1]]}]},
})
```

- [ ] **Step 2: Capture the stamp variant**

Navigate to `http://localhost:5173/?badfx=stamp`, re-run the Step 1 eval, and `preview_screenshot` the resolving view (the O lands, the T chip shakes + red-X). Capture mid-animation if possible.

- [ ] **Step 3: Capture the fly variant**

Navigate to `http://localhost:5173/?badfx=fly`, re-run the Step 1 eval, and `preview_screenshot` the fly-and-reject motion (T chip lunges toward the grid then dissolves with a red X).

- [ ] **Step 4: Present both to the user and get the decision**

Show both screenshots and use `AskUserQuestion` to ask which variant ships (Stamp vs Fly). Do not proceed until answered.

- [ ] **Step 5: Delete the loser + remove the `?badfx` switch**

Once chosen:
- Delete `src/components/ResolutionPhase/badFx.ts` and remove `getBadFxMode`/`badFx` usage.
- Hardcode the chosen variant in `index.tsx` (stamp: `showBadX` always true; fly: always render `BadFlyerOverlay`, and in reduced motion fall back to the stamp-style static X so bad pieces remain visible).
- If **stamp** chosen: delete `BadFlyerOverlay.tsx`.
- If **fly** chosen: keep `BadFlyerOverlay.tsx`; in `SelectionCart`, keep a static red-X path only for the reduced-motion fallback (remove the `?badfx` gating).

- [ ] **Step 6: Run tests, type check, commit**

If the chosen variant changes what the existing bad-piece test asserts (e.g. fly renders the X in an overlay rather than the cart), update the test to match the shipped behavior (still assert `getAllByLabelText('rejected piece')` count = number of bad pieces).

Run: `npm run test && npx tsc --noEmit`
```bash
git add -A
git commit -m "feat(resolution): ship chosen bad-piece FX; remove badfx switch + unused variant"
```

---

## Task 7: Delete dead code — manual placement, carry-overs, locked pieces

Remove everything the new flow makes obsolete. This is one cohesive task that must end with a green build and passing tests.

**Files:**
- Delete: `src/components/PlacingPhase.tsx`
- Modify: `src/types.ts`, `src/store/gameStore.ts`, `src/components/GameShell.tsx`, `src/components/SelectingPhase.tsx`, `src/components/Grid.tsx`, `src/components/ResolutionPhase/SelectionCart.tsx`, `src/components/ScoringPhase.tsx`, `src/engine/cartSlots.ts`
- Test: `tests/store/gameStore.test.ts`, `tests/engine/cartSlots.test.ts`
- Docs: `CLAUDE.md`

- [ ] **Step 1: Remove store actions, state, and carry-over logic**

In `src/store/gameStore.ts`:
- From the `GameStore` interface, delete: `placePiece`, `finishManualPlace`, `holdPiece`, `rotatePiece`, `clearHeld`.
- Delete the implementations of those five actions.
- Remove the `getRotatedCells` import and `Placement`/`Rotation` imports if now unused (let `tsc` tell you).
- In `INITIAL_STATE`, remove `carryOvers: []` and `heldPiece: null`.
- In `startGame`: remove the `carryOvers` read and the `selection` mapping from carry-overs; set `selection: []` directly. Remove `heldPiece: null` from the `set`.
- In `commitRoundScore`: remove `carryOvers: []` from the returned object (so it just returns `{ score: ... }`).

- [ ] **Step 2: Remove dead types**

In `src/types.ts`:
- Remove `'manual-placing'` and `'scoring'` from the `GamePhase` union (the resolving flow never sets them; game-over is reached via `endGame`).
- In `GameState`, remove `carryOvers: CarryOver[]` and `heldPiece: HeldPiece | null`.
- In `SelectionEntry`, remove the `lockedCount` field (keep `pieceType` and `freeCount`).
- Delete the now-unused `CarryOver` and `HeldPiece` interfaces.

- [ ] **Step 3: Update `cartSlots`**

In `src/engine/cartSlots.ts`, in `expandCartSlots` change `const total = entry.lockedCount + entry.freeCount` to `const total = entry.freeCount`.

- [ ] **Step 4: Fix `incrementSelection` / `decrementSelection` / `placePiece` remnants**

In `src/store/gameStore.ts`, `incrementSelection` currently creates `{ pieceType, lockedCount: 0, freeCount: 1 }` — change to `{ pieceType, freeCount: 1 }`. `decrementSelection`'s `.filter(e => e.lockedCount > 0 || e.freeCount > 0)` → `.filter(e => e.freeCount > 0)`. (These compile-fail until fixed.)

- [ ] **Step 5: Remove manual UI**

- Delete `src/components/PlacingPhase.tsx`.
- In `src/components/GameShell.tsx`: remove `import { PlacingPhase } from './PlacingPhase'` and the `{phase === 'manual-placing' && <PlacingPhase />}` line. Change `{(phase === 'scoring' || phase === 'game-over') && <ScoringPhase />}` to `{phase === 'game-over' && <ScoringPhase />}`.
- In `src/components/SelectingPhase.tsx`: replace the selection-chip block (lines that read `entry.lockedCount`, build `label`/`isLocked`, and the locked styling) with the simple free-only version:
```tsx
          {selection.filter(e => e.freeCount > 0).map(entry => (
            <button
              key={entry.pieceType}
              onClick={() => decrementSelection(entry.pieceType)}
              className="flex flex-col items-center gap-1 p-2 rounded-lg border text-xs
                border-blue-500 bg-blue-950 text-blue-300 cursor-pointer hover:bg-blue-900"
            >
              <PieceShape pieceType={entry.pieceType} cellSize={11} />
              <span>×{entry.freeCount}</span>
            </button>
          ))}
```
- In `src/components/Grid.tsx`: remove `const heldPiece = useGameStore(s => s.heldPiece)` and change the cursor block `if (onCellClick && heldPiece && cell?.status === 'empty')` to `if (onCellClick && cell?.status === 'empty')`.
- In `src/components/ResolutionPhase/SelectionCart.tsx`: it has no locked styling to remove (locked chips were only in `SelectingPhase`/`PlacingPhase`); confirm via `grep -n locked src/components/ResolutionPhase/SelectionCart.tsx` — if anything matches, delete it.

- [ ] **Step 6: Simplify `ScoringPhase` (game-over only)**

`ScoringPhase` now only renders for `game-over`. In `src/components/ScoringPhase.tsx`, remove the `phase`/`nextRound` selector usage and the `isGameOver` branch — keep only the Game Over heading and the "Play Again" (`resetGame`) button. (Read the file first; keep the score breakdown + total display.)

- [ ] **Step 7: Update tests for removed surface**

- `tests/engine/cartSlots.test.ts`: remove the `lockedCount` from every `SelectionEntry` literal (the field no longer exists) — replace `{ pieceType: 'I', lockedCount: 0, freeCount: 3 }` with `{ pieceType: 'I', freeCount: 3 }`, etc. Delete the test `'counts both locked and free pieces'` (no longer meaningful) or convert it to `freeCount: 3` expecting length 3.
- `tests/store/gameStore.test.ts`:
  - Delete the test `'cannot decrement locked pieces'` (locked pieces removed).
  - In `commitRoundScore` → `'clears carryOvers'`: delete this test (carryOvers removed). 
  - Any `useGameStore.setState({ carryOvers: [...] })` lines must be removed.
- `tests/components/ResolutionPhase.test.tsx`: the partial/bad-piece fixtures added in Tasks 4–5 set `selection` literals with `lockedCount: 0`. Remove `lockedCount: 0` from each so they match the new `SelectionEntry` shape (`{ pieceType, freeCount }`).
- Search for stragglers: `grep -rn "lockedCount\|carryOver\|manual-placing\|heldPiece\|placePiece\|finishManualPlace\|PlacingPhase" src tests` must return nothing.

- [ ] **Step 8: Run tests & type check**

Run: `npm run test && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 9: Update CLAUDE.md**

The test count and the round-loop / carry-over sections in `CLAUDE.md` are now stale. Update:
- The "Run tests" line: replace the hardcoded "48 tests" with the current count (run `npm run test` and read the total).
- The "Round loop" → resolution section: replace the manual-place/auto-place description with the perfect/partial resolution model (wrong selection → lose a life → best-fit placement → partial credit → clean slate).
- Remove the "Carry-overs" section and the "Carry-over clearing" critical rule (no longer applicable).
- Update the file map: `AutoPlacingPhase` → `ResolutionPhase`; remove `PlacingPhase.tsx`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: remove manual placement, carry-overs, and locked pieces"
```

---

## Final verification

- [ ] `npm run test` — all green.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `grep -rn "auto-placing\|AutoPlacingPhase\|manual-placing\|lockedCount\|carryOver\|heldPiece\|placePiece\|finishManualPlace\|_autoPlaceSolution\|badfx" src tests` — returns nothing (badfx only if a variant was kept that still references it — should be removed in Task 6).
- [ ] Manual smoke in browser (`npm run dev`): play a round, deliberately make a wrong selection — confirm: one life lost, good pieces fly in, bad piece(s) get the red X, partial score shows, Next Round gives a clean cart; on the last life the wrong selection still animates then shows Game Over.

---

## Self-review notes (author)

- **Spec coverage:** best-fit algorithm → Task 1; phase rename/unification → Tasks 2–4; partial scoring → Task 3; amber badge + last-life game-over → Task 4; bad-piece FX (both, user picks) → Tasks 5–6; dead-code removal (PlacingPhase, carryOvers, lockedCount, manual actions, scoring literal) → Task 7; tests throughout; CLAUDE.md update → Task 7 Step 9.
- **Type consistency:** `Resolution { kind, placements, coverage }`, `_resolution`, `endGame`, `bestFit`/`BestFitResult { placements, filledCells, totalCells }`, `NextRoundButton` gains `label`, `SelectionCart` gains `badSlots`/`showBadX`, `SelectionEntry` loses `lockedCount` (keeps `freeCount`) — used consistently across tasks.
- **Green between tasks:** Task 2 is a pure rename; Task 3 keeps dead manual code compiling; removal is deferred to Task 7 where all references are fixed together.
