# Multi-Round Levels — Backbone (Plan 1 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a practice "level" into a **4-round mission** with the new 3-pillar scoring (Speed, Efficiency, Lives Remaining), pooled lives, and a per-round retry — all four rounds playing the existing **Basic** gameplay for now.

**Architecture:** Extend the Zustand store with level/round state and a per-round theme tag (Approach A from the spec). The four round themes ship incrementally; this plan implements only `basic`. Scoring is pure logic added to the shared `core/scoring.ts` alongside the existing single-round functions (which the Journey/server path still uses untouched). UI changes are localised to GameShell, CountdownPhase, ResolutionPhase, ScorePanel, and a new dashed-border overlay.

**Tech Stack:** React 18, Zustand 5 (`useShallow` for object selectors), Vitest + jsdom, Tailwind, framer-motion. Tests live under `tests/` mirroring source; shared engine is imported via the `@shared/*` alias.

**Spec:** `docs/superpowers/specs/2026-06-03-multi-round-themed-levels-design.md`

**Follow-on plans (not here):** Plan 2 Color-coded, Plan 3 Sequential, Plan 4 Flash Mob.

---

## File Structure

**Create:**
- `tests/core/levelScoring.test.ts` — tests for the new scoring primitives.
- `tests/store/gameStore.level.test.ts` — tests for the level/round state machine.
- `src/components/GapBorder.tsx` — overlay tracing a dashed monochrome border around each gap shape.
- `tests/components/GapBorder.test.tsx` — render test for the overlay.

**Modify:**
- `supabase/functions/_shared/core/scoring.ts` — add round/level scoring functions (additive; existing exports untouched).
- `supabase/functions/_shared/types.ts` — add `RoundTheme`, `RoundResult`, and new `GameState` fields.
- `src/store/gameStore.ts` — level/round state machine; per-round scoring in `submitSelection`; `startLevel` / `advanceRound`.
- `src/components/GameShell.tsx` — header shows "Round N of 4", lives, level score.
- `src/components/CountdownPhase.tsx` — title shows round-of-4 + theme label.
- `src/components/ViewingPhase.tsx` — mount `GapBorder` over the grid.
- `src/components/ResolutionPhase/index.tsx` — CTA + flow for next-round / level-complete / game-over / retry.
- `src/components/ResolutionPhase/ScorePanel.tsx` — drop Accuracy row; show Speed/Efficiency; level-complete summary with Lives bonus.

---

## Task 1: Scoring primitives (Speed, Efficiency, Lives, Level total, Stars)

**Files:**
- Modify: `supabase/functions/_shared/core/scoring.ts`
- Test: `tests/core/levelScoring.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/levelScoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  ROUND_PILLAR_MAX, LIVES_BONUS_MAX, MAX_LIVES, ROUNDS_PER_LEVEL, MAX_LEVEL_TOTAL,
  roundSpeed, roundEfficiency, scoreRound, livesBonus, levelStars, levelTotal,
} from '@shared/core/scoring'

describe('level scoring constants', () => {
  it('exposes the round/level maxes', () => {
    expect(ROUND_PILLAR_MAX).toEqual({ speed: 1000, efficiency: 1000 })
    expect(LIVES_BONUS_MAX).toBe(1000)
    expect(MAX_LIVES).toBe(3)
    expect(ROUNDS_PER_LEVEL).toBe(4)
    expect(MAX_LEVEL_TOTAL).toBe(9000) // 4*(1000+1000) + 1000
  })
})

describe('roundSpeed', () => {
  it('combined budget: fraction of total time remaining', () => {
    // 40% used => 60% remaining => 600
    expect(roundSpeed({ viewTimeRemaining: 6000, viewDuration: 10000, selectTimeRemaining: 0, selectDuration: 0 })).toBe(600)
    // weighted across both clocks: (3000+4500)/(5000+10000) = 0.5 => 500
    expect(roundSpeed({ viewTimeRemaining: 3000, viewDuration: 5000, selectTimeRemaining: 4500, selectDuration: 10000 })).toBe(500)
  })

  it('select-only (Flash Mob exception) ignores the view clock', () => {
    expect(roundSpeed({ viewTimeRemaining: 9999, viewDuration: 10000, selectTimeRemaining: 5700, selectDuration: 10000, selectOnly: true })).toBe(570)
  })

  it('is 0 when no time budget exists', () => {
    expect(roundSpeed({ viewTimeRemaining: 0, viewDuration: 0, selectTimeRemaining: 0, selectDuration: 0 })).toBe(0)
  })
})

describe('roundEfficiency', () => {
  it('matches the spec examples (min 5)', () => {
    expect(roundEfficiency(5, 5)).toBe(1000)  // 0 extra
    expect(roundEfficiency(5, 6)).toBe(800)   // 1 extra
    expect(roundEfficiency(5, 9)).toBe(200)   // 4 extra
    expect(roundEfficiency(5, 12)).toBe(-400) // 7 extra
  })

  it('clamps to [-1000, 1000]', () => {
    expect(roundEfficiency(5, 20)).toBe(-1000) // 15 extra => -2000 clamped
    expect(roundEfficiency(5, 0)).toBe(0)      // guard: zero pieces => 0
  })
})

describe('livesBonus', () => {
  it('floors at the spec values', () => {
    expect(livesBonus(3)).toBe(1000)
    expect(livesBonus(2)).toBe(666)
    expect(livesBonus(1)).toBe(333)
    expect(livesBonus(0)).toBe(0)
  })
})

describe('scoreRound', () => {
  it('sums speed + efficiency', () => {
    const r = scoreRound({
      viewTimeRemaining: 6000, viewDuration: 10000, selectTimeRemaining: 0, selectDuration: 0,
      minPieces: 5, selectedPieces: 6,
    })
    expect(r).toEqual({ speed: 600, efficiency: 800, total: 1400 })
  })
})

describe('levelTotal & levelStars', () => {
  it('sums round totals plus lives bonus, floored at 0', () => {
    expect(levelTotal([1400, 1400, 1400, 1400], 3)).toBe(6600) // 5600 + 1000
    expect(levelTotal([-1000, -1000, 0, 0], 1)).toBe(0)        // -2000 + 333 -> floored
  })

  it('stars from the level total / 9000 ratio', () => {
    expect(levelStars(9000)).toBe(3)
    expect(levelStars(6750)).toBe(3)  // 0.75
    expect(levelStars(6749)).toBe(2)
    expect(levelStars(4500)).toBe(2)  // 0.5
    expect(levelStars(4499)).toBe(1)
    expect(levelStars(0)).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/core/levelScoring.test.ts`
Expected: FAIL — `roundSpeed`/etc. are not exported.

- [ ] **Step 3: Add the implementation**

Append to `supabase/functions/_shared/core/scoring.ts`:

```ts
// ── Multi-round level scoring (Speed / Efficiency per round; Lives per level) ──
// Additive: the single-round scoreClear above is still used by the Journey
// server path until the multi-round port lands.

export const ROUND_PILLAR_MAX = { speed: 1000, efficiency: 1000 } as const
export const LIVES_BONUS_MAX = 1000
export const MAX_LIVES = 3
export const ROUNDS_PER_LEVEL = 4
export const MAX_LEVEL_TOTAL =
  ROUNDS_PER_LEVEL * (ROUND_PILLAR_MAX.speed + ROUND_PILLAR_MAX.efficiency) + LIVES_BONUS_MAX

const clampPillar = (n: number) => Math.max(-ROUND_PILLAR_MAX.efficiency, Math.min(ROUND_PILLAR_MAX.efficiency, n))

export interface RoundSpeedInput {
  viewTimeRemaining: number
  viewDuration: number
  selectTimeRemaining: number
  selectDuration: number
  /** Flash Mob: the viewing reveal is unskippable, so score Speed on the select clock only. */
  selectOnly?: boolean
}

/** Speed = 1000 × fraction of allotted time left (combined view+select budget). */
export function roundSpeed(i: RoundSpeedInput): number {
  const rem = i.selectOnly ? i.selectTimeRemaining : i.viewTimeRemaining + i.selectTimeRemaining
  const dur = i.selectOnly ? i.selectDuration : i.viewDuration + i.selectDuration
  if (dur <= 0) return 0
  return Math.round(ROUND_PILLAR_MAX.speed * (rem / dur))
}

/** Efficiency = 1000 × (1 − extra/min), extra = used − min, clamped to ±1000. Zero pieces ⇒ 0. */
export function roundEfficiency(minPieces: number, selectedPieces: number): number {
  if (selectedPieces === 0 || minPieces === 0) return 0
  const extra = selectedPieces - minPieces
  return clampPillar(Math.round(ROUND_PILLAR_MAX.speed * (1 - extra / minPieces)))
}

export interface RoundResult { speed: number; efficiency: number; total: number }

export function scoreRound(i: RoundSpeedInput & { minPieces: number; selectedPieces: number }): RoundResult {
  const speed = roundSpeed(i)
  const efficiency = roundEfficiency(i.minPieces, i.selectedPieces)
  return { speed, efficiency, total: speed + efficiency }
}

/** Lives bonus = floor(1000 × livesRemaining / 3): 3→1000, 2→666, 1→333, 0→0. */
export function livesBonus(livesRemaining: number): number {
  const lives = Math.max(0, Math.min(MAX_LIVES, livesRemaining))
  return Math.floor(LIVES_BONUS_MAX * lives / MAX_LIVES)
}

/** Sum of cleared round totals + lives bonus, floored at 0. */
export function levelTotal(roundTotals: number[], livesRemaining: number): number {
  const rounds = roundTotals.reduce((s, n) => s + n, 0)
  return Math.max(0, rounds + livesBonus(livesRemaining))
}

/** Stars from the level total / MAX_LEVEL_TOTAL ratio: ≥0.75→3, ≥0.5→2, else 1. */
export function levelStars(total: number): number {
  const ratio = total / MAX_LEVEL_TOTAL
  if (ratio >= 0.75) return 3
  if (ratio >= 0.5) return 2
  return 1
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/core/levelScoring.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/core/scoring.ts tests/core/levelScoring.test.ts
git commit -m "feat(scoring): round speed/efficiency + level lives bonus/total/stars"
```

---

## Task 2: Level/round types

**Files:**
- Modify: `supabase/functions/_shared/types.ts`
- Test: (covered by Task 3's store tests; no separate test — types only)

- [ ] **Step 1: Add the theme + result types**

In `supabase/functions/_shared/types.ts`, after the `RoundScore` interface (around line 68), add:

```ts
// ── Multi-round levels ────────────────────────────────────────────────────────

/** Themes are fixed by round position within a level. */
export type RoundTheme = 'basic' | 'colorCoded' | 'sequential' | 'flashMob'

/** The theme played at each round index. Theme plans (2–4) replace entries as
 *  each mechanic ships; until then every round plays Basic. */
export const THEME_SEQUENCE: RoundTheme[] = ['basic', 'basic', 'basic', 'basic']

export const THEME_LABEL: Record<RoundTheme, string> = {
  basic: 'Basic',
  colorCoded: 'Color-coded',
  sequential: 'Sequential',
  flashMob: 'Flash Mob',
}
```

- [ ] **Step 2: Extend `GameState`**

In the same file, inside `interface GameState` (around lines 102–121), add these fields after `difficulty`:

```ts
  // ── Multi-round level state (practice mode) ──
  roundIndex: number            // 0..ROUNDS_PER_LEVEL-1; which round of the level
  roundTheme: RoundTheme        // theme for the current round
  livesRemaining: number        // 3 pooled across the level; a FAIL decrements, a clear does not
  roundResults: number[]        // cleared round totals so far (drives the level total)
  levelComplete: boolean        // true once all rounds are cleared
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: FAILs only in `gameStore.ts` (INITIAL_STATE missing the new fields) — that is fixed in Task 3. No errors in `types.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/types.ts
git commit -m "feat(types): RoundTheme, THEME_SEQUENCE, and level state fields"
```

---

## Task 3: Level/round state machine in the store

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.level.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/store/gameStore.level.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../../src/store/gameStore'
import { THEME_SEQUENCE } from '@shared/types'

const store = () => useGameStore.getState()

describe('level/round state machine', () => {
  beforeEach(() => store().resetGame())

  it('startLevel initialises round 0, full lives, empty results', () => {
    store().startLevel()
    const s = store()
    expect(s.phase).toBe('countdown')
    expect(s.roundIndex).toBe(0)
    expect(s.roundTheme).toBe(THEME_SEQUENCE[0])
    expect(s.livesRemaining).toBe(3)
    expect(s.roundResults).toEqual([])
    expect(s.levelComplete).toBe(false)
    expect(s.grid.length).toBeGreaterThan(0)
  })

  it('advanceRound after a clear moves to the next round and keeps lives', () => {
    store().startLevel()
    // simulate a cleared round result
    useGameStore.setState({ roundScore: { accuracy: 0, speedBonus: 600, efficiencyBonus: 800, attemptsBonus: 0, stars: 0, total: 1400 } })
    store().advanceRound()
    const s = store()
    expect(s.roundIndex).toBe(1)
    expect(s.roundResults).toEqual([1400])
    expect(s.livesRemaining).toBe(3)
    expect(s.phase).toBe('countdown')
    expect(s.levelComplete).toBe(false)
  })

  it('advanceRound on the final round completes the level and adds the lives bonus', () => {
    store().startLevel()
    useGameStore.setState({ roundIndex: 3, roundResults: [1400, 1400, 1400], livesRemaining: 3,
      roundScore: { accuracy: 0, speedBonus: 600, efficiencyBonus: 800, attemptsBonus: 0, stars: 0, total: 1400 } })
    store().advanceRound()
    const s = store()
    expect(s.levelComplete).toBe(true)
    expect(s.roundResults).toEqual([1400, 1400, 1400, 1400])
    // score = 5600 + livesBonus(3)=1000
    expect(s.score).toBe(6600)
  })

  it('loseLife decrements and reports game over at zero', () => {
    store().startLevel()
    store().loseLife(); expect(store().livesRemaining).toBe(2)
    store().loseLife(); expect(store().livesRemaining).toBe(1)
    store().loseLife()
    expect(store().livesRemaining).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/store/gameStore.level.test.ts`
Expected: FAIL — `startLevel`, `advanceRound`, `loseLife` are not defined.

- [ ] **Step 3: Implement the state machine**

In `src/store/gameStore.ts`:

(a) Update imports at the top to add the new scoring + types:

```ts
import type {
  GameState, PieceType,
  DifficultyConfig, Placement, Resolution, ResolutionReason, RoundTheme,
} from '@shared/types'
import { THEME_SEQUENCE } from '@shared/types'
import { scoreRound, livesBonus, ROUNDS_PER_LEVEL, MAX_LIVES } from '@shared/core/scoring'
```

(b) Add the new actions to the `GameStore` interface (after `newGame`):

```ts
  startLevel: () => void
  advanceRound: () => void
  loseLife: () => void
```

(c) Extend `INITIAL_STATE` with the new fields (after `difficulty: DIFFICULTY_TABLE[0]`):

```ts
  roundIndex: 0,
  roundTheme: THEME_SEQUENCE[0],
  livesRemaining: MAX_LIVES,
  roundResults: [],
  levelComplete: false,
```

(d) Add the actions inside the store (place them just after `startGame`):

```ts
  startLevel: () => {
    set({
      mode: get().mode,
      roundIndex: 0,
      roundTheme: THEME_SEQUENCE[0],
      livesRemaining: MAX_LIVES,
      roundResults: [],
      levelComplete: false,
      score: 0,
    })
    get().startGame()
  },

  // CTA after a cleared round: bank the round total, then either start the next
  // round or finish the level (adding the lives bonus to the score).
  advanceRound: () => {
    const { roundScore, roundResults, roundIndex, livesRemaining } = get()
    const banked = [...roundResults, roundScore?.total ?? 0]
    const nextIndex = roundIndex + 1
    if (nextIndex >= ROUNDS_PER_LEVEL) {
      const total = banked.reduce((s, n) => s + n, 0) + livesBonus(livesRemaining)
      set({ roundResults: banked, levelComplete: true, score: Math.max(0, total) })
      return
    }
    set({
      roundResults: banked,
      roundIndex: nextIndex,
      roundTheme: THEME_SEQUENCE[nextIndex],
      score: Math.max(0, banked.reduce((s, n) => s + n, 0)),
    })
    get().startGame()
  },

  loseLife: () => set(state => ({ livesRemaining: Math.max(0, state.livesRemaining - 1) })),
```

(e) Update `startPractice` to start a level instead of a single round:

```ts
  startPractice: () => {
    set({ mode: 'practice' })
    get().startLevel()
  },
```

(f) In `startGame`, set `roundTheme` from the current `roundIndex` so a same-round regeneration keeps the theme. Change the `set({...})` block in `startGame` to also include:

```ts
      roundTheme: THEME_SEQUENCE[get().roundIndex],
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/store/gameStore.level.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full store suite for regressions**

Run: `npm run test -- tests/store/`
Expected: PASS (existing tests unaffected; `score` now resets in `startLevel`).

- [ ] **Step 6: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.level.test.ts
git commit -m "feat(store): level/round state machine (startLevel, advanceRound, loseLife)"
```

---

## Task 4: Wire per-round scoring and the fail path into `submitSelection`

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.level.test.ts` (extend)

- [ ] **Step 1: Add the failing tests**

Append to `tests/store/gameStore.level.test.ts` inside the top `describe`:

```ts
  it('a perfect clear scores Speed+Efficiency only (no accuracy/attempts)', () => {
    store().startLevel()
    store().beginViewing()
    store().endViewing()
    // Pick exactly the pieces the generated gaps need by reading them off the board.
    const gaps = store().gaps
    for (const g of gaps) store().incrementSelection(g.pieceType)
    store().submitSelection()
    const rs = store().roundScore!
    expect(rs.accuracy).toBe(0)
    expect(rs.attemptsBonus).toBe(0)
    expect(rs.total).toBe(rs.speedBonus + rs.efficiencyBonus)
    expect(store()._resolution!.kind).toBe('perfect')
  })

  it('a failed selection spends a life and yields a partial resolution', () => {
    store().startLevel()
    store().beginViewing()
    store().endViewing()
    // Deliberately under-select: pick nothing, submit.
    store().submitSelection()
    expect(store().livesRemaining).toBe(2)
    expect(store()._resolution!.kind).toBe('partial')
  })

  it('failing with the last life leaves zero lives (game over)', () => {
    store().startLevel()
    useGameStore.setState({ livesRemaining: 1 })
    store().beginViewing(); store().endViewing()
    store().submitSelection()
    expect(store().livesRemaining).toBe(0)
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/store/gameStore.level.test.ts`
Expected: FAIL — perfect clear still sets `accuracy: 800`/`attemptsBonus`, and a fail does not decrement `livesRemaining`.

- [ ] **Step 3: Rewrite `submitSelection` scoring**

Replace the body of `submitSelection` in `src/store/gameStore.ts`. The selection tally and `solve` call are unchanged; replace the **scoring** of both branches:

```ts
  submitSelection: () => {
    const { selection, grid, gaps, difficulty, phaseStartTime, viewTimeRemaining, roundTheme } = get()

    const pieceCount: Partial<Record<PieceType, number>> = {}
    for (const entry of selection) {
      if (entry.freeCount > 0) pieceCount[entry.pieceType] = (pieceCount[entry.pieceType] ?? 0) + entry.freeCount
    }

    const result = solve(pieceCount, grid, gaps)
    const selectElapsed = Date.now() - phaseStartTime
    const selectTimeRemaining = Math.max(0, difficulty.selectDuration - selectElapsed)

    if (result.solvable) {
      const minPieces = gaps.length
      const selectedPieces = Object.values(pieceCount).reduce((s, n) => s + (n ?? 0), 0)
      const r = scoreRound({
        viewTimeRemaining, viewDuration: difficulty.viewDuration,
        selectTimeRemaining, selectDuration: difficulty.selectDuration,
        minPieces, selectedPieces,
        selectOnly: roundTheme === 'flashMob',
      })
      set({
        phase: 'resolving',
        _resolution: { kind: 'perfect', placements: result.placements ?? [], coverage: 1 },
        roundScore: { accuracy: 0, speedBonus: r.speed, efficiencyBonus: r.efficiency, attemptsBonus: 0, stars: 0, total: r.total },
      })
    } else {
      const fit = bestFit(pieceCount, grid)
      const coverage = fit.totalCells === 0 ? 0 : fit.filledCells / fit.totalCells
      const uncovered = fit.totalCells - fit.filledCells
      const selectedCells = Object.entries(pieceCount)
        .reduce((sum, [type, n]) => sum + (n ?? 0) * (type === 'SINGLE' ? 1 : 4), 0)
      let reason: ResolutionReason
      if (uncovered === 0) reason = 'too-many'
      else if (selectedCells >= fit.totalCells) reason = 'wrong-shapes'
      else reason = Math.max(1, Math.round(uncovered / 4)) === 1 ? 'missed-one' : 'missed-many'

      // A failed round spends one pooled life (retry replays the same board).
      get().loseLife()
      set({
        phase: 'resolving',
        _resolution: { kind: 'partial', placements: fit.placements, coverage, reason },
        roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
      })
    }
  },
```

> Note: `triesUsed`/`maxTries` are no longer touched by practice scoring; lives are tracked by `livesRemaining`. Leave the fields in `GameState` (the Journey path still uses them) — they are simply unused in the practice level flow.

- [ ] **Step 4: Run to verify passing**

Run: `npm run test -- tests/store/gameStore.level.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.level.test.ts
git commit -m "feat(store): score rounds with Speed+Efficiency; failed round spends a life"
```

---

## Task 5: GameShell header — "Round N of 4", lives, level score

**Files:**
- Modify: `src/components/GameShell.tsx`
- Test: `tests/components/GameShell.test.tsx` (extend if present; otherwise add a focused assertion)

- [ ] **Step 1: Add a failing assertion**

Append to `tests/components/GameShell.test.tsx` (import `useGameStore` from `../../src/store/gameStore` and `render`/`screen` from `@testing-library/react` as the existing file does):

```ts
it('shows round-of-4 and pooled lives in practice level mode', () => {
  useGameStore.setState({ mode: 'practice', phase: 'viewing', roundIndex: 1, livesRemaining: 2, score: 1400, levelComplete: false })
  render(<GameShell />)
  expect(screen.getByText(/ROUND/i)).toBeInTheDocument()
  expect(screen.getByText(/2\s*\/\s*4|2 OF 4/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/components/GameShell.test.tsx`
Expected: FAIL — header still renders the single-round `ROUND {round}`.

- [ ] **Step 3: Update the header selector + markup**

In `src/components/GameShell.tsx`, add `roundIndex`, `livesRemaining`, `levelComplete` to the `useShallow` selector, and replace the practice branch of the metadata span and the `<Hearts>` line:

```tsx
  const { phase, paused, round, score, triesUsed, maxTries, roundIndex, livesRemaining, phaseStartTime, phaseDuration, mode, levelDisplayNumber, levelName, submitting } =
    useGameStore(useShallow(s => ({
      phase: s.phase, paused: s.paused, round: s.round, score: s.score,
      triesUsed: s.triesUsed, maxTries: s.maxTries,
      roundIndex: s.roundIndex, livesRemaining: s.livesRemaining,
      phaseStartTime: s.phaseStartTime, phaseDuration: s.phaseDuration,
      mode: s.mode, levelDisplayNumber: s.levelDisplayNumber, levelName: s.levelName,
      submitting: s.submitting,
    })))
```

Replace the metadata `<span>` (lines ~51–55) with:

```tsx
        <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-neon-cyan">
          {mode === 'journey'
            ? <strong className="text-white">{levelName ?? `LEVEL ${levelDisplayNumber}`}</strong>
            : <>ROUND <strong className="text-white">{roundIndex + 1} / 4</strong></>}
        </span>
```

Replace the `<Hearts ... />` line with a mode-aware lives count (journey keeps the old derivation; practice uses `livesRemaining`):

```tsx
        <Hearts count={mode === 'journey' ? maxTries - triesUsed + 1 : livesRemaining} total={maxTries} />
```

- [ ] **Step 4: Run to verify passing**

Run: `npm run test -- tests/components/GameShell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameShell.tsx tests/components/GameShell.test.tsx
git commit -m "feat(shell): header shows round-of-4 and pooled lives in level mode"
```

---

## Task 6: CountdownPhase title — round-of-4 + theme label

**Files:**
- Modify: `src/components/CountdownPhase.tsx`

- [ ] **Step 1: Update the selector + title**

In `src/components/CountdownPhase.tsx`, extend the selector and title. Replace the `useGameStore(...)` block and the `<motion.h2>` text:

```tsx
import { THEME_LABEL } from '@shared/types'
// ...
  const { roundIndex, roundTheme, mode, beginViewing } = useGameStore(useShallow(s => ({
    roundIndex: s.roundIndex,
    roundTheme: s.roundTheme,
    mode: s.mode,
    beginViewing: s.beginViewing,
  })))
```

Replace the heading content (currently `Round {round}`):

```tsx
        {mode === 'journey' ? `Round ${useGameStore.getState().round}` : `Round ${roundIndex + 1} · ${THEME_LABEL[roundTheme]}`}
```

> The theme label reads "Basic" for all four rounds until Plans 2–4 populate `THEME_SEQUENCE`.

- [ ] **Step 2: Type-check + run countdown-related tests**

Run: `npx tsc --noEmit` then `npm run test -- tests/components/`
Expected: PASS / no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CountdownPhase.tsx
git commit -m "feat(countdown): title shows round-of-4 and theme label"
```

---

## Task 7: ResolutionPhase flow — next round / level complete / game over / retry

**Files:**
- Modify: `src/components/ResolutionPhase/index.tsx`

- [ ] **Step 1: Replace the CTA logic (practice level mode)**

In `src/components/ResolutionPhase/index.tsx`, add `roundIndex`, `livesRemaining`, `levelComplete`, `advanceRound` to the `useShallow` selector (keep the existing journey fields). Then replace the CTA block (lines ~173–183) with level-aware logic. For `mode === 'practice'`:

```tsx
  // ── Practice level CTAs ──
  // Clear  → not last round: "Next Round →" (advanceRound)
  //        → last round:      "Level Complete →" (advanceRound sets levelComplete)
  // Fail   → lives left:      "Try Again ↺" (retryRound, same board)
  //        → no lives:        "Game Over →" (newGame)
  const isLastRound = roundIndex >= 3
  const outOfLives = livesRemaining <= 0

  const ctaVariant: 'next' | 'retry' | 'newgame' =
    !isFailure ? 'next' : outOfLives ? 'newgame' : 'retry'
  const ctaLabel =
    !isFailure ? (isLastRound ? 'Level Complete →' : 'Next Round →')
      : outOfLives ? 'Game Over →'
      : 'Try Again ↺'
  const handleCta = () => {
    if (!isFailure) advanceRound()       // banks the round; completes level on the last round
    else if (outOfLives) newGame()
    else retryRound()
  }
```

> Keep the existing journey-mode behavior (the component already calls `showResults()` for journey before reaching the CTA). This block only governs `mode === 'practice'`. Guard by leaving the journey path that runs in the `useEffect`s untouched.

- [ ] **Step 2: Add a level-complete results hop**

When `levelComplete` becomes true after `advanceRound`, route to the results/scoring view. In the `handleCta` for the last round, after `advanceRound()`, read the fresh state and navigate:

```tsx
  const handleCta = () => {
    if (!isFailure) {
      advanceRound()
      if (useGameStore.getState().levelComplete) showResults()
    } else if (outOfLives) {
      showResults()
    } else {
      retryRound()
    }
  }
```

> `showResults` is already imported (`useNavStore(s => s.showResults)`). The Results screen reads `score` + computes `levelStars(score)` — wire that in Task 8.

- [ ] **Step 3: Type-check + run resolution tests**

Run: `npx tsc --noEmit` then `npm run test -- tests/components/ResolutionPhase.test.tsx`
Expected: PASS / no type errors. If the existing test asserts old CTA labels for practice, update those assertions to the new labels ("Next Round →" remains; "Start New Game" → "Game Over →").

- [ ] **Step 4: Commit**

```bash
git add src/components/ResolutionPhase/index.tsx tests/components/ResolutionPhase.test.tsx
git commit -m "feat(resolution): level-aware CTAs (next round / level complete / game over)"
```

---

## Task 8: ScorePanel — drop Accuracy; show Speed/Efficiency; lives bonus on level complete

**Files:**
- Modify: `src/components/ResolutionPhase/ScorePanel.tsx`

- [ ] **Step 1: Remove the Accuracy row, keep Speed + Efficiency**

In `src/components/ResolutionPhase/ScorePanel.tsx`, delete the Accuracy `<Row>` (line 41) and the `ACCURACY_ICON` usage, and re-time the remaining rows so Speed is first:

```tsx
      {!isFailure && (
        <Row icon={speedSlow ? '🐢' : '⚡'} label="Speed" value={roundScore.speedBonus} delay={0} color={speedSlow ? 'text-gray-400' : 'text-neon-yellow'} />
      )}
      {!isFailure && (
        <Row icon="◆" label="Efficiency" value={roundScore.efficiencyBonus} delay={ROW_STAGGER} color="text-neon-cyan" />
      )}
```

Remove the `accuracyTier` prop and `ACCURACY_ICON` const (no longer used). Update the `Props` interface to drop `accuracyTier`, and update the caller in `ResolutionPhase/index.tsx` to stop passing it. On a **failure**, show no pillar rows (the round total is 0); keep the Round Total / Grand Total footer.

- [ ] **Step 2: Show the Lives bonus on level complete**

Add an optional `livesBonus?: number` prop. When provided (level complete), render a Lives row above the totals:

```tsx
      {livesBonus !== undefined && (
        <Row icon="♥" label="Lives Bonus" value={livesBonus} delay={ROW_STAGGER * 2} color="text-neon-red" />
      )}
```

In `ResolutionPhase/index.tsx`, pass `livesBonus={levelComplete ? livesBonusFor(livesRemaining) : undefined}` where `livesBonusFor` is imported as `livesBonus` from `@shared/core/scoring` (alias to avoid prop/name clash):

```tsx
import { livesBonus as livesBonusFor } from '@shared/core/scoring'
```

- [ ] **Step 3: Type-check + run tests**

Run: `npx tsc --noEmit` then `npm run test -- tests/components/`
Expected: PASS. Update any ScorePanel/ResolutionPhase test that asserts the Accuracy row to assert Speed/Efficiency instead.

- [ ] **Step 4: Commit**

```bash
git add src/components/ResolutionPhase/ScorePanel.tsx src/components/ResolutionPhase/index.tsx tests/components/
git commit -m "feat(score-panel): drop Accuracy row; show Speed/Efficiency + Lives bonus"
```

---

## Task 9: Dashed monochrome gap-border overlay

**Files:**
- Create: `src/components/GapBorder.tsx`
- Create: `tests/components/GapBorder.test.tsx`
- Modify: `src/components/ViewingPhase.tsx`

The gap is a set of `empty` cells. To trace a dashed border around the *shape* (not each cell), draw, per gap cell, only the edges that face a non-gap neighbour. Cell geometry matches `Grid.tsx`: 28px cells, 2px gap, 12px (`p-3`) padding.

- [ ] **Step 1: Write the failing render test**

Create `tests/components/GapBorder.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GapBorder } from '../../src/components/GapBorder'
import type { Gap } from '@shared/types'

const oGap: Gap = {
  pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
  cells: [[0, 0], [0, 1], [1, 0], [1, 1]],
}

describe('GapBorder', () => {
  it('renders one dashed outline element per gap', () => {
    const { container } = render(<GapBorder gaps={[oGap]} />)
    expect(container.querySelectorAll('[data-gap-border]').length).toBe(1)
  })

  it('renders nothing when there are no gaps', () => {
    const { container } = render(<GapBorder gaps={[]} />)
    expect(container.querySelectorAll('[data-gap-border]').length).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/components/GapBorder.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the overlay**

Create `src/components/GapBorder.tsx`:

```tsx
import type { Gap } from '@shared/types'

const CELL = 28
const GAP = 2
const PAD = 12
const STEP = CELL + GAP

// Pixel offset of a cell's top-left within the Grid's padded box.
const px = (i: number) => PAD + i * STEP

interface Props {
  gaps: Gap[]
  /** Tailwind border color class for the dashed outline (monochrome by default). */
  colorClass?: string
}

/**
 * Absolutely-positioned overlay that traces a dashed border around each gap
 * shape. Sits inside ViewingPhase's relative grid wrapper, above the Grid.
 * For each gap cell we draw only the edges that face a cell NOT in the gap, so
 * the outline hugs the tetromino silhouette rather than boxing each cell.
 */
export function GapBorder({ gaps, colorClass = 'border-gray-300/70' }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {gaps.map((gap, gi) => {
        const inGap = new Set(gap.cells.map(([r, c]) => `${r},${c}`))
        return (
          <div key={gi} data-gap-border>
            {gap.cells.map(([r, c]) => {
              const edges: string[] = []
              if (!inGap.has(`${r - 1},${c}`)) edges.push('border-t-2')
              if (!inGap.has(`${r + 1},${c}`)) edges.push('border-b-2')
              if (!inGap.has(`${r},${c - 1}`)) edges.push('border-l-2')
              if (!inGap.has(`${r},${c + 1}`)) edges.push('border-r-2')
              return (
                <div
                  key={`${r},${c}`}
                  className={`absolute border-dashed ${colorClass} ${edges.join(' ')}`}
                  style={{ left: px(c), top: px(r), width: CELL, height: CELL }}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify passing**

Run: `npm run test -- tests/components/GapBorder.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount it in ViewingPhase**

In `src/components/ViewingPhase.tsx`, import and render `GapBorder` inside the relative grid wrapper, alongside `GapShimmer`:

```tsx
import { GapBorder } from './GapBorder'
// ...
        <Grid cellRef={/* unchanged */} />
        <GapBorder gaps={gaps} />
        <GapShimmer containerRef={gridWrapRef} cellRects={cellRects} gaps={gaps} />
```

- [ ] **Step 6: Run the component suite + commit**

Run: `npm run test -- tests/components/`
Expected: PASS.

```bash
git add src/components/GapBorder.tsx tests/components/GapBorder.test.tsx src/components/ViewingPhase.tsx
git commit -m "feat(viewing): dashed monochrome border tracing each gap shape"
```

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors (fix any unused imports left from the Accuracy removal).

- [ ] **Step 3: Build (catches `noUnusedLocals`)**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Full test suite**

Run: `npm run test`
Expected: all pass.

- [ ] **Step 5: Manual smoke (per CLAUDE.md)**

Run: `npm run dev`, open http://localhost:5173, enter Practice via the menu. Verify: 4 rounds play in sequence; header reads "ROUND 1/4 … 4/4"; gaps show a dashed border; clearing a round advances; failing spends a heart and offers "Try Again ↺"; clearing round 4 shows a Lives Bonus and routes to results; losing all 3 lives offers "Game Over →".

- [ ] **Step 6: Commit any lint/build fixups**

```bash
git add -A
git commit -m "chore: lint/build fixups for multi-round backbone"
```

---

## Self-Review notes (author)

- **Spec coverage:** §2 level/lives (Tasks 3–4, 7), §3 state machine (Task 3), §4 scoring incl. Flash Mob select-only flag and floors (Task 1, used in Task 4), §5 Basic dashed border (Task 9), §8 GameShell/Countdown/Resolution/ScorePanel (Tasks 5–8). Color-coded/Sequential/Flash Mob mechanics (§5) and the token-cart (§6) are **deferred to Plans 2–4** by design — the `selectOnly` Speed flag and `RoundTheme`/`THEME_SEQUENCE` scaffolding are landed here so those plans are pure additions.
- **Deferred to Plans 2–4:** `Gap.color`/`Gap.order` fields, token-cart, theme-specific generation, FlashReveal, colored/queue menus, populating `THEME_SEQUENCE` with the real themes.
- **Type consistency:** `RoundResult`, `roundSpeed`/`roundEfficiency`/`scoreRound`/`livesBonus`/`levelTotal`/`levelStars`, and the `selectOnly` flag are named identically across Tasks 1, 4, 8.
- **Known follow-up:** the Results screen (`ResultsScreen.tsx`) should display `levelStars(score)` for practice level-complete; verify its current props during Task 7/8 and wire if needed (it already renders a score for journey).
