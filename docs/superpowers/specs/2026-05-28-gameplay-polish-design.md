# Gameplay Polish: Bigger Board, Gentler Ramp, Retry Flow, Honest Failure Scoring — Design

**Date:** 2026-05-28
**Status:** Design approved; ready for implementation plan.
**Builds on:** `2026-05-28-resolution-polish-design.md` (the resolving phase + diagnostic badge this extends).

## Problem

Six gameplay issues surfaced from playtesting:

1. **Timer too aggressive early.** The view timer drops 5000→4000ms by round 3 (a −20% step), which feels punishing before the player has settled in.
2. **A bad selection silently "advances."** An inaccurate selection currently flows straight into the next round. It should read as a *failed round* the player retries, not progress.
3. **The failure badge over-praises.** A purposely-zero round still shows "Nice try", which feels disingenuous. Low-coverage failures deserve a distinct, blunter badge.
4. **Failures still earn accuracy points.** A failed round awards partial Accuracy/Speed/Efficiency credit. Failures should cost points, scaled by how far off the selection was.
5. **Slow rounds look the same as fast ones.** The Speed row always shows ⚡ even when the player barely beat the clock.
6. **The board saturates.** At 10×8 (80 cells) the grid runs low on empty space by round 7–8 and would have none by round 12–15.

## Behavior model (locked from brainstorm)

- **Board is 12×12** (144 cells). Cells stay 28px; the board grows, it doesn't shrink.
- **Gentler view-timer ramp**, ~300ms/round down to a 2500ms floor; table extends to 15 rounds (capped after).
- **More gaps per round** so the board stays meaningfully empty deep into a run.
- **Failed round = retry.** A non-perfect selection costs a life (unchanged trigger) and presents **"Try Again ↺"**, which regenerates a *fresh puzzle at the same round/difficulty*. The round counter advances **only on a perfect clear**. If the failing attempt was the last life, the button is **"Game Over →"** instead.
- **Failure scoring is a penalty, not partial credit.** Speed and Efficiency are zeroed; Accuracy is negative, scaled by how wrong the selection was.
- **Turtle for slow speed.** On a *successful* round, the Speed row shows 🐢 (muted gray) when the speed bonus is in the bottom ~20%; ⚡ (gold) otherwise.
- **Three-tier failure badge** by coverage: "So Close!" (amber, ≥66%), "Tough Round" (red, 33–66%), "Yikes" (red, <33%).
- The **perfect path is completely unchanged**: 800 + speed + efficiency, green "Perfect!" badge, "Next Round →".

## Architecture

### 1. Board dimensions (`types.ts`)

```ts
export const ROWS = 12 as const
export const COLS = 12 as const
```
Update the doc comment ("12 rows, 12 cols"). No logic change in `Grid.tsx`, `puzzleGenerator.ts`, or `solver.ts` — they all read `ROWS`/`COLS`.

**Layout:** new board ≈ 382px wide (12·28 + 11·2 gap + 24 padding). The existing `max-w-sm` (384px) containers fit; bump to `max-w-md` only if in-browser verification shows it cramped.

### 2. Difficulty table (`store/gameStore.ts`)

Replace `DIFFICULTY_TABLE` with 15 entries:

| Round | viewDuration | selectDuration | placeDuration | gapCount | complexity |
|---|---|---|---|---|---|
| 1 | 5000 | 15000 | 60000 | 3 | simple |
| 2 | 4700 | 15000 | 60000 | 4 | simple |
| 3 | 4400 | 14000 | 60000 | 5 | simple |
| 4 | 4100 | 14000 | 60000 | 6 | medium |
| 5 | 3800 | 13000 | 60000 | 7 | medium |
| 6 | 3500 | 13000 | 60000 | 8 | medium |
| 7 | 3300 | 12000 | 60000 | 9 | complex |
| 8 | 3100 | 12000 | 60000 | 10 | complex |
| 9 | 2900 | 11000 | 60000 | 11 | complex |
| 10 | 2800 | 11000 | 60000 | 12 | complex |
| 11 | 2700 | 10000 | 60000 | 13 | complex |
| 12 | 2600 | 10000 | 60000 | 14 | complex |
| 13 | 2500 | 9000 | 60000 | 15 | complex |
| 14 | 2500 | 9000 | 60000 | 16 | complex |
| 15 | 2500 | 9000 | 60000 | 16 | complex |

`getDifficulty(round)` still clamps to the last entry, so round 15+ uses the round-15 row.

**Solver-cost note:** `bestFit`/`solve` backtracking grows with the empty region, not the whole grid. At 16 disjoint tetromino gaps (64 empty cells) this should stay fast, but the implementation must verify timing (e.g. a `bestFit` micro-bench or an existing-test timing check) before sign-off. If it regresses, reduce the late-round gap cap.

### 3. Retry flow (`store/gameStore.ts` + `ResolutionPhase/index.tsx`)

**Store.** Add a `retryRound` action that regenerates the current round without incrementing:

```ts
retryRound: () => { get().startGame() },   // startGame already uses current `round`
```
`nextRound` is unchanged (increments, then `startGame`). The life deduction stays in `submitSelection`'s unsolvable branch — each failed submission costs a life; the retry button itself does not deduct.

**CTA wiring (`index.tsx`).** `handleCta` branches three ways:

```ts
if (resolution?.kind === 'perfect')      nextRound()
else if (lives === 0)                    endGame()
else                                     retryRound()
```
Button label/style:
- perfect → "Next Round →" (green)
- partial, lives > 0 → "Try Again ↺" (amber)
- partial, lives === 0 → "Game Over →" (red/danger)

`NextRoundButton` gains an amber "retry" variant (alongside the existing default-green and `danger`-red). A simple `variant?: 'next' | 'retry' | 'gameover'` prop (or two booleans) is fine.

### 4. Failure scoring (`store/gameStore.ts`)

Export the speed-bonus max so the UI can compute the turtle threshold:
```ts
export const MAX_SPEED_BONUS = 500
const PENALTY_PER_PIECE = 50
const MAX_PENALTY = 400
```

In `submitSelection`'s unsolvable branch, replace partial credit with a penalty:

```ts
const placed   = fit.placements.length
const selected = selectedPieces                       // total pieces chosen
const needed   = gaps.length                          // pieces required for a perfect fill
const extra    = Math.max(0, selected - placed)       // wasted / over-picked
const missing  = Math.max(0, needed   - placed)       // gaps left open
const penalty  = -Math.min(MAX_PENALTY, PENALTY_PER_PIECE * (extra + missing))

roundScore = { correctness: penalty, speedBonus: 0, efficiencyBonus: 0, total: penalty }
```

- 2 extra → −100; 10 extra → −400 (capped). Short 2 → −100; short 10 → −400. Bigger miss = bigger sting.
- `coverage` and `reason` are still computed (they drive the badge) — only the *scoring* changes.
- The perfect branch is untouched.

**Grand total floors at 0** (`commitRoundScore`):
```ts
score: Math.max(0, state.score + state.roundScore.total)
```
The header never shows negative; the per-round delta still shows the true negative. **For display consistency**, `index.tsx` must also floor the panel's count-up target: `grandTotal = Math.max(0, scoreBeforeRound + (roundScore?.total ?? 0))` — otherwise the Score panel's Grand Total could count up to a negative value while the header reads 0.

`RoundScore.correctness` may now be negative — no type change needed (it's already `number`).

### 5. Score panel on a failed round (`ResolutionPhase/ScorePanel.tsx`)

- **Accuracy row**: when `correctness < 0`, render the value as `−{abs}` (true minus sign) in red, with the red ✕ icon. The `Row`/`DelayedCountUp` helpers must support negative values and suppress the leading `+`.
- **Hide the Speed and Efficiency rows entirely on a failure** (they are zero and only dilute the penalty). Detect failure via a prop, e.g. `isFailure: boolean` passed from `index.tsx` (`resolution?.kind === 'partial'`).
- **Round Total** renders the negative penalty (red, with `−`) instead of the gold `+…`.

### 6. Slow-speed turtle (`ResolutionPhase/ScorePanel.tsx` + `index.tsx`)

On a successful round, the Speed row icon depends on the bonus earned:
- `speedBonus <= 0.20 * MAX_SPEED_BONUS` (≤ 100) → 🐢, muted gray text.
- otherwise → ⚡, gold.

`index.tsx` computes `speedSlow = roundScore.speedBonus <= MAX_SPEED_BONUS * 0.2` (importing `MAX_SPEED_BONUS` from the store) and passes it to `ScorePanel`. (Only relevant on the perfect path, since the Speed row is hidden on failures.)

### 7. Three-tier failure badge (`ResolutionPhase/PartialBadge.tsx`)

Replace the two-state `close` boolean with a tier from coverage:

```ts
const tier = coverage >= 0.66 ? 'close'
           : coverage >= 0.33 ? 'tough'
           : 'yikes'
```

| tier | coverage | label | glyph | gradient | text color |
|---|---|---|---|---|---|
| close | ≥ 66% | So Close! | ≈ | amber | amber |
| tough | 33–66% | Tough Round | ✕ | red | red |
| yikes | < 33% | Yikes | ✕ | red | red |

The existing `reason` sub-label ("Too many pieces", "Missed a piece", etc.) is unchanged.

**Accuracy-icon agreement (`index.tsx`).** `accuracyTier` mapping is unchanged and still agrees with the badge: `perfect` → green ✓; coverage ≥ 0.66 → `close` (amber ≈); else → `far` (red ✕). Both red badge tiers map to the red ✕ icon.

## Data flow (failed round)

```
submitSelection (unsolvable)
  → lives -= 1
  → bestFit → coverage, reason
  → penalty = -min(400, 50·(extra + missing))
  → roundScore = { correctness: penalty, speedBonus: 0, efficiencyBonus: 0, total: penalty }
  → phase = 'resolving', _resolution = { kind:'partial', placements: fit.placements, coverage, reason }

ResolutionPhase
  → walk/reject animation (unchanged)
  → PartialBadge tier from coverage (close / tough / yikes)
  → ScorePanel: Accuracy = negative (red, −); Speed & Efficiency rows hidden; Round Total negative
  → commitRoundScore → score = max(0, score + penalty)
  → CTA: lives>0 → "Try Again ↺" → retryRound() (same round, new puzzle)
          lives===0 → "Game Over →" → endGame()
```

## Testing

The spec is genuinely changing, so affected tests are updated (not bent to pass):

- **`tests/engine/puzzleGenerator.test.ts`** — 12×12 dimensions, new gap counts, gaps stay in-bounds on the larger grid.
- **`tests/engine/solver.test.ts`** — any fixtures that assume 10×8 dimensions; verify solve/bestFit still correct at 12×12.
- **`tests/store/gameStore.test.ts`** — new difficulty table values; failure penalty formula (extra/missing/cap cases incl. zero-selection); grand-total floor at 0; `retryRound` keeps `round`, `nextRound` increments; lives still decrement per failed submission.
- **`tests/components/ResolutionPhase.test.tsx`** — three badge tiers (So Close / Tough Round / Yikes) by coverage; negative Accuracy rendering; Speed/Efficiency rows hidden on failure; turtle vs lightning on successful rounds; CTA label per state (Next Round / Try Again / Game Over).

New tests added for the penalty formula and the retry-vs-advance distinction. The total test count will change; `npm run test` must pass, plus `npm run build` and lint (per project memory: `tsc --noEmit` alone misses `noUnusedLocals`).

## Docs

Update `CLAUDE.md`:
- Grid size note (10×8 → 12×12; recompute the ~382px width line).
- Difficulty-table description (15 rounds, gentler view ramp, scaled gaps).
- Round loop: Partial path now = **failed round → Try Again (same round)**; round advances only on a perfect clear.
- Scoring: failed rounds incur a negative Accuracy penalty (no Speed/Efficiency); grand total floors at 0.
- Test count.

## Out of scope

- Tuning the exact penalty rate / gap curve beyond the values above (these are the agreed starting values; revisit after play).
- Animations beyond what already exists in the resolving phase.
- Any of the deferred items (drag-and-drop, RN port, sound, leaderboard, a11y).
