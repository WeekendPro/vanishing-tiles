# Auto-Placing Phase: Animated Celebration — Design

**Date:** 2026-05-27
**Status:** Design approved; ready for implementation plan.

## Problem

The auto-placing phase currently shows static text ("✓ Auto-placing...") for 800ms before jumping to the scoring screen. For an auto-place — the player's reward for selecting the right pieces — this is unceremonious and unsatisfying. The player did the hard part (memorize gaps, pick the matching pieces under time pressure) and gets a flat transition in return.

This design replaces the text-only auto-placing phase with an animated celebration that:

1. Visually moves each selected piece from the selection cart into its target slot in the grid.
2. Flows directly into a green-checkmark "Perfect!" success moment.
3. Reveals the round's score breakdown inline, with each value counting up.
4. Ends with a Next Round CTA — no separate scoring screen for the auto-place flow.

The manual-place flow is unchanged.

## Visual model (locked from brainstorm)

- **Motion personality:** elegant arc — curved trajectory, soft ease-in-out, brief glow on landing.
- **Sequencing:** one-by-one — each piece fully lands before the next launches.
- **Completion:** flows directly into score reveal in the same view (no transition to a separate screen).
- **Success styling:** rounded green badge with a white SVG checkmark that "draws" in, "Perfect!" label, a small confetti burst, then the score breakdown counts up in tabular numbers with the round total emphasized in gold.

The brainstorm mockups for these decisions are at:
`.superpowers/brainstorm/39222-1779895434/content/{personality,sequencing,celebration}.html`

## Architecture

### Phase model

The store's `phase` stays `'auto-placing'` for the entire celebration — from the moment `submitSelection` resolves as solvable through the moment the user clicks Next Round. The phase no longer transitions through `'scoring'` for the auto-place flow.

The `'scoring'` phase still exists and is still used by the manual-place flow (the player lost a life and is just being shown the partial-credit breakdown). Auto-place bypasses it because the celebration IS the score reveal.

### Library: framer-motion

Adopt `framer-motion` for this phase. Rationale (see brainstorm conversation): the celebration sequence benefits significantly from FM's variants, staggered children, springs, and `AnimatePresence`. For the eventual React Native port, `moti` exposes the same declarative API on top of `react-native-reanimated`, so the mental model and animation shapes translate directly.

This is the project's first FM usage. Future phases (e.g. piece selection feedback, scoring screen polish) MAY adopt FM but doing so is out of scope for this work.

### Store changes

The current `finishAutoPlace` action conflates three concerns: mutating the grid with the placed pieces, adding the round score to the total, and transitioning the phase. The new design needs to do these at different moments in the celebration timeline, so split it:

- **`applyPlacement(placement: Placement)`** — apply a single placement to the grid (marks the placement's cells as `'placed'` with the piece's color). Called once per piece as that piece's flyer lands, so the grid fills incrementally underneath the flyers.
- **`commitRoundScore()`** — add `roundScore.total` to `score`; clear `carryOvers`. Called once after all pieces have landed, before the CTA reveals. Does **not** change `phase`.

`finishAutoPlace` is removed. `nextRound` is unchanged — the CTA's click handler calls it directly, which advances the round counter and runs `startGame()` (transitioning `phase` to `'viewing'`).

`_autoPlaceSolution` continues to be set by `submitSelection` and remains the source of truth for which placements to render and animate.

### Component breakdown

| Component | Responsibility |
|---|---|
| `AutoPlacingPhase` | Top-level orchestrator. Measures DOM positions on mount, drives the local state machine, composes sub-components. Replaces the inline "✓ Auto-placing..." text in `GameShell`. |
| `SelectionCart` | Renders the player's submitted selection as individual chip slots (a selection of `{I × 3, O × 2}` becomes 5 chips). Each chip dims to opacity 0.25 at the moment its corresponding flyer begins moving (delay elapsed, animation started). Exposes refs to each chip's DOM node for position measurement. |
| `FlyerOverlay` | An absolutely-positioned layer covering the phase. Renders one FM `motion.div` per placement. Each flyer renders a real `PieceShape` (correct shape, correct rotation) and animates from its source cart-chip position to its target grid-cell position. Animation: spring + scale (chip size at the cart's `cellSize=11` to grid size at `cellSize=28`). Fires a callback on `onAnimationComplete` for each piece. |
| `CelebrationBadge` | Green rounded badge with a white SVG checkmark drawn via `stroke-dashoffset`, the "Perfect!" label, and a confetti burst (FM `AnimatePresence` with staggered children). |
| `ScorePanel` | Three rows (Correctness +800, Speed Bonus, Efficiency Bonus) plus a Round Total. Rows reveal sequentially via FM variants. Each numeric value counts up via a small `useCountUp(value, durationMs)` hook implemented with `requestAnimationFrame`. The total uses the existing yellow accent (`text-yellow-400`) and a scale pulse on appearance. |
| `NextRoundButton` | Large primary CTA pinned near the bottom. FM slide-up with spring. Click handler is guarded so the action fires at most once per mount. |

The existing `Grid` component is reused as-is to render the empty/gap state during the flight. Cells fill in via the existing `'placed'` cell status as `applyPlacement` runs — no Grid changes required.

### Layout

Inside `GameShell`'s centered content area, the in-flow stack is, top to bottom:
1. **Grid** (existing, prominent at top)
2. **SelectionCart** (below grid; the source of the flying pieces)
3. **ScorePanel** (below cart; revealed during the scoring stage, hidden before)
4. **NextRoundButton** (pinned at the bottom; revealed last)

Two layers float on top of this stack:
- **`FlyerOverlay`** — absolutely positioned relative to the `AutoPlacingPhase` root so its coordinates align with the measured cart-chip and grid-cell positions.
- **`CelebrationBadge`** — overlay anchored above the grid, revealed after the 200ms beat following the last flyer's landing.

The cart sits below the grid in this phase, which differs from `SelectingPhase` (where the cart is above the piece menu). This is intentional: during auto-placing, the grid is the focal point of the reveal.

## State machine

The `AutoPlacingPhase` component owns a local React state machine with these states, driven by `setTimeout`s (cleared on unmount):

| State | Trigger | Duration | What's happening |
|---|---|---|---|
| `measuring` | Mount | 1 frame (via `useLayoutEffect`) | Read DOM rects for cart chips and target grid cells. Compute source/target coords for each flyer. |
| `flying` | Refs measured | `min(500, 3000/N)` per piece, one-by-one | Flyers animate sequentially with staggered FM delays. Each `onAnimationComplete` calls `applyPlacement`. |
| `badge` | Last flyer lands + 200ms beat | 400ms | Checkmark badge pops in, draws, confetti bursts, "Perfect!" label fades in. |
| `scoring` | Badge animation complete | ~1s (3 rows × 300ms stagger + total emphasis) | Score rows slide in and count up. After the total settles, `commitRoundScore()` fires. |
| `cta` | Scoring reveal complete | — | Next Round button slides up. State holds here until the user clicks. |

The full celebration takes roughly 2.5s (2 pieces, the minimum) to 5s (7 pieces, the late-round maximum), plus whatever time the user takes to click Next Round.

### Data flow

```
SelectingPhase: submitSelection()
  → store.submitSelection()
      → solver runs; result.solvable === true
      → phase = 'auto-placing'
      → _autoPlaceSolution = result.placements
      → roundScore = { correctness, speedBonus, efficiencyBonus, total }

AutoPlacingPhase mounts
  → useLayoutEffect: measure chip rects + cell rects → state = 'flying'
  → FlyerOverlay renders N motion.divs with staggered delays
  → for each flyer onAnimationComplete:
      → store.applyPlacement(placement)
      → grid cells become 'placed' for that placement
  → after all N have landed: 200ms beat → state = 'badge'
  → CelebrationBadge animates in (400ms)
      → state = 'scoring'
  → ScorePanel reveals rows + counts up totals
      → store.commitRoundScore()  // adds total to running score; clears carryOvers
      → state = 'cta'
  → NextRoundButton slides up

User clicks Next Round
  → store.nextRound() → round += 1 → startGame() → phase = 'viewing'
  → AutoPlacingPhase unmounts; ViewingPhase mounts
```

## Edge cases

- **`prefers-reduced-motion`**: detected via `useReducedMotion()` (FM's hook). If true, skip the flying state entirely: apply all placements immediately on mount, then run through `badge` → `scoring` → `cta` with near-zero transitions and no scale/spring effects. Numbers in the score panel show their final value immediately (no count-up). The CTA is reachable within ~500ms total from mount.
- **Empty solution** (defensive — solvability check prevents this in practice): if `_autoPlaceSolution` is null or empty when `AutoPlacingPhase` mounts, skip `measuring` and `flying`, jump straight to `badge`.
- **Window resize during animation**: positions are measured once at mount. If the window resizes mid-celebration, flyers land at stale coords. This is acceptable for the POC (single fixed layout, mobile target won't resize during a round). Adding `ResizeObserver` is deferred.
- **Strict-mode double mount**: all `setTimeout` IDs and FM animation controls are cleared in `useEffect` cleanup so a remount doesn't double-fire callbacks. The state machine starts fresh on each mount.
- **Late round with many pieces**: per-piece duration shrinks via `min(500, 3000/N)` so total fly time is capped at 3s. At 7 pieces, each flies in ~430ms.
- **CTA double-click**: button is disabled (and visually `disabled`) after first click; calls `nextRound` exactly once per mount.

## Testing

### Existing tests

All 48 existing tests must continue to pass. Tests that assert the post-`finishAutoPlace` state will need updating because the action is being split:
- Any assertion of `phase === 'scoring'` after a solvable selection becomes `phase === 'auto-placing'`.
- Any assertion that the grid is filled and score added in one step splits into asserting `applyPlacement` mutates the grid and `commitRoundScore` updates the score.

### New tests

- **`useCountUp` hook**: with fake timers, asserts the returned value progresses monotonically from 0 to target and ends exactly at target.
- **Cart slot expansion**: helper that turns `selection: SelectionEntry[]` into `chipSlots: { pieceType, slotIndex }[]`. The expansion order preserves the selection array order, with each entry's `lockedCount + freeCount` chips emitted consecutively. The placement-to-chip mapping rule: iterate `_autoPlaceSolution` in order; for each placement, claim the first not-yet-claimed chip whose `pieceType` matches. Tests cover multi-count entries, mixed piece types, and the claim ordering.
- **State machine transitions**: with fake timers, asserts the phase progression (`measuring` → `flying` → `badge` → `scoring` → `cta`) at expected timestamps, and that `applyPlacement` is called N times during `flying` and `commitRoundScore` once during `scoring`.
- **Reduced-motion fallback**: with `useReducedMotion` mocked to return `true`, asserts the CTA is reachable in under ~500ms and that no FM animations are dispatched.
- **CTA idempotency**: clicking the button twice calls `nextRound` exactly once.

### Manual smoke test

After implementation, run `npm run dev` and play through 2-3 rounds at increasing difficulty to confirm:
- Pieces visibly fly from cart chips into their solved positions.
- Cart chips dim as their piece launches.
- Badge + confetti reveal feels rewarding.
- Score counts up smoothly.
- Late rounds don't drag (total animation ≤ ~5s).
- `prefers-reduced-motion` (test via OS or DevTools rendering settings) skips the flight.

## Out of scope

- Sound effects (deferred per CLAUDE.md).
- Animating the manual-place → scoring path.
- Animating the Game Over screen.
- Drag-and-drop placement (already deferred).
- React Native port of this animation (the visual design will translate; the implementation will be rewritten in `moti`/`react-native-reanimated` when the port happens).

## Implementation order (rough)

1. `npm install framer-motion`.
2. Store: split `finishAutoPlace` into `applyPlacement` + `commitRoundScore`; update existing tests.
3. `useCountUp` hook + unit tests.
4. Cart slot expansion helper + unit tests.
5. Leaf sub-components in isolation: `CelebrationBadge`, `ScorePanel`, `NextRoundButton`.
6. `SelectionCart` (with refs).
7. `FlyerOverlay` with FM motion divs.
8. `AutoPlacingPhase` orchestrator + state machine.
9. Wire into `GameShell` (replace the centered text).
10. `prefers-reduced-motion` fallback path.
11. Manual smoke test; commit.
