# Vanishing Tiles — Project Context

**Vanishing Tiles** is a memory-and-speed puzzle game (a Tetris × Streets of Rage mashup). The web POC is
complete and playable. The eventual goal is a React Native mobile app published to
the Apple App Store. (Vanishing Tiles was formerly named "Vanishing Shapes", before that "Phosphor", and
originally codenamed "Gap City"; those earlier names survive only in internal identifiers — district slugs,
localStorage keys, applied migrations, and the `phos`/`vs`-derived names in dated specs/plans. The
phosphor-inspired *visual* system is still called **Afterglow**; the runtime design tokens were renamed
`phos-*` → `vs-*` → `vt-*`.)

**Run the app:** `npm run dev` → http://localhost:5173  
**Run tests:** `npm run test` (all must pass before any commit)  
**Type check:** `npx tsc --noEmit` (or `npm run build`, which also catches `noUnusedLocals`)

---

## The Game

Players memorize the shape of empty gaps in a pre-filled grid, then pick the Tetris-style pieces needed to fill them — all under time pressure. In Journey mode, tap a station on the transit map to enter a **level hub** (`LevelScreen`), solve the main puzzle, then tackle optional badge challenges. In Practice mode the legacy 4-round gauntlet is still active (Training rework is a separate future effort).

### Journey mode — level hub

Tapping a station on the map opens `LevelScreen`. Each level has **five components**:

- **Main puzzle** — always playable from the start; must be solved to unlock the badges.
- **Four opt-in badges** — True Colors, In Order, Don't Blink, and Riddle (a "Coming soon" placeholder) — locked until the main puzzle is solved, then playable in any order and freely replayable. (Internal component keys remain `colors` / `inSequence` / `flash` / `riddle`.)

Each component play (main or badge) has **3 lives** and runs one puzzle round end-to-end. Flow: `startComponent` → `countdown` → `beginViewing` → `viewing` → `selecting` → `resolving`.

### Round loop (shared by Journey and Practice)

Every round opens with a brief **countdown** (bold "Round N" with a 3-2-1 fade), a **pre-roll** (the view timer starts only when `viewing` begins, so the countdown never costs memorize time). Flow: `startGame` → `countdown` → `beginViewing` → `viewing`.

When `viewing` starts, a one-time **gap shimmer** plays *concurrently* with the memorization timer: a soft, cool-white glare band sweeps diagonally once, **masked to the gap shapes** (`GapShimmer.tsx`) so the light is only visible where it crosses a gap, never the filled board. It uses no piece colors and doesn't touch game state — purely a subtle visual crutch that draws the eye to the gap shapes. The gaps are visible from the start; the timer runs the whole time.

1. **Viewing** — Grid is shown with filled cells and empty gaps (tetromino-shaped). Timer counts down. Player can click **Ready →** to advance early.
2. **Selecting** — Timed. Player picks pieces from a menu (each piece can be selected multiple times). **Done ✓** skips remaining time.
3. **Resolution** — resolved by **strict assignment** (`themeResolution.ts`): a selected piece may only fill a gap of the **exact same shape** (and **color** in color-coded rounds); it never lands on mismatched cells or spans adjacent gaps. Sequential rounds match each pick against its **position** (the gap with `order == k`). A piece with no available matching gap is rejected.
   - **Perfect** (every gap matched, no leftover picks): pieces fly in automatically, **ComponentScorePanel** shows the result, **Next →** CTA.
   - **Failed attempt** (some gap unmatched or some pick rejected): player loses 1 life; matched pieces fly into their gaps, rejected pieces get a red ✕. Badge tiers by coverage — amber **So Close!** (≥66%), red **Tough Round** (33–66%), red **Yikes** (<33%). CTA is **Try Again ↺** (same puzzle, fresh clock). On the last life the CTA is **Back to Level →**.

### Scoring

#### Journey — per-component model (`src/lib/journeyScoring.ts`)

- **Solved:** `completion + time`, `ceil`, capped at 100. **Completion** = `50 − 10 × livesLost` (giving 50 / 40 / 30). **Time** = `50 × (1 − consumed / allotted)` (e.g. 10% of the clock consumed → 45; 50% → 25). Unsolved (all 3 lives lost) = **0**.
- `consumed` = time used; `allotted` = `viewDuration + selectDuration` for most components, `selectDuration` only for Don't Blink (flash reveal, no skippable view phase). Time bonus is measured on the **successful attempt** — retries each get a fresh clock.
- The completed badge's **star fills from the bottom in proportion to the score** (a 70 → a star ~70% full).
- **Level total** = sum of best-score-per-component (0–500 across 5 × 100).
- **Stars**: 1★ when main is solved; then 2★ ≥ 150 / 3★ ≥ 250 / 4★ ≥ 350 / 5★ ≥ 450.
- **Difficulty pips** 1–5 are derived from gap count.
- **Persistence**: per-component best scores live client-side in `progressStore` (localStorage, key `gapcity:progress:v1`); the global record is mocked for now. The level catalog (station list, difficulty) still comes from `get_journey` / `get_level` (Supabase, unchanged).

#### Practice — legacy 4-round gauntlet (`@shared/core/scoring`)

Practice mode still runs 4 themed rounds with pooled lives and the old per-round `scoreRound` / `levelTotal` / `levelStars` scoring. This code is intentionally unchanged — a Training-mode rework is pending.

- Per round on a perfect clear: **Speed bonus** (up to ~500 pts, ratio-based on time remaining) + **Efficiency bonus** (up to ~300 pts, piece count vs. minimum). A slow-but-successful round shows a turtle emoji instead of lightning when the speed bonus is in the bottom ~20%.
- Failed rounds score 0 for that round; lives are pooled across all 4 rounds.
- **Next Round** / **Try Again** / **Game Over** (at 0 lives; 3 lives total).

### Piece types

`I, O, T, S, Z, J, L` (standard tetrominoes, 4 cells each) + `SINGLE` (1 cell, temptation/decoy piece).

---

## Architecture

### File map

```
src/
  types.ts              — PieceType, Rotation, Cell, Phase, GameState
  store/
    gameStore.ts        — Zustand store; all game state + actions (startComponent / retryComponent / replayComponent for Journey; startLevel for Practice)
    progressStore.ts    — Zustand + localStorage store for per-component best scores and level progress (key: gapcity:progress:v1)
  lib/
    components.ts       — ComponentKey types, LEVEL_COMPONENTS, BADGE_COMPONENTS, COMPONENT_THEME, COMPONENT_LABEL, isPlayable helpers
    journeyScoring.ts   — componentScore(), levelStarsFromTotal(), difficultyPips(), sumBests() — Journey scoring math
  engine/
    pieces.ts           — PIECE_DEFINITIONS, getRotatedCells(), getPieceColor()
    puzzleGenerator.ts  — generatePuzzle(difficulty) → { grid, gaps }
    solver.ts           — solve(pieceCount, grid, gaps) backtracking solver
  components/
    GameShell.tsx       — Top bar (component label/score/lives), phase router, idle screen; TrickleBar shown while submitting
    CountdownPhase.tsx  — Pre-round "Round N" + 3-2-1 fade countdown, then beginViewing
    GapShimmer.tsx      — One-time glare sweep masked to the gap shapes; overlaid on the viewing grid (no game-state change)
    ViewingPhase.tsx    — Grid + GapShimmer overlay + Ready button (timer bar lives in GameShell)
    SelectingPhase.tsx  — Piece menu + selection cart + Done button
    ResolutionPhase/    — Auto-placement animation; perfect/failure badge; Try Again / Back to Level CTA (index.tsx + PartialBadge, CelebrationBadge, ScorePanel, ComponentScorePanel, NextRoundButton, FlyerOverlay, SelectionCart)
      ComponentScorePanel.tsx — Journey resolution card: component score breakdown + running level total + stars
    ScoringPhase.tsx    — Practice Game Over screen with Play Again button
    LevelScreen.tsx     — Journey level hub: main puzzle + 4 badge tiles, level progress (stars/total), badge lock state
    Grid.tsx            — 12×12 inline-grid, 28px cells; onCellClick / onCellHover props
    PieceShape.tsx      — Renders a single piece at a given rotation + cell size
    ProgressBar.tsx     — Animated countdown bar
    JourneyScreen.tsx   — Journey "Map" screen: loads get_journey, owns loading/error, GAP CITY header; renders <TransitMap>
    JourneyMap/         — The transit-map Journey: index.tsx (TransitMap = SVG neon lines + HTML station buttons) + layout.ts (hand-authored station coords, line paths, slug→color). Presentational only; tap a station → openLevel.
```

### Grid dimensions

Grid is `inline-grid`, 12 cols × 28px cells + 2px gaps + 12px padding ≈ **382px wide**. UI buttons that should match the grid width go inside an `inline-flex flex-col items-stretch` wrapper so `w-full` auto-sizes to the grid.

### Difficulty table

`DIFFICULTY_TABLE` in `gameStore.ts` — keyed by round number, controls view duration, select duration, and number/type of gaps generated. Spans **15 rounds** (round 15+ uses the last entry). The view (memorize) timer **rises monotonically with `gapCount`** on a comfortable **~1.2–1.33s per gap** budget so every level stays solvable — the challenge is *how fast* you clear it, not *whether* you can. It runs **4000ms → 17000ms** across rounds 1–15, tapering toward ~1.06s/gap at the top tier where adjacent shapes chunk in memory. `selectDuration` also rises (10000 → 23000ms) and is always longer than the view window, so picking pieces is never the bottleneck. `gapCount` climbs from 3 to 16 so the larger board stays meaningfully empty deep into a run. Speed scoring is **ratio-based** (`scoring.ts` uses `timeRemaining / duration`), so these absolute durations self-normalize and don't change the score ceiling — leaving more time on the clock (hitting **Ready →** early) banks more speed bonus.

**Three sources must stay in sync:** the client fallback `DIFFICULTY_TABLE` (`gameStore.ts`), the server config `LEVEL_CONFIGS` (`supabase/functions/_shared/core/levelConfig.ts`), and the DB seed (`supabase/seed.sql`). When running against Supabase, the served durations come from the `levels` **DB table** — the seed uses `on conflict … do nothing`, so an existing DB must be re-seeded/migrated for new values to take effect. The three districts use the fictional slugs `the_hollows` / `the_stacks` / `the_grid` (renamed from the NYC slugs by migration `0009_gap_city_fictional_names.sql`); keep these in sync across `levelConfig.ts`, `seed.sql`, and the migrations.

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
- **Scoring philosophy:** Reward speed AND precision. Journey: per-component 0–100 score (completion 50 − 10·livesLost + time up to 50); unsolved = 0. Practice: per-round speed+efficiency bonuses; failed rounds score 0 for that round.
- **Lives:** 3 hearts per component/level. In Journey, a failed attempt replays the same puzzle (fresh clock); in Practice, a failed round costs a life and retries the same board.
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
