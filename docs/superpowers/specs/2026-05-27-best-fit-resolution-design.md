# Best-Fit Resolution: Partial Placement + Partial Credit — Design

**Date:** 2026-05-27
**Status:** Design approved; ready for implementation plan.

## Problem

A wrong selection currently triggers a triple punishment:

1. Lose a life.
2. Drop into the `manual-placing` phase and hand-place every piece by click.
3. Leftover pieces become `carryOvers` — `lockedCount` chips in the next round's cart that cannot be removed and must be dealt with again.

Losing a life is a fair, sufficient punishment. The manual-placement chore plus the carry-over tax pile on top of it, kill the game's momentum, and bleed one bad round into the next. The "next round" should be a fresh slate.

This design replaces the manual-place + carry-over flow with an **automatic best-fit resolution**:

1. The player still loses a life (unchanged — that is the punishment).
2. The game automatically places as many of the player's pieces as physically fit, reusing the "Perfect!" fly-into-grid animation. Pieces that earn no spot get a playful red-X animation.
3. The player earns **partial credit** for what landed, instead of today's near-zero all-or-nothing.
4. The round ends clean — no pieces follow the player into the next round.

## Behavior model (locked from brainstorm)

- **Resolution is automatic.** No manual clicking. The player watches the outcome of their selection play out, just like the Perfect path.
- **Best-fit = maximum coverage.** The algorithm finds the placement of a subset of the selected pieces that fills the most empty cells, optimizing the player's selection for them.
- **Good pieces fly; bad pieces get a red X.** "Good" = used in the winning packing. "Bad" = a selected piece left over.
- **Partial credit is essential.** Correctness and speed scale by how much of the gap area was filled.
- **Clean slate.** No carry-overs. `carryOvers` and `lockedCount` are removed from the game entirely.
- **Last life:** if the wrong selection drops the player to 0 lives, the resolution animation still plays in full; the closing CTA becomes Game Over instead of Next Round.

## Architecture

### Phase model

The store's `'auto-placing'` phase is **renamed to `'resolving'`** and now covers both outcomes of `submitSelection`:

- **Perfect** (selection exactly tiles the gaps — `solve()` is solvable): green "Perfect!" badge, full scoring. Behavior identical to today.
- **Partial** (not solvable): best-fit placement, amber badge, red-X on bad pieces, partial scoring. A life is deducted.

The stage machine inside the phase component — `measuring → flying → badge → scoring → cta` — is **identical for both outcomes**. Only three things differ: the badge, the presence of red-X chips, and the score values. This is why the two paths share one phase and one component rather than duplicating the celebration sequence.

The `'manual-placing'` phase is **removed**. The `'scoring'` and `'game-over'` phases remain:

- `'game-over'` is now reached *after* the resolving animation completes on the last life (the CTA triggers it), not directly from `submitSelection`.
- `'scoring'` is retained only as the standalone screen reachable via game-over review; with manual-place gone it is otherwise unused by the live loop. (The implementation plan will confirm whether `ScoringPhase` can be deleted or is still wired for game-over; default is to keep `game-over` rendering through the existing `ScoringPhase` as today.)

### Best-fit solver (`engine/solver.ts`)

Add a new export alongside `solve()`:

```ts
export interface BestFitResult {
  placements: Placement[]   // the winning packing (the "good" pieces)
  filledCells: number       // cells covered by `placements`
  totalCells: number        // empty cells before placement
}

export function bestFit(pieceCount: PieceCount, grid: Grid): BestFitResult
```

**Algorithm — maximum-coverage backtracking (branch and bound).** Same engine as the exact solver, with two changes:

1. At the first empty cell, try every fitting piece/rotation **and** the additional option of leaving that cell permanently uncovered (mark it non-empty for the rest of the branch, restore on backtrack). The "leave uncovered" branch is what lets the search skip cells no remaining piece can fill.
2. Instead of returning on the first full tiling, track the best `filledCells` seen across the whole search and keep the corresponding placements.

**Maximization target:** total covered empty cells (this directly drives partial credit). **Tie-break:** among equal-coverage packings, prefer the one using the **fewest pieces** (don't burn a `SINGLE` on a cell a tetromino already covers).

**Performance:** empty cells number at most `gapCount × 4 ≤ 28`, selected pieces are few, and branch-and-bound prunes hard. This is well within budget for a synchronous call. If profiling ever shows a pathological case, an attempts/time cap can be added, but it is not in scope now.

**This path only runs when `solve()` is unsolvable**, so `filledCells < totalCells` always holds here — a full fill would have been caught as Perfect.

### Deriving the "bad" pieces

No new state needed. The resolving component already expands the selection into chip slots (`expandCartSlots`) and maps placements to slots (`mapPlacementsToSlots`). The slots **not claimed** by any placement are the bad pieces. The red-X treatment renders on exactly those unclaimed chips.

### Store changes (`store/gameStore.ts`)

`submitSelection` keeps its two-branch shape but both branches now land on `'resolving'`:

- **Solvable branch:** unchanged scoring (correctness 800, speed up to 500, efficiency up to 300). Sets `_resolution = { kind: 'perfect', placements }`. Phase → `'resolving'`.
- **Unsolvable branch:** deduct a life. Run `bestFit()`. Compute partial scoring (below). Set `_resolution = { kind: 'partial', placements }`. Phase → `'resolving'` (even when `lives` hits 0 — the game-over transition happens at the CTA, after the animation).

State field rename: `_autoPlaceSolution: Placement[] | null` → `_resolution: Resolution | null` where:

```ts
interface Resolution {
  kind: 'perfect' | 'partial'
  placements: Placement[]
}
```

`applyPlacement`, `commitRoundScore`, `nextRound` are unchanged. `commitRoundScore` already clears `carryOvers`; once `carryOvers` is removed from state that line goes away.

**Removed actions and state:** `placePiece`, `finishManualPlace`, `holdPiece`, `rotatePiece`, `clearHeld`, and the `heldPiece` field; plus `carryOvers` (state) and `lockedCount` (on `SelectionEntry`). `startGame` no longer seeds the cart from carry-overs — selection starts empty every round.

### Partial scoring formula

Let `coverage = filledCells / totalCells` (∈ [0, 1) on this path — always less than 1, since a full fill would be solvable; `totalCells` is the empty-cell count before placement). With `timeRemaining` and `selectDuration` as today:

- **Correctness:** `round(800 × coverage)`
- **Speed:** `round(500 × (timeRemaining / selectDuration) × coverage)` — coverage-scaled so a near-empty solve earns ~0 speed.
- **Efficiency:** unchanged formula, computed over **all** selected pieces (`minPieces = gaps.length`, `selectedPieces = total selected`, with the existing `selectedPieces === 0 → ratio 0` guard). Selecting junk pieces still lowers efficiency, which is correct.

Example: 3 of 4 equal gaps filled, submitted with time to spare → ~600 correctness + scaled speed + efficiency, versus today's efficiency-only score. This is the momentum win.

Edge cases:
- `coverage === 0` (nothing fit, e.g. empty submission): all three pillars resolve to 0; no flyers, no bad-X (or all-bad if pieces were selected); a low-coverage amber badge; life still lost.
- The `selectedPieces === 0` efficiency guard is preserved.

### Component architecture (`components/`)

`AutoPlacingPhase/` is **renamed `ResolutionPhase/`** and generalized. Reused as-is: `FlyerOverlay`, `ScorePanel`, `NextRoundButton`, `SelectionCart`, the measuring/flying/scoring stage machine, and the reduced-motion fallback. New/changed:

| Piece | Change |
|---|---|
| `ResolutionPhase/index.tsx` | Reads `_resolution`. Branches on `kind` for badge + bad-chip rendering. Same stage machine. On `'partial'` + `lives === 0`, the CTA fires the game-over transition instead of `nextRound`. |
| Badge | `kind === 'perfect'` → existing green "Perfect!" badge. `kind === 'partial'` → **amber badge**, copy flexes with coverage: e.g. ≥ ~0.66 "So close!", else "Nice try". (Component reads coverage from `filledCells/totalCells`, derivable from placements + grid, or a passed prop.) |
| Bad-piece FX | The unclaimed cart chips get the red-X treatment. **Two variants built, gated by `?badfx=stamp\|fly`** (default `stamp`) for live comparison — see below. |
| `SelectionCart` | The locked-chip styling (🔒) is removed (no more locked pieces). |
| `SelectingPhase` | Locked-chip label/styling removed. |
| `GameShell` | Route `'resolving'` → `ResolutionPhase`; drop the `'manual-placing'` route and the `PlacingPhase` import. |

### Bad-piece FX — build both, user picks

Both animations are implemented behind a query-param switch read once at module load:

- **`?badfx=stamp` (default):** the bad chip stays in the cart, does a quick shake, and a playful red X stamps over it.
- **`?badfx=fly`:** the bad chip launches toward the grid like the good flyers, then bounces back / dissolves with a red X mid-flight.

During implementation, a forced partial resolution is driven in the browser via the dev `window.__store` hook (exposed in `main.tsx` under `import.meta.env.DEV`) so both variants can be screenshotted on the same board. The user picks one; the other variant and the `badfx` switch are then deleted. The switch is a temporary scaffold, not a shipped feature.

## Files removed

- `components/PlacingPhase.tsx`
- The `manual-placing` phase literal and its `GameShell` route.
- `carryOvers` (state, `CarryOver` type usage in state) and `lockedCount` (`SelectionEntry` field).
- Store actions: `placePiece`, `finishManualPlace`, `holdPiece`, `rotatePiece`, `clearHeld`; `heldPiece` field.
- Manual-place / carry-over tests.

## Testing

- **`engine/solver.ts` (`bestFit`):** maximizes coverage on a board no exact tiling exists for; leaves genuinely unfillable cells uncovered; tie-breaks to fewest pieces; returns correct `filledCells`/`totalCells`; "bad" pieces correctly derived (selected minus placed).
- **`store/gameStore.ts`:** rewrite `submitSelection — incorrect` to assert phase `'resolving'`, `_resolution.kind === 'partial'`, a life deducted, and partial `roundScore` (correctness/speed > 0 when coverage > 0, scaled). Keep the game-over-at-0-lives case but assert it now routes through `'resolving'` then the CTA. Solvable path asserts `kind === 'perfect'`. Delete manual-place and carry-over tests.
- **`components/` (`ResolutionPhase`):** existing AutoPlacingPhase tests updated for the rename and for both `kind`s; bad-chip red-X renders on unclaimed slots.
- All tests must pass (`npm run test`) and `npx tsc --noEmit` must be clean before any commit. The CLAUDE.md "48 tests" count will shift as manual-place tests are removed and best-fit/partial tests are added; update that note.

## Out of scope

- Drag-and-drop, sound, leaderboard (still deferred per CLAUDE.md).
- Any change to the Perfect path's look or scoring.
- Re-tuning the difficulty table.
