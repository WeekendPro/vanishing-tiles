# Async Loading Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single modern "trickle" loading bar that gives the user feedback during every async/network transition in the app.

**Architecture:** One presentational primitive (`TrickleBar`) is driven by a tiny global Zustand status store (`useAsyncStatus` + `track()`). A `GlobalLoadingBar` mounts the primitive once at the app root for the four full-screen routes; the in-game submit reuses the existing 6px timer slot in `GameShell`, driven by a new `submitting` flag on the game store.

**Tech Stack:** React 19, TypeScript, Zustand 5, Tailwind, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-01-async-loading-bar-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/store/asyncStatus.ts` *(new)* | Global pending-counter store + `track()` promise wrapper |
| `src/components/TrickleBar.tsx` *(new)* | Presentational trickle bar; `active` prop, 120ms show-delay, fill-to-90% / snap-to-100% on done |
| `src/components/GlobalLoadingBar.tsx` *(new)* | Fixed top-edge mount of `TrickleBar`, reads `useAsyncStatus` |
| `src/App.tsx` *(modify)* | Mount `GlobalLoadingBar` above the routed view |
| `src/components/AuthScreen.tsx` *(modify)* | Wrap `fn()` in `track()` |
| `src/components/JourneyScreen.tsx` *(modify)* | Wrap `getJourney()` in `track()` |
| `src/components/LevelDetailScreen.tsx` *(modify)* | Wrap `getLevel()` and `startJourneySession()` in `track()` |
| `src/store/gameStore.ts` *(modify)* | Add `submitting` flag toggled around `submitAttempt` |
| `src/components/GameShell.tsx` *(modify)* | Render `TrickleBar` in the timer slot while `submitting` |

Conventions to follow (already in this codebase):
- Zustand object selectors **must** use `useShallow` (see `CLAUDE.md`).
- Tests live under `tests/**` mirroring `src/**`; store tests reset state in `beforeEach`.
- Run npm/npx as **separate** Bash calls (never `a && b`) — the nvm shim errors on chained commands.

---

## Task 1: `useAsyncStatus` store + `track()`

**Files:**
- Create: `src/store/asyncStatus.ts`
- Test: `tests/store/asyncStatus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/store/asyncStatus.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAsyncStatus, track } from '../../src/store/asyncStatus'

beforeEach(() => {
  useAsyncStatus.setState({ pending: 0 })
})

describe('useAsyncStatus', () => {
  it('starts with no pending work', () => {
    expect(useAsyncStatus.getState().pending).toBe(0)
  })

  it('start/done increment and decrement the counter', () => {
    useAsyncStatus.getState().start()
    expect(useAsyncStatus.getState().pending).toBe(1)
    useAsyncStatus.getState().done()
    expect(useAsyncStatus.getState().pending).toBe(0)
  })

  it('done never drops below zero', () => {
    useAsyncStatus.getState().done()
    expect(useAsyncStatus.getState().pending).toBe(0)
  })
})

describe('track', () => {
  it('resolves with the promise value and clears pending', async () => {
    const result = await track(Promise.resolve('ok'))
    expect(result).toBe('ok')
    expect(useAsyncStatus.getState().pending).toBe(0)
  })

  it('decrements even when the tracked promise rejects', async () => {
    await expect(track(Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(useAsyncStatus.getState().pending).toBe(0)
  })

  it('stays pending until all overlapping promises settle', async () => {
    let resolveA!: () => void
    let resolveB!: () => void
    const ta = track(new Promise<void>(r => { resolveA = r }))
    const tb = track(new Promise<void>(r => { resolveB = r }))
    expect(useAsyncStatus.getState().pending).toBe(2)
    resolveA(); await ta
    expect(useAsyncStatus.getState().pending).toBe(1)
    resolveB(); await tb
    expect(useAsyncStatus.getState().pending).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/store/asyncStatus.test.ts`
Expected: FAIL — cannot resolve module `../../src/store/asyncStatus`.

- [ ] **Step 3: Write the implementation**

```ts
// src/store/asyncStatus.ts
import { create } from 'zustand'

interface AsyncStatus {
  /** Number of in-flight tracked async calls. The global bar is visible when > 0. */
  pending: number
  start: () => void
  done: () => void
}

export const useAsyncStatus = create<AsyncStatus>((set) => ({
  pending: 0,
  start: () => set(s => ({ pending: s.pending + 1 })),
  done: () => set(s => ({ pending: Math.max(0, s.pending - 1) })),
}))

/**
 * Wrap any promise so the global loading bar reflects it. Increments on call,
 * decrements in a `finally` so rejections still stop the bar. Counter-based, so
 * overlapping calls keep the bar up until every one settles.
 */
export async function track<T>(p: Promise<T>): Promise<T> {
  useAsyncStatus.getState().start()
  try {
    return await p
  } finally {
    useAsyncStatus.getState().done()
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/store/asyncStatus.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/asyncStatus.ts tests/store/asyncStatus.test.ts
git commit -m "feat(loading): add async status store and track() wrapper"
```

---

## Task 2: `TrickleBar` presentational primitive

**Files:**
- Create: `src/components/TrickleBar.tsx`
- Test: `tests/components/TrickleBar.test.tsx`

Behavior: nothing renders for the first `delay` ms (default 120). Once shown, width eases asymptotically toward 90%. When `active` flips to `false`, it snaps to 100%, fades, and unmounts ~400ms later. If `active` goes false *before* the delay elapses, nothing ever renders (no flash).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/TrickleBar.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TrickleBar } from '../../src/components/TrickleBar'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('TrickleBar', () => {
  it('renders nothing before the show-delay elapses', () => {
    render(<TrickleBar active />)
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
    act(() => { vi.advanceTimersByTime(119) })
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })

  it('appears after the 120ms delay while active', () => {
    render(<TrickleBar active />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('trickle-bar')).toBeInTheDocument()
  })

  it('does not flash for a call that resolves within the delay', () => {
    const { rerender } = render(<TrickleBar active />)
    act(() => { vi.advanceTimersByTime(80) })
    rerender(<TrickleBar active={false} />)
    act(() => { vi.advanceTimersByTime(600) })
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })

  it('snaps to 100% then unmounts after active turns false', () => {
    const { rerender } = render(<TrickleBar active />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('trickle-bar')).toBeInTheDocument()
    rerender(<TrickleBar active={false} />)
    expect(screen.getByTestId('trickle-bar')).toHaveStyle({ width: '100%' })
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/TrickleBar.test.tsx`
Expected: FAIL — cannot resolve module `../../src/components/TrickleBar`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/TrickleBar.tsx
import { useEffect, useState } from 'react'

interface Props {
  /** Whether async work is in flight. */
  active: boolean
  /** Delay (ms) before the bar first paints, so fast calls never flash. */
  delay?: number
  /** Tailwind background class. */
  color?: string
  /** Tailwind height class (h-0.5 = 2px global bar, h-1.5 = 6px slot). */
  height?: string
  className?: string
}

/**
 * Indeterminate "trickle" progress bar. While active, eases toward ~90% and
 * parks; on completion snaps to 100%, fades, and unmounts. Pure view logic —
 * touches no game state. `progress === null` means "render nothing".
 */
export function TrickleBar({
  active,
  delay = 120,
  color = 'bg-cyan-400',
  height = 'h-0.5',
  className = '',
}: Props) {
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    if (active) {
      let interval: ReturnType<typeof setInterval>
      const show = setTimeout(() => {
        setProgress(0.08)
        interval = setInterval(() => {
          setProgress(p => (p == null ? p : p + (0.9 - p) * 0.12))
        }, 90)
      }, delay)
      return () => { clearTimeout(show); clearInterval(interval) }
    }
    // active === false: snap shown bars to 100%, then unmount after the fade.
    setProgress(p => (p == null ? null : 1))
    const hide = setTimeout(() => setProgress(null), 400)
    return () => clearTimeout(hide)
  }, [active, delay])

  if (progress == null) return null
  return (
    <div
      data-testid="trickle-bar"
      className={`${height} ${color} ${className} transition-[width,opacity] duration-200 ease-out`}
      style={{ width: `${Math.min(progress, 1) * 100}%`, opacity: progress >= 1 ? 0 : 1 }}
    />
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/TrickleBar.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TrickleBar.tsx tests/components/TrickleBar.test.tsx
git commit -m "feat(loading): add TrickleBar trickle progress primitive"
```

---

## Task 3: `GlobalLoadingBar` + mount in `App`

**Files:**
- Create: `src/components/GlobalLoadingBar.tsx`
- Modify: `src/App.tsx`
- Test: `tests/components/GlobalLoadingBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/GlobalLoadingBar.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { GlobalLoadingBar } from '../../src/components/GlobalLoadingBar'
import { useAsyncStatus } from '../../src/store/asyncStatus'

beforeEach(() => { vi.useFakeTimers(); useAsyncStatus.setState({ pending: 0 }) })
afterEach(() => { vi.useRealTimers() })

describe('GlobalLoadingBar', () => {
  it('shows nothing when idle', () => {
    render(<GlobalLoadingBar />)
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })

  it('shows the trickle bar when async work is pending', () => {
    render(<GlobalLoadingBar />)
    act(() => { useAsyncStatus.setState({ pending: 1 }) })
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('trickle-bar')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/GlobalLoadingBar.test.tsx`
Expected: FAIL — cannot resolve module `../../src/components/GlobalLoadingBar`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/GlobalLoadingBar.tsx
import { useAsyncStatus } from '../store/asyncStatus'
import { TrickleBar } from './TrickleBar'

/** App-root loading bar pinned to the top edge; reflects all tracked async work. */
export function GlobalLoadingBar() {
  const pending = useAsyncStatus(s => s.pending)
  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <TrickleBar active={pending > 0} height="h-0.5" />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/GlobalLoadingBar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Mount it in `App.tsx`**

Replace the `return` block (the `switch (appView)`) so the routed view is computed into a variable and rendered beneath the global bar. The full new file body:

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
import { GlobalLoadingBar } from './components/GlobalLoadingBar'

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

  const view = (() => {
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
  })()

  return (
    <>
      <GlobalLoadingBar />
      {view}
    </>
  )
}
```

- [ ] **Step 6: Run the existing App test to confirm no regression**

Run: `npx vitest run tests/components/App.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/GlobalLoadingBar.tsx src/App.tsx tests/components/GlobalLoadingBar.test.tsx
git commit -m "feat(loading): mount global loading bar at app root"
```

---

## Task 4: Wire `AuthScreen` through `track()`

**Files:**
- Modify: `src/components/AuthScreen.tsx:12-24` (the `run` helper)
- Test: `tests/components/AuthScreen.test.tsx` (add one case + reset)

- [ ] **Step 1: Add the failing wiring test**

In `tests/components/AuthScreen.test.tsx`, add the import near the other imports:

```tsx
import { useAsyncStatus } from '../../src/store/asyncStatus'
```

Update the `beforeEach` to also reset the counter:

```tsx
beforeEach(() => {
  useNavStore.getState().reset()
  useAsyncStatus.setState({ pending: 0 })
  vi.clearAllMocks()
})
```

Add this test inside the `describe('AuthScreen', ...)` block:

```tsx
it('marks async status pending while a sign-in is in flight', async () => {
  let resolve!: (v: { error: null }) => void
  ;(auth.signInWithEmail as any).mockReturnValue(new Promise(r => { resolve = r }))
  const user = userEvent.setup()
  render(<AuthScreen />)
  await user.type(screen.getByPlaceholderText(/Email/i), 'player@example.com')
  await user.type(screen.getByPlaceholderText(/Password/i), 'hunter2')
  await user.click(screen.getByRole('button', { name: /^Sign in$/i }))
  expect(useAsyncStatus.getState().pending).toBe(1)
  await act(async () => { resolve({ error: null }) })
  expect(useAsyncStatus.getState().pending).toBe(0)
})
```

Add `act` to the testing-library import at the top of the file:

```tsx
import { render, screen, act } from '@testing-library/react'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/AuthScreen.test.tsx`
Expected: FAIL — `pending` is 0 (the call isn't tracked yet).

- [ ] **Step 3: Wire `track()` into `run`**

In `src/components/AuthScreen.tsx`, add the import:

```tsx
import { track } from '../store/asyncStatus'
```

Change the awaited call inside `run` from:

```tsx
      const { error } = await fn()
```
to:
```tsx
      const { error } = await track(fn())
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/AuthScreen.test.tsx`
Expected: PASS (all existing tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add src/components/AuthScreen.tsx tests/components/AuthScreen.test.tsx
git commit -m "feat(loading): show loading bar during auth calls"
```

---

## Task 5: Wire `JourneyScreen` through `track()`

**Files:**
- Modify: `src/components/JourneyScreen.tsx:33-41` (the `load` callback)

No new test — covered by the existing `tests/components/JourneyScreen.test.tsx` (must stay green) and the `track()` unit tests.

- [ ] **Step 1: Add the import**

In `src/components/JourneyScreen.tsx`:

```tsx
import { track } from '../store/asyncStatus'
```

- [ ] **Step 2: Wrap the call**

Change:
```tsx
      setThemes((await getJourney()) as JourneyTheme[])
```
to:
```tsx
      setThemes((await track(getJourney())) as JourneyTheme[])
```

- [ ] **Step 3: Run the existing JourneyScreen tests**

Run: `npx vitest run tests/components/JourneyScreen.test.tsx`
Expected: PASS (no regression).

- [ ] **Step 4: Commit**

```bash
git add src/components/JourneyScreen.tsx
git commit -m "feat(loading): show loading bar during journey load"
```

---

## Task 6: Wire `LevelDetailScreen` through `track()`

**Files:**
- Modify: `src/components/LevelDetailScreen.tsx:23-31` (the `load` callback) and `:35-46` (the `play` handler)

No new test — covered by the existing `tests/components/LevelDetailScreen.test.tsx` (must stay green).

- [ ] **Step 1: Add the import**

In `src/components/LevelDetailScreen.tsx`:

```tsx
import { track } from '../store/asyncStatus'
```

- [ ] **Step 2: Wrap the level load**

Change:
```tsx
      setLevel((await getLevel(selectedLevelId)) as LevelDetail)
```
to:
```tsx
      setLevel((await track(getLevel(selectedLevelId))) as LevelDetail)
```

- [ ] **Step 3: Wrap the session start**

Change:
```tsx
      await startJourneySession(level.level_id, level.my_pr ?? 0, level.display_number)
```
to:
```tsx
      await track(startJourneySession(level.level_id, level.my_pr ?? 0, level.display_number))
```

- [ ] **Step 4: Run the existing LevelDetailScreen tests**

Run: `npx vitest run tests/components/LevelDetailScreen.test.tsx`
Expected: PASS (no regression).

- [ ] **Step 5: Commit**

```bash
git add src/components/LevelDetailScreen.tsx
git commit -m "feat(loading): show loading bar during level load and session start"
```

---

## Task 7: `submitting` flag on the game store

**Files:**
- Modify: `src/store/gameStore.ts` — interface (`:46-70`), initial body (`:92-98`), `resetGame` (`:100`), `submitJourneyAttempt` (`:332-368`)
- Test: `tests/store/gameStore.submitting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/store/gameStore.submitting.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'

vi.mock('../../src/lib/api', () => ({
  startSession: vi.fn(),
  submitAttempt: vi.fn(),
}))
import * as api from '../../src/lib/api'
import { useGameStore, DIFFICULTY_TABLE } from '../../src/store/gameStore'

const RESULT = {
  attempt: {
    solved: true, coverage: 1,
    pillars: { accuracy: 800, speed: 0, efficiency: 0, attempts: 1, total: 800, stars: 3 },
    total: 800, stars: 3,
  },
  placements: [],
  session_status: 'cleared' as const,
  progress: {},
}

function enterSelecting() {
  useGameStore.setState({
    phase: 'selecting', mode: 'journey', selection: [], sessionId: 's1',
    difficulty: DIFFICULTY_TABLE[0], phaseStartTime: Date.now(),
    viewTimeRemaining: 0, triesUsed: 1, submitting: false, journeyError: null,
  })
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  vi.clearAllMocks()
})

describe('submitJourneyAttempt — submitting flag', () => {
  it('defaults to false', () => {
    expect(useGameStore.getState().submitting).toBe(false)
  })

  it('is true while the attempt is in flight and false once it resolves', async () => {
    let resolve!: (v: typeof RESULT) => void
    ;(api.submitAttempt as any).mockReturnValue(new Promise(r => { resolve = r }))
    enterSelecting()
    let p!: Promise<void>
    act(() => { p = useGameStore.getState().submitJourneyAttempt() })
    expect(useGameStore.getState().submitting).toBe(true)
    await act(async () => { resolve(RESULT); await p })
    expect(useGameStore.getState().submitting).toBe(false)
    expect(useGameStore.getState().phase).toBe('resolving')
  })

  it('clears submitting when the attempt fails', async () => {
    ;(api.submitAttempt as any).mockRejectedValue(new Error('network down'))
    enterSelecting()
    await act(async () => { await useGameStore.getState().submitJourneyAttempt() })
    expect(useGameStore.getState().submitting).toBe(false)
    expect(useGameStore.getState().journeyError).toMatch(/network down/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/store/gameStore.submitting.test.ts`
Expected: FAIL — `submitting` is `undefined` (not on the store yet).

- [ ] **Step 3: Add `submitting` to the interface**

In `src/store/gameStore.ts`, inside `interface GameStore` (after `levelDisplayNumber: number | null`):

```ts
  submitting: boolean
```

- [ ] **Step 4: Initialize and reset it**

In the store body, after `levelDisplayNumber: null,` (around line 98) add:

```ts
  submitting: false,
```

In `resetGame`, add `submitting: false` to the `set({ ... })` object:

```ts
  resetGame: () => set({ ...INITIAL_STATE, _resolution: null, journeyResult: null, journeyError: null, priorPr: 0, levelDisplayNumber: null, submitting: false }),
```

- [ ] **Step 5: Toggle it around the network call**

Replace the body of `submitJourneyAttempt` (from the `let res` declaration through the success `set`) so it sets `submitting: true` before the call and clears it in both outcomes. The full method:

```ts
  submitJourneyAttempt: async () => {
    const { phase, selection, sessionId, difficulty, phaseStartTime, viewTimeRemaining, triesUsed } = get()
    if (phase !== 'selecting') return // guard against double-submit (timer + click)

    const apiSelection = selection
      .filter(e => e.freeCount > 0)
      .map(e => ({ pieceType: e.pieceType, count: e.freeCount }))
    const selectElapsed = Date.now() - phaseStartTime
    const selectTimeRemaining = Math.max(0, difficulty.selectDuration - selectElapsed)

    set({ submitting: true })

    let res: SubmitAttemptResult
    try {
      res = await submitAttempt({
        sessionId,
        selection: apiSelection,
        viewMsRemaining: viewTimeRemaining,
        selectMsRemaining: selectTimeRemaining,
      })
    } catch (e) {
      set({ journeyError: e instanceof Error ? e.message : 'Submit failed', submitting: false })
      return
    }

    const solved = res.attempt.solved
    set({
      phase: 'resolving',
      submitting: false,
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
```

- [ ] **Step 6: Run the new test plus the existing journey tests**

Run: `npx vitest run tests/store/gameStore.submitting.test.ts`
Expected: PASS (3 tests).

Run: `npx vitest run tests/store/gameStore.journey.test.ts`
Expected: PASS (no regression).

- [ ] **Step 7: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.submitting.test.ts
git commit -m "feat(loading): track submitting state around attempt submission"
```

---

## Task 8: `GameShell` renders the trickle in the timer slot while submitting

**Files:**
- Modify: `src/components/GameShell.tsx:19-31` (selector) and `:55-64` (slot)
- Test: `tests/components/GameShell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/GameShell.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// Stub the phase children so the test isolates GameShell's slot logic.
vi.mock('../../src/components/SelectingPhase', () => ({ SelectingPhase: () => null }))
vi.mock('../../src/components/ViewingPhase', () => ({ ViewingPhase: () => null }))
vi.mock('../../src/components/CountdownPhase', () => ({ CountdownPhase: () => null }))
vi.mock('../../src/components/ResolutionPhase', () => ({ ResolutionPhase: () => null }))

import { GameShell } from '../../src/components/GameShell'
import { useGameStore } from '../../src/store/gameStore'

beforeEach(() => { vi.useFakeTimers(); useGameStore.getState().resetGame() })
afterEach(() => { vi.useRealTimers() })

describe('GameShell loading slot', () => {
  it('shows the trickle bar in the timer slot while submitting', () => {
    act(() => { useGameStore.setState({ phase: 'selecting', mode: 'journey', submitting: true }) })
    render(<GameShell />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('trickle-bar')).toBeInTheDocument()
  })

  it('does not show the trickle bar when not submitting', () => {
    act(() => { useGameStore.setState({ phase: 'selecting', mode: 'journey', submitting: false }) })
    render(<GameShell />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/GameShell.test.tsx`
Expected: FAIL — no `trickle-bar` test id (slot still only renders `ProgressBar`).

- [ ] **Step 3: Wire the slot**

In `src/components/GameShell.tsx`, add the import:

```tsx
import { TrickleBar } from './TrickleBar'
```

Add `submitting` to the selector object (and destructure it):

```tsx
  const { phase, round, score, triesUsed, maxTries, phaseStartTime, phaseDuration, mode, levelDisplayNumber, submitting } =
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
      submitting: s.submitting,
    })))
```

Replace the slot block:

```tsx
      <div className="h-1.5">
        {showTimer && (
          <ProgressBar
            startTime={phaseStartTime}
            duration={phaseDuration}
            color={phase === 'viewing' ? 'bg-cyan-400' : 'bg-green-400'}
            rounded="rounded-none"
          />
        )}
      </div>
```

with:

```tsx
      <div className="h-1.5">
        {submitting ? (
          <TrickleBar active height="h-1.5" className="rounded-none" />
        ) : showTimer ? (
          <ProgressBar
            startTime={phaseStartTime}
            duration={phaseDuration}
            color={phase === 'viewing' ? 'bg-cyan-400' : 'bg-green-400'}
            rounded="rounded-none"
          />
        ) : null}
      </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/GameShell.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/GameShell.tsx tests/components/GameShell.test.tsx
git commit -m "feat(loading): show trickle bar in timer slot during submit"
```

---

## Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: PASS — all suites green (including the four new test files).

- [ ] **Step 2: Type-check + production build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors (this also catches `noUnusedLocals`, which `tsc --noEmit` alone can miss).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `npm run dev` → open http://localhost:5173. Confirm: the thin cyan bar appears at the top edge during sign-in, journey load, opening a level, and pressing PLAY; and that the timer slot shows the trickle after pressing **Done ✓** until the result appears.

- [ ] **Step 5: Final commit (only if Steps 1-3 required fixes)**

```bash
git add -A
git commit -m "chore(loading): verification fixes"
```

---

## Self-Review Notes

- **Spec coverage:** All five async transitions wired — auth (Task 4), journey load (Task 5), level load + start session (Task 6), submit attempt (Tasks 7-8). Primitive (Task 2), store (Task 1), global mount (Task 3). Edge cases (counter, finally-decrement, 120ms anti-flash, no-double-bars) are realized in Tasks 1, 2, 7, 8. Testing section of the spec satisfied by Tasks 1, 2, 4, 7, 8.
- **Type consistency:** `track<T>`, `useAsyncStatus.pending/start/done`, `TrickleBar` props (`active/delay/color/height/className`), and `submitting: boolean` are referenced identically across all tasks.
- **No placeholders:** every code step shows complete code; every run step states the exact command and expected result.
