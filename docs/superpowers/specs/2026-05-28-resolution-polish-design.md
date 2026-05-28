# Resolution Polish: Sequential Reveal + Failure Diagnosis — Design

**Date:** 2026-05-28
**Status:** Design approved; ready for implementation plan.
**Builds on:** `2026-05-27-best-fit-resolution-design.md` (the resolving phase this polishes).

## Problem

The resolving-phase feedback (after a piece selection) is functional but reads poorly:

1. **Too fast.** Good pieces all launch on a stagger and fly concurrently, so the placement is over before it registers.
2. **Bad pieces are unclear.** Every leftover piece gets a thin red ✕ that appears on all of them simultaneously, so it's hard to notice what went wrong.
3. **The badge is the wrong paradigm.** A big coverage percentage ("80%") doesn't communicate *why* the selection failed.
4. **The Accuracy row always shows a green ✓**, even on a failed round, which misrepresents performance.

This design slows the reveal, walks the pieces one at a time with a clearer rejection treatment, replaces the percentage with diagnostic copy, and makes the Accuracy icon reflect performance.

## Behavior model (locked from brainstorm)

- **One-at-a-time walk.** The resolution visits the player's selected pieces in cart order (left→right), one per beat: good pieces fly into the grid; bad pieces shake, desaturate to gray, and get a thick red ✕ stamped on top. This both slows the sequence and makes each outcome legible.
- **Rejected pieces persist.** A grayed+✕ chip stays that way through the score reveal as a lasting record (it does not fade away).
- **Coverage threshold = 66%**, shared by the badge main line and the Accuracy icon so they always agree. (Carried over from the existing `PartialBadge`.)
- **Diagnostic badge.** Main line is "So close!" (coverage ≥ 66%) / "Nice try" (< 66%); a sub-label states the specific reason.
- **Performance icon.** Accuracy row: green ✓ (perfect) / amber ≈ (close) / red ✕ (way off).
- The **perfect path is unchanged** (concurrent-feel is fine for a win; green "Perfect!" badge, green ✓).

## Architecture

### Failure classification (`store/gameStore.ts`)

`submitSelection`'s unsolvable branch already computes `fit = bestFit(pieceCount, grid)` and `coverage`. Add a `reason` classification there and store it on `_resolution`.

New type in `types.ts`:
```ts
export type ResolutionReason = 'too-many' | 'wrong-shapes' | 'missed-one' | 'missed-many'
```
Extend `Resolution`:
```ts
export interface Resolution {
  kind: 'perfect' | 'partial'
  placements: Placement[]
  coverage: number
  reason?: ResolutionReason   // set only when kind === 'partial'
}
```

Classification (computed in the unsolvable branch):
```ts
const emptyCells = fit.totalCells
const uncovered = fit.totalCells - fit.filledCells
const selectedCells = Object.entries(pieceCount)
  .reduce((sum, [type, n]) => sum + (n ?? 0) * (type === 'SINGLE' ? 1 : 4), 0)

let reason: ResolutionReason
if (uncovered === 0) {
  reason = 'too-many'                       // every gap covered by a subset → had extras
} else if (selectedCells >= emptyCells) {
  reason = 'wrong-shapes'                   // enough material, shapes can't tile the gaps
} else {
  const missing = Math.max(1, Math.round(uncovered / 4))
  reason = missing === 1 ? 'missed-one' : 'missed-many'
}
```
The perfect branch sets `reason` undefined (or omits it).

Reason → sub-label string (rendered by the badge):
| reason | sub-label |
|---|---|
| `too-many` | Too many pieces |
| `wrong-shapes` | Some pieces don't fit |
| `missed-one` | Missed a piece |
| `missed-many` | Missed some pieces |

### Sequential walk (`components/ResolutionPhase/index.tsx`)

Replace the current `flying` stage (which builds all good flyers with staggered delays and shows all bad ✕s at once) with a **step-indexed walk** through `slots` (the expanded cart, in order).

State:
- `step: number` — index into `slots`, 0 → `slots.length`.
- `currentFlyer: FlyerSpec | null` — the single flyer in flight for the current good step.
- `consumed: Set<number>` — good slots already flown (rendered dimmed). Grows during the walk.
- `rejected: Set<number>` — bad slots already rejected (rendered grayed + ✕). Grows during the walk.

A reverse map `slotToPlacement: Map<slotIndex, Placement>` is derived from `placementToSlot` so each slot knows whether it's good (has a placement) or bad.

Walk effect (keyed on `stage`, `step`), runs while `stage === 'flying'`:
- If `step >= slots.length`: after `BEAT_AFTER_FLIGHT`, `setStage('badge')`.
- Else let `slot = slots[step]`:
  - **Good** (`slotToPlacement.has(slot.slotIndex)`): build a single `FlyerSpec` (chip rect → target cell rect), set `currentFlyer`, mark the chip consumed. `FlyerOverlay` renders that one flyer; its `onFlyerLanded` callback calls `applyPlacement(placement)`, clears `currentFlyer`, then after `LAND_BEAT` advances `setStep(step + 1)`.
  - **Bad**: add the slot to `rejected` (triggers the cart's shake → gray → ✕). After `REJECT_DURATION`, `setStep(step + 1)`.

Timing constants (starting values; tuned live in-browser):
```ts
const FLY_DURATION      = 0.55   // s, per good-piece flight (was up to 0.5, now a touch slower)
const LAND_BEAT         = 120    // ms, pause after a good piece lands
const REJECT_DURATION   = 600    // ms, shake (~350) + gray/✕ reveal (~250)
const BEAT_AFTER_FLIGHT = 250    // ms, after the last item before the badge (was 200)
const BADGE_DURATION    = 400    // unchanged
const SCORING_DURATION  = 1800   // unchanged
```

The existing per-flyer `delay`-stagger and the separate "dim chips on launch" effect are removed — dimming and rejecting are now driven by the walk.

**Reduced motion:** the existing fast-path applies all placements, commits, and jumps to `cta`. Extend it to also set `consumed` = all good slots and `rejected` = all bad slots, so bad pieces render grayed+✕ statically (no walk). The badge + score + CTA appear as today.

`FlyerOverlay` is reused unchanged, rendered with a single-element `[currentFlyer]` array (delay 0) only while a good step is in flight.

### Cart rendering (`components/ResolutionPhase/SelectionCart.tsx`)

Replace the static `badSlots` prop with a progressive `rejected: ReadonlySet<number>` prop. A chip whose slot is in `rejected`:
- shakes once on entering the set (the existing `x: [0,-3,3,-2,2,0]` keyframe),
- desaturates: apply `filter: grayscale(1) opacity(0.55)` to the `PieceShape`,
- gets a **thick red ✕** overlay — a bold SVG cross (two strokes, `stroke="#ef4444"`, `strokeWidth` ~4–5, `strokeLinecap="round"`, scaled to roughly cover the chip), replacing the thin `text-2xl ✕`. Keep `aria-label="rejected piece"` on the overlay for tests.

`consumed` chips stay dimmed (opacity 0.25) as today. The `getChipRect`/`forwardRef` contract is unchanged (flyer sources still measure chip positions).

A small presentational `RejectMark` (the SVG cross) may live inline in `SelectionCart` or as its own tiny component — implementer's choice, keep it focused.

### Badge (`components/ResolutionPhase/PartialBadge.tsx`)

Drop the percentage number. Props become `{ show: boolean; coverage: number; reason?: ResolutionReason }`. Render:
- **Main line:** `coverage >= 0.66 ? 'So close!' : 'Nice try'` (the existing amber badge container/animation stays).
- **Sub-label:** the reason string from the table above, in a smaller muted style beneath the main line.

The badge no longer needs the `Math.min(99, …)` percentage clamp (no number is shown). The green perfect `CelebrationBadge` is untouched.

### Accuracy icon (`components/ResolutionPhase/ScorePanel.tsx`)

The Accuracy row currently hardcodes `icon="✓"` / green. Add an `accuracyTier: 'perfect' | 'close' | 'far'` prop (computed in `index.tsx` from `_resolution`: `perfect` when `kind === 'perfect'`, else `coverage >= 0.66 ? 'close' : 'far'`). Map tier → icon + color for the Accuracy row only:
| tier | icon | color |
|---|---|---|
| perfect | ✓ | text-green-400 |
| close | ≈ | text-amber-400 |
| far | ✕ | text-red-400 |

Speed and Efficiency rows are unchanged.

## Data flow

`submitSelection` → `_resolution = { kind, placements, coverage, reason }` + `roundScore`. `ResolutionPhase` reads `_resolution`, derives `accuracyTier`, drives the walk (growing `consumed`/`rejected`), and passes `reason`+`coverage` to `PartialBadge` and `accuracyTier` to `ScorePanel`.

## Testing

- **`store/gameStore.ts`:** `reason` classification, one test per category, using `setState` to install a crafted `grid`/`gaps`/`selection`/`difficulty`/`phaseStartTime` then calling `submitSelection` deterministically: `too-many` (a covering subset + an extra piece), `wrong-shapes` (enough cells, wrong shapes), `missed-one` (one tetromino gap's worth uncovered, under-selected), `missed-many` (≥2 uncovered). Assert `_resolution.reason`.
- **`PartialBadge`:** main line per coverage (≥/< 0.66) and sub-label per reason.
- **`ScorePanel`:** Accuracy row icon/color per `accuracyTier` (perfect ✓ green / close ≈ amber / far ✕ red).
- **`SelectionCart`:** a chip in `rejected` renders the reject mark (`aria-label="rejected piece"`) and grayscale; chips not in `rejected` do not.
- **`ResolutionPhase` (reduced motion):** all bad chips render grayed+✕ and the CTA appears; perfect path still shows green badge + "Next Round".
- All tests pass (`npm run test`); `npm run build` (tsc -b) and `npm run lint` are clean. The sequential-walk timing/feel is verified live in the browser, not unit-tested.

## Out of scope

- Changes to the perfect path's look or to scoring math/values.
- The over-selection `coverage === 1` scoring behavior (kept as-is; now simply surfaced as the "Too many pieces" reason).
- Difficulty/timing-table tuning beyond the resolving-phase constants above.
