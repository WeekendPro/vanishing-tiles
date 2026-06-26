# Plan — Infinite Stagger Named Levels + Calibration Sandbox

Spec: `docs/superpowers/specs/2026-06-26-stagger-levels-and-sandbox-design.md`
Branch: `feat/stagger-levels-sandbox`

## Global Constraints (bind every task)

- **Mode isolation:** Only Infinite Stagger is touched (`StaggerScreen.tsx`, `staggerStore.ts`, `staggerCurve.ts`, new `staggerLevels.ts`, `GlobalMenu.tsx`, nav wiring). Journey & Practice code, `gameStore`, scoring for those modes — DO NOT modify.
- **The 5 levels, exact values** (cumulative running-total thresholds; integer multipliers):
  | key | name | threshold | multiplier |
  |-----|------|-----------|------------|
  | `solos` | SOLOS | 20000 | 1 |
  | `twins` | TWINS | 50000 | 2 |
  | `triplets` | TRIPLETS | 100000 | 3 |
  | `transformers` | TRANSFORMERS | 200000 | 4 |
  | `crawlers` | CRAWLERS | 500000 | 5 |
- **Thresholds are cumulative** on the single never-resetting `score`. Active level = highest level whose threshold has NOT yet been crossed. Crossing `crawlers`' 500000 = WIN.
- **Multiplier stacks on streak:** correct pick awards `ACCURACY_PER_GAP × streak × levelMultiplier` (today it is `ACCURACY_PER_GAP × combo`, `ACCURACY_PER_GAP = 100`).
- **"Combo" → "Streak"** in all player-facing copy. Internal identifiers may remain `combo` to limit churn, but no player-visible string says "Combo".
- **Per-level mechanics are calibratable hooks, deliberately NOT fully built.** Do not build triplet reveals, morph animation, or overlap-timing now. The `mechanic` field is a config stub. The existing `STAGGER_CURVE` and its ramp are NOT re-tuned.
- **Zustand 5:** object selectors must use `useShallow` (see CLAUDE.md).
- **Verification:** `npm run test`, `npx tsc --noEmit`, and `npm run build` must all pass before a task is done. New pure logic gets unit tests (Vitest, matching existing test style/location).

---

## Task 1 — `staggerLevels.ts` config + pure helpers (+ tests)

**File:** create `src/lib/staggerLevels.ts` and `src/lib/staggerLevels.test.ts`.

Export:
- `type LevelKey = 'solos' | 'twins' | 'triplets' | 'transformers' | 'crawlers'`.
- `interface StaggerLevel { key: LevelKey; name: string; threshold: number; multiplier: number; mechanic: LevelMechanic }`.
- `type LevelMechanic` — a discriminated/config object. Minimum viable shape: `{ kind: 'singles' | 'pairs' | 'triples' | 'transform' | 'crawl' }` plus an open-ended `params?: Record<string, number>` for later calibration. solos→singles, twins→pairs, triplets→triples, transformers→transform, crawlers→crawl.
- `const STAGGER_LEVELS: readonly StaggerLevel[]` — ordered, with the exact values from Global Constraints.
- Pure helpers:
  - `levelIndexForScore(score: number): number` — index of the active (current) level. Score below 20000 → 0 (solos). Score `>= 20000 && < 50000` → 1 (twins). … Score `>= 500000` → clamps to last index (crawlers / won state).
  - `levelForScore(score: number): StaggerLevel` — `STAGGER_LEVELS[levelIndexForScore(score)]`.
  - `nextThreshold(score: number): number` — the threshold the player is currently climbing toward (the active level's threshold). At/after final threshold, return the final threshold.
  - `isWon(score: number): boolean` — `score >= STAGGER_LEVELS[last].threshold` (>= 500000).
  - `levelByKey(key: LevelKey): StaggerLevel`.
  - `levelIndexByKey(key: LevelKey): number`.

**Boundary semantics (test these exactly):** thresholds are the score at which a level *completes*. So while climbing SOLOS the active level is `solos` for `score` in `[0, 20000)`; at exactly `20000` the player has *completed* solos → active level becomes `twins`. i.e. `levelIndexForScore` uses `score >= threshold` to advance past a level.

**Tests:** cover score 0, 19999, 20000, 49999, 50000, 100000, 199999, 200000, 499999, 500000, 999999. Assert `levelForScore`, `nextThreshold`, `isWon` at each. Assert `STAGGER_LEVELS` has the exact 5 keys/names/thresholds/multipliers.

**Model:** standard.

---

## Task 2 — Store: level tracking, stacked scoring, level-complete + win phases, sandbox

**Files:** `src/store/staggerStore.ts` (primary); read `src/lib/staggerCurve.ts` for `ACCURACY_PER_GAP` and timing; may add a small helper but do NOT re-tune the curve.

Depends on Task 1 (`staggerLevels.ts`).

Changes:
1. **State additions:** `sandboxLevel: LevelKey | null` (default `null`). A derived or stored notion of current level is fine — derive from `score` via `levelForScore` where possible to avoid drift; for sandbox, the locked level is `sandboxLevel`.
2. **Scoring:** in the correct-pick path, multiply the awarded points by the active level's `multiplier`. Active level multiplier = sandbox ? `levelByKey(sandboxLevel).multiplier` : `levelForScore(score).multiplier`. Result: `gained = ACCURACY_PER_GAP × nextStreak × levelMultiplier`.
3. **Phase machine:** extend `StaggerPhase` with `'levelComplete'` and `'won'` (names at implementer's discretion if clearer, document them). After a pick resolves and the batch/normal flow would continue, detect a threshold crossing:
   - **Not sandbox**, and `score` crossed the active level's threshold but not final → enter `levelComplete` (carry which level was completed + the next level for the UI to show). The transition out of `levelComplete` leads into the level-intro countdown for the next level (Task 3 renders it).
   - **Not sandbox**, and `score >= 500000` (final) → enter `won`.
   - **Sandbox:** never advance level, never enter `levelComplete`/`won` on threshold — stay in the locked level's normal loop.
4. **Sandbox unlosable:** when `sandboxLevel !== null`, never decrement to game-over / never enter `gameOver` (infinite lives). Pick a clean implementation (e.g. clamp lives, or guard the game-over transition). Document it in the report.
5. **`startStagger` / start action:** accept an optional `level?: LevelKey`. When provided → set `sandboxLevel = level` and begin in that level's mechanic; when absent → normal run, `sandboxLevel = null`, start at solos.
6. **Reset** on a new run / exit clears `sandboxLevel`.
7. Expose whatever selectors the UI needs (active level object, completed/next level for the celebration, `isSandbox`).

**Provide for Task 3 (write in report):** the exact names of new phases, the selector(s)/state for active level + completed/next level + sandbox flag, and the `startStagger` signature.

**Tests:** unit-test the scoring multiplier stacking and the threshold-crossing → phase decision where they can be isolated as pure helpers. If logic is entangled in the store, extract a small pure function (e.g. `resolvePostPick(score, sandboxLevel)`) and test that.

**Model:** standard (most capable if integration proves subtle).

---

## Task 3 — UI: repositioned countdown, level-complete & win celebrations, Streak rename, sandbox banner

**File:** `src/components/StaggerScreen.tsx` (+ any small sub-component split if it grows; current `StaggerCountdown` is inline here).

Depends on Task 2 (use the phases/selectors/`startStagger` signature from Task 2's report — the dispatch will include them).

Changes:
1. **Repositioned level-intro countdown:** the grid/board frame renders (filled cells, gaps not yet revealed); the `3·2·1` countdown overlays **centered on the grid**; the **level name** (e.g. `TWINS`) sits just above the countdown. Replaces today's full-screen void countdown. Fires at the start of each level (run start, and after each `levelComplete`).
2. **`levelComplete` celebration:** overlay showing e.g. `SOLOS COMPLETE`, the score, and `Next: TWINS · ×2`, then flows into the countdown for the next level. Keep styling consistent with existing Afterglow/`vt-*` tokens and existing celebration visuals.
3. **`won` celebration:** `YOU WIN` game-complete state at 500000 (in crawlers). Distinct from `levelComplete`.
4. **Streak rename:** every player-facing "Combo" string → "Streak" (the `COMBO ×N` chip → `STREAK ×N`, game-over "Best Combo" → "Best Streak", any "Phase N" framing that should now read as the level name — show the active **level name** where the run context is shown).
5. **Sandbox banner:** when `isSandbox`, show a small `SANDBOX · <LEVELNAME>` banner and an exit-to-Home control. Unlosable: no game-over reachable (store enforces; UI just reflects it).

**Verify in preview:** countdown anchored over grid with level name; a simulated threshold crossing fires the celebration; STREAK label present. Use the dev store handle (`window.__store`) or sandbox to drive states.

**Model:** standard.

---

## Task 4 — Sandbox section in `GlobalMenu` + launch wiring

**Files:** `src/components/GlobalMenu.tsx` (primary); `src/store/navStore.ts` and/or `HomeScreen.tsx` as needed for launch into Stagger with a level.

Depends on Task 2's `startStagger(level?)` signature.

Changes:
1. **SANDBOX section** in `GlobalMenu`, listing five entries: SOLOS, TWINS, TRIPLETS, TRANSFORMERS, CRAWLERS (drive from `STAGGER_LEVELS`).
2. **Gating:** render the section only when `import.meta.env.DEV || location.hostname.endsWith('.vercel.app')`. Hidden on production custom domain. Centralize the check in a tiny helper (e.g. `src/lib/env.ts` `isSandboxEnv()`), reusable + testable.
3. **Launch:** tapping an entry calls the start action with that `LevelKey` (sandbox/unlosable) and navigates to Stagger (`goStagger()`), closing the menu.
4. Keep existing menu behavior intact (profile, in-game actions, settings). The section is additive.

**Tests:** unit-test `isSandboxEnv()` for localhost/dev, `*.vercel.app`, and a production host (mock as needed).

**Model:** standard.

---

## Final

After Task 4: whole-branch review (most capable model), fix Critical/Important, then `superpowers:finishing-a-development-branch`.
