# Infinite Stagger — Named Levels + Calibration Sandbox

**Date:** 2026-06-26
**Status:** Approved (design) — ready for implementation plan
**Mode affected:** Infinite Stagger (`StaggerScreen` / `staggerStore` / `staggerCurve`). Journey & Practice untouched.

---

## Motivation

Two problems:

1. **The "doubles" are too hard.** Today Infinite Stagger is one endless run whose difficulty comes from `STAGGER_CURVE` (25 rungs in `src/lib/staggerCurve.ts`) moving four independent levers — shape variety, orientation freedom, gap count `N`, and **pairs `P`**. The pairing density lever (L13–16) spikes difficulty. We need a calibration surface and a faster feedback loop.
2. **It's hard to playtest deep mechanics.** You cannot reasonably play your way to a Transformers-style round. We need an unlosable sandbox to sit in any mechanic and tune it.

The fix is a **structural reframe**: replace the bare endless ramp's *framing* with **5 named, score-gated levels**, each with a bonus multiplier and a (calibratable) defining reveal mechanic, plus a **dev-only sandbox** to iterate on each mechanic in isolation.

**Scope note:** This spec builds the *structure and the sandbox*. The exact per-level mechanics and the difficulty curve are deliberately left as calibratable hooks — the sandbox is the tool we will use to settle them later. We are not re-tuning the curve in this work.

---

## The 5 levels

| # | Name | Cumulative threshold | Multiplier | Defining mechanic (calibrated later) |
|---|------|----------------------|------------|--------------------------------------|
| 1 | **SOLOS** | 20,000 | ×1 | Single reveals (one gap per beat) |
| 2 | **TWINS** | 50,000 | ×2 | Pairs (two gaps per beat) |
| 3 | **TRIPLETS** | 100,000 | ×3 | Triples (three gaps per beat) |
| 4 | **TRANSFORMERS** | 200,000 | ×4 | Pieces visibly morph shape — **TBD, placeholder hook**; escalates doubles → triplets |
| 5 | **CRAWLERS** | 500,000 | ×5 | Single reveals with tighter stagger so blooms overlap → **WIN** at threshold |

Naming is `CRAWLERS` (not `INVERTERS`) per the sandbox list. The completion thresholds, multipliers, and mechanic params all live in **one config table** so retuning is a one-line change.

---

## Part 1 — Level structure

**New file `src/lib/staggerLevels.ts`** — the single calibration surface:

- An ordered `STAGGER_LEVELS` array of `{ key, name, threshold, multiplier, mechanic }`.
  - `key`: stable id (`'solos' | 'twins' | 'triplets' | 'transformers' | 'crawlers'`).
  - `name`: display string (`'SOLOS'`, …).
  - `threshold`: **cumulative** running-total score at which the level completes.
  - `multiplier`: integer bonus applied per correct pick.
  - `mechanic`: a config object (named hook) describing the reveal style. For now it mostly toggles existing levers (e.g. `{ kind: 'singles' }`, `{ kind: 'pairs' }`). `transformers` and `crawlers` carry placeholder mechanic configs we wire up later.
- Pure helpers (unit-tested):
  - `levelForScore(score)` → the active level (highest level whose threshold has **not** yet been crossed).
  - `levelIndexForScore(score)` → its index.
  - `nextThreshold(score)` → the threshold the player is currently climbing toward.
  - `isWon(score)` → `score >= final threshold`.
  - `levelByKey(key)` → lookup for sandbox launch.

**Scoring change (`staggerStore.ts`):** a correct pick currently awards `ACCURACY_PER_GAP * combo` (= `100 × combo`). Add the active level's multiplier: **`100 × streak × levelMultiplier`**. Streak (formerly "combo") behavior is otherwise unchanged.

**Rename "Combo" → "Streak"** in all **player-facing** copy: the `COMBO ×N` chip → `STREAK ×N`, game-over "Best Combo" → "Best Streak". Internal identifiers (`currentCombo`, `bestCombo`) may stay to limit churn; if renamed, rename consistently.

---

## Part 2 — Level-intro countdown (repositioned)

Today `StaggerCountdown` is a full-screen void overlay shown once at run start. New behavior, fired at the **start of each level**:

1. The **grid (board frame) appears first** — filled cells visible, gaps not yet revealed.
2. The **3·2·1 countdown overlays centered on the grid**.
3. The **level name** (e.g. `TWINS`) sits just above the countdown.
4. On zero → the reveal phase begins as today.

Batches *within* a level do not get a countdown (unchanged). The countdown is now a per-level "here is the board — this is TWINS — get ready" beat.

---

## Part 3 — Level completion celebration + triggers

- After a pick resolves, `staggerStore` checks whether `score` has crossed the active level's `threshold`.
- If crossed (and not the final level), the run enters a new **`levelComplete`** beat: a celebratory overlay showing *"SOLOS COMPLETE"*, the score, and the next level's name + multiplier (e.g. *"Next: TWINS · ×2"*), then flows into the Part 2 countdown for the next level.
- Crossing the **final** threshold (500,000, in CRAWLERS) → a **"YOU WIN"** game-complete celebration instead of advancing.
- All trigger values come from the config table — retuning is one line.

**Phase machine:** add a `levelComplete` (and reuse/extend for the win state) phase to `StaggerPhase`. Level transitions occur between batches, never mid-batch.

---

## Part 4 — Calibration sandbox

- **A "SANDBOX" section in `GlobalMenu`**, listing **SOLOS · TWINS · TRIPLETS · TRANSFORMERS · CRAWLERS**.
- **Gated** to dev/preview only — visible when `import.meta.env.DEV` **or** `location.hostname.endsWith('.vercel.app')`. Hidden on the production custom domain.
- Tapping a level launches Stagger **locked to that level in unlosable mode**:
  - **Infinite lives** — no game-over.
  - **No auto-advance** — crossing the threshold does not move to the next level; you stay in the chosen mechanic indefinitely to tune it.
  - A small **`SANDBOX · TWINS`** banner and an exit control back to Home.
- Implemented via a `sandboxLevel: LevelKey | null` flag on `staggerStore` that the phase machine reads to (a) skip life loss / game-over, and (b) skip level advancement. `startStagger` gains an optional level argument.

---

## Out of scope (explicitly)

- Final per-level mechanic definitions (TRANSFORMERS morph animation, CRAWLERS overlap timing, real triplet reveals). These are placeholder hooks; the sandbox exists to settle them next.
- Re-tuning the `STAGGER_CURVE` difficulty numbers.
- Persisting level progress / best level across runs.
- Journey and Practice modes (untouched).

---

## Testing

- **Unit tests** for `staggerLevels.ts` pure helpers: `levelForScore`, `nextThreshold`, `isWon`, boundary cases at exact thresholds, and the stacked scoring math.
- **Type/build:** `npx tsc --noEmit` and `npm run build` (catches `noUnusedLocals`) clean.
- **All existing tests pass** (`npm run test`).
- **Manual/preview verification:** countdown anchored over grid with level name; threshold crossing fires the celebration and advances; sandbox entries are dev-gated, unlosable, and locked to their level.
