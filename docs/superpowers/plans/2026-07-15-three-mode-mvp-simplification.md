# Three-Mode MVP Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Vanishing Tiles as a single infinite-ramp game with three player-selected modes (Easy / Medium / Hard), streak as the ONLY score multiplier, and all experimental mechanics (named levels SOLOS/TWINS/TRIPLETS/TRANSFORMERS/CRAWLERS, pairs/triples reveal chunking, inverted reveal, calibration sandbox) removed from the shipped code.

**Architecture:** All work is in the Infinite Stagger engine (`src/lib/staggerCurve.ts`, `src/store/staggerStore.ts`, `src/components/StaggerScreen.tsx`) plus the home screen. The old Journey/Practice engine stays untouched and hidden (`SHOW_EXPERIMENTAL = false`). Removal proceeds in compile-green layers: (1) named levels + sandbox, (2) pairs/triples/inverted, (3) new ramp table + slow select-clock tightening, (4) mode semantics in the store (ordered picks for Hard), (5) mode visuals (colors/tray/labels), (6) docs + final verification.

**Tech Stack:** Vite + React + TypeScript, Zustand 5 (`useShallow` for object selectors — see CLAUDE.md), Vitest.

## Global Constraints

- All tests green before every commit: `npm run test` (note: run npm commands as SEPARATE Bash calls — `a && b` chains break on this machine's nvm init).
- Type/build check per task: `npm run build` (catches `noUnusedLocals`; `tsc --noEmit` alone is NOT sufficient).
- Do not touch the OLD engine: `src/store/gameStore.ts`, `themeResolution/themeConfig`, Journey/Practice components, Supabase functions.
- Removed code is preserved by the git tag `pre-mvp-simplification` (created in Task 1) — never by keeping dead code around.
- The three modes (final semantics — this is the product spec):
  - **Easy** — memorize reveals each gap in its own piece color; recall tray in piece colors; pick in any order.
  - **Medium** — memorize reveals in piece colors; recall tray is monochrome neon pink `#FF2D9B`; pick in any order.
  - **Hard** — memorize reveals monochrome neon pink `#FF2D9B` (retire the graphite "impasto" reveal); recall tray monochrome pink; picks MUST match the order gaps were revealed.
- Streak (`currentCombo`) is the only multiplier: `gained = 100 × streak`. No level multiplier.
- Reveal pacing stays constant per batch (existing design). The speed ramp lives ONLY in the select clock, tightening slowly (see Task 3).

---

### Task 1: Remove named levels + calibration sandbox (streak becomes the only multiplier)

**Files:**
- Delete: `src/lib/staggerLevels.ts`, `src/lib/staggerMechanic.ts`, `src/lib/levelTransition.ts`, `src/components/StaggerSandboxPanel.tsx`, `src/store/staggerSandboxPresetStore.ts`
- Delete tests: `tests/store/staggerStore.levels.test.ts`, `tests/store/staggerStore.sandbox.test.ts`, `tests/lib/staggerLevels.test.ts`, `tests/lib/staggerMechanic.test.ts`, `tests/lib/levelTransition.test.ts`, `tests/store/staggerSandboxPresetStore.test.ts` (verify each exists before deleting; also delete any other test file that imports the deleted modules — find with `grep -rl "staggerLevels\|staggerMechanic\|levelTransition\|SandboxPanel\|sandboxPreset" tests/`)
- Modify: `src/store/staggerStore.ts`, `src/components/StaggerScreen.tsx`, `src/components/GlobalMenu.tsx`, `tests/store/staggerStore.test.ts`
- Check: `src/store/runHistoryStore.ts` and `src/components/RunHistoryGraph.tsx` for references to level names/indices; strip those fields if present.

**Interfaces:**
- Consumes: current `staggerStore` API.
- Produces: `StaggerPhase = 'idle' | 'countdown' | 'reveal' | 'selecting' | 'gameOver'` (drop `levelComplete`, `won`); `startRun()` takes no arguments; store no longer has `levelIndex`, `sandboxLevel`, `sandboxOverrides`, `completedLevelIndex`, `activeLevel`, `isSandboxRun`, `setSandboxOverride`, `setSandboxOverrides`, `rerollBatch`, `proceedAfterLevelComplete`. Scoring: `gained = STAGGER.ACCURACY_PER_GAP * nextCombo`.

- [ ] **Step 1: Tag the pre-simplification state so nothing is lost**

```bash
git tag pre-mvp-simplification
```

- [ ] **Step 2: Update `tests/store/staggerStore.test.ts` expectations first (TDD)** — remove/adjust any assertion that references level multipliers, sandbox, levelComplete/won. Add/keep an explicit test that a correct pick with streak N gains exactly `100 * N` (no other factor). Run `npx vitest run tests/store/staggerStore.test.ts` — expect failures against current code only where multiplier/level behavior changed (e.g. if a test asserted multiplied gains).

- [ ] **Step 3: Simplify `src/store/staggerStore.ts`:**
  - Drop imports from `staggerLevels`, `staggerMechanic`, `levelTransition`.
  - `StaggerPhase`: remove `'levelComplete' | 'won'`.
  - Remove state fields `levelIndex`, `sandboxLevel`, `sandboxOverrides`, `completedLevelIndex` and the exported helpers `activeLevel`, `isSandboxRun`, plus `sandboxCtx` and the sandbox branch inside `makeBatch` (keep only the curve-driven branch).
  - `startRun: () => void` — seeds `{...IDLE, phase: 'countdown'}`.
  - `beginSelecting`: `const duration = selectDurationForBatch(get().batchIndex)` (direct curve call, no `resolveSelectDuration`).
  - `pickPiece`: miss path loses a life unconditionally (no sandbox exemption); correct path: `const gained = STAGGER.ACCURACY_PER_GAP * nextCombo`.
  - `advanceBatch`: no level transition — `const next = batchIndex + 1; set({ phase: 'reveal', batchIndex: next, ...makeBatch(next) })`.
  - `timeoutBatch`: remove the sandbox early-return.
  - Delete actions `proceedAfterLevelComplete`, `setSandboxOverride`, `setSandboxOverrides`, `rerollBatch`.
  - Keep the trailing `if (import.meta.env.DEV) (window as any).__staggerStore = useStaggerStore` line as-is.

- [ ] **Step 4: Strip sandbox/level UI from `src/components/StaggerScreen.tsx`:** remove the `StaggerSandboxPanel` import + render, all `sandbox*`/`panelVisible` wiring, the `levelComplete`/`won` phase branches and their celebration components, and any level-name/multiplier badge UI. The countdown shows the mode label (already does). Remove now-unused imports.

- [ ] **Step 5: Strip the Sandbox launcher from `src/components/GlobalMenu.tsx`** (the `launchSandboxLevel` helper and the dev-only "Sandbox" section listing levels).

- [ ] **Step 6: Fix any remaining compile errors** (`grep -rn "staggerLevels\|staggerMechanic\|levelTransition\|sandbox" src/` should come back empty apart from unrelated words), then delete the files/tests listed above.

- [ ] **Step 7: Verify** — run `npm run test` then `npm run build` (separate calls). Both must pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Remove named levels + calibration sandbox; streak is the only multiplier"
```

---

### Task 2: Remove pairs/triples/inverted — every reveal beat is a single gap

**Files:**
- Modify: `src/lib/staggerCurve.ts`, `src/store/staggerStore.ts`, `src/components/StaggerScreen.tsx`, `tests/store/staggerStore.test.ts`
- Check for orphaned CSS: the `iv-*` (inverted) classes and `vtBloom` twin-offset styles in whatever stylesheet StaggerScreen uses — remove `iv-*` rules if they live in an obvious stagger-owned block.

**Interfaces:**
- Produces: `revealPlan: number[]` (a shuffled ordering of gap indices — one gap per beat; THIS ORDER is the presentation order Task 4's Hard mode enforces); `makeBatch` returns `{ gaps: StaggerGap[]; revealPlan: number[] }`; `StaggerGap` loses `inverted?`; `staggerCurve` exports lose `pairsForBatch`, `triplesForBatch`, `invertedForBatch`, `flashEventsForBatch`, `INVERTED_FROM`, `buildRevealPlan`; `batchRevealMs(batchIndex) = (gapCountForBatch(i) - 1) * REVEAL_STEP_MS + REVEAL_BLOOM_MS`.

- [ ] **Step 1: Update tests first** — in `tests/store/staggerStore.test.ts` delete the pairs/triples/inverted/beat-formula/buildRevealPlan suites; add:

```ts
it('reveals every gap as its own solo beat, covering all gaps exactly once', () => {
  useStaggerStore.getState().startRun()
  useStaggerStore.getState().beginReveal()
  const { gaps, revealPlan } = useStaggerStore.getState()
  expect(revealPlan).toHaveLength(gaps.length)
  expect([...revealPlan].sort((a, b) => a - b)).toEqual(gaps.map((_, i) => i))
})
```

Run: `npx vitest run tests/store/staggerStore.test.ts` — expect FAIL (revealPlan is still `number[][]`).

- [ ] **Step 2: Simplify `src/lib/staggerCurve.ts`:**
  - `STAGGER`: delete `REVEAL_TWIN_OFFSET_MS` and the five `INV_*` constants.
  - `StaggerRung` → `{ gaps: number }`; strip `pairs`/`triples` from every rung (Task 3 replaces the table values — here just drop the fields).
  - Delete `INVERTED_FROM`, `INVERTED_MAX`, `invertedForBatch`, `chunkableForBatch`, `triplesForBatch`, `pairsForBatch`, `flashEventsForBatch`, `buildRevealPlan`.
  - Add an exported `revealOrderForGaps(count: number, rng: () => number = Math.random): number[]` that returns a Fisher–Yates-shuffled `[0..count)` (reuse the existing `shuffleInPlace`).
  - `batchRevealMs`: `(gapCountForBatch(batchIndex) - 1) * STAGGER.REVEAL_STEP_MS + STAGGER.REVEAL_BLOOM_MS`.
  - Rewrite the file-top comment block to describe the remaining levers only (shape variety, orientation, gap count).

- [ ] **Step 3: Simplify `src/store/staggerStore.ts`:** `revealPlan: number[]`; `makeBatch` drops the re-roll loop, `chooseInverted`, and the plan feasibility check — generate once and `revealPlan: revealOrderForGaps(gaps.length)`; `StaggerGap` drops `inverted?`.

- [ ] **Step 4: Simplify `src/components/StaggerScreen.tsx`:** the reveal driver iterates `revealPlan` as single indices (no `beat.length` handling, no twin offset); delete `runInverted`, `invertedCellOrder`, and every `iv-*` / inverted-branch in the render; delete `REPLAY` behavior only if it referenced inverted (it doesn't — keep replay).

- [ ] **Step 5: Verify** — `npm run test`, then `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Remove pairs/triples/inverted reveal mechanics; solo-beat reveals only"
```

---

### Task 3: New single ramp with runway + slow select-clock tightening

**Files:**
- Modify: `src/lib/staggerCurve.ts`, `tests/store/staggerStore.test.ts`

**Interfaces:**
- Produces: `selectDurationForBatch(batchIndex)` now applies a tightening factor; new constants `SELECT_TIGHTEN_PER_BATCH = 0.005`, `SELECT_MIN_FACTOR = 0.7` inside `STAGGER`.

- [ ] **Step 1: Write failing tests** (append to the curve section of `tests/store/staggerStore.test.ts`):

```ts
describe('single ramp with runway', () => {
  it('holds 3 gaps for the first four levels, then climbs one gap every three levels to 12', () => {
    const expected = [3,3,3,3, 4,4,4, 5,5,5, 6,6,6, 7,7,7, 8,8,8, 9,9,9, 10,10,10, 11,11,11, 12]
    expected.forEach((gaps, i) => expect(gapCountForBatch(i)).toBe(gaps))
    expect(gapCountForBatch(60)).toBe(12) // endless tail clamps at the cap
  })

  it('tightens the select clock slowly: -0.5% per batch, floored at 70%', () => {
    const base = (n: number) => STAGGER.SELECT_BASE + gapCountForBatch(n) * STAGGER.SELECT_PER_GAP
    expect(selectDurationForBatch(0)).toBe(Math.round(base(0)))            // factor 1.0
    expect(selectDurationForBatch(20)).toBe(Math.round(base(20) * 0.9))   // 1 - 20*0.005
    expect(selectDurationForBatch(60)).toBe(Math.round(base(60) * 0.7))   // floor
    expect(selectDurationForBatch(200)).toBe(Math.round(base(200) * 0.7)) // stays floored
  })
})
```

Run: `npx vitest run tests/store/staggerStore.test.ts` — expect FAIL.

- [ ] **Step 2: Implement in `src/lib/staggerCurve.ts`:**

```ts
// in STAGGER:
SELECT_TIGHTEN_PER_BATCH: 0.005, // select clock loses 0.5% per level…
SELECT_MIN_FACTOR: 0.7,          // …until it bottoms out at 70% (batch 60+)

const STAGGER_CURVE: StaggerRung[] = [
  { gaps: 3 }, { gaps: 3 }, { gaps: 3 }, { gaps: 3 },   // L1–4 on-ramp
  { gaps: 4 }, { gaps: 4 }, { gaps: 4 },                 // L5–7 (orientation unlocks L8 — next block)
  { gaps: 5 }, { gaps: 5 }, { gaps: 5 },                 // L8–10
  { gaps: 6 }, { gaps: 6 }, { gaps: 6 },                 // L11–13
  { gaps: 7 }, { gaps: 7 }, { gaps: 7 },                 // L14–16
  { gaps: 8 }, { gaps: 8 }, { gaps: 8 },                 // L17–19
  { gaps: 9 }, { gaps: 9 }, { gaps: 9 },                 // L20–22
  { gaps: 10 }, { gaps: 10 }, { gaps: 10 },              // L23–25
  { gaps: 11 }, { gaps: 11 }, { gaps: 11 },              // L26–28
  { gaps: 12 },                                          // L29+ terminal; only time keeps tightening
]

export function selectDurationForBatch(batchIndex: number): number {
  const factor = Math.max(
    STAGGER.SELECT_MIN_FACTOR,
    1 - batchIndex * STAGGER.SELECT_TIGHTEN_PER_BATCH,
  )
  return Math.round((STAGGER.SELECT_BASE + gapCountForBatch(batchIndex) * STAGGER.SELECT_PER_GAP) * factor)
}
```

Keep `SHAPE_SCHEDULE` and `ORIENTATION_FREE_FROM = 7` exactly as they are (shape variety through L9 and the L8 orientation unlock still land inside the held-gap blocks — one lever at a time). Update the existing curve-shape tests that asserted the old table (e.g. "gaps hold at 3 then climb") to the new expected values.

- [ ] **Step 3: Verify** — `npm run test`, then `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Single ramp with runway: gentler gap climb + slow select-clock tightening"
```

---

### Task 4: Mode semantics in the store — Hard enforces reveal order

**Files:**
- Modify: `src/store/staggerStore.ts`, `src/components/HomeScreen.tsx` (pass the mode into `startRun`), `tests/store/staggerStore.test.ts`

**Interfaces:**
- Consumes: `Difficulty` type from `src/store/settingsStore.ts`; `revealPlan: number[]` from Task 2.
- Produces: `startRun(mode?: Difficulty)` (default `'easy'`); store state gains `mode: Difficulty`; in `mode === 'hard'`, `pickPiece(type)` is correct ONLY if `type` matches the earliest-unfilled gap in `revealPlan` order.

- [ ] **Step 1: Write failing tests:**

```ts
describe('hard mode: ordered recall', () => {
  function seedHardBatch() {
    useStaggerStore.getState().startRun('hard')
    useStaggerStore.getState().beginReveal()
    useStaggerStore.getState().beginSelecting()
    const { gaps, revealPlan } = useStaggerStore.getState()
    return revealPlan.map(i => gaps[i].pieceType)
  }

  it('accepts picks in reveal order', () => {
    const order = seedHardBatch()
    order.forEach(type => expect(useStaggerStore.getState().pickPiece(type).ok).toBe(true))
    expect(useStaggerStore.getState().gaps.every(g => g.filled)).toBe(true)
  })

  it('rejects a shape that exists on the board but is not next in order', () => {
    const order = seedHardBatch()
    const offOrder = order.find(t => t !== order[0])
    if (!offOrder) return // degenerate all-same-shape roll; nothing to assert
    const before = useStaggerStore.getState().lives
    const res = useStaggerStore.getState().pickPiece(offOrder)
    expect(res.ok).toBe(false)
    expect(useStaggerStore.getState().lives).toBe(before - 1) // same miss path as easy/medium
  })

  it('easy and medium accept any order', () => {
    useStaggerStore.getState().startRun('medium')
    useStaggerStore.getState().beginReveal()
    useStaggerStore.getState().beginSelecting()
    const { gaps, revealPlan } = useStaggerStore.getState()
    const last = gaps[revealPlan[revealPlan.length - 1]].pieceType
    expect(useStaggerStore.getState().pickPiece(last).ok).toBe(true)
  })
})
```

Run: `npx vitest run tests/store/staggerStore.test.ts` — expect FAIL (startRun takes no arg, no ordering).

- [ ] **Step 2: Implement in `src/store/staggerStore.ts`:**

```ts
import type { Difficulty } from './settingsStore'
// state: mode: Difficulty  (IDLE gets mode: 'easy' as Difficulty)
startRun: (mode: Difficulty = 'easy') => set({ ...IDLE, phase: 'countdown', mode }),

// pickPiece target resolution replaces the current `gaps.find(...)`:
const { mode, revealPlan } = get()
const target = mode === 'hard'
  ? (() => {
      const nextIdx = revealPlan.find(i => !gaps[i].filled)
      return nextIdx !== undefined && gaps[nextIdx].pieceType === type ? gaps[nextIdx] : undefined
    })()
  : gaps.find(g => !g.filled && g.pieceType === type)
```

Everything downstream of `target` (miss path, streak, scoring) is unchanged.

- [ ] **Step 3: Wire the home screen:** in `src/components/HomeScreen.tsx`, the PLAY handler passes the selected difficulty: `startRun(difficulty)` (find the existing `play()` at ~line 63; it currently calls the start action with no args). The store's `mode` — not `settingsStore` read mid-run — is what gameplay logic uses from here on.

- [ ] **Step 4: Verify** — `npm run test`, then `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Three modes in the engine: Hard requires recall in reveal order"
```

---

### Task 5: Mode visuals — reveal colors, monochrome tray, ordered-recall hint

**Files:**
- Modify: `src/components/StaggerScreen.tsx`, `src/components/HomeScreen.tsx`, `src/store/settingsStore.ts` (doc comment only)
- Possibly modify: the component rendering tray pieces (`PieceTray`/`PieceShape` usage inside StaggerScreen ~line 264) — pass a color override rather than editing `PieceShape` itself if `PieceShape` supports a color prop; otherwise add an optional `colorOverride` prop to the tray piece rendering inside StaggerScreen.

**Interfaces:**
- Consumes: `mode` from `useStaggerStore` (NOT `settingsStore`) for all in-run visuals.
- Produces: reveal color = piece colors for easy AND medium, `REVEAL_MAGENTA` for hard; tray pieces monochrome `REVEAL_MAGENTA` for medium AND hard; a small "IN ORDER" indicator visible during `selecting` in hard mode.

- [ ] **Step 1: Reveal color logic** (StaggerScreen ~line 458): replace the current mapping (`easy` → piece colors, else magenta, `hard` → `vt-paint` graphite) with:

```ts
const paint = false // impasto retired — delete the vt-paint branch and its CSS class usage
const color = mode === 'hard' ? REVEAL_MAGENTA : PIECE_BLOOM_HEX[gap.pieceType]
```

Delete the `.vt-paint` branch in the bloom cell render (~line 202-207) and remove the `vt-paint` CSS rules if they live in a stagger-owned stylesheet block. Filled-gap confirmation colors during recall stay as they are (piece colors) — the monochrome rule applies to the TRAY, not to placed-piece feedback.

- [ ] **Step 2: Monochrome tray for medium/hard:** where tray pieces render (~line 264), pass `mode === 'easy' ? undefined : REVEAL_MAGENTA` as the piece color override so medium/hard trays are uniform neon pink.

- [ ] **Step 3: "IN ORDER" hint for hard:** during `phase === 'selecting' && mode === 'hard'`, render a small chip near the tray (match the existing STREAK-chip styling) reading `IN ORDER`. No per-gap numbering — the challenge is remembering the sequence.

- [ ] **Step 4: Home screen mode descriptions:** under the Easy/Medium/Hard segmented switch, show a one-line description of the SELECTED mode:
  - easy: "Full color. Recall in any order."
  - medium: "Monochrome tray. Recall in any order."
  - hard: "Monochrome. Recall in the order shown."

- [ ] **Step 5: Update the `Difficulty` doc comment in `src/store/settingsStore.ts`** to the new semantics (reveal + tray + ordering, not "hard plays faster").

- [ ] **Step 6: Verify** — `npm run test`, `npm run build`, then launch the preview (`preview_start` with the dev server) and visually confirm: easy = colored reveal + colored tray; medium = colored reveal + pink tray; hard = pink reveal + pink tray + IN ORDER chip; a wrong-order pick in hard shows the miss feedback.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Mode visuals: monochrome pink tray (medium/hard), pink reveal + IN ORDER hint (hard)"
```

---

### Task 6: Documentation refresh + full verification

**Files:**
- Modify: `CLAUDE.md` (the stale "The Game" section)

- [ ] **Step 1: Update CLAUDE.md:** describe the shipped game accurately — auth gate (Supabase, guest allowed) → Home → PLAY into Infinite Stagger with the three modes (spell out the Easy/Medium/Hard semantics from Global Constraints); the single ramp (gap climb table + select tightening + constant reveal pacing); streak-only scoring (`100 × streak`, speed bonus ≤500/batch, 5 lives, life per 5000 pts, miss and timeout both cost a life); note Journey/Practice are legacy code kept behind `SHOW_EXPERIMENTAL = false`, and that removed mechanics live at tag `pre-mvp-simplification`.

- [ ] **Step 2: Full verification** — `npm run test`, `npm run build`, and one end-to-end preview pass of all three modes from AuthScreen (guest) through a few rounds.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Refresh CLAUDE.md for the three-mode MVP"
```
