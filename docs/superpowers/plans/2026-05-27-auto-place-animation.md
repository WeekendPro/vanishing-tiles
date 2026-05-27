# Auto-Place Animated Celebration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static 800ms "✓ Auto-placing..." screen with an animated celebration: pieces fly one-by-one from the selection cart into their grid slots, a green checkmark badge pops in with confetti, the score breakdown counts up, and a Next Round CTA appears — all in one view, with no transition to the existing scoring screen.

**Architecture:** New `AutoPlacingPhase` component owns a local state machine (`measuring` → `flying` → `badge` → `scoring` → `cta`). The store's existing `finishAutoPlace` action is split into `applyPlacement` (called per flyer as it lands) and `commitRoundScore` (called once after all pieces land). Sub-components: `SelectionCart`, `FlyerOverlay` (framer-motion), `CelebrationBadge`, `ScorePanel`, `NextRoundButton`. Manual-place flow continues to use the existing `ScoringPhase` unchanged.

**Tech Stack:** React 18 + TypeScript + Zustand 5 + Tailwind 3 + Vitest + jsdom + @testing-library/react. Adding **framer-motion** for this work.

**Spec:** `docs/superpowers/specs/2026-05-27-auto-place-animation-design.md`

---

## File Structure

**New files:**
- `src/engine/cartSlots.ts` — pure helper: expands `SelectionEntry[]` into individual chip slots and maps placements to slot indices.
- `src/hooks/useCountUp.ts` — RAF-driven hook that animates a number from 0 → target over a duration.
- `src/components/AutoPlacingPhase/index.tsx` — orchestrator + state machine. Exported as `AutoPlacingPhase`.
- `src/components/AutoPlacingPhase/SelectionCart.tsx` — chip strip below the grid; exposes refs.
- `src/components/AutoPlacingPhase/FlyerOverlay.tsx` — absolute-positioned overlay; one `motion.div` per placement.
- `src/components/AutoPlacingPhase/CelebrationBadge.tsx` — green badge + drawn checkmark + confetti.
- `src/components/AutoPlacingPhase/ScorePanel.tsx` — three rows + total with count-up.
- `src/components/AutoPlacingPhase/NextRoundButton.tsx` — primary CTA, FM slide-up.
- `tests/engine/cartSlots.test.ts`
- `tests/hooks/useCountUp.test.ts`
- `tests/components/AutoPlacingPhase.test.tsx` — state-machine + reduced-motion + CTA-idempotency tests.

**Modified files:**
- `src/store/gameStore.ts` — split `finishAutoPlace` into `applyPlacement` + `commitRoundScore`.
- `src/components/GameShell.tsx` — remove the `useEffect` + inline "Auto-placing..." text; render `<AutoPlacingPhase />` for the `auto-placing` phase.
- `tests/store/gameStore.test.ts` — update the one test that calls `finishAutoPlace`; add tests for the new actions.
- `package.json` / `package-lock.json` — add `framer-motion`.

**Layering rationale:** `AutoPlacingPhase/` is a subfolder because this phase has 6 collaborating components — flatten would clutter `src/components/`. `cartSlots.ts` is game-domain logic so it lives in `engine/` next to `solver.ts` and `pieces.ts`. `useCountUp` is a generic hook so it gets its own `hooks/` directory (new).

---

## Task 1: Add framer-motion dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install framer-motion**

Run:
```bash
npm install framer-motion
```
Expected: `framer-motion` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Verify install + types load**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors. (TypeScript can resolve the new package; nothing using it yet.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add framer-motion for auto-place celebration"
```

---

## Task 2: Store — add `applyPlacement` action (TDD)

**Why:** Each flyer needs to commit its placement to the grid the instant it lands, so the grid fills incrementally underneath the flyers. Today's `finishAutoPlace` mutates the whole grid at once.

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `tests/store/gameStore.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/store/gameStore.test.ts` (above `describe('DIFFICULTY_TABLE', ...)`):

```ts
describe('applyPlacement', () => {
  it('marks the placement cells as placed with the piece type', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    const solution = useGameStore.getState()._autoPlaceSolution
    expect(solution).not.toBeNull()
    const firstPlacement = solution![0]

    act(() => useGameStore.getState().applyPlacement(firstPlacement))

    const grid = useGameStore.getState().grid
    for (const [r, c] of firstPlacement.cells) {
      expect(grid[r][c].status).toBe('placed')
      expect(grid[r][c].pieceType).toBe(firstPlacement.pieceType)
    }
  })

  it('does not change phase', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    const solution = useGameStore.getState()._autoPlaceSolution!

    act(() => useGameStore.getState().applyPlacement(solution[0]))
    expect(useGameStore.getState().phase).toBe('auto-placing')
  })
})
```

- [ ] **Step 2: Run the new tests to confirm they fail**

Run:
```bash
npm run test -- gameStore
```
Expected: both `applyPlacement` tests fail with "applyPlacement is not a function" (or similar TS / runtime error).

- [ ] **Step 3: Add the action to the store interface**

In `src/store/gameStore.ts`, find the `GameStore` interface block (around line 39) and add the new action signature next to `finishAutoPlace`:

```ts
interface GameStore extends GameState {
  startGame: () => void
  endViewing: () => void
  submitSelection: () => void
  finishAutoPlace: () => void
  applyPlacement: (placement: Placement) => void   // ← ADD
  placePiece: (row: number, col: number) => void
  // ... rest unchanged
}
```

(`Placement` is already imported from `'../engine/solver'` at the top of the file — no new import needed.)

- [ ] **Step 4: Implement the action**

In `src/store/gameStore.ts`, add this action inside the `create<GameStore>(...)` body. Place it directly above `finishAutoPlace`:

```ts
  applyPlacement: (placement) => {
    set(state => {
      const newGrid = state.grid.map(row => row.map(cell => ({ ...cell })))
      for (const [r, c] of placement.cells) {
        newGrid[r][c] = { status: 'placed', pieceType: placement.pieceType }
      }
      return { grid: newGrid }
    })
  },
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run:
```bash
npm run test -- gameStore
```
Expected: both `applyPlacement` tests pass; no other tests regress.

- [ ] **Step 6: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.test.ts
git commit -m "feat(store): add applyPlacement action for incremental grid fill"
```

---

## Task 3: Store — add `commitRoundScore` action (TDD)

**Why:** Adding the round score and clearing carry-overs needs to happen mid-celebration (after the score panel counts up), not bundled with the grid mutation.

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `tests/store/gameStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/gameStore.test.ts` after the `applyPlacement` describe:

```ts
describe('commitRoundScore', () => {
  it('adds roundScore.total to running score', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    const before = useGameStore.getState().score
    const total = useGameStore.getState().roundScore!.total

    act(() => useGameStore.getState().commitRoundScore())

    expect(useGameStore.getState().score).toBe(before + total)
  })

  it('clears carryOvers', () => {
    useGameStore.setState({ carryOvers: [{ pieceType: 'I', count: 2 }] })
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    act(() => useGameStore.getState().commitRoundScore())

    expect(useGameStore.getState().carryOvers).toEqual([])
  })

  it('does not change phase', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    act(() => useGameStore.getState().commitRoundScore())

    expect(useGameStore.getState().phase).toBe('auto-placing')
  })

  it('is a no-op when roundScore is null', () => {
    const before = useGameStore.getState().score
    act(() => useGameStore.getState().commitRoundScore())
    expect(useGameStore.getState().score).toBe(before)
  })
})
```

- [ ] **Step 2: Confirm they fail**

Run:
```bash
npm run test -- gameStore
```
Expected: 4 new failures for `commitRoundScore`.

- [ ] **Step 3: Add to interface**

In `src/store/gameStore.ts`, in the `GameStore` interface block, add:

```ts
  applyPlacement: (placement: Placement) => void
  commitRoundScore: () => void          // ← ADD
```

- [ ] **Step 4: Implement the action**

In `src/store/gameStore.ts`, add this action inside the `create<GameStore>(...)` body, directly below `applyPlacement`:

```ts
  commitRoundScore: () => {
    set(state => {
      if (!state.roundScore) return {}
      return {
        score: state.score + state.roundScore.total,
        carryOvers: [],
      }
    })
  },
```

- [ ] **Step 5: Run tests to confirm they pass**

Run:
```bash
npm run test -- gameStore
```
Expected: all 4 new `commitRoundScore` tests pass; no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.test.ts
git commit -m "feat(store): add commitRoundScore action"
```

---

## Task 4: Remove `finishAutoPlace` + GameShell timeout

**Why:** The action that bundled "apply all placements + add score + change phase" is no longer needed — the new actions cover its work. The `useEffect` in `GameShell` that auto-fired it after 800ms must also go, because the new `AutoPlacingPhase` owns its own timing.

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `src/components/GameShell.tsx`
- Modify: `tests/store/gameStore.test.ts`

- [ ] **Step 1: Update the one existing test that uses `finishAutoPlace`**

In `tests/store/gameStore.test.ts`, find the `describe('scoring', ...)` block (around line 123) and replace its single test with one that uses the new actions:

```ts
describe('scoring', () => {
  it('correct selection awards correctness points', () => {
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())
    // submitSelection already sets roundScore for the auto-place path
    const { roundScore } = useGameStore.getState()
    expect(roundScore?.correctness).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to confirm the updated test passes (still using finishAutoPlace's old behavior)**

Run:
```bash
npm run test -- gameStore
```
Expected: all tests pass — we haven't removed `finishAutoPlace` yet.

- [ ] **Step 3: Remove `finishAutoPlace` from the store**

In `src/store/gameStore.ts`:

**3a.** Remove `finishAutoPlace: () => void` from the `GameStore` interface block.

**3b.** Remove the entire `finishAutoPlace: () => { ... },` action body (lines ≈189-206 in the current file).

- [ ] **Step 4: Remove the GameShell `useEffect` and inline text**

In `src/components/GameShell.tsx`:

**4a.** Remove `finishAutoPlace` from the destructured selector (currently:
```ts
const { phase, round, score, lives, startGame, finishAutoPlace } = useGameStore(useShallow(s => ({
  phase: s.phase,
  round: s.round,
  score: s.score,
  lives: s.lives,
  startGame: s.startGame,
  finishAutoPlace: s.finishAutoPlace,
})))
```
becomes:
```ts
const { phase, round, score, lives, startGame } = useGameStore(useShallow(s => ({
  phase: s.phase,
  round: s.round,
  score: s.score,
  lives: s.lives,
  startGame: s.startGame,
})))
```
)

**4b.** Delete the whole `useEffect` block:
```ts
useEffect(() => {
  if (phase !== 'auto-placing') return
  const timer = setTimeout(finishAutoPlace, 800)
  return () => clearTimeout(timer)
}, [phase, finishAutoPlace])
```

**4c.** Remove the `useEffect` import if it's no longer used: change `import { useEffect } from 'react'` to be removed entirely (it's only used by the deleted block).

**4d.** Replace the inline auto-placing placeholder:
```tsx
{phase === 'auto-placing'   && (
  <div className="text-green-400 text-xl font-bold animate-pulse">✓ Auto-placing...</div>
)}
```
with a temporary stand-in (the real component arrives in Task 7):
```tsx
{phase === 'auto-placing'   && <div className="text-gray-500 text-sm">[auto-placing — placeholder]</div>}
```

- [ ] **Step 5: Run all tests and confirm green**

Run:
```bash
npm run test && npx tsc --noEmit
```
Expected: all 48 + 6 new = 54 tests pass; TypeScript is clean.

- [ ] **Step 6: Commit**

```bash
git add src/store/gameStore.ts src/components/GameShell.tsx tests/store/gameStore.test.ts
git commit -m "refactor: remove finishAutoPlace and auto-fire timeout

AutoPlacingPhase will own its own timing; applyPlacement +
commitRoundScore replace finishAutoPlace's responsibilities."
```

---

## Task 5: `cartSlots` expansion helper (TDD)

**Why:** A selection of `{I × 3, O × 2}` renders as 5 individual chip slots. Each `Placement` from the solver needs to be mapped to a specific chip so the flyer originates from the right one. Pure helper, easy to test in isolation.

**Files:**
- Create: `src/engine/cartSlots.ts`
- Create: `tests/engine/cartSlots.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/cartSlots.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { expandCartSlots, mapPlacementsToSlots } from '../../src/engine/cartSlots'
import type { SelectionEntry } from '../../src/types'
import type { Placement } from '../../src/engine/solver'

describe('expandCartSlots', () => {
  it('expands a single-entry selection into N chips', () => {
    const selection: SelectionEntry[] = [{ pieceType: 'I', lockedCount: 0, freeCount: 3 }]
    expect(expandCartSlots(selection)).toEqual([
      { pieceType: 'I', slotIndex: 0 },
      { pieceType: 'I', slotIndex: 1 },
      { pieceType: 'I', slotIndex: 2 },
    ])
  })

  it('counts both locked and free pieces', () => {
    const selection: SelectionEntry[] = [{ pieceType: 'O', lockedCount: 2, freeCount: 1 }]
    expect(expandCartSlots(selection)).toHaveLength(3)
  })

  it('preserves selection-array order across multiple entries', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'I', lockedCount: 0, freeCount: 2 },
      { pieceType: 'O', lockedCount: 0, freeCount: 1 },
      { pieceType: 'T', lockedCount: 0, freeCount: 1 },
    ]
    expect(expandCartSlots(selection).map(s => s.pieceType)).toEqual(['I', 'I', 'O', 'T'])
  })

  it('skips empty entries', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'I', lockedCount: 0, freeCount: 0 },
      { pieceType: 'O', lockedCount: 0, freeCount: 2 },
    ]
    expect(expandCartSlots(selection)).toEqual([
      { pieceType: 'O', slotIndex: 0 },
      { pieceType: 'O', slotIndex: 1 },
    ])
  })
})

describe('mapPlacementsToSlots', () => {
  const slots = [
    { pieceType: 'I' as const, slotIndex: 0 },
    { pieceType: 'I' as const, slotIndex: 1 },
    { pieceType: 'O' as const, slotIndex: 2 },
  ]

  const mk = (pieceType: Placement['pieceType']): Placement => ({
    pieceType,
    rotation: 0,
    anchorRow: 0,
    anchorCol: 0,
    cells: [[0, 0]],
  })

  it('claims the first matching unclaimed slot for each placement, in order', () => {
    const placements: Placement[] = [mk('I'), mk('O'), mk('I')]
    expect(mapPlacementsToSlots(placements, slots)).toEqual([0, 2, 1])
  })

  it('returns -1 when no slot of the placement piece type remains', () => {
    const placements: Placement[] = [mk('I'), mk('I'), mk('I')]  // only 2 I-slots
    expect(mapPlacementsToSlots(placements, slots)).toEqual([0, 1, -1])
  })

  it('handles an empty placements list', () => {
    expect(mapPlacementsToSlots([], slots)).toEqual([])
  })
})
```

- [ ] **Step 2: Confirm they fail**

Run:
```bash
npm run test -- cartSlots
```
Expected: failures like `Failed to resolve import "../../src/engine/cartSlots"`.

- [ ] **Step 3: Implement the helper**

Create `src/engine/cartSlots.ts`:

```ts
import type { PieceType, SelectionEntry } from '../types'
import type { Placement } from './solver'

export interface ChipSlot {
  pieceType: PieceType
  slotIndex: number   // 0-based index into the expanded chip list
}

/**
 * Expand a SelectionEntry array into a flat list of individual chip slots.
 * Slot order preserves the selection array order; each entry contributes
 * (lockedCount + freeCount) chips in sequence.
 */
export function expandCartSlots(selection: SelectionEntry[]): ChipSlot[] {
  const slots: ChipSlot[] = []
  for (const entry of selection) {
    const total = entry.lockedCount + entry.freeCount
    for (let i = 0; i < total; i++) {
      slots.push({ pieceType: entry.pieceType, slotIndex: slots.length })
    }
  }
  return slots
}

/**
 * Map each placement to the index of the chip it should originate from.
 * Iterates placements in order; for each placement, claims the first
 * not-yet-claimed slot whose pieceType matches. Returns -1 for any
 * placement with no matching slot (shouldn't happen in practice, since
 * the solver was given exactly these pieces; the -1 is defensive).
 */
export function mapPlacementsToSlots(
  placements: Placement[],
  slots: ChipSlot[],
): number[] {
  const claimed = new Set<number>()
  return placements.map(placement => {
    for (const slot of slots) {
      if (slot.pieceType === placement.pieceType && !claimed.has(slot.slotIndex)) {
        claimed.add(slot.slotIndex)
        return slot.slotIndex
      }
    }
    return -1
  })
}
```

- [ ] **Step 4: Confirm tests pass**

Run:
```bash
npm run test -- cartSlots
```
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cartSlots.ts tests/engine/cartSlots.test.ts
git commit -m "feat(engine): add cartSlots helper for selection→chip expansion"
```

---

## Task 6: `useCountUp` hook (TDD)

**Why:** ScorePanel animates each number from 0 to its final value over a duration. Encapsulate as a reusable hook so the panel stays declarative.

**Files:**
- Create: `src/hooks/useCountUp.ts`
- Create: `tests/hooks/useCountUp.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/hooks/useCountUp.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountUp } from '../../src/hooks/useCountUp'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCountUp', () => {
  it('starts at 0', () => {
    const { result } = renderHook(() => useCountUp(1000, 500))
    expect(result.current).toBe(0)
  })

  it('reaches the target value by the end of the duration', () => {
    const { result } = renderHook(() => useCountUp(1000, 500))
    act(() => {
      vi.advanceTimersByTime(600)  // past the 500ms duration
    })
    expect(result.current).toBe(1000)
  })

  it('progresses monotonically', () => {
    const { result } = renderHook(() => useCountUp(1000, 500))
    const samples: number[] = []
    for (let t = 0; t <= 500; t += 100) {
      act(() => { vi.advanceTimersByTime(100) })
      samples.push(result.current)
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1])
    }
  })

  it('immediately returns target when duration is 0', () => {
    const { result } = renderHook(() => useCountUp(500, 0))
    act(() => { vi.advanceTimersByTime(0) })
    expect(result.current).toBe(500)
  })

  it('restarts when the target value changes', () => {
    const { result, rerender } = renderHook(({ target }) => useCountUp(target, 500), {
      initialProps: { target: 100 },
    })
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current).toBe(100)
    rerender({ target: 500 })
    expect(result.current).toBe(0)
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current).toBe(500)
  })
})
```

- [ ] **Step 2: Confirm they fail**

Run:
```bash
npm run test -- useCountUp
```
Expected: `Failed to resolve import` errors.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useCountUp.ts`:

```ts
import { useEffect, useState } from 'react'

/**
 * Animates a number from 0 → `target` over `durationMs`.
 * Uses requestAnimationFrame; in test environments with fake timers
 * we fall back to a setInterval tick so the value still progresses.
 *
 * Restarts whenever `target` changes.
 */
export function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (durationMs <= 0) {
      setValue(target)
      return
    }

    setValue(0)
    const start = Date.now()
    let raf = 0
    let interval = 0

    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(1, elapsed / durationMs)
      // ease-out cubic for a nicer feel
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      }
    }

    // Drive the animation. In jsdom + fake timers, requestAnimationFrame
    // doesn't advance, so also schedule a setInterval that will fire
    // when vi.advanceTimersByTime() is called.
    raf = requestAnimationFrame(tick)
    interval = window.setInterval(tick, 16)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(interval)
    }
  }, [target, durationMs])

  return value
}
```

- [ ] **Step 4: Confirm tests pass**

Run:
```bash
npm run test -- useCountUp
```
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCountUp.ts tests/hooks/useCountUp.test.ts
git commit -m "feat(hooks): add useCountUp for animated number reveals"
```

---

## Task 7: `AutoPlacingPhase` scaffold + wire into GameShell

**Why:** Get the new component routed and rendering a basic layout (grid + cart placeholder) so the rest of the work can be visually verified in the browser as it lands.

**Files:**
- Create: `src/components/AutoPlacingPhase/index.tsx`
- Modify: `src/components/GameShell.tsx`

- [ ] **Step 1: Create the scaffold component**

Create `src/components/AutoPlacingPhase/index.tsx`:

```tsx
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from '../Grid'

export function AutoPlacingPhase() {
  const { selection } = useGameStore(useShallow(s => ({
    selection: s.selection,
  })))

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm items-center">
      <Grid />

      {/* SelectionCart will replace this in Task 8 */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 inline-flex gap-2">
        {selection.flatMap(e =>
          Array.from({ length: e.lockedCount + e.freeCount }, (_, i) => (
            <span key={`${e.pieceType}-${i}`} className="text-xs text-gray-500">{e.pieceType}</span>
          )),
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Route it from GameShell**

In `src/components/GameShell.tsx`:

**2a.** Add the import near the other phase imports at the top:
```ts
import { AutoPlacingPhase } from './AutoPlacingPhase'
```

**2b.** Replace the temporary placeholder you left in Task 4:
```tsx
{phase === 'auto-placing'   && <div className="text-gray-500 text-sm">[auto-placing — placeholder]</div>}
```
with:
```tsx
{phase === 'auto-placing'   && <AutoPlacingPhase />}
```

- [ ] **Step 3: Visual smoke check**

Run:
```bash
npm run dev
```
Open http://localhost:5173, click Start Game, watch the viewing phase, then select pieces that match the gaps and submit. Expected: when phase becomes `auto-placing` you see the grid (with empty gaps) and a small text strip of selected piece types below it. The screen stays on that view (no auto-advance — the new component doesn't yet call `commitRoundScore` or `nextRound`).

This is expected to be "stuck" — Tasks 8-13 will build out the rest.

- [ ] **Step 4: Type check + tests**

Run:
```bash
npx tsc --noEmit && npm run test
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/AutoPlacingPhase/index.tsx src/components/GameShell.tsx
git commit -m "feat: scaffold AutoPlacingPhase routed from GameShell"
```

---

## Task 8: `SelectionCart` sub-component

**Why:** Renders one chip per individual piece slot, exposes refs so `FlyerOverlay` can measure each chip's position, and dims chips that have already launched.

**Files:**
- Create: `src/components/AutoPlacingPhase/SelectionCart.tsx`
- Modify: `src/components/AutoPlacingPhase/index.tsx`

- [ ] **Step 1: Create the SelectionCart component**

Create `src/components/AutoPlacingPhase/SelectionCart.tsx`:

```tsx
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { PieceShape } from '../PieceShape'
import type { ChipSlot } from '../../engine/cartSlots'

export interface SelectionCartHandle {
  /** Get the bounding rect of the chip at `slotIndex`, or null if not yet mounted. */
  getChipRect: (slotIndex: number) => DOMRect | null
}

interface Props {
  slots: ChipSlot[]
  /** Indices of chips whose flyer has already launched; rendered dimmed. */
  consumed: ReadonlySet<number>
}

export const SelectionCart = forwardRef<SelectionCartHandle, Props>(
  function SelectionCart({ slots, consumed }, ref) {
    const chipRefs = useRef<(HTMLDivElement | null)[]>([])

    useImperativeHandle(ref, () => ({
      getChipRect: (slotIndex: number) => {
        const el = chipRefs.current[slotIndex]
        return el ? el.getBoundingClientRect() : null
      },
    }), [])

    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 inline-flex gap-2 flex-wrap justify-center max-w-sm">
        {slots.map((slot) => {
          const dim = consumed.has(slot.slotIndex)
          return (
            <div
              key={slot.slotIndex}
              ref={el => { chipRefs.current[slot.slotIndex] = el }}
              className={`p-1 transition-opacity duration-150 ${dim ? 'opacity-25' : 'opacity-100'}`}
            >
              <PieceShape pieceType={slot.pieceType} cellSize={11} />
            </div>
          )
        })}
        {slots.length === 0 && (
          <span className="text-xs text-gray-600 italic">No pieces</span>
        )}
      </div>
    )
  },
)
```

- [ ] **Step 2: Use it in AutoPlacingPhase**

Replace the body of `src/components/AutoPlacingPhase/index.tsx`:

```tsx
import { useMemo, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from '../Grid'
import { SelectionCart, type SelectionCartHandle } from './SelectionCart'
import { expandCartSlots } from '../../engine/cartSlots'

export function AutoPlacingPhase() {
  const { selection } = useGameStore(useShallow(s => ({ selection: s.selection })))

  const slots = useMemo(() => expandCartSlots(selection), [selection])
  const cartRef = useRef<SelectionCartHandle>(null)

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm items-center">
      <Grid />
      <SelectionCart ref={cartRef} slots={slots} consumed={new Set()} />
    </div>
  )
}
```

- [ ] **Step 3: Visual check**

Run `npm run dev` and play through to auto-placing. Expected: chips render below the grid, each at its proper colored shape, no dimming yet.

- [ ] **Step 4: Type check + tests**

```bash
npx tsc --noEmit && npm run test
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/AutoPlacingPhase/SelectionCart.tsx src/components/AutoPlacingPhase/index.tsx
git commit -m "feat: SelectionCart with per-chip refs and dim state"
```

---

## Task 9: `FlyerOverlay` with framer-motion

**Why:** This is the centerpiece — flyers travel from cart-chip positions to grid-cell positions, sequenced one-by-one, firing `applyPlacement` as each lands.

**Files:**
- Create: `src/components/AutoPlacingPhase/FlyerOverlay.tsx`
- Modify: `src/components/AutoPlacingPhase/index.tsx`

- [ ] **Step 1: Add a Grid ref for cell measurement**

The current `Grid` component renders one `<div>` per cell but doesn't expose them. We need the bounding rect of a specific cell (the placement's anchor cell) to compute fly targets.

Edit `src/components/Grid.tsx`:

**1a.** Replace the existing `interface Props` and the `export function Grid` signature with one that accepts a `cellRefs` callback:

```tsx
interface Props {
  onCellClick?: (row: number, col: number) => void
  onCellHover?: (row: number, col: number) => void
  highlightCells?: [number, number][]
  /** Called with each cell's DOM node so callers can measure positions. */
  cellRef?: (row: number, col: number, el: HTMLDivElement | null) => void
}

export function Grid({ onCellClick, onCellHover, highlightCells = [], cellRef }: Props) {
```

**1b.** Inside the cell render, attach the ref:

```tsx
return (
  <div
    key={i}
    ref={el => cellRef?.(row, col, el)}
    className={className}
    onClick={() => onCellClick?.(row, col)}
    onMouseEnter={() => onCellHover?.(row, col)}
  />
)
```

- [ ] **Step 2: Create the FlyerOverlay component**

Create `src/components/AutoPlacingPhase/FlyerOverlay.tsx`:

```tsx
import { motion } from 'framer-motion'
import { PieceShape } from '../PieceShape'
import type { Placement } from '../../engine/solver'

export interface FlyerSpec {
  placement: Placement
  /** Source position (top-left in viewport coords). */
  sourceX: number
  sourceY: number
  /** Target position (top-left in viewport coords). */
  targetX: number
  targetY: number
  /** Per-piece flight duration in seconds. */
  duration: number
  /** Delay in seconds before this flyer begins (sequencing). */
  delay: number
}

interface Props {
  /** Bounding rect of the AutoPlacingPhase root so we can convert to relative coords. */
  containerRect: DOMRect
  flyers: FlyerSpec[]
  /** Called when a flyer's animation completes; receives the index into `flyers`. */
  onFlyerLanded: (flyerIndex: number) => void
}

// Cart chips render at PieceShape cellSize=11; grid cells at cellSize=28.
const CART_CELL = 11
const GRID_CELL = 28
const START_SCALE = CART_CELL / GRID_CELL  // ≈ 0.393

export function FlyerOverlay({ containerRect, flyers, onFlyerLanded }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      aria-hidden="true"
    >
      {flyers.map((flyer, i) => {
        // Convert viewport coords to coords relative to the overlay container.
        const sx = flyer.sourceX - containerRect.left
        const sy = flyer.sourceY - containerRect.top
        const tx = flyer.targetX - containerRect.left
        const ty = flyer.targetY - containerRect.top

        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: 0, top: 0, transformOrigin: 'top left' }}
            initial={{ x: sx, y: sy, scale: START_SCALE, opacity: 0 }}
            animate={{
              x: [sx, sx + (tx - sx) * 0.5, tx],
              y: [sy, (sy + ty) / 2 - 30, ty],
              scale: [START_SCALE, (START_SCALE + 1) / 2, 1],
              opacity: [1, 1, 1],
            }}
            transition={{
              duration: flyer.duration,
              delay: flyer.delay,
              ease: [0.65, 0, 0.35, 1],
              times: [0, 0.5, 1],
            }}
            onAnimationComplete={() => onFlyerLanded(i)}
          >
            <PieceShape
              pieceType={flyer.placement.pieceType}
              rotation={flyer.placement.rotation}
              cellSize={GRID_CELL}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Wire the overlay into `AutoPlacingPhase` (measurement + per-piece sequencing)**

Replace the body of `src/components/AutoPlacingPhase/index.tsx`:

```tsx
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from '../Grid'
import { SelectionCart, type SelectionCartHandle } from './SelectionCart'
import { FlyerOverlay, type FlyerSpec } from './FlyerOverlay'
import { expandCartSlots, mapPlacementsToSlots } from '../../engine/cartSlots'

export function AutoPlacingPhase() {
  const { selection, solution, applyPlacement } = useGameStore(useShallow(s => ({
    selection: s.selection,
    solution: s._autoPlaceSolution,
    applyPlacement: s.applyPlacement,
  })))

  const slots = useMemo(() => expandCartSlots(selection), [selection])
  const placementToSlot = useMemo(
    () => mapPlacementsToSlots(solution ?? [], slots),
    [solution, slots],
  )

  const rootRef = useRef<HTMLDivElement>(null)
  const cartRef = useRef<SelectionCartHandle>(null)
  const cellRects = useRef<Map<string, DOMRect>>(new Map())

  const [flyers, setFlyers] = useState<FlyerSpec[] | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const [consumed, setConsumed] = useState<ReadonlySet<number>>(new Set())

  // Measure positions and build flyer specs on mount.
  useLayoutEffect(() => {
    if (!solution || solution.length === 0) return
    if (!rootRef.current || !cartRef.current) return

    const N = solution.length
    const perPiece = Math.min(500, 3000 / N) / 1000  // seconds
    const built: FlyerSpec[] = []

    for (let i = 0; i < N; i++) {
      const placement = solution[i]
      const slotIdx = placementToSlot[i]
      const chipRect = slotIdx >= 0 ? cartRef.current.getChipRect(slotIdx) : null
      const cellRect = cellRects.current.get(`${placement.anchorRow},${placement.anchorCol}`)
      if (!chipRect || !cellRect) continue

      built.push({
        placement,
        sourceX: chipRect.left,
        sourceY: chipRect.top,
        targetX: cellRect.left,
        targetY: cellRect.top,
        duration: perPiece,
        delay: i * perPiece,
      })
    }

    setContainerRect(rootRef.current.getBoundingClientRect())
    setFlyers(built)
  }, [solution, placementToSlot])

  const handleLanded = (flyerIndex: number) => {
    if (!flyers) return
    const flyer = flyers[flyerIndex]
    applyPlacement(flyer.placement)
    setConsumed(prev => {
      const slotIdx = placementToSlot[flyerIndex]
      if (slotIdx < 0) return prev
      const next = new Set(prev)
      next.add(slotIdx)
      return next
    })
  }

  // Mark the chip as consumed at the moment its flyer starts moving
  // (i.e. after its delay elapses). We approximate this by scheduling
  // a timeout. The flyer keeps its initial state hidden via opacity in
  // FlyerOverlay (animate to opacity:1 in the first keyframe).
  useLayoutEffect(() => {
    if (!flyers) return
    const timers = flyers.map((flyer, i) =>
      window.setTimeout(() => {
        setConsumed(prev => {
          const slotIdx = placementToSlot[i]
          if (slotIdx < 0) return prev
          const next = new Set(prev)
          next.add(slotIdx)
          return next
        })
      }, flyer.delay * 1000),
    )
    return () => { timers.forEach(clearTimeout) }
  }, [flyers, placementToSlot])

  return (
    <div ref={rootRef} className="relative flex flex-col gap-4 w-full max-w-sm items-center">
      <Grid
        cellRef={(row, col, el) => {
          if (el) cellRects.current.set(`${row},${col}`, el.getBoundingClientRect())
        }}
      />
      <SelectionCart ref={cartRef} slots={slots} consumed={consumed} />

      {flyers && containerRect && (
        <FlyerOverlay
          containerRect={containerRect}
          flyers={flyers}
          onFlyerLanded={handleLanded}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Visual smoke check**

Run `npm run dev`, play to auto-placing. Expected:
- Pieces visibly fly one-by-one from their cart chip to their grid slot in an arced trajectory.
- Each chip dims to 25% opacity at the moment its piece launches.
- Grid cells turn into colored placed cells as each piece lands.
- After the last piece lands, the screen freezes (no badge or CTA yet — those are upcoming).

- [ ] **Step 5: Type check + tests**

```bash
npx tsc --noEmit && npm run test
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/Grid.tsx src/components/AutoPlacingPhase/FlyerOverlay.tsx src/components/AutoPlacingPhase/index.tsx
git commit -m "feat: animate pieces from cart to grid with framer-motion

FlyerOverlay renders one motion.div per placement with measured
source/target positions; pieces fly with arced trajectory and
scale up from cart size to grid size. Chips dim as their flyer
launches; cells fill as each flyer lands."
```

---

## Task 10: `CelebrationBadge` component

**Why:** The success moment — green badge + drawn checkmark + confetti burst + "Perfect!" label. Reveals 200ms after the last piece lands.

**Files:**
- Create: `src/components/AutoPlacingPhase/CelebrationBadge.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/AutoPlacingPhase/CelebrationBadge.tsx`:

```tsx
import { motion } from 'framer-motion'

interface Props {
  /** When true, the badge animates in; when false, it's hidden. */
  show: boolean
}

const CONFETTI_OFFSETS = [
  { x: -50, y: -58 },
  { x:  50, y: -58 },
  { x: -70, y:   0 },
  { x:  70, y:   0 },
  { x: -40, y:  48 },
  { x:  40, y:  48 },
]
const CONFETTI_COLORS = ['#facc15', '#22c55e', '#ec4899', '#22d3ee', '#facc15', '#f97316']

export function CelebrationBadge({ show }: Props) {
  if (!show) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center pt-12 z-20">
      <motion.div
        className="relative flex items-center justify-center"
        style={{
          width: 84,
          height: 84,
          borderRadius: 22,
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          boxShadow: '0 8px 24px rgba(34,197,94,.35), 0 0 0 4px rgba(34,197,94,.15)',
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: [0, 1.15, 1] }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <motion.svg
          width={38} height={38} viewBox="0 0 40 40"
          fill="none" stroke="white" strokeWidth={5}
          strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.15, duration: 0.3, ease: 'easeOut' }}
        >
          <motion.path d="M8 22 L17 30 L33 12" />
        </motion.svg>

        {/* Confetti dots */}
        {CONFETTI_OFFSETS.map((o, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{ width: 6, height: 6, background: CONFETTI_COLORS[i], left: '50%', top: '50%' }}
            initial={{ x: -3, y: -3, scale: 0, opacity: 0 }}
            animate={{
              x: [-3, o.x - 3],
              y: [-3, o.y - 3],
              scale: [0, 1],
              opacity: [0, 1, 0],
            }}
            transition={{
              delay: 0.2,
              duration: 0.7,
              ease: 'easeOut',
              times: [0, 0.4, 1],
            }}
          />
        ))}
      </motion.div>

      <motion.span
        className="mt-3 text-sm font-bold tracking-widest uppercase text-green-400"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.2 }}
      >
        Perfect!
      </motion.span>
    </div>
  )
}
```

- [ ] **Step 2: Render it under a temporary always-on flag in AutoPlacingPhase**

In `src/components/AutoPlacingPhase/index.tsx`, add the import:
```ts
import { CelebrationBadge } from './CelebrationBadge'
```
and add the badge to the JSX (anywhere inside the root `<div>`):
```tsx
<CelebrationBadge show={true} />
```

This `show={true}` is **temporary** — Task 13 wires it to the state machine. For now it lets you visually confirm the badge renders.

- [ ] **Step 3: Visual check**

Run `npm run dev` to auto-placing. Expected: the green badge with the white checkmark and "Perfect!" label is visible on top of the grid area. (It'll be there from the start of auto-placing, which is wrong — that's fine, fixed in Task 13.)

- [ ] **Step 4: Remove the temporary `show={true}` for now**

Change `<CelebrationBadge show={true} />` to `<CelebrationBadge show={false} />` so the rest of the implementation isn't visually polluted. Task 13 will gate it properly.

- [ ] **Step 5: Commit**

```bash
git add src/components/AutoPlacingPhase/CelebrationBadge.tsx src/components/AutoPlacingPhase/index.tsx
git commit -m "feat: CelebrationBadge component with checkmark draw + confetti"
```

---

## Task 11: `ScorePanel` component

**Why:** Reveals the three score rows and a total, with each number counting up via `useCountUp`.

**Files:**
- Create: `src/components/AutoPlacingPhase/ScorePanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/AutoPlacingPhase/ScorePanel.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useCountUp } from '../../hooks/useCountUp'
import type { RoundScore } from '../../types'

interface Props {
  roundScore: RoundScore
  /** When true, rows reveal + counts animate; when false, panel is hidden. */
  show: boolean
}

const ROW_STAGGER = 0.3   // seconds between row reveals
const COUNT_DURATION = 400

export function ScorePanel({ roundScore, show }: Props) {
  if (!show) return null

  return (
    <motion.div
      className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <Row icon="✓" label="Correctness"        value={roundScore.correctness}     delay={0}                color="text-green-400"  />
      <Row icon="⚡" label="Speed Bonus"        value={roundScore.speedBonus}      delay={ROW_STAGGER}      color="text-yellow-400" />
      <Row icon="◆" label="Efficiency Bonus"   value={roundScore.efficiencyBonus} delay={ROW_STAGGER * 2}  color="text-cyan-400"   />

      <motion.div
        className="mt-2 pt-2 border-t border-gray-800 flex justify-between items-baseline"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: [0.92, 1.08, 1] }}
        transition={{ delay: ROW_STAGGER * 3, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <span className="text-[11px] tracking-widest text-gray-400 uppercase">Round Total</span>
        <span className="text-2xl font-extrabold text-yellow-400 tabular-nums">
          +<TotalNumber value={roundScore.total} delay={ROW_STAGGER * 3} />
        </span>
      </motion.div>
    </motion.div>
  )
}

function Row({ icon, label, value, delay, color }: {
  icon: string; label: string; value: number; delay: number; color: string
}) {
  return (
    <motion.div
      className="flex justify-between items-center text-[13px] py-1"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25, ease: 'easeOut' }}
    >
      <span>
        <span className={`inline-block w-5 text-center mr-1 ${color}`}>{icon}</span>
        <span className="text-gray-300">{label}</span>
      </span>
      <span className="font-semibold text-white tabular-nums">
        +<DelayedCountUp value={value} delay={delay} />
      </span>
    </motion.div>
  )
}

/** Wraps useCountUp with an additional render-time delay before starting. */
function DelayedCountUp({ value, delay }: { value: number; delay: number }) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setActive(true), delay * 1000)
    return () => clearTimeout(t)
  }, [delay])
  const animated = useCountUp(active ? value : 0, COUNT_DURATION)
  return <>{animated.toLocaleString()}</>
}

function TotalNumber({ value, delay }: { value: number; delay: number }) {
  return <DelayedCountUp value={value} delay={delay} />
}
```

- [ ] **Step 2: Render it with a temporary always-on flag**

In `src/components/AutoPlacingPhase/index.tsx`:

**2a.** Add to the destructured store selector:
```ts
const { selection, solution, applyPlacement, roundScore } = useGameStore(useShallow(s => ({
  selection: s.selection,
  solution: s._autoPlaceSolution,
  applyPlacement: s.applyPlacement,
  roundScore: s.roundScore,
})))
```

**2b.** Add the import:
```ts
import { ScorePanel } from './ScorePanel'
```

**2c.** Add to the JSX below the cart:
```tsx
{roundScore && <ScorePanel roundScore={roundScore} show={true} />}
```

(Again `show={true}` is temporary; Task 13 wires it to state.)

- [ ] **Step 3: Visual check**

Run `npm run dev`, play to auto-placing. Expected: after the flyers play, the score panel is visible. The numbers count up from 0 in sequence (correctness, then speed, then efficiency, then total with a scale pulse). Total in gold.

- [ ] **Step 4: Set `show={false}` for now**

In `index.tsx`, change `<ScorePanel ... show={true} />` to `<ScorePanel ... show={false} />`.

- [ ] **Step 5: Commit**

```bash
git add src/components/AutoPlacingPhase/ScorePanel.tsx src/components/AutoPlacingPhase/index.tsx
git commit -m "feat: ScorePanel with staggered rows and count-up numbers"
```

---

## Task 12: `NextRoundButton` component

**Why:** The CTA that closes the celebration and advances to the next round. Must be idempotent (one click → one `nextRound` call).

**Files:**
- Create: `src/components/AutoPlacingPhase/NextRoundButton.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/AutoPlacingPhase/NextRoundButton.tsx`:

```tsx
import { useRef } from 'react'
import { motion } from 'framer-motion'

interface Props {
  show: boolean
  onClick: () => void
}

export function NextRoundButton({ show, onClick }: Props) {
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
      className="w-full py-3 bg-green-700 hover:bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-900/40 cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      Next Round →
    </motion.button>
  )
}
```

- [ ] **Step 2: Render it (temporarily always-on) in AutoPlacingPhase**

In `src/components/AutoPlacingPhase/index.tsx`:

**2a.** Add to the destructured selector:
```ts
const { selection, solution, applyPlacement, roundScore, nextRound } = useGameStore(useShallow(s => ({
  selection: s.selection,
  solution: s._autoPlaceSolution,
  applyPlacement: s.applyPlacement,
  roundScore: s.roundScore,
  nextRound: s.nextRound,
})))
```

**2b.** Import + render at the bottom of the JSX:
```ts
import { NextRoundButton } from './NextRoundButton'
```
```tsx
<NextRoundButton show={true} onClick={nextRound} />
```

- [ ] **Step 3: Visual check**

Run `npm run dev`. Expected: button visible at bottom. Click it — should advance to next round (the existing `nextRound` action handles round++ and starts a new game).

- [ ] **Step 4: Set `show={false}` for now**

```tsx
<NextRoundButton show={false} onClick={nextRound} />
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AutoPlacingPhase/NextRoundButton.tsx src/components/AutoPlacingPhase/index.tsx
git commit -m "feat: NextRoundButton with idempotent click + slide-up"
```

---

## Task 13: Wire the state machine in `AutoPlacingPhase`

**Why:** Replace the three `show={false}` flags with a real state machine that progresses `measuring` → `flying` → `badge` → `scoring` → `cta`, calling `commitRoundScore` at the right moment.

**Files:**
- Modify: `src/components/AutoPlacingPhase/index.tsx`

- [ ] **Step 1: Add a state machine and time-based transitions**

Replace the body of `src/components/AutoPlacingPhase/index.tsx` with:

```tsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from '../Grid'
import { SelectionCart, type SelectionCartHandle } from './SelectionCart'
import { FlyerOverlay, type FlyerSpec } from './FlyerOverlay'
import { CelebrationBadge } from './CelebrationBadge'
import { ScorePanel } from './ScorePanel'
import { NextRoundButton } from './NextRoundButton'
import { expandCartSlots, mapPlacementsToSlots } from '../../engine/cartSlots'

type Stage = 'measuring' | 'flying' | 'badge' | 'scoring' | 'cta'

// Time budgets (ms) from the spec:
const BEAT_AFTER_FLIGHT = 200
const BADGE_DURATION    = 400
const SCORING_DURATION  = 1500   // 3 rows × 300ms stagger + 400ms count + buffer

export function AutoPlacingPhase() {
  const { selection, solution, applyPlacement, roundScore, commitRoundScore, nextRound } =
    useGameStore(useShallow(s => ({
      selection: s.selection,
      solution: s._autoPlaceSolution,
      applyPlacement: s.applyPlacement,
      roundScore: s.roundScore,
      commitRoundScore: s.commitRoundScore,
      nextRound: s.nextRound,
    })))

  const slots = useMemo(() => expandCartSlots(selection), [selection])
  const placementToSlot = useMemo(
    () => mapPlacementsToSlots(solution ?? [], slots),
    [solution, slots],
  )

  const rootRef = useRef<HTMLDivElement>(null)
  const cartRef = useRef<SelectionCartHandle>(null)
  const cellRects = useRef<Map<string, DOMRect>>(new Map())

  const [stage, setStage] = useState<Stage>('measuring')
  const [flyers, setFlyers] = useState<FlyerSpec[] | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const [consumed, setConsumed] = useState<ReadonlySet<number>>(new Set())
  const landedCount = useRef(0)

  // Measure and build flyer specs after first render.
  useLayoutEffect(() => {
    if (stage !== 'measuring') return
    if (!solution || solution.length === 0) {
      // Defensive: no pieces to fly. Skip directly to badge.
      setStage('badge')
      return
    }
    if (!rootRef.current || !cartRef.current) return

    const N = solution.length
    const perPiece = Math.min(500, 3000 / N) / 1000
    const built: FlyerSpec[] = []

    for (let i = 0; i < N; i++) {
      const placement = solution[i]
      const slotIdx = placementToSlot[i]
      const chipRect = slotIdx >= 0 ? cartRef.current.getChipRect(slotIdx) : null
      const cellRect = cellRects.current.get(`${placement.anchorRow},${placement.anchorCol}`)
      if (!chipRect || !cellRect) continue
      built.push({
        placement,
        sourceX: chipRect.left,
        sourceY: chipRect.top,
        targetX: cellRect.left,
        targetY: cellRect.top,
        duration: perPiece,
        delay: i * perPiece,
      })
    }

    setContainerRect(rootRef.current.getBoundingClientRect())
    setFlyers(built)
    setStage('flying')
  }, [stage, solution, placementToSlot])

  // Dim chips at the moment their flyer launches.
  useEffect(() => {
    if (stage !== 'flying' || !flyers) return
    const timers = flyers.map((f, i) =>
      window.setTimeout(() => {
        setConsumed(prev => {
          const slotIdx = placementToSlot[i]
          if (slotIdx < 0) return prev
          const next = new Set(prev)
          next.add(slotIdx)
          return next
        })
      }, f.delay * 1000),
    )
    return () => { timers.forEach(clearTimeout) }
  }, [stage, flyers, placementToSlot])

  // Stage transitions after flying.
  useEffect(() => {
    if (stage !== 'badge') return
    const t = window.setTimeout(() => setStage('scoring'), BADGE_DURATION)
    return () => clearTimeout(t)
  }, [stage])

  useEffect(() => {
    if (stage !== 'scoring') return
    // Per the spec data flow, commitRoundScore fires AFTER the panel
    // finishes counting up — that way the GameShell header's running
    // total updates at the same moment the panel total settles.
    const t = window.setTimeout(() => {
      commitRoundScore()
      setStage('cta')
    }, SCORING_DURATION)
    return () => clearTimeout(t)
  }, [stage, commitRoundScore])

  const handleLanded = (flyerIndex: number) => {
    if (!flyers) return
    applyPlacement(flyers[flyerIndex].placement)
    landedCount.current += 1
    if (landedCount.current === flyers.length) {
      window.setTimeout(() => setStage('badge'), BEAT_AFTER_FLIGHT)
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-4 w-full max-w-sm items-center">
      <Grid
        cellRef={(row, col, el) => {
          if (el) cellRects.current.set(`${row},${col}`, el.getBoundingClientRect())
        }}
      />
      <SelectionCart ref={cartRef} slots={slots} consumed={consumed} />

      {flyers && containerRect && stage === 'flying' && (
        <FlyerOverlay
          containerRect={containerRect}
          flyers={flyers}
          onFlyerLanded={handleLanded}
        />
      )}

      <CelebrationBadge show={stage === 'badge' || stage === 'scoring' || stage === 'cta'} />

      {roundScore && (
        <ScorePanel
          roundScore={roundScore}
          show={stage === 'scoring' || stage === 'cta'}
        />
      )}

      <NextRoundButton show={stage === 'cta'} onClick={nextRound} />
    </div>
  )
}
```

- [ ] **Step 2: Visual check — full flow**

Run `npm run dev`. Play through to auto-placing. Expected sequence:
1. Pieces fly in one-by-one.
2. After last piece lands + ~200ms, green badge pops in with checkmark + confetti + "Perfect!".
3. Score panel reveals; numbers count up; total settles in gold.
4. Next Round button slides in from below.
5. Click → next round starts.

Repeat for 3-4 rounds to verify each round works correctly.

- [ ] **Step 3: Type check + tests**

```bash
npx tsc --noEmit && npm run test
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/AutoPlacingPhase/index.tsx
git commit -m "feat: AutoPlacingPhase state machine drives celebration sequence

Stages: measuring → flying → badge → scoring → cta.
commitRoundScore fires when scoring stage starts; the gated
sub-components reveal at the right moments via FM AnimatePresence."
```

---

## Task 14: `prefers-reduced-motion` fallback

**Why:** Users who request reduced motion should see all the information (placed grid + score + CTA) but without any of the motion.

**Files:**
- Modify: `src/components/AutoPlacingPhase/index.tsx`

- [ ] **Step 1: Add the reduced-motion branch**

In `src/components/AutoPlacingPhase/index.tsx`, add the import:
```ts
import { useReducedMotion } from 'framer-motion'
```

Then, just below the existing `useState`/`useRef` declarations and BEFORE the measurement `useLayoutEffect`, add a new effect that handles the reduced-motion case:

```ts
const reduceMotion = useReducedMotion()

// Reduced motion: skip the flight. Apply all placements immediately,
// then jump straight to the CTA (with the badge + score visible).
useEffect(() => {
  if (!reduceMotion) return
  if (stage !== 'measuring') return
  if (!solution) return
  for (const p of solution) applyPlacement(p)
  commitRoundScore()
  setStage('cta')
}, [reduceMotion, stage, solution, applyPlacement, commitRoundScore])
```

The existing `measuring` → `flying` `useLayoutEffect` should also short-circuit when `reduceMotion` is true. Update its top:

```ts
useLayoutEffect(() => {
  if (stage !== 'measuring') return
  if (reduceMotion) return                     // ← ADD
  if (!solution || solution.length === 0) {
    setStage('badge')
    return
  }
  // ... rest unchanged
}, [stage, solution, placementToSlot, reduceMotion])  // ← add to deps
```

Also: in the reduced-motion path, the badge + scores + CTA appear together. The existing render gates already handle this (badge shows in `'cta'` too).

For the score panel, the rows should NOT count up under reduced motion. Update the `DelayedCountUp` in `ScorePanel.tsx`:

In `src/components/AutoPlacingPhase/ScorePanel.tsx`, add at the top:
```ts
import { useReducedMotion } from 'framer-motion'
```

Replace the `DelayedCountUp` function body:
```tsx
function DelayedCountUp({ value, delay }: { value: number; delay: number }) {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (reduceMotion) { setActive(true); return }
    const t = window.setTimeout(() => setActive(true), delay * 1000)
    return () => clearTimeout(t)
  }, [delay, reduceMotion])
  const animated = useCountUp(active ? value : 0, reduceMotion ? 0 : COUNT_DURATION)
  return <>{animated.toLocaleString()}</>
}
```

- [ ] **Step 2: Manual reduced-motion check**

In Chrome DevTools: open Command Palette (⌘⇧P) → "Show Rendering" → "Emulate CSS media feature prefers-reduced-motion" → "reduce".

Run `npm run dev`, play to auto-placing. Expected: no fly, no count-up, no slide-in. The grid is filled, the badge sits there, the score breakdown shows final values, the Next Round button is immediately clickable. From phase-start to clickable CTA should be ~half a second at most.

- [ ] **Step 3: Add a state-machine test for reduced motion**

Create `tests/components/AutoPlacingPhase.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutoPlacingPhase } from '../../src/components/AutoPlacingPhase'
import { useGameStore } from '../../src/store/gameStore'

// Mock useReducedMotion to return true.
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, useReducedMotion: () => true }
})

beforeEach(() => {
  useGameStore.getState().resetGame()
})

describe('AutoPlacingPhase with reduced motion', () => {
  it('renders the Next Round button immediately after mount', () => {
    // Drive the store into auto-placing with a solved selection.
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    render(<AutoPlacingPhase />)
    // The button text is "Next Round →"
    expect(screen.getByText(/Next Round/)).toBeInTheDocument()
  })

  it('advances the round when Next Round is clicked', async () => {
    const user = userEvent.setup()
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    render(<AutoPlacingPhase />)
    const before = useGameStore.getState().round
    await user.click(screen.getByText(/Next Round/))
    expect(useGameStore.getState().round).toBe(before + 1)
  })

  it('Next Round button is idempotent — multiple clicks advance only one round', async () => {
    const user = userEvent.setup()
    act(() => useGameStore.getState().startGame())
    const { gaps } = useGameStore.getState()
    act(() => useGameStore.getState().endViewing())
    act(() => { for (const gap of gaps) useGameStore.getState().incrementSelection(gap.pieceType) })
    act(() => useGameStore.getState().submitSelection())

    render(<AutoPlacingPhase />)
    const before = useGameStore.getState().round
    const btn = screen.getByText(/Next Round/)
    await user.click(btn)
    await user.click(btn)
    await user.click(btn)
    expect(useGameStore.getState().round).toBe(before + 1)
  })
})
```

- [ ] **Step 4: Run the new tests**

Run:
```bash
npm run test -- AutoPlacingPhase
```
Expected: all 3 tests pass.

- [ ] **Step 5: Type check + full test suite**

```bash
npx tsc --noEmit && npm run test
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/AutoPlacingPhase/index.tsx src/components/AutoPlacingPhase/ScorePanel.tsx tests/components/AutoPlacingPhase.test.tsx
git commit -m "feat: reduced-motion fallback skips fly + count-up

Tests cover the CTA-immediate path and the click-idempotency
guarantee for the Next Round button."
```

---

## Task 15: Manual smoke test + final polish pass

**Why:** With everything wired, play through the game and confirm the experience matches the spec. Catch any visual issues (spacing, timing, overlap) that need quick tweaks before declaring done.

**Files:** Whatever visual tweaks are needed; commonly `src/components/AutoPlacingPhase/index.tsx` for spacing.

- [ ] **Step 1: Reset reduced-motion emulation (if enabled in Task 14)**

DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion" → "No emulation".

- [ ] **Step 2: Play through 4-5 rounds at increasing difficulty**

Run `npm run dev`. Start a new game. For each round, deliberately make a correct selection to trigger the auto-place path. Observe:

| Check | Pass criteria |
|---|---|
| Pieces visibly fly from cart to grid | ✓ — arc trajectory, scale up, lands aligned with the target cell |
| Cart chips dim at launch | ✓ — opacity ~25% the instant the flyer starts moving |
| Grid cells fill as pieces land | ✓ — cell turns to placed color underneath the flyer |
| Badge pops in cleanly | ✓ — 200ms after last piece lands; green; checkmark draws; confetti |
| Score rows reveal sequentially | ✓ — correctness, then speed, then efficiency; numbers count up |
| Total in gold with scale pulse | ✓ — settles last |
| Header total updates | Acceptable — jumps mid-celebration when `commitRoundScore` fires; no extra animation needed |
| Next Round button slides up | ✓ — spring; clickable |
| Late rounds (5-7 pieces) don't drag | ✓ — total fly ≤ 3s; whole celebration ≤ ~5s |

- [ ] **Step 3: Note any visual issues and fix inline**

Common things to look for and likely quick fixes:
- **Badge overlaps the grid awkwardly**: increase `pt-12` in `CelebrationBadge.tsx` or anchor it above the grid by absolute positioning relative to the root.
- **Score panel pushes the button off-screen**: reserve the panel's vertical space from the start (render with `opacity: 0` instead of conditional render — change `if (!show) return null` to `style={{ opacity: show ? 1 : 0 }}` on the root motion.div, and same for badge if needed).
- **CTA appears too soon / too late**: tweak `SCORING_DURATION` in `index.tsx`.
- **Spacing between grid / cart / panel / button**: adjust `gap-4` on the root container or the `mt-X` on individual components.

Make the smallest changes needed. Don't over-engineer.

- [ ] **Step 4: Verify all tests + types still pass**

```bash
npx tsc --noEmit && npm run test
```
Expected: clean. Test count should be 48 (original) + 6 (Tasks 2-3) + 7 (cartSlots) + 5 (useCountUp) + 3 (AutoPlacingPhase) = **69 tests**.

- [ ] **Step 5: Manual-place smoke test**

To make sure we didn't break the manual-place flow: start a new game, deliberately submit a wrong selection (e.g. just press Done immediately with nothing selected, or pick a SINGLE when not needed). Expected: transitions to `manual-placing`, you can place pieces, finishing transitions to the existing `ScoringPhase`. No regressions.

- [ ] **Step 6: Final commit (if any tweaks)**

If you made polish changes:
```bash
git add src/components/AutoPlacingPhase/
git commit -m "polish: tune spacing and timing in auto-place celebration"
```

If nothing needed tweaking, no commit required — Task 14 was the last functional change.

---

## Summary

When this plan is complete, the user sees:
1. A correct piece-selection triggers an animated reveal: pieces fly into their slots, success badge + confetti play, score breakdown counts up, Next Round button slides in.
2. Reduced-motion users get the same information instantly with no animation.
3. The manual-place flow is unchanged.
4. All existing 48 tests still pass; ~21 new tests cover the new behavior.
