# Journey Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each Journey level from a forced 4-round gauntlet into a level hub page with one completing "main" puzzle and four opt-in badges, scored 0–100 per component (completion 65 + speed 35) toward a 0–500 level total and 0–5 stars.

**Architecture:** Add new *single-puzzle* journey machinery alongside the existing Practice gauntlet (which stays untouched — Training is a separate future effort). Components (`main · colors · inSequence · flash · riddle`) are a **client-side concept** that maps the four playable ones onto the existing engine `RoundTheme`s; `riddle` is a non-playable placeholder and never enters the engine. New scoring + per-component records are pure/client modules persisted to localStorage. The existing catalog RPCs (`get_journey` / `get_level`) are reused as-is; the global record is mocked.

**Tech Stack:** React + TypeScript, Zustand 5 (use `useShallow` for object selectors), Vitest + jsdom, Tailwind (arcade theme via `src/components/ui`). Tests live in `tests/**` mirroring `src/**`; alias `@shared` → `supabase/functions/_shared`.

---

## Spec reference

`docs/superpowers/specs/2026-06-08-journey-rework-design.md`

## Conventions (read before starting)

- Run tests: `npm run test`. Type/lint gate: `npm run build` then `npm run lint`. **Run npm/npx as their own Bash calls — never chain with `&&`** (an nvm shell quirk breaks chained commands).
- Zustand object selectors MUST use `useShallow` (see CLAUDE.md). Single-value selectors don't.
- Match arcade styling by mirroring existing components (`NeonButton`, `ArcadePanel`, `ScanlineOverlay`, `Wordmark`, `LockIcon` from `src/components/ui`).
- Commit after each task (TDD red → green → commit).

## File structure (created / modified)

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/components.ts` | `ComponentKey` union, `COMPONENT_THEME` map, ordered `LEVEL_COMPONENTS`, labels | Create |
| `src/lib/journeyScoring.ts` | Pure scoring: `componentScore`, `levelStarsFromTotal`, `difficultyPips`, `sumBests`, `mockGlobalRecord` | Create |
| `src/store/progressStore.ts` | localStorage-backed per-component best scores + selectors | Create |
| `src/store/gameStore.ts` | Add `activeComponent`/`livesLost`; `startComponent`, `replayComponent`; journey single-play `submitSelection` branch | Modify |
| `src/store/navStore.ts` | `levelOrder`, `setLevelOrder`, `goNextLevel`; `levelDetail` view renders the hub page | Modify |
| `supabase/functions/_shared/types.ts` | `activeComponent`/`livesLost` on `GameState` | Modify |
| `src/components/LevelScreen.tsx` | The level hub page (replaces the modal) | Create |
| `src/components/LevelDetailScreen.tsx` | — | Delete (replaced by LevelScreen) |
| `src/components/ResolutionPhase/index.tsx` | Journey single-play CTAs (Play Again / Back to Level / Next Level) + per-component result | Modify |
| `src/components/ResolutionPhase/ComponentScorePanel.tsx` | Per-component breakdown (base / speed / total / level total / stars) | Create |
| `src/components/GameShell.tsx` | Journey header: component name + lives (no "round n/4") | Modify |
| `src/App.tsx` | Route `levelDetail` → `LevelScreen` | Modify |
| `src/components/JourneyScreen.tsx` | Publish `levelOrder` to navStore on load | Modify |
| `CLAUDE.md` | Update stale Round-loop / Scoring sections | Modify |

---

## Task 1: Component vocabulary (`src/lib/components.ts`)

**Files:**
- Create: `src/lib/components.ts`
- Test: `tests/lib/components.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/components.test.ts
import { describe, it, expect } from 'vitest'
import { LEVEL_COMPONENTS, COMPONENT_THEME, COMPONENT_LABEL, isPlayable } from '../../src/lib/components'

describe('level components', () => {
  it('lists all five components in display order, main first', () => {
    expect(LEVEL_COMPONENTS).toEqual(['main', 'colors', 'inSequence', 'flash', 'riddle'])
  })
  it('maps the four playable components onto engine themes', () => {
    expect(COMPONENT_THEME.main).toBe('basic')
    expect(COMPONENT_THEME.colors).toBe('colorCoded')
    expect(COMPONENT_THEME.inSequence).toBe('sequential')
    expect(COMPONENT_THEME.flash).toBe('flashMob')
  })
  it('marks riddle as not playable, the rest playable', () => {
    expect(isPlayable('main')).toBe(true)
    expect(isPlayable('flash')).toBe(true)
    expect(isPlayable('riddle')).toBe(false)
  })
  it('has a human label for every component', () => {
    for (const c of LEVEL_COMPONENTS) expect(COMPONENT_LABEL[c]).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/components.test.ts`
Expected: FAIL — cannot find module `src/lib/components`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/components.ts
import type { RoundTheme } from '@shared/types'

/** A playable puzzle within a level. `riddle` is a placeholder (not yet playable). */
export type ComponentKey = 'main' | 'colors' | 'inSequence' | 'flash' | 'riddle'
export type PlayableComponent = Exclude<ComponentKey, 'riddle'>

/** Display order on the level hub (main first, then the four badges). */
export const LEVEL_COMPONENTS: ComponentKey[] = ['main', 'colors', 'inSequence', 'flash', 'riddle']

/** The four badge components (everything except the main puzzle). */
export const BADGE_COMPONENTS: ComponentKey[] = ['colors', 'inSequence', 'flash', 'riddle']

/** Map each playable component onto the existing engine theme. */
export const COMPONENT_THEME: Record<PlayableComponent, RoundTheme> = {
  main: 'basic',
  colors: 'colorCoded',
  inSequence: 'sequential',
  flash: 'flashMob',
}

export const COMPONENT_LABEL: Record<ComponentKey, string> = {
  main: 'Main',
  colors: 'Colors',
  inSequence: 'In-Sequence',
  flash: 'Flash',
  riddle: 'Riddle',
}

export function isPlayable(c: ComponentKey): c is PlayableComponent {
  return c !== 'riddle'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/components.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components.ts tests/lib/components.test.ts
git commit -m "feat(journey): add level component vocabulary"
```

---

## Task 2: Journey scoring (`src/lib/journeyScoring.ts`)

**Files:**
- Create: `src/lib/journeyScoring.ts`
- Test: `tests/lib/journeyScoring.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/journeyScoring.test.ts
import { describe, it, expect } from 'vitest'
import {
  componentScore, levelStarsFromTotal, difficultyPips, sumBests, mockGlobalRecord,
} from '../../src/lib/journeyScoring'

describe('componentScore', () => {
  it('returns 0 when unsolved', () => {
    expect(componentScore({ solved: false, livesLost: 0, consumed: 0, allotted: 1000 })).toBe(0)
  })
  it('the 97 example: no lives lost, 10% consumed → ceil(65 + 31.5) = 97', () => {
    expect(componentScore({ solved: true, livesLost: 0, consumed: 100, allotted: 1000 })).toBe(97)
  })
  it('subtracts 10 per life lost from the base', () => {
    // 1 life lost, 0% consumed → ceil(55 + 35) = 90
    expect(componentScore({ solved: true, livesLost: 1, consumed: 0, allotted: 1000 })).toBe(90)
    // 2 lives lost, 0% consumed → ceil(45 + 35) = 80
    expect(componentScore({ solved: true, livesLost: 2, consumed: 0, allotted: 1000 })).toBe(80)
  })
  it('caps at 100 and floors speed at 0', () => {
    expect(componentScore({ solved: true, livesLost: 0, consumed: 0, allotted: 1000 })).toBe(100)
    expect(componentScore({ solved: true, livesLost: 0, consumed: 5000, allotted: 1000 })).toBe(65)
  })
  it('treats a zero/negative allotted as fully consumed (speed 0)', () => {
    expect(componentScore({ solved: true, livesLost: 0, consumed: 0, allotted: 0 })).toBe(65)
  })
})

describe('levelStarsFromTotal', () => {
  it('is 0 when main is not solved, regardless of total', () => {
    expect(levelStarsFromTotal(300, false)).toBe(0)
  })
  it('maps totals to stars at the tier boundaries', () => {
    expect(levelStarsFromTotal(1, true)).toBe(1)     // main solved, below 150
    expect(levelStarsFromTotal(149, true)).toBe(1)
    expect(levelStarsFromTotal(150, true)).toBe(2)
    expect(levelStarsFromTotal(250, true)).toBe(3)
    expect(levelStarsFromTotal(350, true)).toBe(4)
    expect(levelStarsFromTotal(450, true)).toBe(5)
    expect(levelStarsFromTotal(500, true)).toBe(5)
  })
})

describe('difficultyPips', () => {
  it('buckets gapCount into 1..5', () => {
    expect(difficultyPips(3)).toBe(1)
    expect(difficultyPips(4)).toBe(1)
    expect(difficultyPips(5)).toBe(2)
    expect(difficultyPips(7)).toBe(2)
    expect(difficultyPips(8)).toBe(3)
    expect(difficultyPips(10)).toBe(3)
    expect(difficultyPips(11)).toBe(4)
    expect(difficultyPips(13)).toBe(4)
    expect(difficultyPips(14)).toBe(5)
    expect(difficultyPips(16)).toBe(5)
  })
  it('clamps out-of-range inputs', () => {
    expect(difficultyPips(1)).toBe(1)
    expect(difficultyPips(99)).toBe(5)
  })
})

describe('sumBests', () => {
  it('sums all five component bests', () => {
    expect(sumBests({ main: 97, colors: 80, inSequence: 0, flash: 50, riddle: 0 })).toBe(227)
  })
})

describe('mockGlobalRecord', () => {
  it('is deterministic per level and within a plausible band (300..500)', () => {
    const a = mockGlobalRecord('level-7')
    expect(mockGlobalRecord('level-7')).toBe(a)
    expect(a).toBeGreaterThanOrEqual(300)
    expect(a).toBeLessThanOrEqual(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/journeyScoring.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/journeyScoring.ts
import type { ComponentKey } from './components'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export const COMPLETION_BASE = 65
export const LIFE_PENALTY = 10
export const SPEED_MAX = 35
export const COMPONENT_MAX = 100
export const COMPONENT_COUNT = 5
export const LEVEL_MAX = COMPONENT_MAX * COMPONENT_COUNT // 500

export interface ComponentScoreInput {
  solved: boolean
  /** Wrong submissions before the successful one (0, 1, or 2). */
  livesLost: number
  /** Time consumed on the successful attempt (ms). */
  consumed: number
  /** Full time budget for the attempt (ms): view+select, or select-only for flash. */
  allotted: number
}

/** base(65 − 10·livesLost) + speed(35·(1 − consumed/allotted)), ceil, 0..100; 0 if unsolved. */
export function componentScore(i: ComponentScoreInput): number {
  if (!i.solved) return 0
  const base = COMPLETION_BASE - LIFE_PENALTY * clamp(i.livesLost, 0, 2)
  const fraction = i.allotted > 0 ? clamp(i.consumed / i.allotted, 0, 1) : 1
  const speed = SPEED_MAX * (1 - fraction)
  return clamp(Math.ceil(base + speed), 0, COMPONENT_MAX)
}

export type ComponentBests = Record<ComponentKey, number>

export function sumBests(b: ComponentBests): number {
  return b.main + b.colors + b.inSequence + b.flash + b.riddle
}

/** 0 if main unsolved; else 1 (main solved) rising by tier: 150/250/350/450 → 2/3/4/5. */
export function levelStarsFromTotal(total: number, mainSolved: boolean): number {
  if (!mainSolved) return 0
  if (total >= 450) return 5
  if (total >= 350) return 4
  if (total >= 250) return 3
  if (total >= 150) return 2
  return 1
}

/** 1..5 difficulty rating derived from the level's gap count. */
export function difficultyPips(gapCount: number): number {
  if (gapCount <= 4) return 1
  if (gapCount <= 7) return 2
  if (gapCount <= 10) return 3
  if (gapCount <= 13) return 4
  return 5
}

/** Deterministic, plausible stand-in for a future server-backed global best (300..500). */
export function mockGlobalRecord(levelId: string): number {
  let h = 0
  for (let i = 0; i < levelId.length; i++) h = (h * 31 + levelId.charCodeAt(i)) >>> 0
  return 300 + (h % 201) // 300..500
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/journeyScoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/journeyScoring.ts tests/lib/journeyScoring.test.ts
git commit -m "feat(journey): pure component scoring, stars, difficulty pips"
```

---

## Task 3: Progress store (`src/store/progressStore.ts`)

**Files:**
- Create: `src/store/progressStore.ts`
- Test: `tests/store/progressStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/store/progressStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  useProgressStore, emptyLevelProgress, levelTotal, levelStars, badgesUnlocked, isEarned,
  PROGRESS_STORAGE_KEY,
} from '../../src/store/progressStore'

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ byLevel: {} })
})

describe('progressStore', () => {
  it('returns an empty progress for an unplayed level', () => {
    const p = useProgressStore.getState().getLevel('L1')
    expect(p).toEqual(emptyLevelProgress())
    expect(levelTotal(p)).toBe(0)
    expect(levelStars(p)).toBe(0)
    expect(badgesUnlocked(p)).toBe(false)
  })

  it('records a play: best is a max, timesPlayed/lastPlayed update', () => {
    const { recordPlay } = useProgressStore.getState()
    recordPlay('L1', 'main', 80)
    recordPlay('L1', 'main', 70) // lower — must NOT downgrade best
    const p = useProgressStore.getState().getLevel('L1')
    expect(p.best.main).toBe(80)
    expect(p.timesPlayed).toBe(2)
    expect(p.lastPlayed).not.toBeNull()
  })

  it('unlocks badges and earns them once scored', () => {
    const { recordPlay } = useProgressStore.getState()
    recordPlay('L1', 'main', 90)
    let p = useProgressStore.getState().getLevel('L1')
    expect(badgesUnlocked(p)).toBe(true)
    expect(isEarned(p, 'colors')).toBe(false)
    recordPlay('L1', 'colors', 60)
    p = useProgressStore.getState().getLevel('L1')
    expect(isEarned(p, 'colors')).toBe(true)
    expect(levelTotal(p)).toBe(150)
    expect(levelStars(p)).toBe(2)
  })

  it('persists to localStorage and rehydrates', () => {
    useProgressStore.getState().recordPlay('L2', 'main', 50)
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    expect(raw).toContain('L2')
    // simulate reload
    useProgressStore.setState({ byLevel: JSON.parse(raw!) })
    expect(useProgressStore.getState().getLevel('L2').best.main).toBe(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/store/progressStore.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
// src/store/progressStore.ts
import { create } from 'zustand'
import type { ComponentKey } from '../lib/components'
import {
  type ComponentBests, sumBests, levelStarsFromTotal,
} from '../lib/journeyScoring'

export const PROGRESS_STORAGE_KEY = 'gapcity:progress:v1'

export interface LevelProgress {
  best: ComponentBests
  timesPlayed: number
  lastPlayed: number | null
}

export function emptyLevelProgress(): LevelProgress {
  return {
    best: { main: 0, colors: 0, inSequence: 0, flash: 0, riddle: 0 },
    timesPlayed: 0,
    lastPlayed: null,
  }
}

export type ProgressMap = Record<string, LevelProgress>

function load(): ProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ProgressMap) : {}
  } catch {
    return {}
  }
}

function save(map: ProgressMap): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota / unavailable storage */
  }
}

interface ProgressStore {
  byLevel: ProgressMap
  getLevel: (levelId: string) => LevelProgress
  recordPlay: (levelId: string, component: ComponentKey, score: number) => void
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  byLevel: load(),

  getLevel: (levelId) => get().byLevel[levelId] ?? emptyLevelProgress(),

  recordPlay: (levelId, component, score) => {
    set((state) => {
      const prev = state.byLevel[levelId] ?? emptyLevelProgress()
      const next: LevelProgress = {
        best: { ...prev.best, [component]: Math.max(prev.best[component], score) },
        timesPlayed: prev.timesPlayed + 1,
        lastPlayed: Date.now(),
      }
      const byLevel = { ...state.byLevel, [levelId]: next }
      save(byLevel)
      return { byLevel }
    })
  },
}))

// ── Derived selectors (pure over a LevelProgress) ──
export const levelTotal = (p: LevelProgress): number => sumBests(p.best)
export const levelStars = (p: LevelProgress): number => levelStarsFromTotal(levelTotal(p), p.best.main > 0)
export const badgesUnlocked = (p: LevelProgress): boolean => p.best.main > 0
export const isEarned = (p: LevelProgress, c: ComponentKey): boolean => p.best[c] > 0
```

> Note: `Date.now()` is fine in app/store code. (The `Date.now()` restriction only applies to Workflow scripts, not this codebase.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/store/progressStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/progressStore.ts tests/store/progressStore.test.ts
git commit -m "feat(journey): localStorage-backed per-component progress store"
```

---

## Task 4: Game state fields for single-play (`types.ts`)

**Files:**
- Modify: `supabase/functions/_shared/types.ts:124-149` (add fields to `GameState`)

- [ ] **Step 1: Add fields to `GameState`**

Add these two fields to the `GameState` interface (after `levelComplete: boolean`):

```ts
  // ── Journey single-play (new model) ──
  activeComponent: import('../../../src/lib/components').ComponentKey | null  // which component this play targets; null in practice
  livesLost: number             // wrong submissions in the CURRENT play (0..2 when solved)
```

> If a cross-package import path is awkward, instead declare a local string-union mirror in `types.ts`:
> `export type ComponentKey = 'main' | 'colors' | 'inSequence' | 'flash' | 'riddle'` and have `src/lib/components.ts` import `ComponentKey` from `@shared/types` rather than defining its own. Pick the local-mirror approach to avoid `@shared` importing from `src` (the alias only goes one way). **Update Task 1 accordingly: import `ComponentKey` from `@shared/types`.**

Concretely, do this:
1. In `supabase/functions/_shared/types.ts`, add near the RoundTheme section:

```ts
/** A playable puzzle within a Journey level (client concept). `riddle` is a placeholder. */
export type ComponentKey = 'main' | 'colors' | 'inSequence' | 'flash' | 'riddle'
```

2. Add to `GameState`:

```ts
  activeComponent: ComponentKey | null
  livesLost: number
```

3. In `src/lib/components.ts`, change the first line to import the type from shared:

```ts
import type { RoundTheme, ComponentKey } from '@shared/types'
export type { ComponentKey }
export type PlayableComponent = Exclude<ComponentKey, 'riddle'>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: errors only about `INITIAL_STATE` missing the new fields (fixed in Task 5). If other errors appear, fix the import direction.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/types.ts src/lib/components.ts tests/lib/components.test.ts
git commit -m "feat(journey): add activeComponent/livesLost to GameState"
```

---

## Task 5: Game store single-play actions (`gameStore.ts`)

This adds the new journey path **without removing** the practice gauntlet. `startComponent` runs one puzzle of one component; `submitSelection` gains a journey branch that scores via `componentScore`, records to the progress store, and handles lives/retry/fail.

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.component.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/store/gameStore.component.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGameStore } from '../../src/store/gameStore'
import { useProgressStore } from '../../src/store/progressStore'
import type { DifficultyConfig } from '@shared/types'

const DIFF: DifficultyConfig = {
  viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 3, complexity: 'simple',
}

function solveCurrent() {
  // Fill the cart with exactly the pieces the current gaps need (shape-only, basic).
  const { gaps, incrementSelection } = useGameStore.getState()
  for (const g of gaps) incrementSelection(g.pieceType)
}

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ byLevel: {} })
  useGameStore.getState().resetGame()
})

describe('startComponent', () => {
  it('starts a single main play in journey mode with 3 lives and the mapped theme', () => {
    useGameStore.getState().startComponent('L1', 'main', DIFF, 1, 'Test Level')
    const s = useGameStore.getState()
    expect(s.mode).toBe('journey')
    expect(s.activeComponent).toBe('main')
    expect(s.roundTheme).toBe('basic')
    expect(s.livesRemaining).toBe(3)
    expect(s.livesLost).toBe(0)
    expect(s.phase).toBe('countdown')
  })
})

describe('solving a component records the score', () => {
  it('records a main play and unlocks badges', () => {
    const g = useGameStore.getState()
    g.startComponent('L1', 'main', DIFF, 1, 'Test')
    g.beginViewing(); g.endViewing()
    solveCurrent()
    g.submitSelection()
    expect(useGameStore.getState().phase).toBe('resolving')
    expect(useGameStore.getState().roundScore!.total).toBeGreaterThanOrEqual(65)
    const p = useProgressStore.getState().getLevel('L1')
    expect(p.best.main).toBeGreaterThanOrEqual(65)
  })
})

describe('failing a submission costs a life and lowers the eventual base', () => {
  it('a wrong submit decrements lives and bumps livesLost; retry replays same puzzle', () => {
    const g = useGameStore.getState()
    g.startComponent('L1', 'main', DIFF, 1, 'Test')
    g.beginViewing(); g.endViewing()
    g.incrementSelection('I') // deliberately wrong / insufficient
    g.submitSelection()
    expect(useGameStore.getState().livesRemaining).toBe(2)
    expect(useGameStore.getState().livesLost).toBe(1)
    g.retryComponent()
    expect(useGameStore.getState().phase).toBe('countdown')
    expect(useGameStore.getState().livesRemaining).toBe(2) // retry does NOT restore lives
  })
})

describe('running out of lives scores 0 and records the play', () => {
  it('marks the play failed at 0 lives', () => {
    const g = useGameStore.getState()
    g.startComponent('L1', 'main', DIFF, 1, 'Test')
    g.beginViewing(); g.endViewing()
    for (let i = 0; i < 3; i++) {
      g.incrementSelection('I'); g.submitSelection()
      if (useGameStore.getState().livesRemaining > 0) g.retryComponent(), g.beginViewing(), g.endViewing()
    }
    const s = useGameStore.getState()
    expect(s.livesRemaining).toBe(0)
    expect(s.roundScore!.total).toBe(0)
    expect(useProgressStore.getState().getLevel('L1').best.main).toBe(0)
  })
})
```

> Note: the exact selection that "solves" a puzzle depends on generated gaps; `solveCurrent()` selects one piece per gap by its `pieceType`, which is correct for the **basic** theme resolver. If the resolver needs ordered/colored entries for other themes, those are out of scope for this test (main only).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/store/gameStore.component.test.ts`
Expected: FAIL — `startComponent` / `retryComponent` not a function.

- [ ] **Step 3: Implement the store changes**

3a. Add imports at the top of `src/store/gameStore.ts`:

```ts
import type { ComponentKey } from '@shared/types'
import { COMPONENT_THEME, isPlayable } from '../lib/components'
import { componentScore } from '../lib/journeyScoring'
import { useProgressStore } from './progressStore'
```

3b. Add to `INITIAL_STATE` (the `GameState` literal):

```ts
  activeComponent: null,
  livesLost: 0,
```

3c. Add to the `GameStore` interface:

```ts
  startComponent: (levelId: string, component: ComponentKey, difficulty: DifficultyConfig, displayNumber: number, levelName?: string | null) => void
  retryComponent: () => void
  replayComponent: () => void
```

3d. Refactor `startGame` so the journey theme comes from `activeComponent` (practice still uses `THEME_SEQUENCE[roundIndex]`). Replace the first lines of `startGame`:

```ts
  startGame: () => {
    const { round, roundIndex, mode, levelDifficulty, activeComponent } = get()
    const roundTheme = mode === 'journey' && activeComponent && isPlayable(activeComponent)
      ? COMPONENT_THEME[activeComponent]
      : THEME_SEQUENCE[roundIndex]
    const difficulty = mode === 'journey' && levelDifficulty
      ? levelDifficulty
      : getDifficulty(round)
    // ...rest unchanged (generatePuzzle + set({...}))
  },
```

3e. Add the new actions (place near `startJourneyLevel`):

```ts
  // Start a single-component Journey play: pin difficulty, set the component,
  // reset lives, and run ONE puzzle (no gauntlet).
  startComponent: (levelId, component, difficulty, displayNumber, levelName = null) => {
    set({
      mode: 'journey',
      levelId,
      activeComponent: component,
      levelDifficulty: difficulty,
      levelDisplayNumber: displayNumber,
      levelName,
      livesRemaining: MAX_LIVES,
      livesLost: 0,
      roundIndex: 0,
      score: 0,
      roundResults: [],
      levelComplete: false,
      journeyError: null,
      submitting: false,
    })
    get().startGame()
  },

  // Failed attempt with lives left: replay the SAME puzzle (pristine board),
  // re-run the countdown. livesRemaining/livesLost already advanced in submit.
  retryComponent: () => {
    set(state => ({
      phase: 'countdown',
      paused: false,
      selection: [],
      roundScore: null,
      _resolution: null,
      grid: state.sessionGrid.map(row => row.map(cell => ({ ...cell }))),
      phaseStartTime: 0,
      phaseDuration: 0,
      viewTimeRemaining: 0,
    }))
  },

  // "Play Again" from the result screen: fresh puzzle, full lives, same component.
  replayComponent: () => {
    const { levelId, activeComponent, levelDifficulty, levelDisplayNumber, levelName } = get()
    if (!levelId || !activeComponent || !levelDifficulty) return
    get().startComponent(levelId, activeComponent, levelDifficulty, levelDisplayNumber ?? 1, levelName)
  },
```

3f. Add a journey branch to `submitSelection`. After computing `res`, `selectElapsed`, `selectTimeRemaining`, `selectedPieces`, and BEFORE the existing practice `if (res.solvable)` block, insert a mode guard:

```ts
    const { activeComponent, levelId, viewTimeRemaining: viewRem } = get()
    if (get().mode === 'journey') {
      const selectOnly = roundTheme === 'flashMob'
      const consumed = selectOnly
        ? difficulty.selectDuration - selectTimeRemaining
        : (effectiveViewDuration(roundTheme, difficulty) - viewRem) + (difficulty.selectDuration - selectTimeRemaining)
      const allotted = selectOnly
        ? difficulty.selectDuration
        : effectiveViewDuration(roundTheme, difficulty) + difficulty.selectDuration

      if (res.solvable) {
        const score = componentScore({ solved: true, livesLost: get().livesLost, consumed, allotted })
        if (levelId && activeComponent) useProgressStore.getState().recordPlay(levelId, activeComponent, score)
        set({
          phase: 'resolving',
          _resolution: { kind: 'perfect', placements: res.placements, coverage: 1 },
          roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: score },
        })
        return
      }

      // Failure: spend a life.
      get().loseLife()
      set(state => ({ livesLost: Math.min(2, state.livesLost + 1) }))
      const outOfLives = get().livesRemaining <= 0
      const uncovered = res.totalCells - res.filledCells
      let reason: ResolutionReason
      if (roundTheme === 'sequential') reason = 'wrong-order'
      else if (uncovered === 0) reason = 'too-many'
      else reason = Math.max(1, Math.round(uncovered / 4)) === 1 ? 'missed-one' : 'missed-many'

      if (outOfLives && levelId && activeComponent) {
        useProgressStore.getState().recordPlay(levelId, activeComponent, 0) // records timesPlayed/lastPlayed; best unchanged
      }
      set({
        phase: 'resolving',
        _resolution: { kind: 'partial', placements: res.placements, coverage: res.coverage, reason },
        roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 },
      })
      return
    }
    // ── existing practice path below (unchanged) ──
```

> `livesLost` is clamped to 2 because solving after a 3rd loss is impossible (3rd loss ⇒ out of lives ⇒ recorded as 0). The clamp keeps the base math (`65 − 10·livesLost`) valid.

3g. Update `resetGame` to clear the new fields. Change the `resetGame` set call to also reset `activeComponent: null, livesLost: 0` (they're in `INITIAL_STATE` already, so `...INITIAL_STATE` covers them — just confirm `INITIAL_STATE` has them from 3b).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/store/gameStore.component.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to catch regressions in the practice path**

Run: `npx vitest run`
Expected: PASS. If `tests/store/gameStore.journey.test.ts` fails (it asserts the old gauntlet journey behavior), that's expected — it is rewritten in Task 11. Leave it for now; note the failure.

- [ ] **Step 6: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.component.test.ts
git commit -m "feat(journey): single-component play actions + scoring/recording in store"
```

---

## Task 6: Navigation — level order + next level + hub view

**Files:**
- Modify: `src/store/navStore.ts`
- Test: `tests/store/navStore.test.ts` (extend)

- [ ] **Step 1: Write the failing test (append to existing file)**

```ts
// add to tests/store/navStore.test.ts
import { useNavStore } from '../../src/store/navStore'

describe('level order + next level', () => {
  beforeEach(() => useNavStore.getState().reset())

  it('stores the ordered level ids', () => {
    useNavStore.getState().setLevelOrder(['a', 'b', 'c'])
    expect(useNavStore.getState().levelOrder).toEqual(['a', 'b', 'c'])
  })

  it('goNextLevel opens the following level, no-op at the end', () => {
    const nav = useNavStore.getState()
    nav.setLevelOrder(['a', 'b', 'c'])
    nav.openLevel('b')
    nav.goNextLevel()
    expect(useNavStore.getState().selectedLevelId).toBe('c')
    expect(useNavStore.getState().appView).toBe('levelDetail')
    nav.goNextLevel() // already at last → stays
    expect(useNavStore.getState().selectedLevelId).toBe('c')
  })

  it('hasNextLevel reflects position', () => {
    const nav = useNavStore.getState()
    nav.setLevelOrder(['a', 'b'])
    nav.openLevel('a')
    expect(useNavStore.getState().hasNextLevel()).toBe(true)
    nav.openLevel('b')
    expect(useNavStore.getState().hasNextLevel()).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/store/navStore.test.ts`
Expected: FAIL — `setLevelOrder` not a function.

- [ ] **Step 3: Implement**

Edit `src/store/navStore.ts`:

```ts
interface NavState {
  appView: AppView
  selectedLevelId: string | null
  selectedLevelLocked: boolean
  levelOrder: string[]
  goAuth: () => void
  goJourney: () => void
  openLevel: (id: string, locked?: boolean) => void
  enterPlaying: () => void
  showResults: () => void
  backToMap: () => void
  goPractice: () => void
  setLevelOrder: (ids: string[]) => void
  goNextLevel: () => void
  hasNextLevel: () => boolean
  reset: () => void
}

const INITIAL = {
  appView: 'auth' as AppView,
  selectedLevelId: null as string | null,
  selectedLevelLocked: false,
  levelOrder: [] as string[],
}

export const useNavStore = create<NavState>((set, get) => ({
  ...INITIAL,
  goAuth: () => set({ appView: 'auth' }),
  goJourney: () => set({ appView: 'journey' }),
  openLevel: (id, locked = false) =>
    set({ appView: 'levelDetail', selectedLevelId: id, selectedLevelLocked: locked }),
  enterPlaying: () => set({ appView: 'playing' }),
  showResults: () => set({ appView: 'results' }),
  backToMap: () => set({ appView: 'journey' }),
  goPractice: () => set({ appView: 'practice' }),
  setLevelOrder: (ids) => set({ levelOrder: ids }),
  goNextLevel: () => {
    const { levelOrder, selectedLevelId } = get()
    const i = selectedLevelId ? levelOrder.indexOf(selectedLevelId) : -1
    const next = i >= 0 && i < levelOrder.length - 1 ? levelOrder[i + 1] : null
    if (next) set({ appView: 'levelDetail', selectedLevelId: next, selectedLevelLocked: false })
  },
  hasNextLevel: () => {
    const { levelOrder, selectedLevelId } = get()
    const i = selectedLevelId ? levelOrder.indexOf(selectedLevelId) : -1
    return i >= 0 && i < levelOrder.length - 1
  },
  reset: () => set({ ...INITIAL }),
}))
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/store/navStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Publish level order from JourneyScreen**

In `src/components/JourneyScreen.tsx`, after themes load, flatten them to an ordered id list and push to navStore. Add to the `load` success path:

```ts
import { useNavStore } from '../store/navStore'
// inside component:
const setLevelOrder = useNavStore(s => s.setLevelOrder)
// in load(), after setThemes(data):
const ordered = (data as JourneyTheme[]).flatMap(t => t.levels.map(l => l.level_id))
setLevelOrder(ordered)
```

> Confirm the level id field name on `JourneyTheme.levels[]` (it is `level_id` per `get_journey`; verify against `src/components/JourneyMap/index.tsx`'s type). Use whatever the existing type exposes.

- [ ] **Step 6: Commit**

```bash
git add src/store/navStore.ts tests/store/navStore.test.ts src/components/JourneyScreen.tsx
git commit -m "feat(journey): nav level order + next-level navigation"
```

---

## Task 7: Component score panel (`ComponentScorePanel.tsx`)

**Files:**
- Create: `src/components/ResolutionPhase/ComponentScorePanel.tsx`
- Test: `tests/components/ComponentScorePanel.test.tsx`

Renders the per-component result: solved/failed, base after lives, speed bonus, component total, then the updated level total + 5-star rating.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/ComponentScorePanel.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComponentScorePanel } from '../../src/components/ResolutionPhase/ComponentScorePanel'

describe('ComponentScorePanel', () => {
  it('shows the component total and level total', () => {
    render(
      <ComponentScorePanel
        show componentLabel="Main" solved livesLost={1}
        componentTotal={90} levelTotal={90} stars={1}
      />,
    )
    expect(screen.getByText('Main')).toBeTruthy()
    expect(screen.getByText('90')).toBeTruthy()
  })

  it('renders five star slots', () => {
    const { container } = render(
      <ComponentScorePanel show componentLabel="Colors" solved={false} livesLost={2}
        componentTotal={0} levelTotal={90} stars={1} />,
    )
    expect(container.querySelectorAll('[data-star]')).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/ComponentScorePanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (mirror `ResolutionPhase/ScorePanel.tsx` styling)

```tsx
// src/components/ResolutionPhase/ComponentScorePanel.tsx
import { ArcadePanel } from '../ui'
import { COMPLETION_BASE, LIFE_PENALTY } from '../../lib/journeyScoring'

export function ComponentScorePanel({
  show, componentLabel, solved, livesLost, componentTotal, levelTotal, stars,
}: {
  show: boolean
  componentLabel: string
  solved: boolean
  livesLost: number
  componentTotal: number
  levelTotal: number
  stars: number
}) {
  const base = solved ? COMPLETION_BASE - LIFE_PENALTY * Math.min(2, livesLost) : 0
  const speed = Math.max(0, componentTotal - base)
  return (
    <ArcadePanel className={`p-4 w-full transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-neon-cyan">{componentLabel}</span>
        <span className="font-pixel text-base tabular-nums text-white">{componentTotal}</span>
      </div>
      {solved && (
        <>
          <Row label="Completion" value={base} />
          <Row label="Speed" value={speed} />
        </>
      )}
      <div className="flex justify-between items-baseline mt-3 pt-2 border-t border-arcade-edge">
        <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-neon-yellow">Level Total</span>
        <span className="font-pixel text-[11px] tabular-nums text-neon-yellow text-glow-yellow">{levelTotal} / 500</span>
      </div>
      <div className="text-center text-xl mt-2">
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} data-star className={i < stars ? 'text-neon-yellow text-glow-yellow' : 'text-arcade-edge'}>★</span>
        ))}
      </div>
    </ArcadePanel>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-baseline mb-1">
      <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-gray-400">{label}</span>
      <span className="font-pixel text-[11px] tabular-nums text-white">{value}</span>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/components/ComponentScorePanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResolutionPhase/ComponentScorePanel.tsx tests/components/ComponentScorePanel.test.tsx
git commit -m "feat(journey): per-component result score panel"
```

---

## Task 8: ResolutionPhase journey branch (single-play CTAs + result)

Add a journey branch that, on the `cta` stage, shows the `ComponentScorePanel` and three buttons: **Play Again** (`replayComponent` + stay playing), **Back to Level** (`backToMap`? no — back to the level hub), **Next Level** (`goNextLevel`, only when `hasNextLevel()`). Practice keeps its existing gauntlet CTA.

**Files:**
- Modify: `src/components/ResolutionPhase/index.tsx`
- Test: `tests/components/ResolutionPhase.test.tsx` (extend or add a journey case)

- [ ] **Step 1: Write the failing test**

```tsx
// add a journey case to tests/components/ResolutionPhase.test.tsx (new describe)
import { render, screen } from '@testing-library/react'
import { useGameStore } from '../../src/store/gameStore'
import { useNavStore } from '../../src/store/navStore'
import { ResolutionPhase } from '../../src/components/ResolutionPhase'

describe('ResolutionPhase — journey single play', () => {
  it('shows Play Again / Back to Level / Next Level after a solved component', async () => {
    useNavStore.getState().setLevelOrder(['L1', 'L2'])
    useNavStore.getState().openLevel('L1')
    // Arrange a solved journey resolution directly in the store:
    useGameStore.setState({
      mode: 'journey', activeComponent: 'main', levelId: 'L1', phase: 'resolving',
      selection: [], gaps: [], grid: [],
      _resolution: { kind: 'perfect', placements: [], coverage: 1 },
      roundScore: { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 90 },
      livesLost: 0,
    })
    render(<ResolutionPhase />)
    // reduced-motion / empty solution jumps to cta quickly; wait for buttons
    expect(await screen.findByText(/Play Again/i)).toBeTruthy()
    expect(screen.getByText(/Back to Level/i)).toBeTruthy()
    expect(screen.getByText(/Next Level/i)).toBeTruthy()
  })
})
```

> If the existing test harness mocks `useReducedMotion`, mirror that so the CTA stage is reached synchronously. Check the top of `tests/components/ResolutionPhase.test.tsx`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: FAIL — Journey buttons not rendered (still shows practice CTA).

- [ ] **Step 3: Implement the journey branch**

In `src/components/ResolutionPhase/index.tsx`:

3a. Extend the store selector to include the new bits:

```ts
  const { /* existing... */ mode, activeComponent, levelId, livesLost, replayComponent } =
    useGameStore(useShallow(s => ({
      // ...existing fields...
      mode: s.mode,
      activeComponent: s.activeComponent,
      levelId: s.levelId,
      livesLost: s.livesLost,
      replayComponent: s.replayComponent,
    })))
```

3b. Add nav handlers:

```ts
  const { showResults, openLevel, goNextLevel, hasNextLevel } = useNavStore(useShallow(s => ({
    showResults: s.showResults,
    openLevel: s.openLevel,
    goNextLevel: s.goNextLevel,
    hasNextLevel: s.hasNextLevel,
  })))
```

3c. Compute journey result figures (read fresh progress from the store):

```ts
  import { useProgressStore, levelTotal as progressLevelTotal, levelStars as progressLevelStars } from '../../store/progressStore'
  import { COMPONENT_LABEL } from '../../lib/components'
  // inside the component, after roundScore is known:
  const isJourney = mode === 'journey'
  const journeyProgress = isJourney && levelId ? useProgressStore.getState().getLevel(levelId) : null
  const jLevelTotal = journeyProgress ? progressLevelTotal(journeyProgress) : 0
  const jStars = journeyProgress ? progressLevelStars(journeyProgress) : 0
```

3d. In the bottom `{stage === 'cta' && (...)}` block, branch on `isJourney`. For journey render three stacked `NeonButton`s; for practice keep the existing single `NextRoundButton`. Example journey CTA:

```tsx
{stage === 'cta' && isJourney && (
  <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pt-10 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent pointer-events-none">
    <div className="w-full max-w-sm pointer-events-auto flex flex-col gap-3">
      <NeonButton fullWidth variant="primary" onClick={() => replayComponent()}>Play Again ↺</NeonButton>
      <NeonButton fullWidth variant="ghost" onClick={() => { if (levelId) openLevel(levelId) }}>Back to Level</NeonButton>
      {hasNextLevel() && (
        <NeonButton fullWidth variant="go" onClick={() => goNextLevel()}>Next Level →</NeonButton>
      )}
    </div>
  </div>
)}
```

> Import `NeonButton` from `../ui`. Keep the existing practice CTA block guarded by `stage === 'cta' && !isJourney`.

3e. Replace the journey score readout: when `isJourney`, render `<ComponentScorePanel show={stage==='scoring'||stage==='cta'} componentLabel={COMPONENT_LABEL[activeComponent ?? 'main']} solved={!isFailure} livesLost={livesLost} componentTotal={roundScore?.total ?? 0} levelTotal={jLevelTotal} stars={jStars} />` in place of the practice `<ScorePanel>` (guard the practice `ScorePanel` with `!isJourney`).

3f. The journey path must not call `commitRoundScore` / `advanceRound` (score already recorded in `submitSelection`). Ensure the `scoring`→`cta` effect's `commitRoundScore()` only runs for practice. Guard:

```ts
  useEffect(() => {
    if (stage !== 'scoring') return
    const t = window.setTimeout(() => {
      if (!isJourney) commitRoundScore()
      setStage('cta')
    }, SCORING_DURATION)
    return () => clearTimeout(t)
  }, [stage, commitRoundScore, isJourney])
```

Likewise the reduced-motion effect: only `commitRoundScore()` when `!isJourney`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResolutionPhase/index.tsx tests/components/ResolutionPhase.test.tsx
git commit -m "feat(journey): single-play result CTAs (Play Again / Back to Level / Next Level)"
```

---

## Task 9: GameShell journey header (component name + lives)

**Files:**
- Modify: `src/components/GameShell.tsx`
- Test: `tests/components/GameShell.test.tsx` (extend)

- [ ] **Step 1: Write the failing test**

```tsx
// add to tests/components/GameShell.test.tsx
it('journey header shows the component label, not "round n/4"', () => {
  useGameStore.setState({
    mode: 'journey', activeComponent: 'colors', levelName: 'Cellar Door',
    phase: 'viewing', livesRemaining: 3,
  })
  render(<GameShell />)
  expect(screen.getByText(/Colors/i)).toBeTruthy()
  expect(screen.queryByText(/\/ 4/)).toBeNull()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/GameShell.test.tsx`
Expected: FAIL — still renders "ROUND n / 4".

- [ ] **Step 3: Implement**

In `src/components/GameShell.tsx`, add `activeComponent` to the selector, import `COMPONENT_LABEL`, and replace the header label block:

```tsx
import { COMPONENT_LABEL } from '../lib/components'
// add activeComponent: s.activeComponent to the useShallow selector
// replace the <span className="font-pixel ...ROUND..."> block with:
<span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-neon-cyan">
  {mode === 'journey' ? (
    <>
      <strong className="text-white mr-2">{levelName ?? `LEVEL ${levelDisplayNumber}`}</strong>
      {activeComponent ? COMPONENT_LABEL[activeComponent] : ''}
    </>
  ) : (
    <>ROUND <strong className="text-white">{roundIndex + 1} / 4</strong></>
  )}
</span>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/components/GameShell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameShell.tsx tests/components/GameShell.test.tsx
git commit -m "feat(journey): GameShell header shows component label in journey mode"
```

---

## Task 10: Level hub page (`LevelScreen.tsx`)

The full-screen hub that replaces the modal. Loads `get_level`, reads records from `progressStore`, shows difficulty pips + metadata + Play + badge row. Tapping Play starts the `main` component; tapping a badge starts that component (locked until main solved; riddle is "Coming soon").

**Files:**
- Create: `src/components/LevelScreen.tsx`
- Test: `tests/components/LevelScreen.test.tsx`
- (Task 12 deletes `LevelDetailScreen.tsx` and rewires `App.tsx`.)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/LevelScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({
  getLevel: vi.fn(async () => ({
    level_id: 'L1', display_number: 1, name: 'Cellar Door', theme_name: 'The Hollows',
    view_duration_ms: 4000, select_duration_ms: 10000, gap_count: 6, shape_complexity: 'medium',
    adjacency: 0, my_pr: null, my_stars: 0, global_high: null, last_played: null,
  })),
}))

import { LevelScreen } from '../../src/components/LevelScreen'
import { useProgressStore } from '../../src/store/progressStore'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ byLevel: {} })
  useNavStore.getState().reset()
  useNavStore.getState().openLevel('L1')
})

describe('LevelScreen', () => {
  it('renders name, difficulty pips, a Play button and four badges', async () => {
    render(<LevelScreen />)
    expect(await screen.findByText('Cellar Door')).toBeTruthy()
    expect(screen.getByRole('button', { name: /play/i })).toBeTruthy()
    for (const b of ['Colors', 'In-Sequence', 'Flash', 'Riddle']) {
      expect(screen.getByText(b)).toBeTruthy()
    }
    // 3 difficulty pips for gapCount 6 (bucket 2? -> see journeyScoring: 6 -> 2)
    expect(screen.getAllByTestId('difficulty-pip')).toHaveLength(5)
  })

  it('locks badges until the main puzzle is solved', async () => {
    render(<LevelScreen />)
    await screen.findByText('Cellar Door')
    const colors = screen.getByRole('button', { name: /Colors/i })
    expect(colors).toBeDisabled()
    // solve main → unlock
    useProgressStore.getState().recordPlay('L1', 'main', 90)
    await waitFor(() => expect(screen.getByRole('button', { name: /Colors/i })).not.toBeDisabled())
  })

  it('Riddle stays a Coming soon placeholder even after main is solved', async () => {
    useProgressStore.getState().recordPlay('L1', 'main', 90)
    render(<LevelScreen />)
    await screen.findByText('Cellar Door')
    expect(screen.getByRole('button', { name: /Riddle/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/LevelScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/LevelScreen.tsx
import { useCallback, useEffect, useState } from 'react'
import { getLevel } from '../lib/api'
import { relativeTime } from '../lib/relativeTime'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { useProgressStore, levelTotal, levelStars, badgesUnlocked, isEarned } from '../store/progressStore'
import { difficultyPips, mockGlobalRecord } from '../lib/journeyScoring'
import { BADGE_COMPONENTS, COMPONENT_LABEL, isPlayable, type ComponentKey } from '../lib/components'
import { track } from '../store/asyncStatus'
import { NeonButton, ScanlineOverlay } from './ui'
import type { DifficultyConfig } from '@shared/types'

interface LevelDetail {
  level_id: string; display_number: number; name: string; theme_name: string
  view_duration_ms: number; select_duration_ms: number
  gap_count: number; shape_complexity: string; adjacency: number
  my_pr: number | null; my_stars: number; global_high: number | null; last_played: string | null
}

function Pips({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`Difficulty ${value} of 5`}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} data-testid="difficulty-pip"
          className={`h-2 w-2 rounded-full ${i < value ? 'bg-neon-magenta shadow-[0_0_6px_#f0f]' : 'bg-arcade-edge'}`} />
      ))}
    </span>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-base">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={i < value ? 'text-neon-yellow text-glow-yellow' : 'text-arcade-edge'}>★</span>
      ))}
    </span>
  )
}

export function LevelScreen() {
  const selectedLevelId = useNavStore(s => s.selectedLevelId)
  const goJourney = useNavStore(s => s.goJourney)
  const enterPlaying = useNavStore(s => s.enterPlaying)
  const startComponent = useGameStore(s => s.startComponent)
  const progress = useProgressStore(s => (selectedLevelId ? s.getLevel(selectedLevelId) : null))
  const byLevel = useProgressStore(s => s.byLevel) // re-render on record
  const [level, setLevel] = useState<LevelDetail | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!selectedLevelId) return
    setError(false); setLevel(null)
    try { setLevel((await track(getLevel(selectedLevelId))) as LevelDetail) }
    catch { setError(true) }
  }, [selectedLevelId])
  useEffect(() => { load() }, [load])

  const p = selectedLevelId ? useProgressStore.getState().getLevel(selectedLevelId) : null
  void byLevel // selector above already triggers re-render

  const difficulty = (lvl: LevelDetail): DifficultyConfig => ({
    viewDuration: lvl.view_duration_ms,
    selectDuration: lvl.select_duration_ms,
    placeDuration: 0,
    gapCount: lvl.gap_count,
    complexity: (lvl.shape_complexity as DifficultyConfig['complexity']) ?? 'medium',
    adjacency: Number(lvl.adjacency) || 0,
  })

  const play = (component: ComponentKey) => {
    if (!level || !isPlayable(component)) return
    startComponent(level.level_id, component, difficulty(level), level.display_number, level.name)
    enterPlaying()
  }

  const unlocked = p ? badgesUnlocked(p) : false

  return (
    <div className="min-h-dvh bg-arcade-bg text-white arcade-scanlines px-4 py-6">
      <ScanlineOverlay />
      <button onClick={goJourney} className="mb-4 text-arcade-edge hover:text-neon-cyan text-sm">← Map</button>

      {error && (
        <div className="text-center py-10">
          <p className="text-gray-400 mb-4">Couldn’t load this level.</p>
          <NeonButton variant="primary" size="sm" onClick={load}>Retry</NeonButton>
        </div>
      )}

      {level && p && (
        <div className="max-w-sm mx-auto">
          <div className="font-pixel text-[9px] uppercase tracking-[0.15em] text-neon-magenta text-glow-magenta mb-1">{level.theme_name}</div>
          <h2 className="font-pixel text-lg uppercase tracking-[0.08em] text-neon-cyan text-glow-cyan mb-2">{level.name}</h2>
          <div className="flex items-center gap-4 mb-5">
            <Pips value={difficultyPips(level.gap_count)} />
            <Stars value={levelStars(p)} />
          </div>

          <dl className="text-sm text-gray-300 space-y-1 mb-6">
            <div className="flex justify-between"><dt className="text-gray-500">Global Record</dt><dd>{mockGlobalRecord(level.level_id)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Personal Record</dt><dd>{levelTotal(p) || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Stars</dt><dd>{levelStars(p)} / 5</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Last played</dt><dd>{relativeTime(p.lastPlayed ? new Date(p.lastPlayed).toISOString() : null)}</dd></div>
          </dl>

          <NeonButton fullWidth variant="go" onClick={() => play('main')} className="mb-2">
            {p.best.main > 0 ? `▶ Play  ·  Best ${p.best.main}` : '▶ Play'}
          </NeonButton>

          <div className="grid grid-cols-2 gap-2 mt-4">
            {BADGE_COMPONENTS.map(c => {
              const playable = isPlayable(c)
              const disabled = !unlocked || !playable
              const earned = isEarned(p, c)
              return (
                <button
                  key={c}
                  disabled={disabled}
                  onClick={() => play(c)}
                  className={`relative rounded-md border-2 p-3 text-left transition
                    ${disabled ? 'border-arcade-edge text-gray-500 opacity-60'
                                : 'border-neon-cyan text-white hover:shadow-[0_0_8px_#0ff]'}`}
                >
                  <div className="font-pixel text-[10px] uppercase tracking-[0.08em]">{COMPONENT_LABEL[c]}</div>
                  <div className="text-[11px] mt-1 text-gray-400">
                    {!playable ? 'Coming soon' : !unlocked ? '🔒 Solve main' : earned ? `Best ${p.best[c]}` : 'Not earned'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

> Notes: the `byLevel` selector subscription forces a re-render when a play is recorded (so the unlock test passes without a reload). `relativeTime` takes an ISO string or null (verify its signature in `src/lib/relativeTime.ts`; adapt the `lastPlayed` conversion if it accepts epoch ms directly).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/components/LevelScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LevelScreen.tsx tests/components/LevelScreen.test.tsx
git commit -m "feat(journey): level hub page with difficulty pips, metadata, Play, badges"
```

---

## Task 11: Wire routing + retire the journey results screen

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/LevelDetailScreen.tsx`
- Modify/Delete: `tests/components/LevelDetailScreen.test.tsx` (delete — replaced by LevelScreen test)
- Modify: `tests/components/ResultsScreen.test.tsx` (journey branch is gone — keep only practice cases, or delete journey assertions)
- Modify: `tests/store/gameStore.journey.test.ts` (rewrite for single-component model or replace with `gameStore.component.test.ts` coverage)

- [ ] **Step 1: Route `levelDetail` to the hub page**

In `src/App.tsx`:

```tsx
import { LevelScreen } from './components/LevelScreen'
// remove: import { LevelDetailScreen } from './components/LevelDetailScreen'
// change the case:
case 'levelDetail':
  return <LevelScreen />
```

> The journey flow no longer uses the `results` view (per-component results live inside `ResolutionPhase`). Leave the `results` route in place for Practice. Journey’s `showResults` is no longer called from the journey CTA (Task 8 uses `openLevel`/`goNextLevel`/`replayComponent`).

- [ ] **Step 2: Delete the modal and its test**

```bash
git rm src/components/LevelDetailScreen.tsx tests/components/LevelDetailScreen.test.tsx
```

- [ ] **Step 3: Fix ResultsScreen journey coupling**

`ResultsScreen.tsx` still imports `submitJourneyLevel` and the old `levelStars`/`livesBonus`. Since journey no longer routes to `results`, simplify `ResultsScreen` to the **practice-only** path:
- Remove the `mode === 'journey'` branch and the `useEffect` that calls `submitJourneyLevel`.
- Remove the `prBreak`/`journeyError`/`submitting`/`submitJourneyLevel`/`priorPr` usage.
- Keep `LevelSummary` + the practice buttons (Play Again / Back to Menu).
- It can keep using the old `levelStars`/`livesBonus` from `@shared/core/scoring` (practice still uses the gauntlet). Leave those scoring functions intact.

Update `tests/components/ResultsScreen.test.tsx` to drop journey-branch assertions; keep practice rendering tests.

- [ ] **Step 4: Rewrite the old journey store test**

`tests/store/gameStore.journey.test.ts` asserts the old gauntlet aggregate journey behavior (4 rounds, `submitJourneyLevel`). Replace its contents with a redirect note + minimal smoke that journey now uses `startComponent` (or delete it, since `gameStore.component.test.ts` covers the new model):

```bash
git rm tests/store/gameStore.journey.test.ts
```

> Keep `submitJourneyLevel` / `startJourneyLevel` in the store **only if** still referenced; otherwise remove them in Task 13 cleanup. They are no longer called by the UI after this task.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS (all). Fix any stragglers referencing the deleted modal or journey results.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(journey): route to level hub, retire journey results screen + modal"
```

---

## Task 12: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start local services**

Run (separate calls): `npm run db:start` then `npm run dev`.
Expected: dev server on http://localhost:5173; sign in as guest.

- [ ] **Step 2: Verify the flow**

Using the preview tooling (preview_start / preview_snapshot / preview_click / preview_screenshot):
- Map → tap a level → **Level page** (not a modal): name, difficulty pips, metadata (Global Record = a number, Personal Record `—`, Stars 0/5, Last played `—`), Play, four badges (all locked).
- Tap **Play** → countdown → viewing → selecting → solve → result shows Completion/Speed/component total + Level Total/stars + Play Again / Back to Level / Next Level.
- Back to Level → badges now unlocked (Riddle still "Coming soon").
- Play a badge → score adds to Level Total; stars rise past 1 once total ≥150.
- Fail a play 3× → component scores 0, no game-over; replay works.
- Reload the page → Personal Record / stars / best scores persist (localStorage).

- [ ] **Step 3: Capture a screenshot of the level hub for the record.**

No commit (verification task).

---

## Task 13: Cleanup + docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `src/store/gameStore.ts` (remove now-dead journey-aggregate code if unreferenced)

- [ ] **Step 1: Remove dead journey-aggregate code**

If nothing references them after Task 11, remove `startJourneyLevel`, `submitJourneyLevel`, `priorPr`, and related fields from `gameStore.ts` and the `GameStore` interface. Run `npm run build` to confirm `noUnusedLocals` is clean. (Keep `startLevel`/`advanceRound`/`THEME_SEQUENCE` — still used by Practice.)

Run: `npx tsc -b` (or `npm run build`)
Expected: no unused-symbol errors.

- [ ] **Step 2: Update CLAUDE.md**

Rewrite the **Round loop** and **Scoring** sections to describe:
- Journey = a level hub with one main puzzle + four opt-in badges (Colors / In-Sequence / Flash / Riddle-placeholder); the level completes on solving main.
- Per-component scoring: `base (65 − 10·livesLost) + speed (0–35)`; speed = view+select clock (select-only for Flash); fresh clock per retry; `ceil`, capped 100; unsolved = 0.
- Level total = sum of best component scores (0–500); stars 0–5 at 1(main)/150/250/350/450; difficulty pips 1–5.
- Persistence: hybrid — catalog from `get_journey`/`get_level`; per-component records in `progressStore` (localStorage); global record mocked.
- Note Practice still runs the legacy 4-round gauntlet (Training rework pending).

Update the file map to add `src/lib/components.ts`, `src/lib/journeyScoring.ts`, `src/store/progressStore.ts`, `src/components/LevelScreen.tsx`, `ResolutionPhase/ComponentScorePanel.tsx`; remove `LevelDetailScreen.tsx`.

- [ ] **Step 3: Full gate**

Run (separate calls): `npm run test`, then `npm run build`, then `npm run lint`.
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(journey): retire dead aggregate code, update CLAUDE.md"
```

---

## Self-review notes (for the executor)

- **Spec coverage:** Level hub (T10), difficulty pips (T2/T10), metadata incl. mocked global record (T2/T10), Play + badges with main-gating + Riddle placeholder (T10), any-order replayable badges (T5 `replayComponent`/T10), 3-lives/−10 base + 0-on-out (T5), speed clock per component incl. flash select-only (T5), fresh clock per retry (T5 `retryComponent`), 0–500 total + 0–5 stars (T2/T3), localStorage persistence (T3), Play Again / Back to Level / Next Level (T6/T8), GameShell header (T9), hybrid persistence (T3/T10), CLAUDE.md (T13). ✔
- **Risk:** existing tests asserting the old gauntlet-journey behavior (`gameStore.journey.test.ts`, journey branch of `ResultsScreen.test.tsx`, `LevelDetailScreen.test.tsx`) are intentionally deleted/rewritten in T11. Run the full suite after T11 and T13.
- **Practice mode** is deliberately untouched; its gauntlet code stays. Full retirement is a follow-up tied to the Training rework.
- **`relativeTime` signature** and **`JourneyTheme.levels[]` id field** must be verified against the codebase during T6/T10 (noted inline).
