# Multi-Round Levels — Plan 4: Flash Mob Round Implementation Plan

> **For agentic workers:** implement task-by-task. Tests + build must be green before each commit.

**Goal:** Add the Flash Mob round (Round 4 of a level, the final theme). During viewing there is **no board** — each gap's tetromino shape flashes **once, centered on screen, 700ms on / 300ms off**, in a **single pass** (no loop). The reveal is **not skippable** (no early "Ready →"). The player tallies the flashed shapes from memory and picks them with the same unordered +/− stepper menu as Basic. Speed scoring uses the **select-only exception** (banked view-time is always 0).

**Architecture:** Flash Mob reuses today's generation (basic, no color/order), today's `solve()` validation, and the Basic selection menu (both `colorMatters` and `orderMatters` are false). The only genuinely new pieces are: (a) activating round 4 in `THEME_SEQUENCE`, (b) a **derived view duration** (`gapCount × 1000ms`) threaded through `beginViewing` / `endViewing` / `submitSelection` via a single helper, and (c) the presentational `FlashReveal` component plus routing it into `ViewingPhase`. `scoreRound`/`roundSpeed` already honor `selectOnly` (already wired in `submitSelection`), so `scoring.ts` is NOT touched.

**Tech Stack:** React 18, Zustand 5 (`useShallow` for object selectors), TypeScript, Vite, Vitest + jsdom, Tailwind.

## Conventions (read before starting)

- **Run tests:** `npm run test`. Single file: `npx vitest run <path>`.
- **Type-check / build:** `npm run build` (enforces `noUnusedLocals`; `tsc --noEmit` is a no-op here).
- **nvm quirk:** shell errors on chained commands (`a && b`). Run each `npm`/`npx` as its own Bash call.
- **Zustand 5:** object selectors MUST use `useShallow`.

## Already done (verify, do not rebuild)

- `supabase/functions/_shared/types.ts`: `RoundTheme` includes `'flashMob'`; `THEME_LABEL.flashMob = 'Flash Mob'`.
- `supabase/functions/_shared/core/themeConfig.ts`: `flashMob: { orderMatters: false, colorMatters: false }`.
- `supabase/functions/_shared/core/scoring.ts`: `roundSpeed`/`scoreRound` honor `selectOnly`.
- `src/store/gameStore.ts` `submitSelection`: passes `selectOnly: roundTheme === 'flashMob'`.
- `src/store/gameStore.ts` `startGame`: non-color/non-order themes fall through to the plain `difficulty` generator.
- `src/components/SelectingPhase.tsx`: Basic branch (8 piece +/− steppers) already serves flashMob.

## File map

| File | Change |
|------|--------|
| `supabase/functions/_shared/types.ts` | `THEME_SEQUENCE[3]` → `'flashMob'` |
| `src/store/gameStore.ts` | `effectiveViewDuration(roundTheme, difficulty)` helper + use in `beginViewing`, `endViewing`, `submitSelection` |
| `src/components/FlashReveal.tsx` | **Create** — centered single-pass shape flasher; calls `endViewing` after the last shape |
| `src/components/ViewingPhase.tsx` | Route to `<FlashReveal>` for flashMob (no Grid/overlays, no Ready button) |

Tests:
- `tests/store/gameStore.flashmob.test.ts` (Create) — round 4 is flashMob; effective view duration.
- `tests/core/levelScoring.flashmob.test.ts` (Create) — select-only speed for a flashMob clear via `scoreRound`.
- `tests/components/FlashReveal.test.tsx` (Create) — renders gap shapes; single-pass; calls endViewing; no Ready button.

## Task 1: Activate Round 4 + derived view duration helper

- Flip `THEME_SEQUENCE[3]` from `'basic'` to `'flashMob'` in `types.ts`.
- Add `effectiveViewDuration(roundTheme, difficulty)` in `gameStore.ts` returning
  `roundTheme === 'flashMob' ? difficulty.gapCount * 1000 : difficulty.viewDuration`.
- Use it in `beginViewing` (`phaseDuration`), `endViewing` (`viewTimeRemaining` math),
  and `submitSelection` (`viewDuration` passed to `scoreRound`).
- Tests: `tests/store/gameStore.flashmob.test.ts`, `tests/core/levelScoring.flashmob.test.ts`.

## Task 2: FlashReveal component + viewing routing

- Create `src/components/FlashReveal.tsx`: iterate `gaps` in order; each shape flashes
  centered for 700ms on then 300ms off, single pass; after the last off-phase call
  `endViewing` once. Render each shape via `PieceShape`. Non-skippable, no game-state
  mutation beyond the final `endViewing`.
- Route `ViewingPhase`: when `roundTheme === 'flashMob'`, render `<FlashReveal>` instead of
  the Grid/GapBorder/GapNumbers/GapShimmer stack, and omit the "Ready →" button. To avoid a
  double-fire, ViewingPhase's existing `setTimeout(endViewing, …)` is skipped for flashMob
  (FlashReveal owns the transition).
- Test: `tests/components/FlashReveal.test.tsx` (fake timers).

## Verification

- `npm run test` (all green), `npm run build` (no `noUnusedLocals` errors).

## Self-review / scope

- Spec §4 (select-only Speed), §5 (Round 4 reveal cadence 700/300 single pass), §8 (FlashReveal),
  §9 (`viewDuration = gapCount × 1000`) covered.
- Out of scope: Journey/server port, difficulty tuning beyond Vacant Heights.
