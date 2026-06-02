# Global Menu & Full-Screen Pause — Design

**Date:** 2026-06-01
**Status:** Approved design (pre-implementation)

## Goal

Make the menu a **global, always-present** element and, during gameplay, a **full-screen pause** that freezes the clock and hides the board. Replace the per-screen dropdown `UserMenu` introduced earlier.

## Decisions (locked)

- **Floating button:** a single global hamburger pinned `fixed` top-right, present on every signed-in screen. Independent of each screen's own bar. Morphs to `×` when open.
- **Full-screen everywhere:** the menu panel is a bold, full-width/height overlay in all contexts (not a dropdown).
- **Context-aware items** (two contexts):
  - **Map context** (`appView` ∈ `journey`, `levelDetail`, `results`): *Training Mode · Settings · Sign Out*
  - **In-game context** (`appView` ∈ `playing`, `practice`): *Resume · Quit to Map · Settings · Sign Out*
- **Pause** applies in in-game context: opening freezes the clock + hides the board; **instant resume** (no re-countdown) continues from the exact frozen remaining time.
- **Settings** remains a styled-but-muted stub (no settings screen yet).

## Components

### `GlobalMenu` (new, `src/components/GlobalMenu.tsx`)
- Mounted once in `App.tsx`, rendered for every `appView` except `auth`.
- Owns local `open` state and the floating button + full-screen overlay.
- Reads:
  - `navStore`: `appView`, `goJourney`, `reset`
  - `gameStore`: `phase`, `mode`, `paused`, `pauseGame`, `resumeGame`, `resetGame`
- Loads the user (email/name/avatar) via `supabase.auth.getUser()` — the same logic currently in `UserMenu` (moved here).
- Behavior:
  - **Open in-game** → `pauseGame()` then show overlay.
  - **Resume / × / Esc** → `resumeGame()` then close.
  - **Open on map** → just show overlay (no pause).
  - **Training Mode** (map) → `startPractice()` + `goPractice()`, close.
  - **Quit to Map** (in-game) → `resetGame()` + `goJourney()`, close.
  - **Sign Out** → `signOut()` + `navStore.reset()`.

Visual: gradient backdrop (`from-gray-950 via-gray-900 to-black`), profile header (avatar + name/email), big left-aligned `text-3xl font-black` action rows; Sign Out pinned to the bottom in red; a "PAUSED" eyebrow label in-game. Reference mockup: `mockups/menu.html`.

### `UserMenu` (delete)
Superseded by `GlobalMenu`. Remove the import/usage from `JourneyScreen`; the Journey header keeps only its title.

### `GameShell` (modify)
- **Top-bar rethink:** regroup metadata into a left cluster (`Round/Level · Score · ♥♥♥`) with a flex spacer, leaving the **right corner free** so the global floating button never collides with hearts.
- **Pause gating:** when `paused` is true, render no phase content (the phase components unmount). The `GlobalMenu` overlay (z above shell) covers the screen. This both hides the board and cancels the phase's `setTimeout` via effect cleanup.

## Pause mechanics

Timers today: each timed phase arms `setTimeout(fn, phaseDuration)` on mount; `ProgressBar` derives fill from `phaseStartTime + phaseDuration` against `Date.now()`. Both are wall-clock based off `phaseStartTime`.

### Store changes (`gameStore.ts`)
- Add `paused: boolean` to `GameState` (initial `false`).
- `pauseGame()`: capture `pausedElapsed = Date.now() - phaseStartTime` into a transient store field, then set `paused: true`.
- `resumeGame()`: `phaseStartTime = Date.now() - pausedElapsed`, `paused: false`. `phaseDuration` is **unchanged** (still the full duration) so `endViewing`/`submit` scoring math (`viewDuration - viewElapsed`) stays correct.
- Include `paused: false` (and `pausedElapsed: 0`) in `INITIAL_STATE` and in `startGame` (which begins a fresh round). Resume always clears `paused`, so other transitions don't need to — but `startGame` resetting it is a safety net against a quit-while-paused leaking into the next game.

### Phase-component change (robustness)
Change the auto-advance `setTimeout` in `ViewingPhase` and `SelectingPhase` from a fixed `phaseDuration` delay to the **remaining** time:

```ts
const remaining = Math.max(0, phaseStartTime + phaseDuration - Date.now())
const timer = setTimeout(fn, remaining)
```

This makes re-mount after resume continue (fire after the leftover time) instead of waiting a fresh full duration. `ProgressBar` needs no change — it already reads `phaseStartTime`.

### Phase-specific pause behavior
- **viewing / selecting:** clock freezes; board hidden; instant resume continues remaining time. (Board hidden ⇒ no extra free memorization — desirable.)
- **countdown:** no view clock yet; `CountdownPhase` unmounts on pause and on resume restarts the 3-2-1 pre-roll from 3. Acceptable (nothing to preserve).
- **resolving:** no timer; overlay simply hides the results; Resume/× returns to them; Quit resets.

## Data flow

```
GlobalMenu (App-level)
  open + appView=in-game ──> gameStore.pauseGame() ──> paused=true
                                                      └─> GameShell unmounts phase ──> setTimeout cleared
  close/Resume ───────────> gameStore.resumeGame() ──> phaseStartTime rebased, paused=false
                                                      └─> GameShell remounts phase ──> setTimeout(remaining), ProgressBar continues
```

## Error handling / edge cases
- Rapid open/close: `pauseGame`/`resumeGame` are idempotent on their flag; rebasing uses the captured `pausedElapsed` only on resume.
- Pause during `resolving` or `countdown`: `pausedElapsed` is captured but harmless (those phases don't use it for scoring); resume just clears `paused`.
- Auth screen: `GlobalMenu` not rendered (no session).
- Esc key and backdrop/`×` all route through the same close→resume path.

## Testing
- **Store unit tests:** `pauseGame` then `resumeGame` preserves remaining time (rebased `phaseStartTime` such that elapsed is continuous); `viewTimeRemaining`/`selectTimeRemaining` scoring is unaffected by a pause; `paused` resets on new phases.
- **Manual / preview:** open menu mid-viewing → board hidden, bar frozen; resume → bar continues, auto-advance fires after the leftover time, not a full duration; Quit to Map resets and navigates; context items differ map vs in-game; Sign Out returns to auth.
- All existing tests must still pass (`npm run test`), plus `npm run build`.

## Out of scope
- A real Settings screen (item stays a stub).
- Re-countdown on resume (explicitly chose instant).
- Restart-round action in the pause menu (YAGNI for now).
