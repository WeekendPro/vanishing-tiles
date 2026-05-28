# Mind The Gap — Project Context

A memory-and-speed puzzle game. The web POC is complete and playable. The eventual goal is a React Native mobile app published to the Apple App Store.

**Run the app:** `npm run dev` → http://localhost:5173  
**Run tests:** `npm run test` (76 tests, all must pass before any commit)  
**Type check:** `npx tsc --noEmit`

---

## The Game

Players memorize the shape of empty gaps in a pre-filled grid, then pick the Tetris-style pieces needed to fill them — all under time pressure.

### Round loop

1. **Viewing** — Grid is shown with filled cells and empty gaps (tetromino-shaped). Timer counts down. Player can click **Ready →** to advance early.
2. **Selecting** — Timed. Player picks pieces from a menu (each piece can be selected multiple times). **Done ✓** skips remaining time.
3. **Resolution:**
   - **Perfect** (solver confirms the selection exactly fills all gaps): pieces fly in automatically, full scoring.
   - **Partial** (selection doesn't fit): player loses 1 life, the game auto-runs a best-fit placement (good pieces fly in, leftover pieces get a red ✕), and awards partial credit. The next round starts clean — no carry-overs.
4. **Scoring** — Three pillars:
   - ✓ Correctness: 800 pts (auto-place only)
   - ⚡ Speed bonus: up to 500 pts (auto-place only, based on time remaining)
   - ◆ Efficiency bonus: up to 300 pts (both paths, based on piece count vs. minimum needed)
5. **Next Round** or **Game Over** (at 0 lives; 3 lives total).

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
    ResolutionPhase.tsx — Auto-placement animation; perfect/partial badge; Next Round / Game Over CTA
    ScoringPhase.tsx    — Game Over screen with Play Again button
    Grid.tsx            — 10×8 inline-grid, 28px cells; onCellClick / onCellHover props
    PieceShape.tsx      — Renders a single piece at a given rotation + cell size
    ProgressBar.tsx     — Animated countdown bar
```

### Grid dimensions

Grid is `inline-grid`, 8 cols × 28px cells + 2px gaps + 12px padding ≈ **262px wide**. UI buttons that should match the grid width go inside an `inline-flex flex-col items-stretch` wrapper so `w-full` auto-sizes to the grid.

### Difficulty table

`DIFFICULTY_TABLE` in `gameStore.ts` — keyed by round number, controls view duration, select duration, and number/type of gaps generated.

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

All 76 tests must pass before committing. Run `npm run test`. Do not skip or modify tests to make them pass unless the spec has genuinely changed.

---

## Design decisions (agreed upon)

- **Grid size:** 10 rows × 8 columns (not square; taller than wide)
- **Placement UX:** Click-to-place (drag-and-drop is deferred)
- **Scoring philosophy:** Reward speed AND precision, not just filling gaps
- **Lives:** 3 hearts; a wrong selection (partial resolution) costs 1 life
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
