# Gap City — Per-Station Sequential Gating Design (gameplay change)

**Date:** 2026-06-02
**Status:** Approved direction — **deferred to a future instance.** NOT part of Spec 2
(the Map redesign). This is a **gameplay/gating change** and must be implemented as such.
**Depends on:** Spec 2 (the Map) being in place — its station-state visuals were
deliberately designed to slot into this gating with minimal rework.
**Branch:** build on top of `feat/gap-city-identity` + Spec 2's work.

---

## 1. Why this is its own spec

Spec 2 (the transit-map Map) is **presentational only** and keeps today's lock behavior.
During Spec 2 brainstorming the user decided the *real* progression model should change —
but changing what's playable is a gameplay change, so it was split out here to keep
Spec 2 focused. This document captures the locked decisions so a future instance can pick
it up cleanly.

## 2. The change

**Replace district-level unlocking with per-station sequential gating.**

- **Ditch the 70% district-unlock rule** entirely (today: a line unlocks when the
  previous district is ≥70% cleared, and all stations on an unlocked line are freely
  tappable).
- **New rule:** progression is a single linear path across all 15 stations (Hollows 1–5 →
  Stacks 6–10 → Grid 11–15, in `display_number` order). At any time there is a **"current"
  station** = the first station the player has not yet cleared.
  - **Everything before the current station** (i.e. cleared stations) is **revisitable** —
    the player can replay any completed level.
  - **Everything after the current station is locked** — you cannot skip ahead past an
    incomplete station.
- Lines no longer gate as whole blocks; the gate is per station and advances one at a
  time as stations are cleared. (A line is, in effect, "unlocked" up to the current
  station and locked beyond it — districts become purely a visual/thematic grouping, not a
  gating unit.)

## 3. Resolved design questions

- **Why this doesn't create an unsolvable wall:** a station you keep failing becomes a
  hard gate (no skipping). The user accepted this explicitly, because the project's design
  philosophy guarantees **every level is solvable** — the view/select timers rise with
  `gap_count` so the challenge is *speed, not feasibility* (see CLAUDE.md "Difficulty
  table"). So a stuck player can always, eventually, clear the current station. The old
  "go play an easier level in the district" release valve is intentionally removed.
- **Internal-contradiction resolution:** the old 70% rule and per-station gating disagree
  about what's playable (70% lets you advance without clearing every level; per-station
  forbids skipping). **Per-station gating wins; the 70% rule is removed**, not layered.
- **"Current" definition:** first station (by `display_number`) with `cleared = false`.
  If a station was played and failed (attempted but not cleared) it is still the current
  station. If all 15 are cleared, the game is fully complete (no current station — decide
  the end-state treatment in that spec's brainstorming).

## 4. Likely implementation surface (to be confirmed when built)

This is a sketch, not a plan — the implementing instance should brainstorm/plan properly.

- **Gating source of truth:** decide between (a) the backend `get_journey` RPC computing a
  per-level `locked`/`current` flag from `display_number` + the player's `cleared` set, or
  (b) a frontend gating layer over the existing data. Backend is cleaner (single source,
  testable in pgTAP) and keeps the client dumb. The RPC currently emits a per-*theme*
  `locked` flag derived from `unlock_threshold`; this work replaces that derivation with
  per-level sequential logic.
- **Remove/neutralize `unlock_threshold`** usage in `get_journey` (the 70% join). Decide
  whether to drop the column or just stop reading it.
- **Map visuals (Spec 2):** promote the "ahead (unlocked line)" de-emphasized treatment to
  the real **locked** treatment for stations after the current one; "next stop" becomes
  the single playable frontier; cleared stations stay revisitable. Spec 2's station-state
  vocabulary already anticipates this — mostly a matter of switching which stations get
  the locked style and disabling taps beyond the current station.
- **Tests:** pgTAP for the new gating logic (cleared N → station N+1 current, N+2 locked);
  frontend tests that stations after current are disabled and cleared ones remain tappable;
  remove/replace the existing 70%-threshold lock tests.

## 5. Explicitly NOT decided here

- The fully-complete end state (all 15 cleared).
- Whether `unlock_threshold` / `themes.unlock_threshold` is dropped or merely unused.
- Any change to scoring, solver, or the difficulty table (this is gating only).
