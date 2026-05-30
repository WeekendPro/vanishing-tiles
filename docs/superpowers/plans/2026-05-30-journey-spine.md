# Journey Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the tested server-authoritative backend into an end-to-end, online-playable journey (auth → sectioned-grid map → level detail → server-scored gameplay → results), while preserving the existing client-only free-play loop as an unscored **Practice** mode.

**Architecture:** A new `navStore` owns app-level navigation (`appView`, `selectedLevelId`); `gameStore` gains a `mode` flag plus journey session state and journey actions. The existing phase machine (countdown → viewing → selecting → resolving, with the fly-in animation) is reused verbatim for both modes — only the *source* of the puzzle and the *source* of the score differ. Practice uses the local engine/scoring; Journey uses `start_session`/`submit_attempt` Edge Functions. The two stores stay independent: components orchestrate cross-store transitions (e.g. `startJourneySession()` then `enterPlaying()`), so neither store imports the other.

**Tech Stack:** Vite + React 18 + Zustand 5 (`useShallow` for object selectors) + TypeScript + Tailwind 3 + framer-motion + Vitest 2 + Testing Library. Backend already built (Supabase Edge Functions + RPCs); **no backend changes in this slice**.

---

## Reference: spec & verified contracts

Spec: `docs/superpowers/specs/2026-05-30-journey-spine-design.md`.

**Verified API surface** (`src/lib/api.ts`, already implemented):
- `startSession(levelId): Promise<StartSessionResult>` → `{ session_id, puzzle: { grid, gaps }, view_duration_ms, select_duration_ms, max_tries }`
- `submitAttempt({ sessionId, selection: { pieceType, count }[], viewMsRemaining, selectMsRemaining })` → `{ attempt: { solved, coverage, pillars: { accuracy, speed, efficiency, attempts, total, stars }, total, stars }, placements, session_status: 'cleared'|'exhausted'|'active', progress }`
- `getJourney()`, `getLevel(levelId)`, `getStats()` (rpc wrappers)

**Verified auth surface** (`src/lib/auth.ts`): `signInWithApple()`, `signInWithGoogle()`, `signInAsGuest()`, `signOut()`, `getSession()`.

**Verified scoring constants** (`@shared/core/scoring`): `PILLAR_MAX = { accuracy: 800, speed: 500, efficiency: 300, attempts: 400 }`.

**Verified types** (`@shared/types`): `Placement { pieceType, rotation, anchorRow, anchorCol, cells }`, `Resolution { kind: 'perfect'|'partial', placements, coverage, reason? }`, `Grid`, `Gap`, `PieceType`, `DifficultyConfig`, `SelectionEntry { pieceType, freeCount }`.

**Key architecture decisions locked for this plan:**
- **Separate `navStore`** (brainstorming chose "Nav store + mode-aware loop"). Components call both stores; stores don't import each other.
- **`submit()` dispatcher** on `gameStore` branches by `mode` so `SelectingPhase` stays mode-agnostic.
- **Journey reuses `ResolutionPhase`** for the fly-in/badge (fed by server placements), then routes to a dedicated `ResultsScreen` (`appView='results'`) for server-scored pillar bars + CTAs. The practice `ScorePanel` is *not* shown in journey mode.
- **Journey `triesUsed` mirrors practice semantics**: starts at 1 (current attempt #), increments after a non-final failed submit when `session_status === 'active'`. This keeps the existing `Hearts` math (`maxTries - triesUsed + 1`) unchanged. The **server** is authoritative; the client only mirrors.
- **Placements are NOT adapted** — server `placements` already come from the shared solver, so their shape matches `FlyerOverlay`'s consumer. (YAGNI; no adapter.)

---

## File Structure

```
src/
  store/
    navStore.ts          — NEW: appView, selectedLevelId, navigation actions
    gameStore.ts         — MODIFY: add mode, journeyResult, priorPr, levelDisplayNumber;
                           add startPractice, startJourneySession, submitJourneyAttempt,
                           retryJourney, submit (dispatcher)
  lib/
    api.ts               — MODIFY: type submitAttempt's return (SubmitAttemptResult)
    config.ts            — NEW: PROVIDERS_ENABLED flag
  components/
    App.tsx              — already exists as <GameShell/>; MODIFY to a routing host on appView
    AuthScreen.tsx       — NEW
    JourneyScreen.tsx    — NEW (sectioned grid + Practice entry)
    LevelDetailScreen.tsx— NEW (sheet over the map)
    ResultsScreen.tsx    — NEW (server-scored pillar bars + status CTAs)
    GameShell.tsx        — MODIFY: drop the idle start screen; mode-aware header label
    ResolutionPhase/
      index.tsx          — MODIFY: journey branch routes to ResultsScreen, skips ScorePanel
tests/
  store/
    navStore.test.ts        — NEW
    gameStore.journey.test.ts — NEW
  components/
    AuthScreen.test.tsx     — NEW
    JourneyScreen.test.tsx  — NEW
    ResultsScreen.test.tsx  — NEW
```

`App.tsx` currently is `export default function App() { return <GameShell /> }`. `src/main.tsx` renders `<App/>`. We keep that entry; `App` becomes the appView switch.

---

## Task 1: Client config flag

**Files:**
- Create: `src/lib/config.ts`
- Test: `tests/lib/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/config.test.ts
import { describe, it, expect } from 'vitest'
import { PROVIDERS_ENABLED } from '../../src/lib/config'

describe('client config', () => {
  it('ships with OAuth providers gated off by default', () => {
    expect(PROVIDERS_ENABLED).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/config.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/config`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/config.ts
// Gate for real Apple/Google OAuth. The provider buttons on AuthScreen always
// render and are clickable; this flag only governs an optional "coming soon"
// affordance and never hides the buttons. Flip to true once real credentials land.
export const PROVIDERS_ENABLED = false
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts tests/lib/config.test.ts
git commit -m "feat(client): add PROVIDERS_ENABLED config flag"
```

---

## Task 2: Navigation store

**Files:**
- Create: `src/store/navStore.ts`
- Test: `tests/store/navStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/store/navStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useNavStore.getState().reset()
})

describe('navStore', () => {
  it('starts on the auth view with no selected level', () => {
    const s = useNavStore.getState()
    expect(s.appView).toBe('auth')
    expect(s.selectedLevelId).toBeNull()
  })

  it('goJourney moves to the journey view', () => {
    useNavStore.getState().goJourney()
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('openLevel records the level id and shows the detail sheet', () => {
    useNavStore.getState().openLevel('lvl-7')
    const s = useNavStore.getState()
    expect(s.appView).toBe('levelDetail')
    expect(s.selectedLevelId).toBe('lvl-7')
  })

  it('enterPlaying, showResults, and backToMap drive the play→results→map loop', () => {
    const s = useNavStore.getState()
    s.openLevel('lvl-7')
    s.enterPlaying()
    expect(useNavStore.getState().appView).toBe('playing')
    s.showResults()
    expect(useNavStore.getState().appView).toBe('results')
    s.backToMap()
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('goPractice enters the practice view; goAuth returns to auth', () => {
    useNavStore.getState().goPractice()
    expect(useNavStore.getState().appView).toBe('practice')
    useNavStore.getState().goAuth()
    expect(useNavStore.getState().appView).toBe('auth')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/store/navStore.test.ts`
Expected: FAIL — cannot resolve `../../src/store/navStore`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/store/navStore.ts
import { create } from 'zustand'

export type AppView =
  | 'auth' | 'journey' | 'levelDetail' | 'playing' | 'results' | 'practice'

interface NavState {
  appView: AppView
  selectedLevelId: string | null
  goAuth: () => void
  goJourney: () => void
  openLevel: (id: string) => void
  enterPlaying: () => void
  showResults: () => void
  backToMap: () => void
  goPractice: () => void
  reset: () => void
}

const INITIAL = { appView: 'auth' as AppView, selectedLevelId: null as string | null }

export const useNavStore = create<NavState>((set) => ({
  ...INITIAL,
  goAuth: () => set({ appView: 'auth' }),
  goJourney: () => set({ appView: 'journey' }),
  openLevel: (id) => set({ appView: 'levelDetail', selectedLevelId: id }),
  enterPlaying: () => set({ appView: 'playing' }),
  showResults: () => set({ appView: 'results' }),
  backToMap: () => set({ appView: 'journey' }),
  goPractice: () => set({ appView: 'practice' }),
  reset: () => set({ ...INITIAL }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/store/navStore.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/navStore.ts tests/store/navStore.test.ts
git commit -m "feat(store): add navigation store for app-view routing"
```

---

## Task 3: gameStore `mode` flag + Practice entry

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.test.ts` (append) — existing tests MUST stay green

Add a `mode` field (default `'practice'`) and a `startPractice` action. `startPractice` just sets `mode='practice'` and runs the existing `startGame()` flow, so the practice path is explicit and the existing free-play tests are unaffected.

- [ ] **Step 1: Write the failing test (append to existing file)**

```ts
// tests/store/gameStore.test.ts — append a new describe block
describe('mode', () => {
  it('defaults to practice mode', () => {
    expect(useGameStore.getState().mode).toBe('practice')
  })

  it('startPractice sets practice mode and opens the countdown', () => {
    act(() => useGameStore.getState().startPractice())
    const s = useGameStore.getState()
    expect(s.mode).toBe('practice')
    expect(s.phase).toBe('countdown')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/store/gameStore.test.ts`
Expected: FAIL — `mode` is `undefined`; `startPractice` is not a function.

- [ ] **Step 3: Write minimal implementation**

In `src/store/gameStore.ts`:

1. Extend the store interface (add near the other action signatures):

```ts
  mode: 'practice' | 'journey'
  startPractice: () => void
```

2. Add `mode: 'practice'` to `INITIAL_STATE` — but note `INITIAL_STATE` is typed `GameState`. Add `mode` to `GameState` in `@shared/types` instead (so it is part of the canonical state). In `supabase/functions/_shared/types.ts`, add to `GameState`:

```ts
  mode: 'practice' | 'journey'
```

3. In `gameStore.ts` `INITIAL_STATE`, add:

```ts
  mode: 'practice',
```

4. Add the action inside the store body:

```ts
  startPractice: () => {
    set({ mode: 'practice' })
    get().startGame()
  },
```

- [ ] **Step 4: Run the full store suite to verify pass + no regressions**

Run: `npm run test -- tests/store/gameStore.test.ts`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 5: Type-check (GameState change touches shared types)**

Run: `npm run build`
Expected: build succeeds (no `noUnusedLocals`/type errors).

- [ ] **Step 6: Commit**

```bash
git add src/store/gameStore.ts supabase/functions/_shared/types.ts tests/store/gameStore.test.ts
git commit -m "feat(store): add game mode flag and startPractice entry"
```

---

## Task 4: api.ts — type the submitAttempt result

**Files:**
- Modify: `src/lib/api.ts`
- Test: covered indirectly by Task 5/Task 10 (this is a pure type addition; no runtime change)

- [ ] **Step 1: Add the result types and annotate the function**

In `src/lib/api.ts`, add an import and the interfaces, and change `submitAttempt`'s return type:

```ts
import type { Grid, Gap, PieceType, Placement } from '@shared/types'

export interface AttemptPillars {
  accuracy: number; speed: number; efficiency: number
  attempts: number; total: number; stars: number
}
export interface AttemptScore {
  solved: boolean
  coverage: number
  pillars: AttemptPillars
  total: number
  stars: number
}
export type SessionStatus = 'cleared' | 'exhausted' | 'active'
export interface SubmitAttemptResult {
  attempt: AttemptScore
  placements: Placement[]
  session_status: SessionStatus
  progress: unknown
}
```

Change the signature:

```ts
export async function submitAttempt(a: SubmitAttemptInput): Promise<SubmitAttemptResult> {
  const { data, error } = await supabase.functions.invoke('submit_attempt', {
    body: {
      session_id: a.sessionId, selection: a.selection,
      view_ms_remaining: a.viewMsRemaining, select_ms_remaining: a.selectMsRemaining,
    },
  })
  if (error) throw error
  return data as SubmitAttemptResult
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): type submitAttempt result shape"
```

---

## Task 5: gameStore journey session + submit + retry (same-puzzle invariant)

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: `tests/store/gameStore.journey.test.ts`

This is the heart of the slice. Mock `src/lib/api` so no network is hit.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/store/gameStore.journey.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import type { Grid, Cell } from '@shared/types'

// Mock the api module BEFORE importing the store.
vi.mock('../../src/lib/api', () => ({
  startSession: vi.fn(),
  submitAttempt: vi.fn(),
}))
import * as api from '../../src/lib/api'
import { useGameStore } from '../../src/store/gameStore'

// 2x2 all-filled grid is enough; the store never solves on the journey path.
function filledGrid(): Grid {
  const cell = (): Cell => ({ status: 'filled' })
  return Array.from({ length: 2 }, () => Array.from({ length: 2 }, cell))
}

const START_RESULT = {
  session_id: 'sess-1',
  puzzle: { grid: filledGrid(), gaps: [] },
  view_duration_ms: 7000,
  select_duration_ms: 9000,
  max_tries: 3,
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  vi.clearAllMocks()
})

describe('startJourneySession', () => {
  it('loads the server puzzle into state without local generation', async () => {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    await act(async () => {
      await useGameStore.getState().startJourneySession('lvl-1', 1200, 5)
    })
    const s = useGameStore.getState()
    expect(api.startSession).toHaveBeenCalledWith('lvl-1')
    expect(s.mode).toBe('journey')
    expect(s.sessionId).toBe('sess-1')
    expect(s.phase).toBe('countdown')
    expect(s.triesUsed).toBe(1)
    expect(s.maxTries).toBe(3)
    expect(s.priorPr).toBe(1200)
    expect(s.levelDisplayNumber).toBe(5)
    expect(s.difficulty.viewDuration).toBe(7000)
    expect(s.difficulty.selectDuration).toBe(9000)
    // sessionGrid is a pristine copy for retry replays.
    expect(s.sessionGrid).toHaveLength(2)
    expect(s.sessionGrid).not.toBe(s.grid)
  })
})

describe('submitJourneyAttempt', () => {
  async function startThenSubmit(submitResult: any) {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    ;(api.submitAttempt as any).mockResolvedValue(submitResult)
    await act(async () => {
      await useGameStore.getState().startJourneySession('lvl-1', 0, 1)
    })
    act(() => useGameStore.getState().beginViewing())
    act(() => useGameStore.getState().endViewing())
    await act(async () => {
      await useGameStore.getState().submitJourneyAttempt()
    })
  }

  it('stores the server result and enters the resolving phase on a clear', async () => {
    await startThenSubmit({
      attempt: { solved: true, coverage: 1,
        pillars: { accuracy: 800, speed: 300, efficiency: 200, attempts: 400, total: 1700, stars: 3 },
        total: 1700, stars: 3 },
      placements: [], session_status: 'cleared', progress: null,
    })
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s.journeyResult?.session_status).toBe('cleared')
    expect(s._resolution?.kind).toBe('perfect')
    // A cleared session must NOT offer another try.
    expect(s.triesUsed).toBe(1)
  })

  it('increments triesUsed when the session stays active after a miss', async () => {
    await startThenSubmit({
      attempt: { solved: false, coverage: 0.4,
        pillars: { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 },
        total: 0, stars: 0 },
      placements: [], session_status: 'active', progress: null,
    })
    const s = useGameStore.getState()
    expect(s.phase).toBe('resolving')
    expect(s._resolution?.kind).toBe('partial')
    expect(s.triesUsed).toBe(2)
  })

  it('does not increment triesUsed when the session is exhausted', async () => {
    await startThenSubmit({
      attempt: { solved: false, coverage: 0.4,
        pillars: { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 },
        total: 0, stars: 0 },
      placements: [], session_status: 'exhausted', progress: null,
    })
    expect(useGameStore.getState().triesUsed).toBe(1)
  })

  it('sends the cart as { pieceType, count } pairs', async () => {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    ;(api.submitAttempt as any).mockResolvedValue({
      attempt: { solved: true, coverage: 1,
        pillars: { accuracy: 800, speed: 0, efficiency: 0, attempts: 400, total: 1200, stars: 2 },
        total: 1200, stars: 2 },
      placements: [], session_status: 'cleared', progress: null,
    })
    await act(async () => { await useGameStore.getState().startJourneySession('lvl-1', 0, 1) })
    act(() => useGameStore.getState().beginViewing())
    act(() => useGameStore.getState().endViewing())
    act(() => { useGameStore.getState().incrementSelection('T') })
    act(() => { useGameStore.getState().incrementSelection('T') })
    await act(async () => { await useGameStore.getState().submitJourneyAttempt() })
    const arg = (api.submitAttempt as any).mock.calls[0][0]
    expect(arg.sessionId).toBe('sess-1')
    expect(arg.selection).toEqual([{ pieceType: 'T', count: 2 }])
  })
})

describe('retryJourney (same-puzzle invariant)', () => {
  it('replays the same session and puzzle without calling startSession again', async () => {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    ;(api.submitAttempt as any).mockResolvedValue({
      attempt: { solved: false, coverage: 0.3,
        pillars: { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 },
        total: 0, stars: 0 },
      placements: [], session_status: 'active', progress: null,
    })
    await act(async () => { await useGameStore.getState().startJourneySession('lvl-1', 0, 1) })
    act(() => useGameStore.getState().beginViewing())
    act(() => useGameStore.getState().endViewing())
    await act(async () => { await useGameStore.getState().submitJourneyAttempt() })

    const sessionBefore = useGameStore.getState().sessionId
    ;(api.startSession as any).mockClear()
    act(() => useGameStore.getState().retryJourney())
    const s = useGameStore.getState()
    expect(api.startSession).not.toHaveBeenCalled()
    expect(s.sessionId).toBe(sessionBefore)
    expect(s.phase).toBe('countdown')
    expect(s.selection).toEqual([])
    expect(s._resolution).toBeNull()
    expect(s.triesUsed).toBe(2) // carried over from the failed attempt
  })
})

describe('submit dispatcher', () => {
  it('routes to submitJourneyAttempt in journey mode', async () => {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    ;(api.submitAttempt as any).mockResolvedValue({
      attempt: { solved: true, coverage: 1,
        pillars: { accuracy: 800, speed: 0, efficiency: 0, attempts: 400, total: 1200, stars: 2 },
        total: 1200, stars: 2 },
      placements: [], session_status: 'cleared', progress: null,
    })
    await act(async () => { await useGameStore.getState().startJourneySession('lvl-1', 0, 1) })
    act(() => useGameStore.getState().beginViewing())
    act(() => useGameStore.getState().endViewing())
    await act(async () => { await useGameStore.getState().submit() })
    expect(api.submitAttempt).toHaveBeenCalledTimes(1)
    expect(useGameStore.getState().phase).toBe('resolving')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/store/gameStore.journey.test.ts`
Expected: FAIL — `startJourneySession`/`submitJourneyAttempt`/`retryJourney`/`submit` are not functions.

- [ ] **Step 3: Write minimal implementation**

In `src/store/gameStore.ts`:

1. Add the import at the top:

```ts
import { startSession, submitAttempt, type SubmitAttemptResult } from '../lib/api'
```

2. Extend `GameStore` interface with the new fields and actions:

```ts
  journeyResult: SubmitAttemptResult | null
  priorPr: number
  levelDisplayNumber: number | null
  startJourneySession: (levelId: string, priorPr: number, displayNumber: number) => Promise<void>
  submitJourneyAttempt: () => Promise<void>
  retryJourney: () => void
  submit: () => void | Promise<void>
```

3. Add to `INITIAL_STATE` (these are store-only, not in the shared `GameState`, so add them in the `create(...)` initializer alongside `_resolution` rather than `INITIAL_STATE`):

```ts
  journeyResult: null,
  priorPr: 0,
  levelDisplayNumber: null,
```

   And add to `resetGame`:

```ts
  resetGame: () => set({ ...INITIAL_STATE, _resolution: null, journeyResult: null, priorPr: 0, levelDisplayNumber: null }),
```

4. Add the actions inside the store body:

```ts
  startJourneySession: async (levelId, priorPr, displayNumber) => {
    const res = await startSession(levelId)
    const difficulty: DifficultyConfig = {
      viewDuration: res.view_duration_ms,
      selectDuration: res.select_duration_ms,
      placeDuration: 0,
      gapCount: res.puzzle.gaps.length,
      complexity: 'medium',
    }
    set({
      mode: 'journey',
      phase: 'countdown',
      sessionId: res.session_id,
      levelId,
      priorPr,
      levelDisplayNumber: displayNumber,
      grid: res.puzzle.grid.map(row => row.map(cell => ({ ...cell }))),
      sessionGrid: res.puzzle.grid.map(row => row.map(cell => ({ ...cell }))),
      gaps: res.puzzle.gaps,
      selection: [],
      difficulty,
      maxTries: res.max_tries,
      triesUsed: 1,
      roundScore: null,
      journeyResult: null,
      phaseStartTime: 0,
      phaseDuration: 0,
      viewTimeRemaining: 0,
      _resolution: null,
    })
  },

  submitJourneyAttempt: async () => {
    const { phase, selection, sessionId, difficulty, phaseStartTime, viewTimeRemaining, triesUsed } = get()
    if (phase !== 'selecting') return // guard against double-submit (timer + click)

    const apiSelection = selection
      .filter(e => e.freeCount > 0)
      .map(e => ({ pieceType: e.pieceType, count: e.freeCount }))
    const selectElapsed = Date.now() - phaseStartTime
    const selectTimeRemaining = Math.max(0, difficulty.selectDuration - selectElapsed)

    const res = await submitAttempt({
      sessionId,
      selection: apiSelection,
      viewMsRemaining: viewTimeRemaining,
      selectMsRemaining: selectTimeRemaining,
    })

    const solved = res.attempt.solved
    set({
      phase: 'resolving',
      journeyResult: res,
      _resolution: {
        kind: solved ? 'perfect' : 'partial',
        placements: res.placements ?? [],
        coverage: res.attempt.coverage,
      },
      // Mirror the server: another try only if the session is still active.
      triesUsed: res.session_status === 'active' ? triesUsed + 1 : triesUsed,
      roundScore: null,
    })
  },

  // Try Again on the journey path: replay the SAME session_id and the SAME
  // in-memory puzzle (restore sessionGrid). Does NOT call startSession — that
  // would re-roll the seed and break the 3-tries/same-puzzle invariant.
  retryJourney: () => {
    set(state => ({
      phase: 'countdown',
      selection: [],
      roundScore: null,
      journeyResult: null,
      _resolution: null,
      grid: state.sessionGrid.map(row => row.map(cell => ({ ...cell }))),
      phaseStartTime: 0,
      phaseDuration: 0,
      viewTimeRemaining: 0,
    }))
  },

  submit: () => {
    return get().mode === 'journey'
      ? get().submitJourneyAttempt()
      : get().submitSelection()
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/store/gameStore.journey.test.ts`
Expected: PASS (all blocks).

- [ ] **Step 5: Run the full store suite + build**

Run: `npm run test -- tests/store/`
Then: `npm run build`
Expected: all pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.journey.test.ts
git commit -m "feat(store): add journey session, submit, retry, and submit dispatcher"
```

---

## Task 6: SelectingPhase uses the submit dispatcher

**Files:**
- Modify: `src/components/SelectingPhase.tsx`
- Test: existing `tests/components/*` (no new test; the dispatcher is unit-tested in Task 5). Verify practice regression.

Make `SelectingPhase` call the mode-agnostic `submit` instead of `submitSelection`, so journey submits hit the server path.

- [ ] **Step 1: Edit the component**

In `src/components/SelectingPhase.tsx`, replace `submitSelection` with `submit` in the selector, the timer effect, and the Done button:

```ts
  const {
    selection, incrementSelection, decrementSelection,
    submit, phaseDuration,
  } = useGameStore(useShallow(s => ({
    selection: s.selection,
    incrementSelection: s.incrementSelection,
    decrementSelection: s.decrementSelection,
    submit: s.submit,
    phaseDuration: s.phaseDuration,
  })))

  useEffect(() => {
    const timer = setTimeout(submit, phaseDuration)
    return () => clearTimeout(timer)
  }, [phaseDuration, submit])
```

And the Done button: `onClick={submit}`.

- [ ] **Step 2: Verify practice still works (regression)**

Run: `npm run test -- tests/components/ResolutionPhase.test.tsx tests/store/gameStore.test.ts`
Then: `npm run build`
Expected: PASS; build clean. (Practice `submit` → `submitSelection`, unchanged behavior.)

- [ ] **Step 3: Commit**

```bash
git add src/components/SelectingPhase.tsx
git commit -m "refactor(selecting): submit via mode-aware dispatcher"
```

---

## Task 7: ResolutionPhase journey branch → ResultsScreen

**Files:**
- Modify: `src/components/ResolutionPhase/index.tsx`
- Test: `tests/components/ResolutionPhase.test.tsx` (append a journey case)

In journey mode, the fly-in/badge animation still plays (reused verbatim, fed by server `_resolution.placements`), but the practice `ScorePanel` and practice CTAs are NOT shown. When the animation settles, `ResolutionPhase` calls `navStore.showResults()` to hand off to the server-scored `ResultsScreen`.

- [ ] **Step 1: Write the failing test (append)**

```ts
// tests/components/ResolutionPhase.test.tsx — append
import { useNavStore } from '../../src/store/navStore'

describe('ResolutionPhase in journey mode', () => {
  it('routes to results (does not show the practice score panel) when the badge settles', () => {
    useNavStore.getState().reset()
    // Drive the store directly into a journey resolving state.
    act(() => {
      useGameStore.setState({
        mode: 'journey',
        phase: 'resolving',
        selection: [],
        _resolution: { kind: 'perfect', placements: [], coverage: 1 },
        journeyResult: {
          attempt: { solved: true, coverage: 1,
            pillars: { accuracy: 800, speed: 0, efficiency: 0, attempts: 400, total: 1200, stars: 2 },
            total: 1200, stars: 2 },
          placements: [], session_status: 'cleared', progress: null,
        },
        roundScore: null,
      } as any)
    })
    render(<ResolutionPhase />)
    // With reduced motion mocked true, the journey branch reaches the results
    // hand-off synchronously: showResults() has been called.
    expect(useNavStore.getState().appView).toBe('results')
    // The practice "Next Round" CTA must NOT appear on the journey path.
    expect(screen.queryByText(/Next Round/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/components/ResolutionPhase.test.tsx`
Expected: FAIL — `appView` stays `'auth'`; the practice CTA still renders.

- [ ] **Step 3: Implement the journey branch**

In `src/components/ResolutionPhase/index.tsx`:

1. Add imports:

```ts
import { useNavStore } from '../../store/navStore'
```

2. Read `mode` and `showResults` from the stores. Extend the existing `useGameStore(useShallow(...))` selector with `mode: s.mode`, and add:

```ts
  const showResults = useNavStore(s => s.showResults)
```

3. Reduced-motion path: after applying placements, branch by mode. Replace the reduced-motion effect's tail (`commitRoundScore(); setStage('cta')`) with:

```ts
    if (mode === 'journey') { showResults(); return }
    commitRoundScore()
    setStage('cta')
```

4. Animated path: in the `stage === 'badge'` effect, branch before scheduling the scoring stage:

```ts
  useEffect(() => {
    if (stage !== 'badge') return
    if (mode === 'journey') {
      const t = window.setTimeout(() => showResults(), BADGE_DURATION)
      return () => clearTimeout(t)
    }
    const t = window.setTimeout(() => setStage('scoring'), BADGE_DURATION)
    return () => clearTimeout(t)
  }, [stage, mode, showResults])
```

   (The journey path never enters `'scoring'`/`'cta'`, so the practice `ScorePanel` and `NextRoundButton` blocks below — which are gated on `stage === 'scoring'`/`'cta'` and on `roundScore` — never render. `roundScore` is `null` in journey, so the `ScorePanel` block is already skipped.)

- [ ] **Step 4: Run to verify it passes (+ practice regression)**

Run: `npm run test -- tests/components/ResolutionPhase.test.tsx`
Expected: PASS — journey case routes to results; existing practice cases still green.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResolutionPhase/index.tsx tests/components/ResolutionPhase.test.tsx
git commit -m "feat(resolution): route journey resolution to ResultsScreen"
```

---

## Task 8: AuthScreen

**Files:**
- Create: `src/components/AuthScreen.tsx`
- Test: `tests/components/AuthScreen.test.tsx`

Three live buttons. Guest → `signInAsGuest()` then `goJourney()` on success. Apple/Google → call helper; on error show an inline message (never crash).

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/AuthScreen.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/auth', () => ({
  signInAsGuest: vi.fn(),
  signInWithApple: vi.fn(),
  signInWithGoogle: vi.fn(),
}))
import * as auth from '../../src/lib/auth'
import { AuthScreen } from '../../src/components/AuthScreen'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('AuthScreen', () => {
  it('renders all three sign-in options', () => {
    render(<AuthScreen />)
    expect(screen.getByRole('button', { name: /Apple/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guest/i })).toBeInTheDocument()
  })

  it('guest sign-in calls signInAsGuest and navigates to the journey', async () => {
    ;(auth.signInAsGuest as any).mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: /Guest/i }))
    expect(auth.signInAsGuest).toHaveBeenCalledTimes(1)
    expect(useNavStore.getState().appView).toBe('journey')
  })

  it('shows an inline error when a provider sign-in fails', async () => {
    ;(auth.signInWithApple as any).mockResolvedValue({ data: {}, error: { message: 'Provider not enabled' } })
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: /Apple/i }))
    expect(await screen.findByText(/Provider not enabled/i)).toBeInTheDocument()
    // Did not navigate away.
    expect(useNavStore.getState().appView).toBe('auth')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/components/AuthScreen.test.tsx`
Expected: FAIL — cannot resolve `AuthScreen`.

- [ ] **Step 3: Implement**

```tsx
// src/components/AuthScreen.tsx
import { useState } from 'react'
import { signInAsGuest, signInWithApple, signInWithGoogle } from '../lib/auth'
import { useNavStore } from '../store/navStore'

export function AuthScreen() {
  const goJourney = useNavStore(s => s.goJourney)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, navigate: boolean) => {
    setError(null)
    setBusy(true)
    try {
      const { error } = await fn()
      if (error) { setError(error.message); return }
      if (navigate) goJourney()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center px-4">
      <div className="inline-flex flex-col items-stretch w-full max-w-sm text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Mind The Gap</h1>
        <p className="text-gray-400 mb-8">Sign in to start your journey.</p>

        <button disabled={busy} onClick={() => run(signInWithApple, false)}
          className="w-full py-3 mb-3 rounded-xl font-bold bg-white text-black hover:bg-gray-200 disabled:opacity-50">
          Sign in with Apple
        </button>
        <button disabled={busy} onClick={() => run(signInWithGoogle, false)}
          className="w-full py-3 mb-3 rounded-xl font-bold bg-gray-100 text-black hover:bg-gray-300 disabled:opacity-50">
          Sign in with Google
        </button>
        <button disabled={busy} onClick={() => run(signInAsGuest, true)}
          className="w-full py-3 rounded-xl font-bold bg-green-700 text-white hover:bg-green-600 disabled:opacity-50">
          Play as Guest
        </button>

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/components/AuthScreen.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AuthScreen.tsx tests/components/AuthScreen.test.tsx
git commit -m "feat(auth): add sign-in screen with guest + provider buttons"
```

---

## Task 9: JourneyScreen (sectioned grid)

**Files:**
- Create: `src/components/JourneyScreen.tsx`
- Test: `tests/components/JourneyScreen.test.tsx`

Fetch `getJourney()`; render each theme as a titled section. Unlocked themes show level cards (number, stars, PR badge, cleared check) — tapping a card calls `openLevel(level_id)`. Locked themes show a lock + disabled cards. Include a **Practice** entry that calls `startPractice()` then `goPractice()`. On fetch error, show a retry affordance.

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/JourneyScreen.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({ getJourney: vi.fn() }))
import * as api from '../../src/lib/api'
import { JourneyScreen } from '../../src/components/JourneyScreen'
import { useNavStore } from '../../src/store/navStore'

const JOURNEY = [
  { theme_id: 't1', slug: 'beginner', name: 'Beginner', mechanic: 'classic', sort_order: 1, locked: false,
    levels: [
      { level_id: 'l1', display_number: 1, my_pr: 1820, my_stars: 3, cleared: true, last_played: null, global_best: 1900 },
      { level_id: 'l2', display_number: 2, my_pr: null, my_stars: 0, cleared: false, last_played: null, global_best: null },
    ] },
  { theme_id: 't2', slug: 'advanced', name: 'Advanced', mechanic: 'menu-trim', sort_order: 2, locked: true,
    levels: [
      { level_id: 'l9', display_number: 9, my_pr: null, my_stars: 0, cleared: false, last_played: null, global_best: null },
    ] },
]

beforeEach(() => {
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('JourneyScreen', () => {
  it('renders unlocked theme sections with level cards and PR badges', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    render(<JourneyScreen />)
    expect(await screen.findByText('Beginner')).toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
    expect(screen.getByText(/1820/)).toBeInTheDocument() // PR badge on cleared level
  })

  it('opens the level detail when an unlocked card is tapped', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    const user = userEvent.setup()
    render(<JourneyScreen />)
    await screen.findByText('Beginner')
    await user.click(screen.getByRole('button', { name: /Level 1/i }))
    const s = useNavStore.getState()
    expect(s.appView).toBe('levelDetail')
    expect(s.selectedLevelId).toBe('l1')
  })

  it('does not open locked-theme levels', async () => {
    ;(api.getJourney as any).mockResolvedValue(JOURNEY)
    const user = userEvent.setup()
    render(<JourneyScreen />)
    await screen.findByText('Advanced')
    const locked = screen.getByRole('button', { name: /Level 9/i })
    expect(locked).toBeDisabled()
  })

  it('shows a retry affordance when the journey fetch fails', async () => {
    ;(api.getJourney as any).mockRejectedValue(new Error('network'))
    render(<JourneyScreen />)
    expect(await screen.findByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/components/JourneyScreen.test.tsx`
Expected: FAIL — cannot resolve `JourneyScreen`.

- [ ] **Step 3: Implement**

```tsx
// src/components/JourneyScreen.tsx
import { useCallback, useEffect, useState } from 'react'
import { getJourney } from '../lib/api'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'

interface JourneyLevel {
  level_id: string; display_number: number
  my_pr: number | null; my_stars: number; cleared: boolean
  last_played: string | null; global_best: number | null
}
interface JourneyTheme {
  theme_id: string; slug: string; name: string; mechanic: string
  sort_order: number; locked: boolean; levels: JourneyLevel[]
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-xs tracking-tight">
      {[0, 1, 2].map(i => (
        <span key={i} className={i < n ? 'text-yellow-400' : 'text-gray-700'}>★</span>
      ))}
    </span>
  )
}

export function JourneyScreen() {
  const openLevel = useNavStore(s => s.openLevel)
  const goPractice = useNavStore(s => s.goPractice)
  const startPractice = useGameStore(s => s.startPractice)
  const [themes, setThemes] = useState<JourneyTheme[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    setThemes(null)
    try {
      setThemes((await getJourney()) as JourneyTheme[])
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const enterPractice = () => { startPractice(); goPractice() }

  if (error) {
    return (
      <div className="min-h-dvh bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Couldn’t load the journey.</p>
        <button onClick={load} className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 font-bold">Retry</button>
      </div>
    )
  }

  if (!themes) {
    return <div className="min-h-dvh bg-gray-950 text-gray-500 flex items-center justify-center">Loading…</div>
  }

  return (
    <div className="min-h-dvh bg-gray-950 text-white px-4 py-4">
      <div className="flex items-center justify-between mb-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold">Mind The Gap</h1>
        <button onClick={enterPractice} className="text-sm text-cyan-400 hover:text-cyan-300 font-semibold">Practice</button>
      </div>

      <div className="max-w-md mx-auto flex flex-col gap-6">
        {themes.map(theme => (
          <section key={theme.theme_id}>
            <div className="text-xs font-bold tracking-widest uppercase mb-2 flex items-center gap-2">
              {theme.locked && <span>🔒</span>}
              <span className={theme.locked ? 'text-gray-500' : 'text-cyan-300'}>{theme.name}</span>
            </div>
            <div className={`grid grid-cols-3 gap-2 ${theme.locked ? 'opacity-50' : ''}`}>
              {theme.levels.map(lvl => (
                <button
                  key={lvl.level_id}
                  disabled={theme.locked}
                  onClick={() => openLevel(lvl.level_id)}
                  className="rounded-xl p-2 text-center border border-gray-700 bg-gray-900
                    enabled:hover:border-gray-500 disabled:cursor-not-allowed"
                >
                  <div className="font-bold text-sm">Level {lvl.display_number}</div>
                  <Stars n={lvl.my_stars} />
                  <div className="text-[10px] text-gray-500 mt-1">
                    {lvl.cleared && lvl.my_pr != null ? `PR ${lvl.my_pr}` : theme.locked ? '🔒' : '—'}
                  </div>
                  {lvl.cleared && <div className="text-green-400 text-[10px]">✓ cleared</div>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/components/JourneyScreen.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/JourneyScreen.tsx tests/components/JourneyScreen.test.tsx
git commit -m "feat(journey): add sectioned-grid journey map screen"
```

---

## Task 10: LevelDetailScreen (sheet)

**Files:**
- Create: `src/components/LevelDetailScreen.tsx`
- Test: `tests/components/LevelDetailScreen.test.tsx`

Fetch `getLevel(selectedLevelId)`; show theme name, level number, my PR, global high, last played, and a **PLAY** button. PLAY → `startJourneySession(level_id, my_pr ?? 0, display_number)` then `enterPlaying()`. A Close/back control → `goJourney()`. On fetch error, retry affordance.

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/LevelDetailScreen.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({ getLevel: vi.fn() }))
const startJourneySession = vi.fn().mockResolvedValue(undefined)
vi.mock('../../src/store/gameStore', () => ({
  useGameStore: (sel: any) => sel({ startJourneySession }),
}))
import * as api from '../../src/lib/api'
import { LevelDetailScreen } from '../../src/components/LevelDetailScreen'
import { useNavStore } from '../../src/store/navStore'

const LEVEL = {
  level_id: 'l1', display_number: 1, theme_name: 'Beginner',
  view_duration_ms: 7000, select_duration_ms: 9000,
  gap_count: 4, shape_complexity: 'simple', adjacency: 'low',
  my_pr: 1820, my_stars: 3, global_high: 1950, last_played: null,
}

beforeEach(() => {
  useNavStore.getState().reset()
  useNavStore.getState().openLevel('l1')
  vi.clearAllMocks()
})

describe('LevelDetailScreen', () => {
  it('shows the level metadata once loaded', async () => {
    ;(api.getLevel as any).mockResolvedValue(LEVEL)
    render(<LevelDetailScreen />)
    expect(await screen.findByText(/Beginner/)).toBeInTheDocument()
    expect(screen.getByText(/1820/)).toBeInTheDocument()
    expect(screen.getByText(/1950/)).toBeInTheDocument()
  })

  it('PLAY starts a journey session and enters playing', async () => {
    ;(api.getLevel as any).mockResolvedValue(LEVEL)
    const user = userEvent.setup()
    render(<LevelDetailScreen />)
    await screen.findByText(/Beginner/)
    await user.click(screen.getByRole('button', { name: /PLAY/i }))
    expect(startJourneySession).toHaveBeenCalledWith('l1', 1820, 1)
    expect(useNavStore.getState().appView).toBe('playing')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/components/LevelDetailScreen.test.tsx`
Expected: FAIL — cannot resolve `LevelDetailScreen`.

- [ ] **Step 3: Implement**

```tsx
// src/components/LevelDetailScreen.tsx
import { useCallback, useEffect, useState } from 'react'
import { getLevel } from '../lib/api'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'

interface LevelDetail {
  level_id: string; display_number: number; theme_name: string
  view_duration_ms: number; select_duration_ms: number
  gap_count: number; shape_complexity: string; adjacency: string
  my_pr: number | null; my_stars: number; global_high: number | null; last_played: string | null
}

export function LevelDetailScreen() {
  const selectedLevelId = useNavStore(s => s.selectedLevelId)
  const goJourney = useNavStore(s => s.goJourney)
  const enterPlaying = useNavStore(s => s.enterPlaying)
  const startJourneySession = useGameStore(s => s.startJourneySession)
  const [level, setLevel] = useState<LevelDetail | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!selectedLevelId) return
    setError(false); setLevel(null)
    try {
      setLevel((await getLevel(selectedLevelId)) as LevelDetail)
    } catch {
      setError(true)
    }
  }, [selectedLevelId])

  useEffect(() => { load() }, [load])

  const play = async () => {
    if (!level) return
    setBusy(true)
    await startJourneySession(level.level_id, level.my_pr ?? 0, level.display_number)
    enterPlaying()
  }

  return (
    <div className="min-h-dvh bg-gray-950/90 text-white flex items-end sm:items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-5">
        <div className="flex justify-between items-start mb-4">
          <button onClick={goJourney} className="text-gray-500 hover:text-gray-300 text-sm">← Back</button>
        </div>

        {error && (
          <div className="text-center py-6">
            <p className="text-gray-400 mb-4">Couldn’t load this level.</p>
            <button onClick={load} className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 font-bold">Retry</button>
          </div>
        )}

        {!error && !level && <p className="text-gray-500 text-center py-6">Loading…</p>}

        {level && (
          <>
            <div className="text-xs font-bold tracking-widest uppercase text-cyan-300 mb-1">{level.theme_name}</div>
            <h2 className="text-2xl font-bold mb-4">Level {level.display_number}</h2>
            <dl className="text-sm text-gray-300 space-y-1 mb-6">
              <div className="flex justify-between"><dt className="text-gray-500">My PR</dt><dd>{level.my_pr ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Global high</dt><dd>{level.global_high ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Last played</dt><dd>{level.last_played ?? 'never'}</dd></div>
            </dl>
            <button disabled={busy} onClick={play}
              className="w-full py-3 rounded-xl font-bold bg-green-700 hover:bg-green-600 disabled:opacity-50">
              PLAY
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/components/LevelDetailScreen.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LevelDetailScreen.tsx tests/components/LevelDetailScreen.test.tsx
git commit -m "feat(journey): add level detail sheet with PLAY entry"
```

---

## Task 11: ResultsScreen (server-scored pillar bars + CTAs)

**Files:**
- Create: `src/components/ResultsScreen.tsx`
- Test: `tests/components/ResultsScreen.test.tsx`

Render `journeyResult.attempt`: four per-pillar % fill bars against each pillar's own max (`PILLAR_MAX`), labeled with raw points; stars (0–3); coverage for a failed attempt; PR-break celebration when `attempt.total > priorPr` on a clear. CTAs by `session_status`: `active` → **Try Again ↺** (`retryJourney()` then `enterPlaying()`) + **Back to Map** (`backToMap()`); `cleared`/`exhausted` → **Back to Map** only.

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/ResultsScreen.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { ResultsScreen } from '../../src/components/ResultsScreen'
import { useGameStore } from '../../src/store/gameStore'
import { useNavStore } from '../../src/store/navStore'

function seedResult(over: Partial<any> = {}) {
  act(() => {
    useGameStore.setState({
      priorPr: over.priorPr ?? 0,
      journeyResult: over.journeyResult ?? {
        attempt: { solved: true, coverage: 1,
          pillars: { accuracy: 800, speed: 250, efficiency: 150, attempts: 400, total: 1600, stars: 3 },
          total: 1600, stars: 3 },
        placements: [], session_status: 'cleared', progress: null,
      },
    } as any)
  })
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  useNavStore.getState().reset()
})

describe('ResultsScreen', () => {
  it('renders the four pillar bars with raw points', () => {
    seedResult()
    render(<ResultsScreen />)
    expect(screen.getByText(/Accuracy/i)).toBeInTheDocument()
    expect(screen.getByText(/800\s*\/\s*800/)).toBeInTheDocument()
    expect(screen.getByText(/250\s*\/\s*500/)).toBeInTheDocument()
    expect(screen.getByText(/150\s*\/\s*300/)).toBeInTheDocument()
    expect(screen.getByText(/400\s*\/\s*400/)).toBeInTheDocument()
  })

  it('shows a PR-break celebration when total beats the prior PR on a clear', () => {
    seedResult({ priorPr: 1200 })
    render(<ResultsScreen />)
    expect(screen.getByText(/New PR/i)).toBeInTheDocument()
  })

  it('shows only Back to Map after a clear', () => {
    seedResult()
    render(<ResultsScreen />)
    expect(screen.getByRole('button', { name: /Back to Map/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Try Again/i })).not.toBeInTheDocument()
  })

  it('offers Try Again on an active session and replays the same session', async () => {
    seedResult({
      journeyResult: {
        attempt: { solved: false, coverage: 0.4,
          pillars: { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 },
          total: 0, stars: 0 },
        placements: [], session_status: 'active', progress: null,
      },
    })
    const retrySpy = vi.spyOn(useGameStore.getState(), 'retryJourney')
    const user = userEvent.setup()
    render(<ResultsScreen />)
    await user.click(screen.getByRole('button', { name: /Try Again/i }))
    expect(retrySpy).toHaveBeenCalledTimes(1)
    expect(useNavStore.getState().appView).toBe('playing')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/components/ResultsScreen.test.tsx`
Expected: FAIL — cannot resolve `ResultsScreen`.

- [ ] **Step 3: Implement**

```tsx
// src/components/ResultsScreen.tsx
import { useShallow } from 'zustand/shallow'
import { useGameStore } from '../store/gameStore'
import { useNavStore } from '../store/navStore'
import { PILLAR_MAX } from '@shared/core/scoring'

const PILLARS: { key: keyof typeof PILLAR_MAX; label: string; color: string }[] = [
  { key: 'accuracy', label: 'Accuracy', color: 'bg-green-500' },
  { key: 'speed', label: 'Speed', color: 'bg-cyan-400' },
  { key: 'efficiency', label: 'Efficiency', color: 'bg-purple-400' },
  { key: 'attempts', label: 'Attempts', color: 'bg-amber-400' },
]

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{value} / {max}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ResultsScreen() {
  const { journeyResult, priorPr, retryJourney } = useGameStore(useShallow(s => ({
    journeyResult: s.journeyResult,
    priorPr: s.priorPr,
    retryJourney: s.retryJourney,
  })))
  const { enterPlaying, backToMap } = useNavStore(useShallow(s => ({
    enterPlaying: s.enterPlaying,
    backToMap: s.backToMap,
  })))

  if (!journeyResult) return null
  const { attempt, session_status } = journeyResult
  const isClear = attempt.solved
  const prBreak = isClear && attempt.total > priorPr
  const canRetry = session_status === 'active'

  const tryAgain = () => { retryJourney(); enterPlaying() }

  return (
    <div className="min-h-dvh bg-gray-950 text-white flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold mb-1">
            {isClear ? 'Cleared!' : session_status === 'exhausted' ? 'Out of tries' : 'Missed it'}
          </div>
          <div className="text-2xl">
            {[0, 1, 2].map(i => (
              <span key={i} className={i < attempt.stars ? 'text-yellow-400' : 'text-gray-700'}>★</span>
            ))}
          </div>
          {prBreak && <div className="text-yellow-300 font-bold mt-2">🎉 New PR — {attempt.total}!</div>}
          {!isClear && (
            <div className="text-gray-400 text-sm mt-2">Coverage {Math.round(attempt.coverage * 100)}%</div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
          {PILLARS.map(p => (
            <Bar key={p.key} label={p.label} value={attempt.pillars[p.key]} max={PILLAR_MAX[p.key]} color={p.color} />
          ))}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-800 mt-2">
            <span>Total</span><span className="text-yellow-400">{attempt.total}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {canRetry && (
            <button onClick={tryAgain}
              className="w-full py-3 rounded-xl font-bold bg-blue-700 hover:bg-blue-600">Try Again ↺</button>
          )}
          <button onClick={backToMap}
            className="w-full py-3 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 border border-gray-600">
            Back to Map
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/components/ResultsScreen.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ResultsScreen.tsx tests/components/ResultsScreen.test.tsx
git commit -m "feat(journey): add server-scored results screen"
```

---

## Task 12: Journey error handling (spec §6)

**Files:**
- Modify: `src/store/gameStore.ts` (add `journeyError`, catch in `submitJourneyAttempt`)
- Modify: `src/components/LevelDetailScreen.tsx` (catch a failed session start)
- Modify: `src/components/SelectingPhase.tsx` (surface a submit failure + Back to Map)
- Test: `tests/store/gameStore.journey.test.ts` (append)

Journey is intentionally online-only — on an API failure we surface a retry/escape rather than falling back to local scoring (which would break server authority). This task covers the three failure points the spec calls out: **map load** (already handled in Task 9's `JourneyScreen` retry), **session start**, and **submit**.

- [ ] **Step 1: Write the failing tests (append to `tests/store/gameStore.journey.test.ts`)**

```ts
describe('journey error handling', () => {
  it('keeps the player in selecting and records an error when submit fails', async () => {
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    ;(api.submitAttempt as any).mockRejectedValue(new Error('network down'))
    await act(async () => { await useGameStore.getState().startJourneySession('lvl-1', 0, 1) })
    act(() => useGameStore.getState().beginViewing())
    act(() => useGameStore.getState().endViewing())
    await act(async () => { await useGameStore.getState().submitJourneyAttempt() })
    const s = useGameStore.getState()
    expect(s.phase).toBe('selecting')          // not advanced to resolving
    expect(s._resolution).toBeNull()
    expect(s.journeyError).toMatch(/network down/)
  })

  it('clears a prior error on the next session start and on retry', async () => {
    useGameStore.setState({ journeyError: 'stale' } as any)
    ;(api.startSession as any).mockResolvedValue(START_RESULT)
    await act(async () => { await useGameStore.getState().startJourneySession('lvl-1', 0, 1) })
    expect(useGameStore.getState().journeyError).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/store/gameStore.journey.test.ts`
Expected: FAIL — `journeyError` is `undefined`; `submitJourneyAttempt` currently lets the rejection propagate.

- [ ] **Step 3: Implement the store changes**

In `src/store/gameStore.ts`:

1. Add to the `GameStore` interface:

```ts
  journeyError: string | null
  clearJourneyError: () => void
```

2. Add `journeyError: null` to the `create(...)` initializer (alongside `journeyResult`) and to `resetGame`'s `set({ ... })`.

3. In `startJourneySession`, add `journeyError: null` to its `set({ ... })`. In `retryJourney`, add `journeyError: null` to its `set(...)`.

4. Wrap the network call in `submitJourneyAttempt` so a failure surfaces an error instead of throwing:

```ts
    let res: SubmitAttemptResult
    try {
      res = await submitAttempt({
        sessionId,
        selection: apiSelection,
        viewMsRemaining: viewTimeRemaining,
        selectMsRemaining: selectTimeRemaining,
      })
    } catch (e) {
      set({ journeyError: e instanceof Error ? e.message : 'Submit failed' })
      return
    }
```

   (The existing happy-path `set({ phase: 'resolving', ... })` follows unchanged.)

5. Add the action:

```ts
  clearJourneyError: () => set({ journeyError: null }),
```

- [ ] **Step 4: Run to verify store tests pass**

Run: `npm run test -- tests/store/gameStore.journey.test.ts`
Expected: PASS.

- [ ] **Step 5: Surface a failed session start in LevelDetailScreen**

In `src/components/LevelDetailScreen.tsx`, make `play()` resilient:

```ts
  const play = async () => {
    if (!level) return
    setBusy(true)
    try {
      await startJourneySession(level.level_id, level.my_pr ?? 0, level.display_number)
      enterPlaying()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
```

(The existing `error` state already renders a Retry affordance, so a failed start now shows it instead of hanging on `busy`.)

- [ ] **Step 6: Surface a submit failure in SelectingPhase**

In `src/components/SelectingPhase.tsx`, read `journeyError` and `backToMap`, and render a banner when set:

```ts
import { useNavStore } from '../store/navStore'
// ...
  const journeyError = useGameStore(s => s.journeyError)
  const backToMap = useNavStore(s => s.backToMap)
```

Add above the piece menu (inside the outer `div`):

```tsx
      {journeyError && (
        <div className="bg-red-950 border border-red-700 rounded-xl p-3 text-sm text-red-300 flex items-center justify-between gap-3">
          <span>Couldn’t submit: {journeyError}</span>
          <button onClick={backToMap} className="shrink-0 px-3 py-1 rounded-lg bg-red-800 hover:bg-red-700 font-semibold">
            Back to Map
          </button>
        </div>
      )}
```

- [ ] **Step 7: Verify build + practice regression**

Run: `npm run test -- tests/store/ tests/components/`
Then: `npm run build`
Expected: PASS; build clean. (Practice mode never sets `journeyError`, so the banner never shows there.)

- [ ] **Step 8: Commit**

```bash
git add src/store/gameStore.ts src/components/LevelDetailScreen.tsx src/components/SelectingPhase.tsx tests/store/gameStore.journey.test.ts
git commit -m "feat(journey): handle session-start and submit failures gracefully"
```

---

## Task 13: App routing host + GameShell refactor

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/GameShell.tsx`
- Test: `tests/components/App.test.tsx` (NEW)

`App` boots by calling `getSession()`: a session → `goJourney()`, else → `goAuth()`. It then renders by `appView`. `GameShell` drops its idle start screen (App now owns entry) and shows a mode-aware header label ("Level N" in journey, "Round N" in practice).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/App.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../../src/lib/auth', () => ({
  getSession: vi.fn(),
}))
// Keep the journey screen from hitting the network in this routing test.
vi.mock('../../src/lib/api', () => ({ getJourney: vi.fn().mockResolvedValue([]) }))
import * as auth from '../../src/lib/auth'
import App from '../../src/App'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('App routing', () => {
  it('shows the auth screen when there is no session', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: null } })
    render(<App />)
    expect(await screen.findByText(/Play as Guest/i)).toBeInTheDocument()
    expect(useNavStore.getState().appView).toBe('auth')
  })

  it('routes to the journey when a session exists', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    render(<App />)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('journey'))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/components/App.test.tsx`
Expected: FAIL — `App` still renders `<GameShell/>` only; no auth screen / no routing.

- [ ] **Step 3: Implement App routing host**

```tsx
// src/App.tsx
import { useEffect } from 'react'
import { useShallow } from 'zustand/shallow'
import { getSession } from './lib/auth'
import { useNavStore } from './store/navStore'
import { AuthScreen } from './components/AuthScreen'
import { JourneyScreen } from './components/JourneyScreen'
import { LevelDetailScreen } from './components/LevelDetailScreen'
import { ResultsScreen } from './components/ResultsScreen'
import { GameShell } from './components/GameShell'

export default function App() {
  const { appView, goAuth, goJourney } = useNavStore(useShallow(s => ({
    appView: s.appView,
    goAuth: s.goAuth,
    goJourney: s.goJourney,
  })))

  useEffect(() => {
    let cancelled = false
    getSession()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.session) goJourney()
        else goAuth()
      })
      .catch(() => { if (!cancelled) goAuth() })
    return () => { cancelled = true }
  }, [goAuth, goJourney])

  switch (appView) {
    case 'auth': return <AuthScreen />
    case 'journey': return <JourneyScreen />
    case 'levelDetail':
      return <><JourneyScreen /><LevelDetailScreen /></>
    case 'results': return <ResultsScreen />
    case 'playing':
    case 'practice':
      return <GameShell />
    default: return <AuthScreen />
  }
}
```

- [ ] **Step 4: Refactor GameShell — drop idle screen, mode-aware header**

In `src/components/GameShell.tsx`:

1. Add `mode` and `levelDisplayNumber` to the selector:

```ts
  const { phase, round, score, triesUsed, maxTries, phaseStartTime, phaseDuration, mode, levelDisplayNumber } =
    useGameStore(useShallow(s => ({
      phase: s.phase,
      round: s.round,
      score: s.score,
      triesUsed: s.triesUsed,
      maxTries: s.maxTries,
      phaseStartTime: s.phaseStartTime,
      phaseDuration: s.phaseDuration,
      mode: s.mode,
      levelDisplayNumber: s.levelDisplayNumber,
    })))
```

   (Remove `startGame` from the selector — the idle screen is gone.)

2. Delete the entire `if (phase === 'idle') { ... }` block.

3. Replace the header round label with a mode-aware one:

```tsx
        <span className="text-sm text-gray-400">
          {mode === 'journey'
            ? <>Level <strong className="text-white">{levelDisplayNumber}</strong></>
            : <>Round <strong className="text-white">{round}</strong></>}
        </span>
```

   (In journey mode the running `score` is not the source of truth — server scoring drives results — but leaving the header score readout is harmless; keep it as-is.)

- [ ] **Step 5: Run to verify it passes (+ regressions)**

Run: `npm run test -- tests/components/App.test.tsx`
Then the full component + store suites: `npm run test -- tests/components/ tests/store/`
Expected: PASS. (The old idle-screen behavior was not directly tested; ResolutionPhase/gameStore tests are unaffected.)

- [ ] **Step 6: Type-check**

Run: `npm run build`
Expected: build succeeds — no unused `startGame`/import errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/GameShell.tsx tests/components/App.test.tsx
git commit -m "feat(app): route by appView; GameShell becomes mode-aware in-game host"
```

---

## Task 14: Full green sweep + manual browser smoke

**Files:** none (verification only).

- [ ] **Step 1: Run the entire test suite**

Run: `npm run test`
Expected: ALL pass (existing + new). No skipped/modified existing tests.

- [ ] **Step 2: Build (type-check + noUnusedLocals)**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Practice path browser smoke**

Start the dev server (preview_start with config `puzzle-game`, port 5173). In the browser:
- Land on AuthScreen → click **Play as Guest** (requires a running local Supabase + anon sign-in; if anonymous sign-in is unavailable in the local env, drive `useNavStore.getState().goPractice(); useGameStore.getState().startPractice()` via `preview_eval` to verify the Practice loop renders).
- Verify the Practice loop still plays end-to-end (countdown → viewing → selecting → resolution with ScorePanel + Next Round). No console errors.

- [ ] **Step 5: Journey path browser smoke (if local Supabase is running)**

- Guest sign-in → JourneyScreen renders seeded themes.
- Open a Beginner level → LevelDetailScreen → **PLAY** → countdown → viewing → selecting → submit → fly-in → **ResultsScreen** with pillar bars.
- On a miss with tries left, **Try Again** replays the same puzzle (same gaps) without a new countdown seed change; on clear/exhaust only **Back to Map** appears.
- Capture a `preview_screenshot` of the ResultsScreen as proof.

If local Supabase is not running, document that the journey path was verified by unit/component tests (mocked api) and the Practice path was verified live.

- [ ] **Step 6: Final review handoff**

Per subagent-driven-development, dispatch the final whole-branch code reviewer, then use superpowers:finishing-a-development-branch. **Do not push without user confirmation** (binding project preference).

---

## Notes for the executor

- **Zustand 5:** every object selector MUST use `useShallow` (see CLAUDE.md). Single-value selectors (`s => s.foo`) are fine without it.
- **`@shared/*`** resolves to `supabase/functions/_shared` (vite/vitest alias + tsconfig paths). Import shared types/scoring from `@shared/...`.
- **Run npm/npx commands as separate Bash calls** — chained `a && b` trips the local `__init_nvm` shell hook (harmless noise, but chains error). One command per call.
- **No backend changes.** If a task seems to need a new RPC field (e.g. `new_achievements`), it is out of scope — stop and flag it.
- **Server is authoritative** on the journey path: never solve/score/generate locally there, never log or surface a seed.
- **Practice regression is a hard gate:** the local free-play loop, its scoring, and its tests must stay green and behaviorally unchanged.
```
