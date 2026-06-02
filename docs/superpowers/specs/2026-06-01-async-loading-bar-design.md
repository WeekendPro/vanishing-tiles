# Async Loading Bar — Design

**Date:** 2026-06-01
**Status:** Approved

## Goal

Make game-play feel more graceful by giving the user feedback during async
(network) transitions. Today several backend calls run with little or no visible
feedback — buttons just dim, or a bare "Loading…" string appears, and the
selecting→resolving submit has *no* feedback at all. We want a single, modern,
sleek **trickle loading bar** — visually a cousin of the existing viewing/
selecting timer bars — applied **universally** across every async transition.

## Async surface (the transitions we cover)

| # | Where | Call | Current feedback |
|---|-------|------|------------------|
| 1 | `AuthScreen` | sign-in / sign-up / Google / guest (`run()`) | button dims only |
| 2 | `JourneyScreen` | `getJourney()` initial load | "Loading…" text |
| 3 | `LevelDetailScreen` | `getLevel()` load | "Loading…" text |
| 4 | `LevelDetailScreen` | PLAY → `startJourneySession` → `startSession()` | button dims only |
| 5 | gameplay | Done ✓ → `submitJourneyAttempt` → `submitAttempt()` | **none** |

## Chosen visual style

**Trickle fill** (GitHub / YouTube style), in cyan (`bg-cyan-400`) to match the
viewing timer and read as a consistent "system working" accent:

- While active, progress eases asymptotically toward ~90% and parks there — a
  long call keeps inching and never appears stalled, but never claims to be done.
- When the call resolves, the bar snaps to 100%, holds a beat, fades out, and
  unmounts.
- A **120ms show-delay** before first paint, so sub-100ms calls never flash a bar.

Rejected alternatives: indeterminate sweep (B), shimmer gradient (C), glow
comet (D) — all viable but the trickle reads as real progress and is the closest
sibling to the existing timer bars (it just fills forward instead of draining).

## Architecture

Three small units, each independently understandable and testable.

### 1. `TrickleBar` — the presentational primitive

`src/components/TrickleBar.tsx`

- Prop: `active: boolean`. (Plus optional `color`, `height`, `className` for the
  two render contexts.)
- Internally driven by `requestAnimationFrame`; manages a `progress` value:
  - On `active` true (after the 120ms delay): ease asymptotically toward ~0.9.
  - On `active` false: animate to 1.0, hold briefly, fade, then stop rendering.
- Pure view logic — touches no game state and no store.

### 2. `useAsyncStatus` — global status store + `track()`

`src/store/asyncStatus.ts`

- Zustand store: `pending: number`, `start()`, `done()`.
- Derived `active = pending > 0` (a **counter**, not a boolean, so overlapping
  calls keep the bar up until all finish).
- `track<T>(p: Promise<T>): Promise<T>` — calls `start()`, awaits, and calls
  `done()` in a `finally` (so rejections still stop the bar).

### 3. Two render sites (the hybrid placement)

- **Global bar** — mounted once at the app root: `position: fixed`, top edge,
  full width, ~3px tall, `z` above everything. Renders
  `<TrickleBar active={pending > 0} />`. Covers transitions **1–4** (the
  full-screen routes). Each of those call sites is wrapped in `track(...)`.
- **In-game slot** — the 6px slot already reserved in `GameShell` under the top
  bar. When a journey answer submit is in flight, the slot shows the TrickleBar
  (cyan) instead of the now-irrelevant green selecting timer. Driven by a new
  `submitting` flag on the game store, set around the `submitAttempt` call.
  Transition **5** drives **only** the slot — not the global bar — so the two
  indicators never double up.

## Wiring

- `AuthScreen.run()` — wrap `fn()` in `track(...)`.
- `JourneyScreen.load()` — wrap `getJourney()` in `track(...)`.
- `LevelDetailScreen.load()` — wrap `getLevel()` in `track(...)`.
- `LevelDetailScreen.play()` — wrap `startJourneySession(...)` in `track(...)`.
- `gameStore.submitJourneyAttempt()` — set `submitting: true` before the
  `submitAttempt` call, clear it in a `finally`. `GameShell` renders the
  TrickleBar in the slot when `submitting` is true.

## Edge cases & error handling

- **Errors hide the bar.** `track()` decrements in `finally`; the `submitting`
  flag clears in `finally`. A failed/rejected call always stops the bar, and the
  existing error UIs (auth error text, "Couldn't load…", `journeyError`) take over.
- **Concurrent calls.** The counter keeps the bar up until every in-flight call
  resolves.
- **Fast calls.** The 120ms show-delay means a sub-100ms call shows no bar.
- **No double bars.** The submit path drives only the slot; everything else
  drives only the global bar.
- **Unmount mid-flight.** `track`'s `finally` runs even if the originating
  component unmounts (e.g. modal closed), so the counter never gets stuck.

## Testing

Following the existing vitest + React Testing Library setup:

- `useAsyncStatus`: `start`/`done` increment/decrement; `active` derived
  correctly under overlapping calls.
- `TrickleBar`: with `vi.useFakeTimers`, mounts after the 120ms delay while
  `active`; on `active→false` reaches 100% then stops rendering.
- Wiring smoke tests: `AuthScreen` shows the bar while a sign-in promise is
  pending; the in-game slot shows the trickle while `submitting` is true.

## Out of scope

- Per-context color tinting (everything stays cyan for v1).
- Spinners or skeleton screens — the trickle bar is the single mechanism.
- Retry/backoff behavior — unchanged; only the visual feedback is added.
