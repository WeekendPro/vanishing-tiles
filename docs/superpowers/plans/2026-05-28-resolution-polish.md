# Resolution Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the resolving-phase feedback slower and clearer — a one-at-a-time reveal (good pieces fly in; bad pieces shake, gray out, and get a thick red ✕), a diagnostic badge sub-label, and a coverage-tiered Accuracy icon.

**Architecture:** The store classifies *why* a selection failed and stores it on `_resolution.reason`. `ResolutionPhase` replaces its all-at-once `flying` stage with a `step`-indexed walk through the cart, driving progressive `consumed` (good) and `rejected` (bad) sets. The badge and Accuracy icon read coverage/reason from `_resolution`.

**Tech Stack:** TypeScript, React, Zustand 5 (`useShallow` for object selectors), framer-motion, Vitest + Testing Library, Vite + Tailwind.

**Conventions (read before starting):**
- Single test file: `npx vitest run tests/path/file.test.ts`. Full suite: `npm run test`.
- **Verify with `npm run build`, not just `npx tsc --noEmit`** — the build (`tsc -b`) uses `noUnusedLocals` and catches unused imports the root `tsc --noEmit` misses. Also run `npm run lint`.
- **Do not chain shell commands with `&&`** in this environment (an nvm shim breaks on chained npm/npx) — run `npm run test`, `npm run build`, `npm run lint` as separate commands.
- Zustand object selectors MUST use `useShallow`. Each commit must leave `npm run test`, `npm run build`, and `npm run lint` green.
- Current resolving-phase types: `Resolution = { kind: 'perfect'|'partial'; placements: Placement[]; coverage: number }`. `SelectionEntry = { pieceType; freeCount }`. Coverage threshold for "close" is `0.66`.

---

## File map

| File | Change | Task |
|---|---|---|
| `src/types.ts` | Add `ResolutionReason`; add `reason?` to `Resolution`. | 1 |
| `src/store/gameStore.ts` | Classify `reason` in `submitSelection`; store on `_resolution`. | 1 |
| `src/components/ResolutionPhase/PartialBadge.tsx` | Drop %, show main line + reason sub-label. | 2 |
| `src/components/ResolutionPhase/ScorePanel.tsx` | `accuracyTier` prop → Accuracy icon/color. | 3 |
| `src/components/ResolutionPhase/SelectionCart.tsx` | `rejected` prop: shake + grayscale + thick ✕. | 4 |
| `src/components/ResolutionPhase/index.tsx` | Pass reason/accuracyTier/rejected; then the sequential walk + timing + reduced-motion. | 2,3,4,5 |
| `tests/...` | Reason classification, badge copy, accuracy icon, reject rendering. | 1–5 |

---

## Task 1: Store — failure `reason` classification

**Files:**
- Modify: `src/types.ts`, `src/store/gameStore.ts`
- Test: `tests/store/gameStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/gameStore.test.ts` (the file already imports `useGameStore`, `DIFFICULTY_TABLE`, `describe/it/expect`, `act`, and uses fake timers in `beforeEach`):

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
// reason depends only on grid + selection (not gaps); gaps:[] is fine here.
function submitWith(grid: Grid, selection: { pieceType: any; freeCount: number }[]) {
  useGameStore.setState({
    grid, gaps: [], selection, lives: 3,
    difficulty: DIFFICULTY_TABLE[0], phaseStartTime: Date.now(),
  })
  act(() => useGameStore.getState().submitSelection())
  return useGameStore.getState()._resolution
}
const O_GAP_1: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1]]
const O_GAP_2: [number, number][] = [[0, 3], [0, 4], [1, 3], [1, 4]]
const O_GAP_3: [number, number][] = [[0, 6], [0, 7], [1, 6], [1, 7]]

describe('submitSelection — failure reason', () => {
  it('"too-many": all gaps covered but extra pieces selected', () => {
    const grid = emptyAt(fullGrid(), O_GAP_1)                 // one 2x2 gap
    const res = submitWith(grid, [
      { pieceType: 'O', freeCount: 1 },                       // covers the gap
      { pieceType: 'T', freeCount: 1 },                       // extra
    ])
    expect(res?.kind).toBe('partial')
    expect(res?.reason).toBe('too-many')
  })

  it('"wrong-shapes": enough cells but shapes do not fit', () => {
    const grid = emptyAt(fullGrid(), O_GAP_1)                 // 2x2 gap
    const res = submitWith(grid, [{ pieceType: 'I', freeCount: 1 }]) // I can't fit 2x2
    expect(res?.reason).toBe('wrong-shapes')
  })

  it('"missed-one": under-selected by one piece', () => {
    const grid = emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2) // two gaps (8 cells)
    const res = submitWith(grid, [{ pieceType: 'O', freeCount: 1 }]) // fills one, 4 uncovered
    expect(res?.reason).toBe('missed-one')
  })

  it('"missed-many": under-selected by more than one piece', () => {
    const grid = emptyAt(emptyAt(emptyAt(fullGrid(), O_GAP_1), O_GAP_2), O_GAP_3) // 12 cells
    const res = submitWith(grid, [{ pieceType: 'O', freeCount: 1 }]) // fills one, 8 uncovered
    expect(res?.reason).toBe('missed-many')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/store/gameStore.test.ts`
Expected: FAIL — `reason` is undefined.

- [ ] **Step 3: Add the `ResolutionReason` type**

In `src/types.ts`, just above the `Resolution` interface, add:
```ts
export type ResolutionReason = 'too-many' | 'wrong-shapes' | 'missed-one' | 'missed-many'
```
And add `reason` to `Resolution`:
```ts
export interface Resolution {
  kind: 'perfect' | 'partial'
  placements: Placement[]
  coverage: number
  reason?: ResolutionReason   // set only when kind === 'partial'
}
```

- [ ] **Step 4: Classify in the store**

In `src/store/gameStore.ts`, add `ResolutionReason` to the existing `import type { ... } from '../types'` line.

In `submitSelection`'s unsolvable (`else`) branch, after the `coverage` line and before building `roundScore`, insert:
```ts
      const uncovered = fit.totalCells - fit.filledCells
      const selectedCells = Object.entries(pieceCount)
        .reduce((sum, [type, n]) => sum + (n ?? 0) * (type === 'SINGLE' ? 1 : 4), 0)
      let reason: ResolutionReason
      if (uncovered === 0) reason = 'too-many'
      else if (selectedCells >= fit.totalCells) reason = 'wrong-shapes'
      else reason = Math.max(1, Math.round(uncovered / 4)) === 1 ? 'missed-one' : 'missed-many'
```
Then add `reason` to the resolution in that branch's `set(...)`:
```ts
        _resolution: { kind: 'partial', placements: fit.placements, coverage, reason },
```
(The solvable branch is unchanged — its `_resolution` has no `reason`.)

- [ ] **Step 5: Verify**

Run each separately: `npx vitest run tests/store/gameStore.test.ts` (PASS), `npm run test` (all pass), `npm run build` (clean), `npm run lint` (clean).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/store/gameStore.ts tests/store/gameStore.test.ts
git commit -m "feat(store): classify partial-resolution failure reason"
```

---

## Task 2: Badge — main line + reason sub-label

**Files:**
- Modify: `src/components/ResolutionPhase/PartialBadge.tsx`, `src/components/ResolutionPhase/index.tsx`
- Test: `tests/components/ResolutionPhase.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `tests/components/ResolutionPhase.test.tsx` (reuses existing `fullGrid`/`emptyAt`, `render`, `screen`, `useGameStore`, `ResolutionPhase`; the file mocks `useReducedMotion` → true):

```ts
describe('ResolutionPhase — badge copy (reduced motion)', () => {
  function showPartial(coverage: number, reason: string) {
    useGameStore.setState({
      phase: 'resolving', lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { correctness: 1, speedBonus: 0, efficiencyBonus: 0, total: 1 },
      _resolution: {
        kind: 'partial', coverage, reason: reason as any,
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
  }

  it('high coverage → "So close!" with the reason sub-label, no percentage', () => {
    showPartial(0.8, 'too-many')
    render(<ResolutionPhase />)
    expect(screen.getByText('So close!')).toBeInTheDocument()
    expect(screen.getByText('Too many pieces')).toBeInTheDocument()
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument()
  })

  it('low coverage → "Nice try" with the reason sub-label', () => {
    showPartial(0.25, 'missed-many')
    render(<ResolutionPhase />)
    expect(screen.getByText('Nice try')).toBeInTheDocument()
    expect(screen.getByText('Missed some pieces')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: FAIL — old badge renders a `%` and no sub-label.

- [ ] **Step 3: Rewrite `PartialBadge`**

Replace the contents of `src/components/ResolutionPhase/PartialBadge.tsx` with:
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

export function PartialBadge({ show, coverage, reason }: Props) {
  if (!show) return null
  const close = coverage >= 0.66
  const mainLine = close ? 'So close!' : 'Nice try'
  const glyph = close ? '≈' : '✕'
  const subLabel = reason ? REASON_LABEL[reason] : ''

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
        <span className="text-5xl font-black text-white leading-none">{glyph}</span>
      </motion.div>
      <motion.span
        className="mt-3 text-sm font-bold tracking-widest uppercase text-amber-400"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.2 }}
      >
        {mainLine}
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

- [ ] **Step 4: Pass `reason` from `index.tsx`**

In `src/components/ResolutionPhase/index.tsx`, update the PartialBadge render:
```tsx
        {resolution?.kind === 'partial'
          ? <PartialBadge show={badgeShown} coverage={resolution.coverage} reason={resolution.reason} />
          : <CelebrationBadge show={badgeShown} />}
```

- [ ] **Step 5: Verify**

Run separately: `npx vitest run tests/components/ResolutionPhase.test.tsx` (PASS), `npm run test`, `npm run build`, `npm run lint` (all clean).

- [ ] **Step 6: Commit**

```bash
git add src/components/ResolutionPhase/PartialBadge.tsx src/components/ResolutionPhase/index.tsx tests/components/ResolutionPhase.test.tsx
git commit -m "feat(resolution): diagnostic badge — main line + reason sub-label"
```

---

## Task 3: Accuracy-row icon tiers

**Files:**
- Modify: `src/components/ResolutionPhase/ScorePanel.tsx`, `src/components/ResolutionPhase/index.tsx`
- Test: `tests/components/ResolutionPhase.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `tests/components/ResolutionPhase.test.tsx`:
```ts
describe('ResolutionPhase — accuracy icon (reduced motion)', () => {
  function showPartial(coverage: number) {
    useGameStore.setState({
      phase: 'resolving', lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }],
      roundScore: { correctness: 1, speedBonus: 0, efficiencyBonus: 0, total: 1 },
      _resolution: {
        kind: 'partial', coverage, reason: 'too-many',
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
  }

  // Note: the badge glyph reuses the same character (≈/✕), so scope the
  // assertion to the Accuracy row rather than the whole document.
  it('close coverage shows the amber ≈ accuracy icon', () => {
    showPartial(0.8)
    render(<ResolutionPhase />)
    const accRow = screen.getByText('Accuracy').closest('div')!
    expect(accRow.textContent).toContain('≈')
  })

  it('far coverage shows the red ✕ accuracy icon', () => {
    showPartial(0.3)
    render(<ResolutionPhase />)
    const accRow = screen.getByText('Accuracy').closest('div')!
    expect(accRow.textContent).toContain('✕')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: FAIL on the `≈` test (Accuracy row hardcodes `✓`).

- [ ] **Step 3: Add `accuracyTier` to `ScorePanel`**

In `src/components/ResolutionPhase/ScorePanel.tsx`, extend `Props`:
```ts
interface Props {
  roundScore: RoundScore
  grandTotal: number
  show: boolean
  accuracyTier: 'perfect' | 'close' | 'far'
}
```
Add a tier→icon map above the component:
```ts
const ACCURACY_ICON: Record<Props['accuracyTier'], { icon: string; color: string }> = {
  perfect: { icon: '✓', color: 'text-green-400' },
  close:   { icon: '≈', color: 'text-amber-400' },
  far:     { icon: '✕', color: 'text-red-400' },
}
```
Update the signature to destructure `accuracyTier`, and replace the Accuracy `Row`:
```tsx
      <Row icon={ACCURACY_ICON[accuracyTier].icon} label="Accuracy" value={roundScore.correctness} delay={0} color={ACCURACY_ICON[accuracyTier].color} />
```
(Speed and Efficiency rows unchanged.)

- [ ] **Step 4: Compute + pass `accuracyTier` from `index.tsx`**

In `src/components/ResolutionPhase/index.tsx`, add near `badgeShown`:
```ts
  const accuracyTier: 'perfect' | 'close' | 'far' =
    resolution?.kind === 'perfect' ? 'perfect'
      : (resolution && resolution.coverage >= 0.66 ? 'close' : 'far')
```
And pass it to ScorePanel:
```tsx
        <ScorePanel
          roundScore={roundScore}
          grandTotal={grandTotal}
          show={stage === 'scoring' || stage === 'cta'}
          accuracyTier={accuracyTier}
        />
```

- [ ] **Step 5: Verify**

Run separately: `npx vitest run tests/components/ResolutionPhase.test.tsx`, `npm run test`, `npm run build`, `npm run lint` (all clean). The pre-existing perfect-path tests still pass (perfect → ✓).

- [ ] **Step 6: Commit**

```bash
git add src/components/ResolutionPhase/ScorePanel.tsx src/components/ResolutionPhase/index.tsx tests/components/ResolutionPhase.test.tsx
git commit -m "feat(resolution): coverage-tiered Accuracy icon"
```

---

## Task 4: Bad-chip rejection treatment (shake + gray + thick ✕)

**Files:**
- Modify: `src/components/ResolutionPhase/SelectionCart.tsx`, `src/components/ResolutionPhase/index.tsx`
- Test: `tests/components/ResolutionPhase.test.tsx`

This task renames the cart's `badSlots` prop to `rejected` and upgrades the visual to a grayed-out piece with a thick red ✕. It stays "all at once" until Task 5 makes it progressive.

- [ ] **Step 1: Write the failing test**

The existing test `renders a red X on each unused (bad) chip` asserts `getAllByLabelText('rejected piece')` has length 1 — keep it. Append a grayscale assertion:
```ts
describe('ResolutionPhase — rejected chip styling (reduced motion)', () => {
  it('grays out the rejected piece', () => {
    useGameStore.setState({
      phase: 'resolving', lives: 2,
      grid: emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]),
      selection: [{ pieceType: 'O', freeCount: 1 }, { pieceType: 'T', freeCount: 1 }],
      roundScore: { correctness: 1, speedBonus: 0, efficiencyBonus: 0, total: 1 },
      _resolution: {
        kind: 'partial', coverage: 0.5, reason: 'too-many',
        placements: [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
          cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
      },
    })
    render(<ResolutionPhase />)
    const mark = screen.getByLabelText('rejected piece')
    // the mark's chip wrapper carries the grayscale utility
    expect(mark.closest('.grayscale')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: FAIL — no `.grayscale` ancestor (and, after the prop rename in Step 3, the old `badSlots` wiring would also break, which Step 4 fixes).

- [ ] **Step 3: Rewrite `SelectionCart`**

Replace the contents of `src/components/ResolutionPhase/SelectionCart.tsx` with:
```tsx
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { motion } from 'framer-motion'
import { PieceShape } from '../PieceShape'
import type { ChipSlot } from '../../engine/cartSlots'

export interface SelectionCartHandle {
  getChipRect: (slotIndex: number) => DOMRect | null
}

interface Props {
  slots: ChipSlot[]
  /** Chips whose flyer has launched; rendered dimmed. */
  consumed: ReadonlySet<number>
  /** Chips rejected so far; grayed out with a thick red ✕. */
  rejected?: ReadonlySet<number>
}

function RejectMark() {
  return (
    <span aria-label="rejected piece" className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="#ef4444"
           strokeWidth={4} strokeLinecap="round">
        <line x1="5" y1="5" x2="19" y2="19" />
        <line x1="19" y1="5" x2="5" y2="19" />
      </svg>
    </span>
  )
}

export const SelectionCart = forwardRef<SelectionCartHandle, Props>(
  function SelectionCart({ slots, consumed, rejected }, ref) {
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
          const rej = !!rejected?.has(slot.slotIndex)
          return (
            <motion.div
              key={slot.slotIndex}
              ref={el => { chipRefs.current[slot.slotIndex] = el }}
              className={`relative p-1 transition-opacity duration-150 ${dim ? 'opacity-25' : 'opacity-100'}`}
              animate={rej ? { x: [0, -3, 3, -2, 2, 0] } : undefined}
              transition={rej ? { duration: 0.35 } : undefined}
            >
              <div className={rej ? 'grayscale opacity-60 transition-all duration-200' : ''}>
                <PieceShape pieceType={slot.pieceType} cellSize={11} />
              </div>
              {rej && <RejectMark />}
            </motion.div>
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

- [ ] **Step 4: Update `index.tsx` to pass `rejected`**

In `src/components/ResolutionPhase/index.tsx`, change the cart render from `badSlots={badSlots}` to `rejected={badSlots}`:
```tsx
      <SelectionCart ref={cartRef} slots={slots} consumed={consumed} rejected={badSlots} />
```
(Leave the `badSlots` useMemo as-is for now; Task 5 replaces it with progressive state.)

- [ ] **Step 5: Verify**

Run separately: `npx vitest run tests/components/ResolutionPhase.test.tsx`, `npm run test`, `npm run build`, `npm run lint` (all clean).

- [ ] **Step 6: Commit**

```bash
git add src/components/ResolutionPhase/SelectionCart.tsx src/components/ResolutionPhase/index.tsx tests/components/ResolutionPhase.test.tsx
git commit -m "feat(resolution): grayscale + thick-X rejection treatment for bad chips"
```

---

## Task 5: Sequential one-at-a-time walk

**Files:**
- Modify: `src/components/ResolutionPhase/index.tsx`
- Test: `tests/components/ResolutionPhase.test.tsx` (existing tests must keep passing)

Rewrite the `flying` stage from "launch all good flyers staggered" into a `step`-indexed walk: each cart slot is processed in turn — good slots fly one at a time, bad slots reject one at a time — growing `consumed`/`rejected`. Reduced motion fills both sets instantly.

- [ ] **Step 1: Confirm the existing component tests still describe the target behavior**

No new test is required for the walk timing (it's verified live in Task 6). The reduced-motion tests already added (badge copy, accuracy icon, rejected styling, the original "Next Round" perfect-path tests, and `getAllByLabelText('rejected piece')`) are the regression net. Run them first to see the current (pre-rewrite) green baseline:

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: PASS (baseline before the rewrite).

- [ ] **Step 2: Rewrite the stage machine in `index.tsx`**

Make these changes to `src/components/ResolutionPhase/index.tsx`:

(a) Add a `Placement` type import at the top:
```ts
import type { Placement } from '../../types'
```

(b) Replace the state block (the `flyers`/`consumed`/`landedCount` declarations) with:
```ts
  const [stage, setStage] = useState<Stage>('measuring')
  const [step, setStep] = useState(0)
  const [currentFlyer, setCurrentFlyer] = useState<FlyerSpec | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const [consumed, setConsumed] = useState<ReadonlySet<number>>(new Set())
  const [rejected, setRejected] = useState<ReadonlySet<number>>(new Set())
```
Remove the now-unused `badSlots` useMemo and `landedCount` ref.

(c) Add a slot→placement map after `placementToSlot`:
```ts
  const slotToPlacement = useMemo(() => {
    const m = new Map<number, Placement>()
    ;(solution ?? []).forEach((p, i) => {
      const s = placementToSlot[i]
      if (s >= 0) m.set(s, p)
    })
    return m
  }, [solution, placementToSlot])
```

(d) Replace the reduced-motion effect with one that also fills consumed/rejected:
```ts
  useEffect(() => {
    if (!reduceMotion || stage !== 'measuring' || !solution) return
    for (const p of solution) applyPlacement(p)
    const good = new Set<number>()
    const bad = new Set<number>()
    for (const s of slots) (slotToPlacement.has(s.slotIndex) ? good : bad).add(s.slotIndex)
    setConsumed(good)
    setRejected(bad)
    commitRoundScore()
    setStage('cta')
  }, [reduceMotion, stage, solution, applyPlacement, commitRoundScore, slots, slotToPlacement])
```

(e) Replace the measuring `useLayoutEffect` (the one that built all flyers) with a minimal one that just measures and starts the walk:
```ts
  useLayoutEffect(() => {
    if (stage !== 'measuring' || reduceMotion) return
    if (!rootRef.current) return
    if (!solution || slots.length === 0) { setStage('badge'); return }
    setContainerRect(rootRef.current.getBoundingClientRect())
    setStep(0)
    setStage('flying')
  }, [stage, reduceMotion, solution, slots])
```

(f) Replace the "dim chips on launch" effect AND the old `handleLanded`/badge-after-flight logic with the walk effect + a flyer-landed handler:
```ts
  // The walk: process one cart slot per step.
  useEffect(() => {
    if (stage !== 'flying') return
    if (step >= slots.length) {
      const t = window.setTimeout(() => setStage('badge'), BEAT_AFTER_FLIGHT)
      return () => clearTimeout(t)
    }
    const slot = slots[step]
    const placement = slotToPlacement.get(slot.slotIndex)
    if (placement) {
      const chipRect = cartRef.current?.getChipRect(slot.slotIndex) ?? null
      const cellRect = cellRects.current.get(`${placement.anchorRow},${placement.anchorCol}`)
      setConsumed(prev => new Set(prev).add(slot.slotIndex))
      if (!chipRect || !cellRect) {
        // Can't measure (defensive): apply immediately and advance.
        applyPlacement(placement)
        const t = window.setTimeout(() => setStep(s => s + 1), LAND_BEAT)
        return () => clearTimeout(t)
      }
      setCurrentFlyer({
        placement,
        sourceX: chipRect.left, sourceY: chipRect.top,
        targetX: cellRect.left, targetY: cellRect.top,
        duration: FLY_DURATION, delay: 0,
      })
      // advancement happens in handleFlyerLanded
    } else {
      setRejected(prev => new Set(prev).add(slot.slotIndex))
      const t = window.setTimeout(() => setStep(s => s + 1), REJECT_DURATION)
      return () => clearTimeout(t)
    }
  }, [stage, step, slots, slotToPlacement, applyPlacement])

  const handleFlyerLanded = () => {
    const p = currentFlyer?.placement
    setCurrentFlyer(null)
    if (p) applyPlacement(p)
    window.setTimeout(() => setStep(s => s + 1), LAND_BEAT)
  }
```

(g) Update the timing constants near the top of the file:
```ts
const FLY_DURATION      = 0.55   // s, per good-piece flight
const LAND_BEAT         = 120    // ms, pause after a good piece lands
const REJECT_DURATION   = 600    // ms, shake + gray/✕ reveal per bad piece
const BEAT_AFTER_FLIGHT = 250    // ms, after the last item before the badge
const BADGE_DURATION    = 400
const SCORING_DURATION  = 1800
```

(h) Replace the FlyerOverlay render with the single current flyer, and pass progressive `rejected` to the cart:
```tsx
      <SelectionCart ref={cartRef} slots={slots} consumed={consumed} rejected={rejected} />

      {currentFlyer && containerRect && stage === 'flying' && (
        <FlyerOverlay
          containerRect={containerRect}
          flyers={[currentFlyer]}
          onFlyerLanded={handleFlyerLanded}
        />
      )}
```
`FlyerOverlay.onFlyerLanded` is called with the flyer index; `handleFlyerLanded` ignores it.

- [ ] **Step 3: Verify**

Run separately: `npx vitest run tests/components/ResolutionPhase.test.tsx` (all PASS under reduced motion — consumed/rejected are filled by the fast-path), `npm run test`, `npm run build`, `npm run lint`. Confirm `grep -rn "badSlots\|landedCount" src/components/ResolutionPhase/index.tsx` returns nothing.

- [ ] **Step 4: Commit**

```bash
git add src/components/ResolutionPhase/index.tsx tests/components/ResolutionPhase.test.tsx
git commit -m "feat(resolution): one-at-a-time sequential reveal walk"
```

---

## Task 6: Live verification + timing tune

Interactive, controller-driven (not a subagent task). Verify the real animation in the browser, confirm all four reason categories and the icon tiers render correctly, and tune the timing to taste.

- [ ] **Step 1: Start the dev server** (`preview_start`, http://localhost:5173).

- [ ] **Step 2: Drive each failure category** via the dev `window.__store` hook and a crafted grid/selection, letting the natural game flow (or a forced `_resolution`) play the walk. For each: confirm the one-at-a-time reveal (good pieces fly singly; bad pieces shake → gray → thick ✕ in sequence), and confirm the badge main line + sub-label and the Accuracy icon match:
  - too-many (one O-gap; select O + T)
  - wrong-shapes (one O-gap; select I)
  - missed-one (two O-gaps; select O)
  - missed-many (three O-gaps; select O)

- [ ] **Step 3: Screenshot** a representative partial resolution (mid-walk and settled) and confirm with the user that the pace + rejection treatment feel right.

- [ ] **Step 4: Tune** `FLY_DURATION` / `REJECT_DURATION` / `LAND_BEAT` / `BEAT_AFTER_FLIGHT` in `index.tsx` if the user wants it faster/slower. Re-verify in browser.

- [ ] **Step 5:** Run `npm run test`, `npm run build`, `npm run lint` (all clean) and commit any tuning:
```bash
git add src/components/ResolutionPhase/index.tsx
git commit -m "polish(resolution): tune sequential-reveal timing"
```

---

## Final verification

- [ ] `npm run test`, `npm run build`, `npm run lint` — all green.
- [ ] Browser smoke: play real rounds; confirm perfect path unchanged (green "Perfect!", green ✓), and each partial outcome shows the sequential walk, correct badge copy, and the matching Accuracy icon.

---

## Self-review notes (author)

- **Spec coverage:** slowdown + one-at-a-time walk → Task 5 (timing) + Task 6 (tune); reason classification → Task 1; progressive grayscale + thick ✕ rejection → Task 4 (visual) + Task 5 (progressive); badge main line + sub-label, no % → Task 2; coverage-tiered Accuracy icon → Task 3; reduced-motion fills consumed/rejected → Task 5.
- **Type consistency:** `ResolutionReason` + `Resolution.reason?` (Task 1) used by `PartialBadge` (Task 2) and the store; `accuracyTier: 'perfect'|'close'|'far'` (Task 3); `SelectionCart` prop `rejected` (Task 4) consumed by the walk's `rejected` state (Task 5); `FlyerSpec`/`Placement` reused from existing modules.
- **Green between tasks:** Tasks 1–4 leave the old `flying` stage intact (Task 4 passes the static `badSlots` set as `rejected`); Task 5 swaps in the progressive walk. Reduced-motion (used by all component tests) fills `consumed`/`rejected` so the suite stays green without testing wall-clock timing.
