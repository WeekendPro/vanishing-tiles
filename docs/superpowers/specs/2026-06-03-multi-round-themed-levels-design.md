# Gap City — Multi-Round Themed Levels Design

**Date:** 2026-06-03
**Status:** Finalized design — ready for an implementation plan.
**Prototype target:** The Hollows, Level 1 — **Vacant Heights**.
**Build location:** **Practice mode first** (local, in `gameStore`); the Journey/server port is
deferred (see §11).
**Branch note:** This is a separate initiative from the in-flight per-station gating work
(`feat/per-station-gating`). It should get its own branch.

---

## 1. Why this exists

Today a "level" is a **single round**: one puzzle, 3 tries on the same board. It goes by too
quickly and leaves the level concept thin. This spec **redefines a level as a 4-round
"mission"** — a richer, longer unit of play with thematic variety — and uses Vacant Heights
as the guinea pig. The same 4-round framework is intended to build **every** level eventually;
levels get harder purely via their existing difficulty profile.

## 2. The level

A **level** is an ordered sequence of **4 rounds**, all sharing one difficulty profile, played
as a single mission. Themes are fixed by position:

1. **Basic** → 2. **Color-coded** → 3. **Sequential** → 4. **Flash Mob**

- **Lives:** 3, **pooled across the whole level**. Clearing a round costs nothing; **failing**
  a round spends one life and **replays that same round**. Cleared rounds stay cleared.
- **Win:** clear all 4 rounds. **Lose:** lives reach 0 (game over).
- Each round is its own puzzle generated from the shared difficulty profile.

### Retry semantics

A failed round is retried on the **exact same board** (same seed for that round) — preserving
today's per-puzzle invariant and keeping the server port simple. This is consistent with the
game's philosophy that every level is guaranteed solvable; the challenge is speed, not
feasibility, so a same-board retry is effectively a speed re-attempt.

## 3. State machine & flow

The existing per-puzzle phases (`countdown → viewing → selecting → resolving`) become the
**inner loop for one round**, wrapped in level/round state:

```
startLevel → for roundIndex in 0..3:
    countdown ("Round N · <Theme>") → viewing → selecting → resolving
      ├─ cleared → advance roundIndex → next round
      │             (after round 4 cleared → LEVEL COMPLETE)
      └─ failed  → livesRemaining--
                    └─ if 0 → GAME OVER
                       else  → replay same round (same seed)
```

New `GameState` fields (practice mode):

- `roundIndex: 0..3`
- `roundTheme` — the active theme for the current round
- `livesRemaining: number` — the 3 shared lives (a clear does not decrement; a fail does)
- `roundScores: RoundScore[]` — per-round results accumulated through the level
- `levelScore: number` — running level total

The countdown card names the round and theme (e.g. "Round 2 · Color-coded") so transitions
read clearly.

## 4. Scoring

The **Accuracy pillar is removed** — on a clear it is always 100%, so it carried no
information. The model is three pillars:

| Pillar          | Scope      | Range        | Formula |
|-----------------|------------|--------------|---------|
| Speed           | per round  | 0 … 1000     | `1000 × (viewRem + selectRem) / (viewDur + selectDur)` |
| Efficiency      | per round  | −1000 … 1000 | `clamp(1000 × (1 − extra/min), −1000, 1000)`, `extra = used − min` |
| Lives Remaining | per level  | 0 … 1000     | `1000 × livesRemaining / 3` |

- **Speed — Flash Mob exception:** Flash Mob's viewing is a forced, unskippable reveal, so
  banked view-time is always 0. Its Speed uses **select-phase only**:
  `1000 × selectRem / selectDur`. The other three rounds use the combined-budget formula.
- **Efficiency examples** (min 5): used 6 → 800; used 9 → 200; used 12 → −400. Clamped to a
  −1000 floor so even pathological over-selection (e.g. filling every 4-cell gap with four
  SINGLE pieces) can't swing a single round below −1000.
- **Lives Remaining:** 3 → 1000, 2 → 666, 1 → 333.
- **Level total** = Σ(speed + efficiency over the 4 rounds) + lives bonus. **Floored at 0**
  (a disastrous level posts 0, never negative). Theoretical max = `4 × (1000 + 1000) + 1000 =`
  **9000**.
- **Stars** from the total / 9000 ratio, reusing today's thresholds: ≥ 0.75 → 3★, ≥ 0.5 → 2★,
  else 1★.

## 5. The four round themes

### Round 1 — Basic
Today's gameplay. Board shown with filled cells and tetromino-shaped gaps. **New:** each gap
gets a **dashed, monochrome border** that traces its shape, helping the eye read the gap.
Cart = unordered shape multiset.

### Round 2 — Color-coded
Gaps drawn with **dashed colored borders**. The cart must match each gap's **shape *and*
color**. The selection menu shows the round's shape(s) rendered in each available palette
color. The player memorizes the color distribution during viewing and reproduces it.

Difficulty knobs (scale with the level's complexity tier):
- **Vacant Heights (simplest):** 1 shape type, **all-distinct** colors, 3 gaps.
- **Higher complexity:** colors may **repeat** (count/histogram memory), and **multiple shape
  types** may appear (e.g. 3 colored L gaps + 3 colored O gaps).

The 8-color palette (e.g. green, red, blue, yellow, orange, purple, pink, indigo) is
**separate** from piece-type colors — in this mode, color is decoupled from shape.

### Round 3 — Sequential
Monochrome dashed borders **plus a number badge (1 … N)** on each gap. The player builds an
**ordered queue** by tapping pieces (tap-to-append, with undo/backspace removing the last
pick). The k-th pick must match the shape of the gap labeled *k*. **Wrong order = round fail,
no partial credit** (correct shapes in the wrong order do not score). Cart = ordered shape
list. (Identical shapes in adjacent slots are interchangeable since their order is
indistinguishable.)

### Round 4 — Flash Mob
**No board during viewing.** Each gap's shape **flashes once, centered on screen, 700ms on /
300ms off**, in a **single pass** (no loop). Viewing duration is derived, not read from the
table: `viewDuration = gapCount × 1000ms` (3s at Vacant Heights). The reveal is **not
skippable** (no early Ready→). The player tallies the flashed shapes from memory. Cart =
unordered shape multiset. Speed uses the select-only exception (§4).

## 6. The token-cart & validation (unifying core)

Generalize selection from a piece-type tally to an ordered list of **tokens**:

```ts
interface SelectionToken { pieceType: PieceType; color?: string }
```

Each theme carries a small config declaring two booleans, `orderMatters` and `colorMatters`.
A single validator interprets the same token list per theme:

| Theme       | orderMatters | colorMatters | Menu |
|-------------|:------------:|:------------:|------|
| Basic       | no  | no  | 8 piece types, +/− steppers |
| Color-coded | no  | **yes** | round's shape(s) × palette colors |
| Sequential  | **yes** | no  | piece types, tap-to-append queue |
| Flash Mob   | no  | no  | 8 piece types, +/− steppers |

**Solver extensions:**
- **Color-coded:** partition gaps and tokens by color, then solve each color-group as an
  independent Basic solve. A colored gap must be filled by a matching-color piece.
- **Sequential:** check the picked shape-sequence equals the gap shapes ordered by their
  number, then assign in order. Order mismatch → fail.
- **Basic / Flash Mob:** use today's `solve()` unchanged (order/color ignored → tally by
  `pieceType`).

## 7. Puzzle generation & Gap extensions

`Gap` gains two optional fields: `color?: string` and `order?: number`. `generatePuzzle`
becomes theme-aware:
- **Basic / Flash Mob:** today's generator (random shapes; no color, no order).
- **Color-coded:** pick the shape-set per the difficulty knobs, then assign colors (distinct
  at Vacant Heights).
- **Sequential:** assign `order` 1 … N across the gaps.

## 8. Components

**Reused, parameterized:**
- `Grid`, `CountdownPhase` (themed title card), `FlyerOverlay`, `ScorePanel`, resolution
  badges.

**New / modified:**
- **Dashed-border gap styling** — monochrome (Basic, Sequential) and colored (Color-coded).
- **Number-badge overlay** on gaps (Sequential).
- **`FlashReveal`** — centered, single-pass shape flasher (Flash Mob viewing).
- **Colored-piece menu** (Color-coded selection).
- **Tap-to-append queue menu** with undo (Sequential selection).
- **Level shell** — tracks round progress (which of the 4 rounds, cleared/current) and the 3
  shared lives across rounds.

## 9. Vacant Heights difficulty profile

Reuses level 1's existing knobs (`gapCount 3`, complexity `simple`) applied to all 4 rounds.
Per-theme timing: Basic / Color-coded / Sequential use the difficulty table's view + select
durations; Flash Mob derives `viewDuration = gapCount × 1000ms = 3000ms`. Color-coded at this
level = 1 shape type, 3 distinct colors.

## 10. Architecture decision

**Extend the store + a per-round theme config object** (chosen over a full strategy framework
or a parallel mode). One game loop. `GameState` gains the level/round state from §3, and each
round carries a theme config that parameterizes generation, the token-cart, the viewing view,
and validation. Reuses today's phase machine and most components. The configs and validators
are **pure logic**, deliberately written so they can later lift straight into the Supabase edge
functions for the Journey port.

## 11. Out of scope (this prototype)

- **Server / Journey port** — deferred. Built in practice mode first. The reshaped multi-round
  session (DB schema, `start_session` / `submit_attempt`, scoring) comes after the feel is
  validated; the pure configs/validators are designed to lift over.
- **Per-station gating** — separate in-flight initiative (`feat/per-station-gating`).
- **Tuning across all 15 levels** — only Vacant Heights is wired now; the difficulty knobs for
  Color-coded (shape variety, color repetition) and the other themes at higher tiers are
  defined in concept but not tuned.
- **A 5th "Gauntlet" round** — parked; the framework stays at 4 rounds.
