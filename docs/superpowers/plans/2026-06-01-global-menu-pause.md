# Global Menu & Full-Screen Pause Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-screen `UserMenu` with a single global floating hamburger that opens a bold full-screen overlay; in gameplay it acts as a pause that freezes the clock and hides the board, with instant resume.

**Architecture:** A `GlobalMenu` mounted once in `App.tsx` (shown on every signed-in screen). Pause is store-driven: `pauseGame()` records elapsed time and flips a `paused` flag; `GameShell` unmounts the timed phase while paused (cancelling its `setTimeout`); `resumeGame()` rebases `phaseStartTime` so the clock continues from the exact remaining time. Phase auto-advance timers are switched to fire on *remaining* time so re-mount after resume continues instead of restarting.

**Tech Stack:** React 18, Zustand 5 (`useShallow`), Vitest + @testing-library/react, Tailwind, Supabase auth.

---

## File Structure

- `supabase/functions/_shared/types.ts` — add `paused: boolean` to `GameState`.
- `src/store/gameStore.ts` — `paused` in state, internal `pausedElapsed`, `pauseGame`/`resumeGame` actions.
- `src/lib/auth.ts` — add `getUser` wrapper (so components don't import the supabase client directly; keeps tests mockable).
- `src/components/GlobalMenu.tsx` — **new**; floating button + full-screen overlay + context-aware items + pause wiring.
- `src/components/UserMenu.tsx` — **delete**.
- `src/components/JourneyScreen.tsx` — drop `UserMenu`.
- `src/App.tsx` — render `<GlobalMenu />` for non-auth views.
- `src/components/GameShell.tsx` — regroup top bar (free right corner), gate phase content on `paused`.
- `src/components/ViewingPhase.tsx`, `src/components/SelectingPhase.tsx` — fire auto-advance on remaining time.
- Tests: `tests/store/gameStorePause.test.ts` (new), `tests/components/GlobalMenu.test.tsx` (new), `tests/components/App.test.tsx` (update mock).

> **nvm note (project memory):** run `npm`/`npx` as their **own** Bash calls — do not chain with `&&` (the shell's `__init_nvm` errors on chained commands).

---

## Task 1: Add `paused` to the shared GameState type

**Files:**
- Modify: `supabase/functions/_shared/types.ts:102-120`

- [ ] **Step 1: Add the field**

In the `GameState` interface, add `paused` right after `phase`:

```ts
export interface GameState {
  mode: 'practice' | 'journey'
  phase: GamePhase
  paused: boolean             // true while the full-screen pause menu is open mid-game
  round: number
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: FAIL — `gameStore.ts` `INITIAL_STATE` now misses `paused`. (Fixed in Task 2.) This confirms the type is wired.

---

## Task 2: Store pause/resume actions (TDD)

**Files:**
- Test: `tests/store/gameStorePause.test.ts`
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/store/gameStorePause.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useGameStore } from '../../src/store/gameStore'

beforeEach(() => { useGameStore.getState().resetGame() })
afterEach(() => { vi.restoreAllMocks() })

describe('gameStore pause/resume', () => {
  it('starts un-paused', () => {
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('pauseGame flips the flag and resumeGame preserves elapsed time', () => {
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1000)
    useGameStore.setState({ phase: 'viewing', phaseStartTime: 1000, phaseDuration: 10000, paused: false })

    now.mockReturnValue(4000)              // 3000ms elapsed
    useGameStore.getState().pauseGame()
    expect(useGameStore.getState().paused).toBe(true)

    now.mockReturnValue(9000)              // 5000ms spent paused
    useGameStore.getState().resumeGame()
    const s = useGameStore.getState()
    expect(s.paused).toBe(false)
    // phaseStartTime rebased so elapsed at the resume instant is still 3000
    expect(Date.now() - s.phaseStartTime).toBe(3000)
  })

  it('resumeGame does not rebase phaseStartTime outside viewing/selecting', () => {
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(5000)
    useGameStore.setState({ phase: 'resolving', phaseStartTime: 1234, paused: true, pausedElapsed: 999 } as any)
    useGameStore.getState().resumeGame()
    const s = useGameStore.getState()
    expect(s.paused).toBe(false)
    expect(s.phaseStartTime).toBe(1234)   // untouched
  })

  it('startGame clears a leftover paused flag', () => {
    useGameStore.setState({ paused: true })
    useGameStore.getState().startGame()
    expect(useGameStore.getState().paused).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/store/gameStorePause.test.ts`
Expected: FAIL — `pauseGame`/`resumeGame` are not functions; `paused` is undefined.

- [ ] **Step 3: Add `paused` to `INITIAL_STATE`**

In `src/store/gameStore.ts`, in `INITIAL_STATE` (after `phase: 'idle',`):

```ts
const INITIAL_STATE: GameState = {
  mode: 'practice',
  phase: 'idle',
  paused: false,
  round: 1,
```

- [ ] **Step 4: Add `pausedElapsed` to the store interface and init**

In the `GameStore` interface (near `_resolution: Resolution | null`), add:

```ts
  pauseGame: () => void
  resumeGame: () => void
  pausedElapsed: number
```

In the store body, alongside `_resolution: null,` add:

```ts
  pausedElapsed: 0,
```

- [ ] **Step 5: Implement the actions**

In `src/store/gameStore.ts`, add these actions (place them right after `resetGame`):

```ts
  pauseGame: () => set(state => ({
    paused: true,
    pausedElapsed: Date.now() - state.phaseStartTime,
  })),

  resumeGame: () => set(state => ({
    paused: false,
    phaseStartTime: (state.phase === 'viewing' || state.phase === 'selecting')
      ? Date.now() - state.pausedElapsed
      : state.phaseStartTime,
  })),
```

- [ ] **Step 6: Reset `paused` in `startGame`**

In `startGame`'s `set({ ... })`, add `paused: false,` next to `phase: 'countdown',`:

```ts
    set({
      phase: 'countdown',
      paused: false,
      grid,
```

- [ ] **Step 7: Run the test**

Run: `npx vitest run tests/store/gameStorePause.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/_shared/types.ts src/store/gameStore.ts tests/store/gameStorePause.test.ts
git commit -m "feat(store): add pause/resume that preserves remaining phase time"
```

---

## Task 3: Auto-advance timers fire on remaining time

Make `ViewingPhase` / `SelectingPhase` re-mount safe so resume continues instead of restarting the full duration.

**Files:**
- Modify: `src/components/ViewingPhase.tsx:8-20`
- Modify: `src/components/SelectingPhase.tsx:10-26`

- [ ] **Step 1: ViewingPhase — pull `phaseStartTime` and use remaining**

Replace the selector and effect:

```ts
  const { endViewing, phaseStartTime, phaseDuration, gaps } = useGameStore(useShallow(s => ({
    endViewing: s.endViewing,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
    gaps: s.gaps,
  })))

  const gridWrapRef = useRef<HTMLDivElement>(null)
  const cellRects = useRef<Map<string, DOMRect>>(new Map())

  useEffect(() => {
    const remaining = Math.max(0, phaseStartTime + phaseDuration - Date.now())
    const timer = setTimeout(endViewing, remaining)
    return () => clearTimeout(timer)
  }, [phaseStartTime, phaseDuration, endViewing])
```

- [ ] **Step 2: SelectingPhase — same change**

Add `phaseStartTime: s.phaseStartTime,` to the `useShallow` selector (and `phaseStartTime` to the destructure), then replace the effect:

```ts
  useEffect(() => {
    const remaining = Math.max(0, phaseStartTime + phaseDuration - Date.now())
    const timer = setTimeout(submit, remaining)
    return () => clearTimeout(timer)
  }, [phaseStartTime, phaseDuration, submit])
```

- [ ] **Step 3: Type-check + full test suite (no regressions)**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run test`
Expected: PASS (all existing tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/ViewingPhase.tsx src/components/SelectingPhase.tsx
git commit -m "refactor(phases): fire auto-advance on remaining time (resume-safe)"
```

---

## Task 4: `getUser` auth helper

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add the wrapper**

At the end of `src/lib/auth.ts` add:

```ts
export const getUser = () => supabase.auth.getUser()
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): add getUser wrapper"
```

---

## Task 5: GlobalMenu component (TDD)

**Files:**
- Test: `tests/components/GlobalMenu.test.tsx`
- Create: `src/components/GlobalMenu.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/GlobalMenu.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/auth', () => ({
  getUser: vi.fn().mockResolvedValue({
    data: { user: { email: 'luis@example.com', is_anonymous: false, user_metadata: {} } },
  }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}))
import * as auth from '../../src/lib/auth'
import { GlobalMenu } from '../../src/components/GlobalMenu'
import { useNavStore } from '../../src/store/navStore'
import { useGameStore } from '../../src/store/gameStore'

beforeEach(() => {
  useNavStore.getState().reset()
  useGameStore.getState().resetGame()
  vi.clearAllMocks()
})

describe('GlobalMenu', () => {
  it('on the map shows Training Mode and account actions', async () => {
    useNavStore.setState({ appView: 'journey' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('button', { name: /Training Mode/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument()
  })

  it('in game shows Resume + Quit and pauses on open, resumes on Resume', async () => {
    useNavStore.setState({ appView: 'practice' })
    useGameStore.setState({ phase: 'viewing', phaseStartTime: Date.now(), phaseDuration: 10000 })
    const user = userEvent.setup()
    render(<GlobalMenu />)

    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(useGameStore.getState().paused).toBe(true)
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quit to Map/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Resume/i }))
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('Quit to Map resets the game and navigates to the journey', async () => {
    useNavStore.setState({ appView: 'practice' })
    useGameStore.setState({ phase: 'viewing', round: 4 })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Quit to Map/i }))
    expect(useNavStore.getState().appView).toBe('journey')
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('Sign Out calls signOut and resets navigation', async () => {
    useNavStore.setState({ appView: 'journey' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: /Sign Out/i }))
    expect(auth.signOut).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/components/GlobalMenu.test.tsx`
Expected: FAIL — cannot find `GlobalMenu`.

- [ ] **Step 3: Implement `GlobalMenu`**

Create `src/components/GlobalMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { getUser, signOut } from '../lib/auth'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'

interface MenuUser {
  name: string
  email: string | null
  avatarUrl: string | null
  isGuest: boolean
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Avatar({ user }: { user: MenuUser }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/15" />
  }
  return (
    <div className="w-12 h-12 rounded-full grid place-items-center font-black text-lg text-white
      bg-gradient-to-br from-cyan-400 to-indigo-600 ring-1 ring-white/15">
      {initials(user.name)}
    </div>
  )
}

function Action({ label, onClick, tone = 'default' }:
  { label: string; onClick: () => void; tone?: 'default' | 'muted' | 'danger' }) {
  const color = tone === 'danger' ? 'text-red-400/90 hover:text-red-300'
    : tone === 'muted' ? 'text-gray-500 hover:text-white'
    : 'text-white hover:text-cyan-300'
  return (
    <button onClick={onClick} className={`text-left text-3xl font-black py-3 ${color}`}>
      {label}
    </button>
  )
}

export function GlobalMenu() {
  const appView = useNavStore(s => s.appView)
  const { goJourney, goPractice, reset: resetNav } = useNavStore(useShallow(s => ({
    goJourney: s.goJourney,
    goPractice: s.goPractice,
    reset: s.reset,
  })))
  const { phase, pauseGame, resumeGame, startPractice, resetGame } = useGameStore(useShallow(s => ({
    phase: s.phase,
    pauseGame: s.pauseGame,
    resumeGame: s.resumeGame,
    startPractice: s.startPractice,
    resetGame: s.resetGame,
  })))

  const inGame = appView === 'playing' || appView === 'practice'
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<MenuUser | null>(null)

  useEffect(() => {
    let cancelled = false
    getUser().then(({ data }) => {
      if (cancelled || !data.user) return
      const m = data.user.user_metadata ?? {}
      const isGuest = data.user.is_anonymous ?? false
      const name = (m.full_name || m.name || data.user.email?.split('@')[0] || (isGuest ? 'Guest' : 'Player')) as string
      setUser({
        name,
        email: data.user.email ?? null,
        avatarUrl: (m.avatar_url || m.picture || null) as string | null,
        isGuest,
      })
    })
    return () => { cancelled = true }
  }, [])

  const openMenu = () => { if (inGame) pauseGame(); setOpen(true) }
  const close = () => { if (inGame) resumeGame(); setOpen(false) }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const enterPractice = () => { setOpen(false); startPractice(); goPractice() }
  const quitToMap = () => { setOpen(false); resetGame(); goJourney() }
  const handleSignOut = async () => { setOpen(false); await signOut(); resetNav() }

  return (
    <>
      <button
        onClick={open ? close : openMenu}
        aria-label="Menu"
        aria-expanded={open}
        className="fixed top-3 right-3 z-50 grid place-items-center w-10 h-10 rounded-xl
          border border-gray-700 bg-gray-900/90 text-gray-200 hover:border-gray-500"
      >
        {open ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <span className="flex flex-col gap-[5px]">
            <span className="block w-5 h-0.5 rounded-full bg-current" />
            <span className="block w-5 h-0.5 rounded-full bg-current" />
            <span className="block w-5 h-0.5 rounded-full bg-current" />
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col px-7 pt-20 pb-8
          bg-gradient-to-b from-gray-950 via-gray-900 to-black">
          {inGame && (
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-400 font-bold mb-1">Paused</div>
          )}
          {user && (
            <div className="flex items-center gap-3 mb-8">
              <Avatar user={user} />
              <div className="min-w-0">
                <div className="font-bold text-lg leading-tight truncate">{user.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {user.email ?? (user.isGuest ? 'Guest session' : '')}
                </div>
              </div>
            </div>
          )}

          {inGame ? (
            <>
              <Action label="Resume" onClick={close} />
              <Action label="Quit to Map" onClick={quitToMap} />
            </>
          ) : (
            <Action label="Training Mode" onClick={enterPractice} />
          )}
          <Action label="Settings" tone="muted" onClick={() => { /* no settings screen yet */ }} />

          <div className="mt-auto">
            <Action label="Sign Out" tone="danger" onClick={handleSignOut} />
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/components/GlobalMenu.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/GlobalMenu.tsx tests/components/GlobalMenu.test.tsx
git commit -m "feat(menu): add global full-screen menu with in-game pause"
```

---

## Task 6: Mount GlobalMenu in App; remove UserMenu from Journey

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/JourneyScreen.tsx`
- Modify: `tests/components/App.test.tsx` (mock update)
- Delete: `src/components/UserMenu.tsx`

- [ ] **Step 1: Update the App.test mock first (so the suite stays green)**

In `tests/components/App.test.tsx`, replace the `lib/auth` mock with one that includes the helpers GlobalMenu needs:

```ts
vi.mock('../../src/lib/auth', () => ({
  getSession: vi.fn(),
  getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
  signOut: vi.fn(),
}))
```

- [ ] **Step 2: Render GlobalMenu in App**

Rewrite `src/App.tsx`'s render so the screen is computed and the menu is rendered alongside it for non-auth views:

```tsx
import { useEffect } from 'react'
import { useShallow } from 'zustand/shallow'
import { getSession } from './lib/auth'
import { useNavStore } from './store/navStore'
import { AuthScreen } from './components/AuthScreen'
import { JourneyScreen } from './components/JourneyScreen'
import { LevelDetailScreen } from './components/LevelDetailScreen'
import { ResultsScreen } from './components/ResultsScreen'
import { GameShell } from './components/GameShell'
import { GlobalMenu } from './components/GlobalMenu'

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

  const screen = (() => {
    switch (appView) {
      case 'auth': return <AuthScreen />
      case 'journey': return <JourneyScreen />
      case 'levelDetail': return <><JourneyScreen /><LevelDetailScreen /></>
      case 'results': return <ResultsScreen />
      case 'playing':
      case 'practice': return <GameShell />
      default: return <AuthScreen />
    }
  })()

  return (
    <>
      {screen}
      {appView !== 'auth' && <GlobalMenu />}
    </>
  )
}
```

- [ ] **Step 3: Remove UserMenu from JourneyScreen**

In `src/components/JourneyScreen.tsx`, delete the `import { UserMenu } from './UserMenu'` line and replace the header's `<UserMenu />` with nothing (the title sits alone; the global button floats over the corner):

```tsx
      <div className="flex items-center justify-between mb-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold">Mind The Gap</h1>
      </div>
```

- [ ] **Step 4: Delete the old component**

```bash
git rm src/components/UserMenu.tsx
```

- [ ] **Step 5: Type-check + full suite**

Run: `npx tsc --noEmit`
Expected: PASS (no remaining references to `UserMenu`).

Run: `npm run test`
Expected: PASS (App routing tests still green with the updated mock).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/JourneyScreen.tsx tests/components/App.test.tsx
git commit -m "feat(menu): mount GlobalMenu app-wide, retire per-screen UserMenu"
```

---

## Task 7: Rework GameShell top bar + pause gating

**Files:**
- Modify: `src/components/GameShell.tsx`

- [ ] **Step 1: Pull `paused` into the selector**

Add `paused: s.paused,` to the `useShallow` selector object and add `paused` to the destructured names.

- [ ] **Step 2: Free the right corner in the metadata bar**

Replace the metadata bar so the three stats cluster on the left and a spacer reserves the right corner for the floating button:

```tsx
      <div className="sticky top-0 z-30 bg-gray-950 flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <span className="text-sm text-gray-400">
          {mode === 'journey'
            ? <>Level <strong className="text-white">{levelDisplayNumber}</strong></>
            : <>Round <strong className="text-white">{round}</strong></>}
        </span>
        <span className="text-sm text-yellow-400 font-bold">{score.toLocaleString()}</span>
        <Hearts count={maxTries - triesUsed + 1} total={maxTries} />
        <span className="flex-1" />
        <span className="w-10" aria-hidden />
      </div>
```

(The trailing `w-10` spacer keeps the stats from sliding under the fixed menu button.)

- [ ] **Step 3: Gate the timer + phase content on `paused`**

Update `showTimer` and the content area so nothing renders while paused (this unmounts the timed phase, cancelling its `setTimeout`):

```tsx
  const showTimer = (phase === 'viewing' || phase === 'selecting') && !paused
```

```tsx
      <div className={`flex-1 flex justify-center px-4 pb-4 ${centerContent ? 'items-center pt-4' : 'items-start pt-8'}`}>
        {!paused && phase === 'countdown'  && <CountdownPhase />}
        {!paused && phase === 'viewing'    && <ViewingPhase />}
        {!paused && phase === 'selecting'  && <SelectingPhase />}
        {!paused && phase === 'resolving'  && <ResolutionPhase />}
      </div>
```

- [ ] **Step 4: Type-check + full suite**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Build (catches `noUnusedLocals`, per project memory)**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/GameShell.tsx
git commit -m "feat(game): reserve menu corner in top bar; hide board while paused"
```

---

## Task 8: Manual verification in the preview

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and sign in as Guest**

Use the preview tools: `preview_start` ("puzzle-game"), then sign in as Guest to reach the journey map.

- [ ] **Step 2: Map menu**

Click the floating menu (top-right). Confirm the full-screen overlay shows the avatar, **Training Mode**, Settings (muted), **Sign Out**. Click Training Mode → a game starts (countdown).

- [ ] **Step 3: In-game pause**

During **viewing**, open the menu. Confirm: the board disappears, the timer bar freezes, and the overlay shows **Resume / Quit to Map / Settings / Sign Out** with a "PAUSED" label. Wait several seconds, click **Resume** → the board returns and the timer continues from where it stopped (it does **not** restart at full, and does **not** instantly expire).

- [ ] **Step 4: Selecting pause + Quit**

Advance to **selecting**, open the menu, confirm the same freeze, then click **Quit to Map** → returns to the journey map; opening a level/practice again starts fresh (not paused).

- [ ] **Step 5: Screenshot proof**

Capture a screenshot of the paused full-screen overlay and of the in-game top bar with the floating button, and share them.

---

## Self-Review Notes (addressed)

- **Spec coverage:** global floating button (Task 5/6), full-screen everywhere (Task 5), context-aware items (Task 5), pause freezes clock + hides board (Tasks 2/3/7), instant resume (Tasks 2/3), top-bar rethink (Task 7), UserMenu removed (Task 6), Settings stub (Task 5). All covered.
- **Type consistency:** `pauseGame`/`resumeGame`/`paused`/`pausedElapsed` defined in Task 2 and consumed identically in Tasks 5 & 7. `getUser` defined in Task 4, consumed in Task 5 and mocked in Task 6.
- **No placeholders:** every code step shows full code; the only intentional no-op is the Settings handler (documented stub, per spec "out of scope").
