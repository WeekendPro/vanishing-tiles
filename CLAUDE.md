# Mind The Gap — Project Context

A memory-and-speed puzzle game. The web POC is complete and playable. The eventual goal is a React Native mobile app published to the Apple App Store.

**Run the app:** `npm run dev` → http://localhost:5173  
**Run tests:** `npm run test` (all must pass before any commit)  
**Type check:** `npx tsc --noEmit` (or `npm run build`, which also catches `noUnusedLocals`)

---

## The Game

Players memorize the shape of empty gaps in a pre-filled grid, then pick the Tetris-style pieces needed to fill them — all under time pressure.

### Round loop

1. **Viewing** — Grid is shown with filled cells and empty gaps (tetromino-shaped). Timer counts down. Player can click **Ready →** to advance early.
2. **Selecting** — Timed. Player picks pieces from a menu (each piece can be selected multiple times). **Done ✓** skips remaining time.
3. **Resolution:**
   - **Perfect** (solver confirms the selection exactly fills all gaps): pieces fly in automatically, full scoring, green **Perfect!** badge, **Next Round →** CTA. The round counter advances.
   - **Failed round** (selection doesn't fit): player loses 1 life, the game auto-runs a best-fit placement (good pieces fly in, leftover pieces get a red ✕), and the round is scored as a **failure** (see Scoring). The badge tiers by coverage — amber **So Close!** (≥66%), red **Tough Round** (33–66%), red **Yikes** (<33%). The CTA is **Try Again ↺**, which regenerates a *fresh puzzle at the same round* (the round counter advances **only on a perfect clear**). On the last life the CTA is **Game Over →**.
4. **Scoring** — Three pillars on a perfect clear; a penalty on a failure:
   - ✓ Accuracy: **+800** pts on a perfect clear. On a **failure** it is a **negative penalty** — `-50` per wrong/missing piece (`extra + missing`), floored at `-400` — shown in red; Speed/Efficiency are zeroed and their rows hidden.
   - ⚡ Speed bonus: up to 500 pts (perfect clear only, based on time remaining). A slow-but-successful round shows a 🐢 instead of ⚡ when the bonus is in the bottom ~20%.
   - ◆ Efficiency bonus: up to 300 pts (perfect clear only, piece count vs. minimum needed).
   - The running **grand total is floored at 0** — a net-negative round never pushes the score below zero.
5. **Next Round** / **Try Again** / **Game Over** (at 0 lives; 3 lives total).

### Piece types

`I, O, T, S, Z, J, L` (standard tetrominoes, 4 cells each) + `SINGLE` (1 cell, temptation/decoy piece).

---

## Architecture

### File map

```
src/
  types.ts              — PieceType, Rotation, Cell, Phase, GameState
  store/
    gameStore.ts        — Zustand store; all game state + actions
  engine/
    pieces.ts           — PIECE_DEFINITIONS, getRotatedCells(), getPieceColor()
    puzzleGenerator.ts  — generatePuzzle(difficulty) → { grid, gaps }
    solver.ts           — solve(pieceCount, grid, gaps) backtracking solver
  components/
    GameShell.tsx       — Top bar (round/score/lives), phase router, idle screen
    ViewingPhase.tsx    — Grid + progress bar + Ready button
    SelectingPhase.tsx  — Piece menu + selection cart + Done button
    ResolutionPhase/    — Auto-placement animation; perfect/failure badge; Try Again / Next Round / Game Over CTA (index.tsx + PartialBadge, CelebrationBadge, ScorePanel, NextRoundButton, FlyerOverlay, SelectionCart)
    ScoringPhase.tsx    — Game Over screen with Play Again button
    Grid.tsx            — 12×12 inline-grid, 28px cells; onCellClick / onCellHover props
    PieceShape.tsx      — Renders a single piece at a given rotation + cell size
    ProgressBar.tsx     — Animated countdown bar
```

### Grid dimensions

Grid is `inline-grid`, 12 cols × 28px cells + 2px gaps + 12px padding ≈ **382px wide**. UI buttons that should match the grid width go inside an `inline-flex flex-col items-stretch` wrapper so `w-full` auto-sizes to the grid.

### Difficulty table

`DIFFICULTY_TABLE` in `gameStore.ts` — keyed by round number, controls view duration, select duration, and number/type of gaps generated. Spans **15 rounds** (round 15+ uses the last entry): the view timer eases gently (~300ms/round from 5000ms, floored at 2500ms) and `gapCount` climbs from 3 to 16 so the larger board stays meaningfully empty deep into a run.

---

## Critical rules for agents

### Zustand 5 — always use `useShallow` for object selectors

```ts
// ✅ correct
import { useShallow } from 'zustand/shallow'
const { foo, bar } = useGameStore(useShallow(s => ({ foo: s.foo, bar: s.bar })))

// ✅ also fine (single value, no object)
const foo = useGameStore(s => s.foo)

// ❌ will cause infinite loop in Zustand 5
const { foo, bar } = useGameStore(s => ({ foo: s.foo, bar: s.bar }))
```

Zustand 5 uses `useSyncExternalStore` internally. Inline object selectors return a new reference every render → React infinite loop. `useShallow` memoizes by shallow equality.

### Solver correctness

`solver.ts` uses backtracking. The outer piece-type loop must **not** `break` early — it must try all piece types for each empty cell, otherwise the solver is order-dependent and misses valid solutions.

### Efficiency bonus guard

When `selectedPieces === 0`, the efficiency ratio must be 0 — not `minPieces / minPieces = 1.0`. Always check `selectedPieces === 0` before computing the ratio.

### Tests

All tests must pass before committing. Run `npm run test`. Do not skip or modify tests to make them pass unless the spec has genuinely changed.

---

## Design decisions (agreed upon)

- **Grid size:** 12 rows × 12 columns (square)
- **Placement UX:** Click-to-place (drag-and-drop is deferred)
- **Scoring philosophy:** Reward speed AND precision; a failed round is penalized (negative accuracy), not partially rewarded
- **Lives:** 3 hearts; a failed round costs 1 life and is retried at the same round (round advances only on a perfect clear)
- **Button style:** Full-width, centered, matching grid width — consistent across all phases

---

## Deferred (post-POC)

- Drag-and-drop piece placement
- React Native port → Apple App Store
- Sound effects and animations
- Leaderboard / high score persistence
- Accessibility (ARIA, keyboard nav)
- Difficulty scaling tuning

---

## Docs

- **Design spec:** `docs/superpowers/specs/2026-05-26-puzzle-game-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-05-26-puzzle-game-poc.md`
- **Gameplay polish (12×12 board, retry flow, failure penalty, turtle):** `docs/superpowers/specs/2026-05-28-gameplay-polish-design.md` + `docs/superpowers/plans/2026-05-28-gameplay-polish.md`
