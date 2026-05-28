# Gameplay Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship six gameplay changes — a 12×12 board, a gentler view-timer ramp extended to 15 rounds, failed-round retry flow, a negative-accuracy failure penalty, a slow-speed turtle icon, and a three-tier failure badge.

**Architecture:** Logic changes live in `store/gameStore.ts` (difficulty table, scoring, retry action) and `types.ts` (board dims). UI changes live in the `ResolutionPhase/` components (`index.tsx` CTA wiring, `PartialBadge.tsx` tiers, `ScorePanel.tsx` icons/penalty rendering, `NextRoundButton.tsx` variants). The board grows by changing the `ROWS`/`COLS` constants — `Grid`, `puzzleGenerator`, and `solver` already read them.

**Tech Stack:** React + TypeScript, Zustand 5 (use `useShallow` for object selectors), framer-motion, Vitest + Testing Library, Tailwind, Vite.

**Spec:** `docs/superpowers/specs/2026-05-28-gameplay-polish-design.md`

**Project rules (from CLAUDE.md / memory):**
- Verify with `npm run build` AND `npm run test` AND lint — `tsc --noEmit` alone misses `noUnusedLocals`.
- nvm quirk: do not chain commands with `&&` if they trigger `__init_nvm`; run `npm`/`npx` as separate Bash calls.
- Zustand 5 object selectors MUST use `useShallow`.
- The solver's outer piece-type loop must not `break` early (unchanged here, just don't regress it).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/types.ts` | `ROWS`/`COLS` constants | 10×8 → 12×12 |
| `src/engine/puzzleGenerator.ts` | gap placement | bump attempt cap for denser boards |
| `src/store/gameStore.ts` | difficulty table, scoring, actions | new table; failure penalty; `retryRound`; grand-total floor; export `MAX_SPEED_BONUS` |
| `src/components/ResolutionPhase/index.tsx` | CTA wiring + ScorePanel props | retry/next/gameover branching; `isFailure`/`speedSlow`/floored `grandTotal` |
| `src/components/ResolutionPhase/NextRoundButton.tsx` | CTA button | `variant` prop (next/retry/gameover) |
| `src/components/ResolutionPhase/PartialBadge.tsx` | failure badge | three tiers (So Close / Tough Round / Yikes) |
| `src/components/ResolutionPhase/ScorePanel.tsx` | score rows | negative accuracy; hide Speed/Efficiency on fail; turtle icon |
| `CLAUDE.md` | project docs | grid size, difficulty, round loop, scoring, test count |
| `tests/*` | tests | updated to match new spec |

---

## Task 1: Grow the board to 12×12

Changing `ROWS`/`COLS` ripples into every test that builds a grid by hand or asserts `grid.length`. Do all of it here so the suite stays green.

**Files:**
- Modify: `src/types.ts:25-29`
- Modify: `src/engine/puzzleGenerator.ts:53` (attempt cap)
- Test: `tests/engine/puzzleGenerator.test.ts` (add gapCount-16 case)
- Modify (test helpers/asserts): `tests/store/gameStore.test.ts:37`, `tests/store/gameStore.test.ts:235-237`, `tests/components/ResolutionPhase.test.tsx:64-67`

- [ ] **Step 1: Write the failing test** — a denser board must support 16 gaps. Add to `tests/engine/puzzleGenerator.test.ts` inside the `describe('generatePuzzle', …)` block:

```ts
  it('places a high gap count on the larger board', () => {
    const { gaps } = generatePuzzle({ gapCount: 16, complexity: 'complex' })
    expect(gaps).toHaveLength(16)
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/engine/puzzleGenerator.test.ts -t "high gap count"`
Expected: FAIL — on the 10×8 (80-cell) board the generator can't fit 16 tetromino gaps, so `gaps` is shorter than 16.

- [ ] **Step 3: Grow the board** in `src/types.ts` — replace lines 25-29:

```ts
/** Grid is ROWS × COLS. grid[row][col]. 12 rows, 12 cols. */
export type Grid = Cell[][]

export const ROWS = 12 as const
export const COLS = 12 as const
```

- [ ] **Step 4: Raise the placement attempt cap** in `src/engine/puzzleGenerator.ts` — the denser late-round boards need more random tries. Change line 54's condition `attempts < 1000` to `attempts < 4000`:

```ts
  while (gaps.length < gapCount && attempts < 4000) {
```

- [ ] **Step 5: Fix grids that other tests build by hand.** The solver iterates `0..ROWS`/`0..COLS`, so a hand-built grid smaller than 12×12 now throws (`grid[10]` is `undefined`).

In `tests/store/gameStore.test.ts`, change the `startGame` grid-length assertion (line 37) from:
```ts
    expect(useGameStore.getState().grid).toHaveLength(10)
```
to:
```ts
    expect(useGameStore.getState().grid).toHaveLength(12)
```

And update the `fullGrid()` helper (lines 235-237) to 12×12:
```ts
function fullGrid(): Grid {
  return Array.from({ length: 12 }, () =>
    Array.from({ length: 12 }, (): Cell => ({ status: 'filled' })))
}
```

In `tests/components/ResolutionPhase.test.tsx`, update its `fullGrid()` helper (lines 64-67) to 12×12:
```ts
function fullGrid(): Grid {
  return Array.from({ length: 12 }, () =>
    Array.from({ length: 12 }, (): Cell => ({ status: 'filled' })))
}
```

(`tests/engine/solver.test.ts` and `tests/engine/puzzleGenerator.test.ts` already build grids from the `ROWS`/`COLS` imports, so they adapt automatically. The hand-placed cells they use — rows 0-3, cols 0-7, and `[5..6][5..6]` — all fit inside 12×12.)

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS (all tests, including the new gapCount-16 case).

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/engine/puzzleGenerator.ts tests/engine/puzzleGenerator.test.ts tests/store/gameStore.test.ts tests/components/ResolutionPhase.test.tsx
git commit -m "feat(board): grow grid to 12x12"
```

---

## Task 2: New difficulty table — gentler ramp, more gaps, 15 rounds

**Files:**
- Modify: `src/store/gameStore.ts:11-22`
- Test: `tests/store/gameStore.test.ts:225-233` (replace the `DIFFICULTY_TABLE` describe block)

- [ ] **Step 1: Write the failing tests.** Replace the existing `describe('DIFFICULTY_TABLE', …)` block (lines 225-233) in `tests/store/gameStore.test.ts` with:

```ts
describe('DIFFICULTY_TABLE', () => {
  it('round 1 still starts at a 5000ms view duration', () => {
    expect(DIFFICULTY_TABLE[0].viewDuration).toBe(5000)
  })

  it('has 15 rounds', () => {
    expect(DIFFICULTY_TABLE).toHaveLength(15)
  })

  it('eases the view timer gently — round 2 is only ~300ms faster', () => {
    expect(DIFFICULTY_TABLE[1].viewDuration).toBe(4700)
  })

  it('view duration never increases and floors at 2500ms', () => {
    for (let i = 1; i < DIFFICULTY_TABLE.length; i++) {
      expect(DIFFICULTY_TABLE[i].viewDuration).toBeLessThanOrEqual(DIFFICULTY_TABLE[i - 1].viewDuration)
    }
    expect(DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1].viewDuration).toBe(2500)
  })

  it('gap count climbs across the run so the board stays full', () => {
    expect(DIFFICULTY_TABLE[0].gapCount).toBe(3)
    expect(DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1].gapCount).toBeGreaterThanOrEqual(13)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/store/gameStore.test.ts -t "DIFFICULTY_TABLE"`
Expected: FAIL — current table has 10 entries, round 2 is 5000 (not 4700), last gapCount is 7.

- [ ] **Step 3: Replace the table** in `src/store/gameStore.ts` (lines 11-22):

```ts
export const DIFFICULTY_TABLE: DifficultyConfig[] = [
  { viewDuration: 5000, selectDuration: 15000, placeDuration: 60000, gapCount:  3, complexity: 'simple'  },
  { viewDuration: 4700, selectDuration: 15000, placeDuration: 60000, gapCount:  4, complexity: 'simple'  },
  { viewDuration: 4400, selectDuration: 14000, placeDuration: 60000, gapCount:  5, complexity: 'simple'  },
  { viewDuration: 4100, selectDuration: 14000, placeDuration: 60000, gapCount:  6, complexity: 'medium'  },
  { viewDuration: 3800, selectDuration: 13000, placeDuration: 60000, gapCount:  7, complexity: 'medium'  },
  { viewDuration: 3500, selectDuration: 13000, placeDuration: 60000, gapCount:  8, complexity: 'medium'  },
  { viewDuration: 3300, selectDuration: 12000, placeDuration: 60000, gapCount:  9, complexity: 'complex' },
  { viewDuration: 3100, selectDuration: 12000, placeDuration: 60000, gapCount: 10, complexity: 'complex' },
  { viewDuration: 2900, selectDuration: 11000, placeDuration: 60000, gapCount: 11, complexity: 'complex' },
  { viewDuration: 2800, selectDuration: 11000, placeDuration: 60000, gapCount: 12, complexity: 'complex' },
  { viewDuration: 2700, selectDuration: 10000, placeDuration: 60000, gapCount: 13, complexity: 'complex' },
  { viewDuration: 2600, selectDuration: 10000, placeDuration: 60000, gapCount: 14, complexity: 'complex' },
  { viewDuration: 2500, selectDuration:  9000, placeDuration: 60000, gapCount: 15, complexity: 'complex' },
  { viewDuration: 2500, selectDuration:  9000, placeDuration: 60000, gapCount: 16, complexity: 'complex' },
  { viewDuration: 2500, selectDuration:  9000, placeDuration: 60000, gapCount: 16, complexity: 'complex' },
]
```

(`getDifficulty` already clamps `round - 1` to the last index, so round 15+ uses the final row.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/store/gameStore.test.ts -t "DIFFICULTY_TABLE"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.test.ts
git commit -m "feat(difficulty): gentler view ramp, scaled gaps, 15 rounds"
```

---

## Task 3: Failure scoring → negative accuracy penalty, no bonuses

**Files:**
- Modify: `src/store/gameStore.ts:28-32` (constants), `src/store/gameStore.ts:155-188` (unsolvable branch)
- Test: `tests/store/gameStore.test.ts` (update `submitSelection — partial`; add a penalty describe block)

- [ ] **Step 1: Write the failing tests.** First, update the existing `submitSelection — partial` test (lines 107-122) to expect a penalty instead of partial credit:

```ts
describe('submitSelection — partial', () => {
  it('goes to resolving, deducts a life, and applies a negative accuracy penalty', () => {
    act(() => useGameStore.getState().startGame())
    act(() => useGameStore.getState().endViewing())
    act(() => useGameStore.getState().incrementSelection('SINGLE')) // 1 cell, never a full fill
    act(() => useGameStore.getState().submitSelection())
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('partial')
    expect(s.lives).toBe(2)
    expect(s._resolution!.placements.length).toBeGreaterThan(0)
    expect(s._resolution!.coverage).toBeGreaterThan(0)
    expect(s._resolution!.coverage).toBeLessThan(1)
    expect(s.roundScore!.correctness).toBeLessThan(0)   // penalty, not credit
    expect(s.roundScore!.speedBonus).toBe(0)
    expect(s.roundScore!.efficiencyBonus).toBe(0)
  })
})
```

Then add a dedicated penalty block. Put it right after the existing `submitSelection — failure reason` block at the end of the file, and add `Gap` to the type import on line 4 (`import type { Grid, Cell, PieceType, Gap } from '../../src/types'`):

```ts
// Penalty reads only gaps.length (for "needed"), so a length-only stub is fine.
function stubGaps(n: number): Gap[] {
  return Array.from({ length: n }, () => ({
    pieceType: 'O' as const, rotation: 0 as const, anchorRow: 0, anchorCol: 0, cells: [],
  }))
}
function submitForScore(
  grid: Grid,
  gaps: Gap[],
  selection: { pieceType: PieceType; freeCount: number }[],
) {
  useGameStore.setState({
    grid, gaps, selection, lives: 3,
    difficulty: DIFFICULTY_TABLE[0], phaseStartTime: Date.now(),
  })
  act(() => useGameStore.getState().submitSelection())
  return useGameStore.getState().roundScore!
}

describe('submitSelection — failure penalty', () => {
  it('penalizes extra pieces by -50 each, with no speed/efficiency', () => {
    // one O gap (4 cells, needs 1 piece); select O + T → T is wasted (1 extra)
    const grid = emptyAt(fullGrid(), O_GAP_1)
    const rs = submitForScore(grid, stubGaps(1), [
      { pieceType: 'O', freeCount: 1 },
      { pieceType: 'T', freeCount: 1 },
    ])
    expect(rs.correctness).toBe(-50)
    expect(rs.speedBonus).toBe(0)
    expect(rs.efficiencyBonus).toBe(0)
    expect(rs.total).toBe(-50)
  })

  it('penalizes missing pieces by -50 each', () => {
    // two O gaps (needs 2), select nothing → 2 missing
    const grid = emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2)
    const rs = submitForScore(grid, stubGaps(2), [])
    expect(rs.correctness).toBe(-100)
    expect(rs.total).toBe(-100)
  })

  it('caps the penalty at -400', () => {
    // pretend 12 gaps are needed but nothing is selected → 12 missing → -600, capped at -400
    const grid = emptyAt(fullGrid(), O_GAP_1)
    const rs = submitForScore(grid, stubGaps(12), [])
    expect(rs.correctness).toBe(-400)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/store/gameStore.test.ts -t "penalty"`
Expected: FAIL — current code awards positive `correctness` via coverage and non-zero bonuses.

- [ ] **Step 3: Add scoring constants** in `src/store/gameStore.ts`. Replace lines 28-32:

```ts
// ── Scoring constants ────────────────────────────────────────────────────────

const CORRECTNESS_POINTS = 800
export const MAX_SPEED_BONUS = 500
const MAX_EFFICIENCY_BONUS = 300

const PENALTY_PER_PIECE = 50   // points docked per wrong/missing piece on a failed round
const MAX_PENALTY = 400        // failed-round penalty floor (never worse than -400)
```

- [ ] **Step 4: Rewrite the unsolvable branch** in `src/store/gameStore.ts`. Replace the `else { … }` block (lines 155-188) with the version below. The `coverage`/`reason` computation is unchanged; only the scoring changes (penalty; zeroed bonuses):

```ts
    } else {
      const newLives = lives - 1
      const fit = bestFit(pieceCount, grid)
      const coverage = fit.totalCells === 0 ? 0 : fit.filledCells / fit.totalCells

      const uncovered = fit.totalCells - fit.filledCells
      const selectedCells = Object.entries(pieceCount)
        .reduce((sum, [type, n]) => sum + (n ?? 0) * (type === 'SINGLE' ? 1 : 4), 0)
      let reason: ResolutionReason
      if (uncovered === 0) reason = 'too-many'
      else if (selectedCells >= fit.totalCells) reason = 'wrong-shapes'
      // uncovered cells → nearest whole piece, clamped to ≥1
      else reason = Math.max(1, Math.round(uncovered / 4)) === 1 ? 'missed-one' : 'missed-many'

      // Failed round: accuracy is a penalty scaled by how wrong the selection was.
      // Bigger over-selection OR bigger shortfall = bigger penalty. No speed/efficiency.
      const placed = fit.placements.length
      const selectedPieces = Object.values(pieceCount).reduce((s, n) => s + (n ?? 0), 0)
      const needed = gaps.length
      const extra = Math.max(0, selectedPieces - placed)
      const missing = Math.max(0, needed - placed)
      const penalty = -Math.min(MAX_PENALTY, PENALTY_PER_PIECE * (extra + missing))

      set({
        phase: 'resolving',
        lives: Math.max(0, newLives),
        _resolution: { kind: 'partial', placements: fit.placements, coverage, reason },
        roundScore: {
          correctness: penalty,
          speedBonus: 0,
          efficiencyBonus: 0,
          total: penalty,
        },
      })
    }
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run tests/store/gameStore.test.ts`
Expected: PASS (penalty block + updated partial test; the `scoring` block that checks the *perfect* path still passes because the perfect branch is untouched).

- [ ] **Step 6: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.test.ts
git commit -m "feat(scoring): failed rounds dock accuracy, drop bonuses"
```

---

## Task 4: Grand-total floor + `retryRound` action

**Files:**
- Modify: `src/types.ts` is NOT touched; `src/store/gameStore.ts:36-48` (interface), `:201-213` (commit + actions)
- Test: `tests/store/gameStore.test.ts` (add floor test to `commitRoundScore`; add `retryRound`/`nextRound` blocks)

- [ ] **Step 1: Write the failing tests.** Add a floor test inside the existing `describe('commitRoundScore', …)` block:

```ts
  it('floors the running score at 0 on a net-negative round', () => {
    useGameStore.setState({
      score: 50,
      roundScore: { correctness: -200, speedBonus: 0, efficiencyBonus: 0, total: -200 },
    })
    act(() => useGameStore.getState().commitRoundScore())
    expect(useGameStore.getState().score).toBe(0)   // 50 + (-200) = -150 → floored to 0
  })
```

And add two new blocks (anywhere top-level, e.g. after the `commitRoundScore` describe):

```ts
describe('retryRound', () => {
  it('regenerates the puzzle at the same round and returns to viewing', () => {
    act(() => useGameStore.getState().startGame())
    const before = useGameStore.getState().round
    act(() => useGameStore.getState().retryRound())
    expect(useGameStore.getState().round).toBe(before)   // round does NOT advance
    expect(useGameStore.getState().phase).toBe('viewing')
  })
})

describe('nextRound', () => {
  it('advances the round number', () => {
    act(() => useGameStore.getState().startGame())
    const before = useGameStore.getState().round
    act(() => useGameStore.getState().nextRound())
    expect(useGameStore.getState().round).toBe(before + 1)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/store/gameStore.test.ts -t "retryRound"`
Expected: FAIL — `retryRound` is not a function (TypeScript/runtime error).

- [ ] **Step 3: Declare `retryRound`** in the `GameStore` interface in `src/store/gameStore.ts`. Add the line after `nextRound` (line 42):

```ts
  nextRound: () => void
  retryRound: () => void
```

- [ ] **Step 4: Floor the score** in `commitRoundScore` (lines 201-208):

```ts
  commitRoundScore: () => {
    set(state => {
      if (!state.roundScore) return {}
      return {
        score: Math.max(0, state.score + state.roundScore.total),
      }
    })
  },
```

- [ ] **Step 5: Add the `retryRound` action** right after `nextRound` (after line 213). It regenerates the current round without incrementing — `startGame` already reads the current `round`:

```ts
  retryRound: () => {
    get().startGame()
  },
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run tests/store/gameStore.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.test.ts
git commit -m "feat(store): floor score at 0, add retryRound action"
```

---

## Task 5: CTA wiring — Try Again / Next Round / Game Over

**Files:**
- Modify: `src/components/ResolutionPhase/NextRoundButton.tsx` (variant prop)
- Modify: `src/components/ResolutionPhase/index.tsx:24-35` (selector), `:154-199` (CTA + props)
- Modify: `src/components/ResolutionPhase/ScorePanel.tsx:6-14` (accept new optional props — consumed in Task 7)
- Test: `tests/components/ResolutionPhase.test.tsx` (update partial test; add Try Again test)

- [ ] **Step 1: Write the failing tests.** In `tests/components/ResolutionPhase.test.tsx`, update the partial high-coverage test (lines 180-198) so it expects **Try Again** (a partial with lives left is now a retry, not an advance):

```ts
describe('ResolutionPhase — partial (reduced motion)', () => {
  it('shows the amber "So close!" badge and a Try Again CTA for high coverage with lives left', () => {
    useGameStore.setState({
      phase: 'resolving',
      lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { correctness: -50, speedBonus: 0, efficiencyBonus: 0, total: -50 },
      _resolution: {
        kind: 'partial',
        coverage: 0.75,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    expect(screen.getByText(/So close/i)).toBeInTheDocument()
    expect(screen.getByText(/Try Again/)).toBeInTheDocument()
  })
```

Add a retry-behavior test inside the same `describe` (before its closing `})`), then leave the existing "Game Over" test as-is:

```ts
  it('Try Again regenerates the round without advancing, returning to viewing', async () => {
    const user = userEvent.setup()
    act(() => useGameStore.getState().startGame())   // establishes round 1 + a grid
    useGameStore.setState({
      phase: 'resolving',
      lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { correctness: -50, speedBonus: 0, efficiencyBonus: 0, total: -50 },
      _resolution: {
        kind: 'partial',
        coverage: 0.5,
        reason: 'too-many',
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    const before = useGameStore.getState().round
    await user.click(screen.getByText(/Try Again/))
    expect(useGameStore.getState().round).toBe(before)     // same round
    expect(useGameStore.getState().phase).toBe('viewing')  // fresh puzzle
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx -t "Try Again"`
Expected: FAIL — current code renders "Next Round →" for a partial with lives left, and there is no Try Again handler.

- [ ] **Step 3: Add the `variant` prop to the button.** Replace the whole body of `src/components/ResolutionPhase/NextRoundButton.tsx`:

```tsx
import { useRef } from 'react'
import { motion } from 'framer-motion'

export type CtaVariant = 'next' | 'retry' | 'gameover'

interface Props {
  show: boolean
  onClick: () => void
  label: string
  variant: CtaVariant
}

const VARIANT_CLASSES: Record<CtaVariant, string> = {
  next:     'bg-green-700 hover:bg-green-600 text-white shadow-lg shadow-green-900/40',
  retry:    'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/40',
  gameover: 'bg-red-900 border-2 border-red-500 text-red-300',
}

export function NextRoundButton({ show, onClick, label, variant }: Props) {
  const fired = useRef(false)

  if (!show) return null

  const handleClick = () => {
    if (fired.current) return
    fired.current = true
    onClick()
  }

  return (
    <motion.button
      onClick={handleClick}
      className={`w-full py-3 rounded-xl font-bold cursor-pointer ${VARIANT_CLASSES[variant]}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {label}
    </motion.button>
  )
}
```

- [ ] **Step 4: Wire the CTA in `index.tsx`.** Add `retryRound` to the store selector (lines 25-35) — add the line `retryRound: s.retryRound,` alongside `nextRound`:

```tsx
  const { selection, resolution, applyPlacement, roundScore, commitRoundScore, nextRound, retryRound, lives, endGame } =
    useGameStore(useShallow(s => ({
      selection: s.selection,
      resolution: s._resolution,
      applyPlacement: s.applyPlacement,
      roundScore: s.roundScore,
      commitRoundScore: s.commitRoundScore,
      nextRound: s.nextRound,
      retryRound: s.retryRound,
      lives: s.lives,
      endGame: s.endGame,
    })))
```

Add `MAX_SPEED_BONUS` to the gameStore import at the top of the file (line 3):
```tsx
import { useGameStore, MAX_SPEED_BONUS } from '../../store/gameStore'
```

Replace the CTA-decision block + render (lines 156-199). The `accuracyTier` computation stays; replace from `isFinalLife` through the `<NextRoundButton …/>`:

```tsx
  const accuracyTier: 'perfect' | 'close' | 'far' =
    resolution?.kind === 'perfect' ? 'perfect'
      : (resolution && resolution.coverage >= 0.66 ? 'close' : 'far')

  const isFailure = resolution?.kind === 'partial'
  const speedSlow = !!roundScore && roundScore.speedBonus <= MAX_SPEED_BONUS * 0.2

  const ctaVariant: 'next' | 'retry' | 'gameover' =
    !isFailure ? 'next' : lives === 0 ? 'gameover' : 'retry'
  const ctaLabel =
    ctaVariant === 'next' ? 'Next Round →'
      : ctaVariant === 'gameover' ? 'Game Over →'
      : 'Try Again ↺'
  const handleCta = () => {
    if (ctaVariant === 'next') nextRound()
    else if (ctaVariant === 'gameover') endGame()
    else retryRound()
  }
```

Then the JSX return uses the floored grand total, passes the new props to `ScorePanel`, and the new button props. Update the `grandTotal` definition (line 67) to floor at 0:

```tsx
  const grandTotal = Math.max(0, scoreBeforeRound + (roundScore?.total ?? 0))
```

Update the `ScorePanel` usage (lines 190-197) and the button (line 199):

```tsx
      {roundScore && (
        <ScorePanel
          roundScore={roundScore}
          grandTotal={grandTotal}
          show={stage === 'scoring' || stage === 'cta'}
          accuracyTier={accuracyTier}
          isFailure={isFailure}
          speedSlow={speedSlow}
        />
      )}

      <NextRoundButton show={stage === 'cta'} onClick={handleCta} label={ctaLabel} variant={ctaVariant} />
```

- [ ] **Step 5: Let `ScorePanel` accept the new props** (behavior comes in Task 7). In `src/components/ResolutionPhase/ScorePanel.tsx`, extend the `Props` interface (lines 6-14) with two optional fields:

```ts
interface Props {
  roundScore: RoundScore
  /** Cumulative running score INCLUDING this round (snapshot captured by caller
   * to avoid a moving target when commitRoundScore fires mid-reveal). */
  grandTotal: number
  /** When true, rows reveal + counts animate; when false, panel is hidden. */
  show: boolean
  accuracyTier: 'perfect' | 'close' | 'far'
  /** Failed round: hide Speed/Efficiency rows and render Accuracy as a penalty. */
  isFailure?: boolean
  /** Successful but slow: swap the Speed ⚡ for a 🐢. */
  speedSlow?: boolean
}
```

(Leave the rest of `ScorePanel` unchanged for now; the new props are unused until Task 7 — destructuring them is deferred so there's no unused-var lint error.)

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: PASS (Try Again tests pass; the perfect-path "Next Round" tests still pass; "Game Over" test still passes).

- [ ] **Step 7: Build + lint (catch unused vars / type drift)**

Run: `npm run build`
Expected: succeeds with no TypeScript or `noUnusedLocals` errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ResolutionPhase/NextRoundButton.tsx src/components/ResolutionPhase/index.tsx src/components/ResolutionPhase/ScorePanel.tsx tests/components/ResolutionPhase.test.tsx
git commit -m "feat(resolution): failed round retries the same round (Try Again CTA)"
```

---

## Task 6: Three-tier failure badge — So Close / Tough Round / Yikes

**Files:**
- Modify: `src/components/ResolutionPhase/PartialBadge.tsx`
- Test: `tests/components/ResolutionPhase.test.tsx:117-122` (update), add a mid-tier test

- [ ] **Step 1: Write the failing tests.** In `tests/components/ResolutionPhase.test.tsx`, replace the low-coverage badge test (lines 117-122) and add a mid-tier test, inside the `describe('ResolutionPhase — badge copy …')` block:

```ts
  it('very low coverage → "Yikes" with the reason sub-label', () => {
    showPartial(0.25, 'missed-many')
    render(<ResolutionPhase />)
    expect(screen.getByText('Yikes')).toBeInTheDocument()
    expect(screen.getByText('Missed some pieces')).toBeInTheDocument()
  })

  it('mid coverage → "Tough Round"', () => {
    showPartial(0.5, 'wrong-shapes')
    render(<ResolutionPhase />)
    expect(screen.getByText('Tough Round')).toBeInTheDocument()
  })
```

(The `showPartial` helper in that block sets `roundScore.correctness: 1`; that's fine — the badge reads only `coverage`/`reason`.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx -t "Yikes"`
Expected: FAIL — current badge renders "Nice try" for low coverage; "Yikes"/"Tough Round" don't exist.

- [ ] **Step 3: Implement the three tiers.** Replace the whole body of `src/components/ResolutionPhase/PartialBadge.tsx`:

```tsx
import { motion } from 'framer-motion'
import type { ResolutionReason } from '../../types'

interface Props {
  show: boolean
  coverage: number
  reason?: ResolutionReason
}

const REASON_LABEL: Record<ResolutionReason, string> = {
  'too-many': 'Too many pieces',
  'wrong-shapes': "Some pieces don't fit",
  'missed-one': 'Missed a piece',
  'missed-many': 'Missed some pieces',
}

type Tier = 'close' | 'tough' | 'yikes'

const TIER: Record<Tier, {
  label: string; glyph: string; gradient: string; shadow: string; text: string
}> = {
  close: {
    label: 'So close!', glyph: '≈',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    shadow: '0 8px 24px rgba(245,158,11,.35), 0 0 0 4px rgba(245,158,11,.15)',
    text: 'text-amber-400',
  },
  tough: {
    label: 'Tough Round', glyph: '✕',
    gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    shadow: '0 8px 24px rgba(239,68,68,.35), 0 0 0 4px rgba(239,68,68,.15)',
    text: 'text-red-400',
  },
  yikes: {
    label: 'Yikes', glyph: '✕',
    gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    shadow: '0 8px 24px rgba(239,68,68,.35), 0 0 0 4px rgba(239,68,68,.15)',
    text: 'text-red-400',
  },
}

export function PartialBadge({ show, coverage, reason }: Props) {
  if (!show) return null
  const tier: Tier = coverage >= 0.66 ? 'close' : coverage >= 0.33 ? 'tough' : 'yikes'
  const t = TIER[tier]
  const subLabel = reason ? REASON_LABEL[reason] : ''

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-20">
      <motion.div
        className="flex items-center justify-center"
        style={{
          width: 84, height: 84, borderRadius: 22,
          background: t.gradient,
          boxShadow: t.shadow,
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: [0, 1.15, 1] }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <span className="text-5xl font-black text-white leading-none">{t.glyph}</span>
      </motion.div>
      <motion.span
        className={`mt-3 text-sm font-bold tracking-widest uppercase ${t.text}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.2 }}
      >
        {t.label}
      </motion.span>
      {subLabel && (
        <motion.span
          className="mt-1 text-xs text-gray-400"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.2 }}
        >
          {subLabel}
        </motion.span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: PASS — the high-coverage "So close!" test, the new "Yikes"/"Tough Round" tests, and the accuracy-icon tests (0.8→amber ≈, 0.3→red ✕) all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResolutionPhase/PartialBadge.tsx tests/components/ResolutionPhase.test.tsx
git commit -m "feat(resolution): three-tier failure badge (So Close / Tough Round / Yikes)"
```

---

## Task 7: Score panel — negative accuracy, hidden bonus rows on fail, turtle

**Files:**
- Modify: `src/components/ResolutionPhase/ScorePanel.tsx`
- Test: `tests/components/ResolutionPhase.test.tsx` (add negative-accuracy, hidden-rows, turtle/lightning tests)

- [ ] **Step 1: Write the failing tests.** Add a new describe block to `tests/components/ResolutionPhase.test.tsx`:

```ts
describe('ResolutionPhase — score panel (reduced motion)', () => {
  function showPartial(correctness: number, coverage = 0.3) {
    useGameStore.setState({
      phase: 'resolving', lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { correctness, speedBonus: 0, efficiencyBonus: 0, total: correctness },
      _resolution: {
        kind: 'partial', coverage, reason: 'too-many',
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
  }

  function showPerfect(speedBonus: number) {
    useGameStore.setState({
      phase: 'resolving', lives: 3,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { correctness: 800, speedBonus, efficiencyBonus: 100, total: 900 + speedBonus },
      _resolution: {
        kind: 'perfect', coverage: 1,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
  }

  it('renders a negative Accuracy value on a failed round', () => {
    showPartial(-200)
    render(<ResolutionPhase />)
    const accRow = screen.getByText('Accuracy').closest('div')!
    expect(accRow.textContent).toContain('-200')
  })

  it('hides the Speed and Efficiency rows on a failed round', () => {
    showPartial(-200)
    render(<ResolutionPhase />)
    expect(screen.queryByText('Speed')).not.toBeInTheDocument()
    expect(screen.queryByText('Efficiency')).not.toBeInTheDocument()
  })

  it('shows a turtle on the Speed row when a successful round was slow', () => {
    showPerfect(50) // <= 100 (20% of 500)
    render(<ResolutionPhase />)
    const speedRow = screen.getByText('Speed').closest('div')!
    expect(speedRow.textContent).toContain('🐢')
  })

  it('shows a lightning bolt when a successful round was fast', () => {
    showPerfect(400)
    render(<ResolutionPhase />)
    const speedRow = screen.getByText('Speed').closest('div')!
    expect(speedRow.textContent).toContain('⚡')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx -t "score panel"`
Expected: FAIL — Speed/Efficiency rows currently always render; accuracy always shows `+`; the Speed icon is always ⚡.

- [ ] **Step 3: Implement the panel changes.** In `src/components/ResolutionPhase/ScorePanel.tsx`:

(a) Destructure the new props and use them. Change the function signature (line 27) to:
```tsx
export function ScorePanel({ roundScore, grandTotal, show, accuracyTier, isFailure = false, speedSlow = false }: Props) {
```

(b) Replace the three score rows (lines 37-39) so Speed/Efficiency are hidden on a failure and the Speed icon reflects slowness:
```tsx
      <Row icon={ACCURACY_ICON[accuracyTier].icon} label="Accuracy" value={roundScore.correctness} delay={0} color={ACCURACY_ICON[accuracyTier].color} />
      {!isFailure && (
        <Row icon={speedSlow ? '🐢' : '⚡'} label="Speed" value={roundScore.speedBonus} delay={ROW_STAGGER} color={speedSlow ? 'text-gray-400' : 'text-yellow-400'} />
      )}
      {!isFailure && (
        <Row icon="◆" label="Efficiency" value={roundScore.efficiencyBonus} delay={ROW_STAGGER * 2} color="text-cyan-400" />
      )}
```

(c) Make the Round Total render a negative penalty in red (replace lines 48-51 inside the round-total `motion.div`):
```tsx
          <span className="text-[11px] tracking-widest text-gray-400 uppercase">Round Total</span>
          <span className={`text-2xl font-extrabold tabular-nums ${roundScore.total < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
            {roundScore.total >= 0 ? '+' : ''}<DelayedCountUp value={roundScore.total} delay={ROUND_TOTAL_DELAY} />
          </span>
```

(d) Make the `Row` helper render negative values without a leading `+` and in red (replace the value `<span>` at lines 84-86):
```tsx
      <span className={`font-semibold tabular-nums ${value < 0 ? 'text-red-400' : 'text-white'}`}>
        {value >= 0 ? '+' : ''}<DelayedCountUp value={value} delay={delay} />
      </span>
```

(`DelayedCountUp` already counts to any number; for a negative `value`, `toLocaleString()` yields e.g. `"-200"`, so no `+` prefix is added.)

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: PASS (score-panel block + all earlier blocks).

- [ ] **Step 5: Full suite + build**

Run: `npx vitest run`
Then (separate call): `npm run build`
Expected: all tests pass; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/ResolutionPhase/ScorePanel.tsx tests/components/ResolutionPhase.test.tsx
git commit -m "feat(resolution): negative accuracy, hide bonuses on fail, turtle for slow speed"
```

---

## Task 8: Docs + full verification (build, lint, in-browser)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`** to reflect the new behavior. Make these edits:

1. **Run/test header:** the test count line ("76 tests") is now higher — change it to read `npm run test` (all tests must pass before any commit) without a hardcoded count, or update the count after running the suite in Step 3.

2. **Round loop → Resolution → Partial bullet:** replace the partial description with:
   > **Partial / Failed round** (selection doesn't fit): player loses 1 life, the auto-best-fit placement runs (good pieces fly in, leftover pieces get a red ✕), and the round is scored as a **failure** — a negative Accuracy penalty, no Speed/Efficiency. The CTA is **"Try Again ↺"**, which regenerates a fresh puzzle at the **same round** (the round counter advances **only on a perfect clear**). On the last life the CTA is **"Game Over →"**.

3. **Scoring pillars:** note that Accuracy is `800 × ` correctness on a perfect clear, but a **negative penalty** (`-50` per wrong/missing piece, floored at `-400`) on a failure, with Speed/Efficiency zeroed; the running grand total is floored at 0.

4. **Design decisions → Grid size:** change `10 rows × 8 columns (not square; taller than wide)` to `12 rows × 12 columns (square)`.

5. **Architecture → Grid dimensions:** recompute the width note. The grid is `inline-grid`, 12 cols × 28px + 11×2px gaps + 12px padding×2 ≈ **382px** wide.

6. **Difficulty table:** note it now spans 15 rounds with a gentler view-timer ramp (~300ms/round, floor 2500ms) and gap counts that climb to 16.

- [ ] **Step 2: Update the `useShallow`/solver/efficiency "Critical rules" if needed** — no change required (those rules still hold). Skip if nothing is stale.

- [ ] **Step 3: Run the complete verification gate.** Run each as a SEPARATE Bash call (nvm chained-command quirk):

```bash
npx vitest run
```
```bash
npm run build
```
```bash
npm run lint
```
Expected: all tests pass; build clean; lint clean. If the CLAUDE.md test-count line was left as a number, set it to the final passing count now.

- [ ] **Step 4: In-browser verification** (use the preview_* tools, not Bash/Chrome MCP):
  - `preview_start` the dev server (`npm run dev`, http://localhost:5173).
  - Start a game; confirm the **12×12 board** renders fully and is not clipped by the `max-w-sm` containers. If clipped, bump the wrapper in `index.tsx` (and `SelectingPhase.tsx`/`ViewingPhase.tsx` if needed) from `max-w-sm` to `max-w-md`, then re-verify.
  - Play one round and **intentionally fail** (e.g. submit a single wrong piece): confirm the **fail badge** (Tough Round / Yikes by how far off), the **negative Accuracy** row in red, **no Speed/Efficiency rows**, a red negative **Round Total**, and a **"Try Again ↺"** button that returns to the viewing phase at the **same round number**.
  - Clear a round correctly but **slowly** (let the select timer run down): confirm the Speed row shows the **🐢**. Clear one quickly: confirm **⚡**.
  - Exhaust lives on a failure: confirm the **"Game Over →"** CTA ends the game.
  - Capture a `preview_screenshot` of the failed-round panel and the 12×12 board to share as proof.

- [ ] **Step 5: Solver-cost sanity check.** While at the dev server, reach (or temporarily seed) a high-gap round and submit an over-selection; confirm the resolution computes without a visible hang. If `bestFit` janks on the densest rounds, reduce the late-round `gapCount` cap in `DIFFICULTY_TABLE` (Task 2) and re-verify. (Expected: fine — gaps are disjoint regions.)

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md src/components/ResolutionPhase/index.tsx
git commit -m "docs: update CLAUDE.md for 12x12 board, retry flow, failure scoring"
```

(Include any `max-w` tweaks from Step 4 in this commit if you made them.)

---

## Self-Review

**Spec coverage:**
- 12×12 board → Task 1. ✓
- Gentler view ramp + more gaps + 15 rounds → Task 2. ✓
- Failed-round = retry, round advances only on perfect → Tasks 4 (`retryRound`) + 5 (CTA). ✓
- Negative accuracy penalty, no speed/efficiency, grand total floored at 0 → Tasks 3 + 4. ✓
- Score-panel: negative accuracy render, hide bonus rows on fail → Task 7. ✓
- Turtle for slow speed (bottom 20%) → Tasks 5 (`speedSlow`) + 7 (icon). ✓
- Three-tier badge (So Close / Tough Round / Yikes) → Task 6. ✓
- Docs + tests updated → Tasks 1-7 (tests inline) + 8 (CLAUDE.md). ✓
- Solver-cost note → Task 8 Step 5. ✓

**Type consistency:** `retryRound` declared in the `GameStore` interface (Task 4) and consumed in `index.tsx` (Task 5). `MAX_SPEED_BONUS` exported in Task 3, imported in Task 5. `ScorePanel` props `isFailure`/`speedSlow` added in Task 5, consumed in Task 7. `CtaVariant` ('next'|'retry'|'gameover') consistent between `NextRoundButton.tsx` and `index.tsx`. Badge `Tier` ('close'|'tough'|'yikes') is internal to `PartialBadge.tsx`.

**Placeholder scan:** No TBD/TODO; every code step shows full code; every test step shows the assertion and the run command with expected result.
