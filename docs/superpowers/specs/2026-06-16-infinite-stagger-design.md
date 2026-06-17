# Infinite Stagger — Design Spec

**Date:** 2026-06-16
**Status:** Approved design, pending implementation plan

## Overview

Infinite Stagger is a new **endless** game mode — a blend of *The Classic* (memorize
gaps, pick matching pieces) and *Glimpse* (gaps flash and vanish). It strips out the
round/level framing, the briefing, and the explicit "Done" commit step to keep the
player continuously in the action. Gaps are revealed one at a time with a smooth
fade; the player then picks pieces from memory, each pick judged **instantly**.
Clear a batch and the next, slightly harder batch begins immediately. The run ends
when the player runs out of lives.

### Design goals

- **Trim the fat / reduce friction.** No briefing, no map, no "Done" button, no
  per-round resolution screen, no tap-to-continue between batches.
- **Keep the player in the action.** Fully continuous batch-to-batch flow.
- **A pure recall test.** Gaps flash as empty hollow holes, then vanish before
  selection; the board reads as an even, faint lattice (gaps hidden).
- **Cumulative, escalating.** One growing score; difficulty climbs every batch.

## Mode identity & entry

- Launched from the hamburger menu (`GlobalMenu.tsx`) as its own item, **"Infinite
  Stagger"**, sitting alongside "Training Mode". It bypasses the Journey map, the
  Git Map, and the level briefing entirely.
- New `AppView` value `'stagger'` in `navStore.ts` with a `goStagger()` action.
- `App.tsx` routes `'stagger'` → `<StaggerScreen />`.
- The mode is **self-contained**: it does not touch `gameStore`, `GameShell`,
  Practice, Journey, or Git Map. Those modes are unchanged.

## Architecture — isolation

The loop diverges enough from the round-based modes (endless, live per-pick judging,
no resolve phase) that it gets its own slice rather than new branches threaded
through `gameStore`/`GameShell`:

- **`src/store/staggerStore.ts`** — a dedicated Zustand store owning the run state
  and the phase machine (see State model). Follows the project's `useShallow` rule
  for object selectors.
- **`src/components/StaggerScreen.tsx`** — a full-screen component that renders the
  current phase, the persistent score/lives HUD, the timer bar, the grid, and the
  piece tray.

It **reuses** the shared building blocks:

- `Grid.tsx` for the 12×12 board.
- The gap-silhouette fade from `FlashReveal.tsx` (the `GapSilhouette` look + a clean
  opacity fade in/out), refactored as needed so both modes share one silhouette
  renderer rather than duplicating it.
- `ProgressBar.tsx` is **not** reused directly — Infinite Stagger's bar both *fills*
  (reveal) and *drains* (selection), so the screen drives the bar width itself. The
  visual treatment (height, rounding, colors) matches the existing bar.
- The piece-tray styling from `SelectingPhase.tsx` (the 7-tetromino picker grid).
- `engine/puzzleGenerator.ts` `generatePuzzle(difficulty)` for `{ grid, gaps }`.
- The shape-match logic from `themeResolution.ts` (strict, monochrome, shape-only)
  for judging each pick.

## State model (`staggerStore`)

```
phase: 'idle' | 'countdown' | 'reveal' | 'selecting' | 'gameOver'
batchIndex: number          // 0-based; drives difficulty
grid: Cell[][]              // current board
gaps: Gap[]                 // current batch's gaps, each with a filled flag
score: number              // cumulative across the run
lives: number              // starts at 3
revealStep: number         // which gap is currently flashing (reveal phase)
barFill: number            // 0..1, what the timer bar should show right now
selectStartTime: number    // ms when selecting began (for speed scoring)
selectDuration: number     // current batch's select clock (ms)
```

Actions: `startRun()`, `beginCountdown()`, `beginReveal()`, `beginSelecting()`,
`pickPiece(type)`, `clearBatch()`, `endRun()`, `exit()`.

## Phase machine / the loop

1. **`countdown`** — bold "3 · 2 · 1 · GO" fade (same feel as `CountdownPhase`),
   then `beginReveal()`. The reveal/select clock is *not* running yet.
2. **`reveal`** — gaps flash **one at a time**, in order. Each gap: fade in
   (~200ms) → hold (batch-dependent) → fade out (~200ms). The board is otherwise
   solid. The timer bar **fills** in `gaps.length` equal steps: after gap *k* of
   *n* finishes, the bar sits at `k/n`. The bar fill is therefore a **count
   indicator** — it tells the player how many gaps are coming, not elapsed time.
   When the last gap fades out, `beginSelecting()`.
3. **`selecting`** — the board is solid (gaps invisible — pure recall). The piece
   tray appears just under the grid. The **same bar** now flips to the select color
   and **drains** from 100% → 0% over `selectDuration`. There is **no Done button**.
   Each piece tap is judged immediately:
   - **Correct** (an unfilled gap matches the picked piece's shape): that gap's
     cells light up in the piece color (a brief snap/glow), `filled = true`,
     `score += ACCURACY_PER_GAP`.
   - **Wrong** (no unfilled gap matches): a red ✕ flashes over the grid, a short
     shake, `lives -= 1`. If `lives === 0` → `endRun()` (`gameOver`).
   - When **every gap is filled** → award the batch speed bonus, then `clearBatch()`.
   - If the **select clock expires** before all gaps are filled: the unfinished
     batch is abandoned, costs **one life**, and (if any remain) the next batch
     begins. Running out of time mid-batch can therefore end the run.
4. **continuous transition** — `clearBatch()` increments `batchIndex` and immediately
   re-enters `reveal` for the next batch (a brief ~0.5s score-tick beat is allowed,
   but no tap and no full pause).
5. **`gameOver`** — when `lives` hits 0: show final cumulative score and the batch
   reached, plus a **Replay** and an **Exit to menu** CTA.

## Difficulty — Infinite Stagger's own curve

Independent of `DIFFICULTY_TABLE`. Because the run is unbounded, the curve is a
**formula** of `batchIndex` (`b`, 0-based), not a finite table. Starting values are
generous (per the "scale with difficulty" decision) and tighten as `b` grows:

```
gapCount(b)   = min(MAX_GAPS, 3 + floor(b / 2))          // 3,3,4,4,5,5,…  cap MAX_GAPS=12
holdMs(b)     = max(MIN_HOLD, START_HOLD - b * HOLD_STEP) // generous→snappy
fadeMs        = 200                                       // constant in/out
selectDuration(b) = SELECT_BASE + gapCount(b) * SELECT_PER_GAP
complexity(b) = gapCount-derived (simple ≤5 / medium ≤8 / complex otherwise)
```

Tunable constants (initial values, to be refined in playtest):

```
MAX_GAPS      = 12
START_HOLD    = 720   // ms hold at batch 0  → ~1.12s/gap total with fades
MIN_HOLD      = 260   // floor                → ~0.66s/gap total at the top
HOLD_STEP     = 38    // ms shaved per batch
SELECT_BASE   = 6000  // ms
SELECT_PER_GAP = 1400 // ms  → select clock always comfortably longer than reveal
```

The per-batch reveal total per gap is `fadeMs + holdMs(b) + fadeMs`. The grid
geometry already supports up to 16 gaps elsewhere, so `MAX_GAPS = 12` leaves the
12×12 board comfortably solvable while staying visually dense.

Difficulty config is built per batch and passed to `generatePuzzle` exactly as the
other modes do. Theme is monochrome shape-only (`'basic'` semantics) — no colors,
no sequence/order constraint.

### Shape & orientation ramp

Beyond gap count, two more dials ramp the memory load (both live in
`staggerCurve.ts`, fed to `generatePuzzle` via its `allowedTypes` / `lockedRotations`
options):

- **Shapes introduced gradually.** The run opens on `O` + `I` only; trickier shapes
  join one at a time — `L` at batch 3, `J` at 5, `S` at 7, `T` at 9, `Z` at 11. The
  allowed set only ever grows.
- **Orientation locked early.** Through `ORIENTATION_FREE_FROM` (batch 6), every gap
  uses the same orientation it's drawn at in the tray (`DISPLAY_ROTATION`: `I`/`J`/`L`
  upright, the rest canonical), so the player maps shapes 1:1 with the cart. From
  that batch on, gaps may appear in any rotation.

## Scoring (cumulative)

Reuses the same ratio-based speed model the rest of the game uses
(`roundSpeed` with `selectOnly` semantics — measured on the select clock only,
since the reveal is a forced, unskippable sequence like Glimpse).

- **Per correct pick:** `score += ACCURACY_PER_GAP` (initial `100`). Bigger batches
  therefore bank more accuracy.
- **Per batch clear (all gaps filled):** speed bonus
  `round(SPEED_MAX * selectTimeRemaining / selectDuration)` where
  `selectTimeRemaining` is the clock left at the moment the final gap is filled.
  Initial `SPEED_MAX = 500`.
- **Wrong pick:** 0 points, −1 life.
- **Score is cumulative** across the entire run and **pinned at the top of the
  screen** the whole time (ticks up live).
- Final score is the run total shown on the game-over screen.

Persistence of a best/high score is **out of scope** for this pass (the global
record is mocked elsewhere); the score resets each run.

## Lives & game over

- **5 shared lives** for the whole run.
- Each wrong pick costs one life; letting the select clock expire mid-batch also
  costs one life.
- `lives === 0` → run ends immediately, even mid-batch → `gameOver`.
- Game-over screen: final cumulative score, batch reached, **Replay** (restart at
  batch 1) and **Exit to menu**.

## Rendering / HUD

The `StaggerScreen` HUD, persistent across phases:

- **Score** — top, prominent, the dominant number on screen.
- **Lives** — five hearts; a lost life dims.
- **Gap progress** — a `filled / total` fraction for the current batch (e.g.
  "2 / 6"), climbing as each gap is recalled. No batch number is shown.
- **Timer bar** — one bar that fills during reveal (cool/cyan) and drains during
  selection (green), matching the existing bar's dimensions and the grid width.
- **Grid** — 12×12, solid board; gap silhouettes flash over it during reveal;
  correct picks light their cells in the piece color.
- **Piece tray** — the 7 tetromino pickers, shown only during `selecting`.

## Out of scope (deferred)

- High-score / leaderboard persistence for Infinite Stagger.
- Colors or sequence constraints (mode is monochrome shape-only).
- Sound effects.
- A separate entry on the Git Map / Journey map (menu-only launch).
- Difficulty-curve fine-tuning beyond the initial constants.

## Testing

- **`staggerStore` unit tests** (pure logic):
  - `gapCount/holdMs/selectDuration` formulas produce the expected monotonic curve
    and respect their caps/floors.
  - `pickPiece`: correct pick fills the matching unfilled gap and adds accuracy;
    wrong pick deducts a life and adds no score; a second correct pick of the same
    type fills a *second* matching gap, not the already-filled one.
  - Batch clears when the last gap fills; speed bonus uses the select-clock ratio.
  - `lives === 0` transitions to `gameOver`; select-clock expiry ends the batch with
    no penalty and continues.
  - Cumulative `score` accumulates across batches.
- All existing tests must continue to pass (the mode is additive; no shared-module
  behavior changes beyond extracting the shared gap-silhouette renderer).
```
