# Infinite Stagger — TWINS Sandbox Calibration Workbench

**Date:** 2026-06-26
**Status:** Approved (design) — ready for implementation plan
**Mode affected:** Infinite Stagger only (`StaggerScreen` / `staggerStore` / `staggerCurve` / new `staggerMechanic`). Journey & Practice untouched.
**Builds on:** `2026-06-26-stagger-levels-and-sandbox-design.md` (named levels + sandbox shell).

---

## Motivation

The named-levels + sandbox shell shipped, but the sandbox's `mechanic` field is a stub:
entering the **TWINS** sandbox does **not** reliably show paired reveals. Cause: `makeBatch(batchIndex)`
derives the reveal mechanic (pairs/triples/inverted) purely from `batchIndex` through the difficulty
curve. In a sandbox the level is *locked* but `batchIndex` still increments every batch
(`advanceBatch` always does `+1`), so the mechanic drifts off the locked level name — TWINS only
starts pairing once `batchIndex` reaches the curve's pairing rungs (~L10+).

This work makes the sandbox **always play its locked level's mechanic**, polishes how the two
simultaneous ("twin") reveals read, and adds a **live, desktop-only tuning panel** to calibrate how
TWINS feels in real time.

This is **dev/preview-only tooling** (gated by `isSandboxEnv()`); it must not appear in production
and must not change normal (non-sandbox) runs.

---

## Deliverable 1 — couple sandbox level → reveal mechanic

### New pure module: `src/lib/staggerMechanic.ts`

The mechanic→reveal mapping and override resolution, isolated as pure functions (unit-tested):

```ts
type RevealCounts = { pairs: number; triples: number; inverted: number }

// Mechanic → reveal counts for a board of `gapCount` gaps. Respects the feasibility
// rule 2·P + 3·Tr ≤ N − Inv (each mechanic uses ONE chunk type, so clamping is simple).
revealCountsForMechanic(kind: LevelMechanic['kind'], gapCount: number): RevealCounts
```

| kind | mapping | notes |
|---|---|---|
| `singles` | `{ pairs: 0, triples: 0, inverted: 0 }` | all solo beats |
| `pairs` | `{ pairs: ⌊N/2⌋, … }` | **TWINS — the acceptance target.** Max pairing on EVERY batch |
| `triples` | `{ triples: ⌊N/3⌋, … }` | |
| `transform` | `triples: ⌊N/3⌋`, then `pairs` from the remainder | densest blend; **not polished this pass** |
| `crawl` | `{ pairs: 0, triples: 0, inverted: 0 }` (singles fallback) | **not polished this pass** |

Only `pairs` (TWINS) is the focus; `triples` is mapped correctly because it's cheap, while
`transform`/`crawl` get sensible-but-unpolished fallbacks (deferred — see Out of scope).

### Resolver helpers (pure, in `staggerMechanic.ts`)

Each layers an optional override on top of the mechanic/curve/constant default, so override values
map cleanly back onto the curve constants:

- `resolveRevealCounts(level, gapCount, overrides)` — start from `revealCountsForMechanic`, then if
  `overrides.pairs != null` substitute pairs (clamped to `⌊gapCount/2⌋`).
- `resolveGapCount(batchIndex, overrides)` — `overrides.gapCount ?? gapCountForBatch(batchIndex)`, clamped to `STAGGER.MAX_GAPS`.
- `resolveTiming(overrides)` → `{ stepMs, bloomMs, waveMs, twinOffsetMs }` — each `override ?? STAGGER` constant.
- `resolveMultiplier(level, overrides)` — `overrides.multiplier ?? level.multiplier`.
- `resolveSelectDuration(batchIndex, overrides)` — `overrides.selectDuration ?? selectDurationForBatch(batchIndex)`.

### Store changes (`staggerStore.ts`)

- `makeBatch` becomes **sandbox-aware**: when `sandboxLevel != null` it derives `gapCount` and the
  reveal counts from the resolvers (mechanic + overrides) instead of the `batchIndex` curve helpers.
  **Non-sandbox runs keep the exact existing curve-driven path, byte-for-byte.**
- `pickPiece` multiplier routes through `resolveMultiplier`; `beginSelecting` select-clock through
  `resolveSelectDuration` — both only diverge from current behavior when sandboxed.
- New ephemeral state `sandboxOverrides: SandboxOverrides` (all fields `null` = "use default"),
  reset to all-null on `startRun`, never persisted.
- New actions: `setSandboxOverride(key, value)` and `rerollBatch()` (regenerate the current batch and
  replay its reveal, for instant structural-knob feedback).

### Twin-reveal polish

Today a pair blooms both gaps on the *identical* tick, so a pair can read as two unrelated blooms.
Multi-gap beats get a small **shared-pulse** treatment: a tunable intra-beat onset offset
(`STAGGER.REVEAL_TWIN_OFFSET_MS`, default ~70ms) between the two gaps, with synced flood color and
decay wave — so a pair reads as one coupled "da-dum" beat. The offset is exposed as a tuning knob
(see Deliverable 2).

---

## Deliverable 2 — live tuning panel

### `src/components/StaggerSandboxPanel.tsx`

A **fixed right-side panel** (`fixed right-0 top-0 h-screen`, ~280px wide, vt-* styled, collapsible
to a thin tab), rendered from `StaggerScreen` only when `isSandboxRun(...)` **and** `isSandboxEnv()`.
Desktop-only: it sits in the viewport's right margin and does not constrain the centered game column
(no need to fit the mobile game view — this is a laptop dev tool).

**8 knobs**, each a labeled slider + numeric readout + per-knob reset to default:

1. **Pairs-per-board** (structural)
2. **Gap count** (structural)
3. **`REVEAL_STEP_MS`** — stagger between flashes (timing)
4. **`REVEAL_BLOOM_MS`** — visible duration; with #3 controls overlap (timing)
5. **`REVEAL_WAVE_MS`** — per-cell decay wave (timing)
6. **Twin-pulse offset** (`REVEAL_TWIN_OFFSET_MS`) — intra-beat onset offset between paired gaps (timing)
7. **Level multiplier** (scoring)
8. **Select-clock duration** (timing)

### Apply timing ("live where safe, else next batch")

- **Timing + multiplier** (knobs 3–8): take effect live on the next reveal / next pick.
- **Structural** (knobs 1–2): apply on the next batch automatically; a **"Re-roll board"** button
  regenerates the current batch immediately for instant feedback, so sliders don't interrupt an
  in-progress reveal on every tick.

### Overrides shape

```ts
interface SandboxOverrides {
  gapCount: number | null
  pairs: number | null
  revealStepMs: number | null
  revealBloomMs: number | null
  revealWaveMs: number | null
  twinOffsetMs: number | null
  multiplier: number | null
  selectDuration: number | null
}
```

`null` = "use the mechanic/curve/constant default", keeping the panel's state a thin override layer
over the real constants.

---

## Guarantees preserved (must not regress)

- **Locked level** — sandbox stays on its chosen level; no advancement.
- **Unlosable** — lives never drop, `gameOver`/`won` unreachable in sandbox.
- **Mode isolation** — only Infinite Stagger files touched. Journey/Practice/`gameStore` untouched.
- **Production-safe** — panel + coupling gated by `isSandboxEnv()`; invisible in production.
- **Non-sandbox runs unchanged** — the curve-driven reveal path is untouched for normal play.

---

## Out of scope (explicitly)

- Polished `transform` and `crawl` mechanics (sensible fallbacks only this pass).
- Persisting overrides across runs/sessions.
- Re-tuning the `STAGGER_CURVE` numbers for normal play.
- Journey and Practice modes.

---

## Testing

- **Unit tests** (`tests/lib/staggerMechanic.test.ts`): `revealCountsForMechanic` per kind + feasibility
  clamps at small/large `N`; `resolveRevealCounts`/`resolveGapCount`/`resolveTiming`/`resolveMultiplier`/
  `resolveSelectDuration` with and without overrides (null falls through to default; value overrides win and clamp).
- **Type/build:** `npx tsc --noEmit` and `npm run build` (catches `noUnusedLocals`) clean.
- **All existing tests pass** (`npm run test`).
- **Manual/preview verification:** hamburger → SANDBOX → TWINS shows paired reveals on the FIRST batch;
  the right panel's knobs change the game live (timing/multiplier) or on re-roll (structural); lives
  never drop; panel absent in a production-like (non-dev, non-`*.vercel.app`) host.
