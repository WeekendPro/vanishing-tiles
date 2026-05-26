# Puzzle Game Design Spec
**Date:** 2026-05-26  
**Status:** Approved

---

## Overview

A memory-and-speed puzzle game built in React (web POC), with a future React Native port targeting the Apple App Store. Each round challenges the player to memorize a partially-filled grid, then recall which tetromino-shaped gaps need to be filled — under time pressure and with a scoring system that rewards correctness, speed, and piece efficiency.

---

## Grid

- **Dimensions:** 8 columns × 10 rows (80 cells)
- Most cells are pre-filled; empty cells form the gaps the player must fill
- Gaps are always shaped to match valid tetromino orientations (never 1×1)
- Puzzle generation places gaps algorithmically at runtime; no pre-authored levels

---

## Pieces

Eight available pieces:

| Piece | Shape | Notes |
|-------|-------|-------|
| I | 1×4 straight | Standard tetromino |
| O | 2×2 square | Standard tetromino |
| T | T-shape | Standard tetromino |
| S | S-skew | Standard tetromino |
| Z | Z-skew | Standard tetromino |
| J | J-shape | Standard tetromino |
| L | L-shape | Standard tetromino |
| ■ | 1×1 single block | **Temptation piece** — always placeable, gaps are never 1×1. Selecting it is a strategic gamble that costs efficiency. |

Pieces support rotation (0°, 90°, 180°, 270°). Rotation is applied during the placement phase, not the selection phase.

---

## Core Game Loop

Each round cycles through four phases:

### Phase 1 — Viewing
- The 8×10 grid appears, mostly filled with colored blocks
- Empty cells (tetromino-shaped gaps) are visually distinct
- A progress bar counts down the view timer (starts at 5s, decreases with difficulty)
- Copy: *"Memorize the gaps"*
- When the bar empties, the grid hides and Phase 2 begins

### Phase 2 — Selecting
- The grid is hidden; a piece selection UI appears
- **Metadata bar:** Round number · Score · Lives (hearts) · Progress bar (selection timer)
- **Selection box (top panel):** Shows the player's current cart
  - Free pieces show count: `×1`, `×3`
  - Carry-over pieces (locked from previous round) show: `🔒×2`
  - Carry-overs combined with free additions show: `🔒×2 +1`
  - Tapping a piece in this box decrements the free count (locked pieces cannot be removed)
  - Help text: *"tap selected to decrement"*
- **Piece menu (bottom panel):** All 8 pieces displayed; tapping adds one to the selection box
  - Help text: *"tap to increment"*
- A "Done ✓" button submits the selection early
- The selection timer runs as a progress bar (no number shown); unused time earns a speed bonus
- When the timer expires or the player taps Done, selection is evaluated

**Selection evaluation:**
- The engine tries all rotations of the selected pieces against the grid gaps (backtracking solver)
- **Correct:** pieces exactly fill all gaps → Phase 3A (auto-place), no strike
- **Incorrect:** over- or under-selected, or pieces don't fit → Phase 3B (manual place), 1 strike

### Phase 3A — Auto-Place
- Pieces snap into their solved positions with a brief animation
- Proceeds immediately to Phase 4

### Phase 3B — Manual Place
- The grid reappears showing the remaining gaps
- The player's piece tray appears below the grid
- Interaction: click a piece in the tray to "hold" it → click a target cell on the grid to place it
- Press R (or tap a rotate button on mobile) to cycle piece orientation before placing
- Invalid placements are rejected (piece shown in error state)
- When all gaps are filled (or all placeable pieces are placed), proceeds to Phase 4
- Any pieces that could not be placed carry over to the next round (see Carry-Over rules)

### Phase 4 — Scoring
- Score breakdown displayed:
  - **Correct selection** (primary) — base points, only awarded in Phase 3A path
  - **Speed bonus** (secondary) — proportional to selection time remaining; 0 if incorrect
  - **Efficiency bonus** — proportional to how close piece count is to the theoretical minimum
- "Next Round →" button advances to the next round

---

## Carry-Over Rules

- Any pieces remaining unplaced at the end of Phase 3B carry over to the next round
- Carry-over pieces are **locked** in the selection box at the start of Phase 2 — they cannot be removed
- The player must work around carry-overs when building their new selection
- If carry-overs + new selections exactly fill the next puzzle → no strike, auto-placed
- If carry-overs happen to fit the next puzzle perfectly and the player selects complementary pieces correctly, they are rewarded normally (no penalty for having carried them over, as long as the final selection is correct)
- Unplaceable carry-overs (pieces that don't fit any remaining gap) persist in the tray during Phase 3B and carry over again

---

## Lives System

- Player starts with **3 lives** (displayed as hearts ♥♥♥)
- **1 strike = 1 life lost** — triggered any time Phase 3B (manual placement) is entered, for any reason
- **0 lives = game over**, score is final
- Magnitude of incorrectness doesn't matter: being off by 1 piece or 5 pieces is the same strike

---

## Scoring System

Three pillars, applied per round:

### 1. Correct Selection (primary)
- Base points awarded only when Phase 3A (auto-place) is reached
- No base points for incorrect selections that require manual placement
- Example values (tunable): correct = 800 pts base

### 2. Speed Bonus (secondary)
- Only awarded on correct selections
- `speed_bonus = max_speed_bonus × (time_remaining / total_selection_time)`
- Fast correct selection earns more; slow correct selection earns less but still > any incorrect selection
- Example: max speed bonus = 500 pts
- **Invariant:** `correct_selection_slow > incorrect_selection_fast` at all point values

### 3. Efficiency Bonus
- Awarded based on how close the player's piece count is to the theoretical minimum
- `efficiency_bonus = max_efficiency_bonus × (min_pieces / selected_pieces)`
- `selected_pieces` = total pieces in the cart including locked carry-overs (carry-overs count against efficiency — the player earned that debt)
- `min_pieces` = fewest pieces that could theoretically fill the current puzzle's gaps
- Selecting the 1×1 temptation piece increases `selected_pieces` and reduces the bonus
- Applies to both correct and incorrect paths (rewarded for attempting efficiency even in manual mode)
- Example: max efficiency bonus = 300 pts

---

## Difficulty Progression

Four variables scale across rounds, staggered:

| Rounds | View time | Selection timer | Gap count | Gap complexity |
|--------|-----------|-----------------|-----------|----------------|
| 1–3 | 5s | 15s | Low (2–3 gaps) | Simple shapes (I, O) |
| 4–6 | 4s | 13s | Medium (3–4 gaps) | + T, J, L |
| 7–10 | 3s | 11s | Medium-high (4–5) | + S, Z, combinations |
| 11–15 | 2.5s | 9s | High (5–6 gaps) | Multi-piece adjacency |
| 16+ | 2s | 7s | High (6+ gaps) | Maximum complexity |

View and selection timers are displayed as **progress bars only** — no numeric countdown shown to the player.

---

## UI Layout

Single-screen app; only the center content changes per phase. Persistent shell:
- Top bar: Round · Score · Lives (hearts)
- Progress bar: phase timer
- Main content area: grid (viewing/placing) or piece selection UI (selecting/scoring)

### Interaction model (POC)
- **Selection:** tap piece in menu to increment; tap piece in selection box to decrement
- **Placement:** click piece in tray → click target cell on grid; R to rotate
- **Future:** drag-and-drop placement as a second interaction mode post-POC

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React (Vite + TypeScript) | Fast setup, ecosystem maturity |
| State | Zustand | Lightweight, clean logic/UI separation, natural path to RN port |
| Styling | CSS Modules or Tailwind | TBD during implementation |
| Puzzle solver | Custom backtracking (TypeScript) | Constraint satisfaction for auto-place verification |
| Future mobile | React Native | Swap UI layer, keep Zustand store |

---

## Future Scope (post-POC)

- Drag-and-drop placement alongside click-to-place
- React Native port for App Store submission
- Sound effects and animations
- Leaderboard / high score persistence
- Accessibility (keyboard navigation, screen reader labels)
- Puzzle difficulty tuning based on playtesting data
