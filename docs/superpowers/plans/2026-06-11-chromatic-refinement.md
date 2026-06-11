# Chromatic Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Chromatic puzzles mix multiple tetromino shapes in a 5-color neon palette, and replace the combinatorial shape×color button grid with a clean two-panel "active selection" UI.

**Architecture:** Three small data/logic changes (palette ids, a difficulty→shape-count helper, a generalized variety guard) plus one component rewrite (the `colorMatters` branch of `SelectingPhase`). Validation/solver untouched — matching stays shape AND color per gap.

**Tech Stack:** React + TypeScript, Zustand 5 (`useShallow` for object selectors), Tailwind (neon tokens in `tailwind.config.js`), Vitest + Testing Library.

**Norms:** Run `npm` / `npx` as separate shell calls (no `&&` chaining). Before committing the whole feature: `npm run build` + `npm run test` + `npm run lint` all green.

---

### Task 1: Neon palette — recolor the shared color set

**Files:**
- Modify: `supabase/functions/_shared/core/themeConfig.ts` (`GAP_COLOR_IDS`)
- Modify: `src/lib/gapPalette.ts` (`FILL`, `BORDER`)
- Test: `tests/engine/puzzleGenerator.colorCoded.test.ts` (existing — still imports `GAP_COLOR_IDS`)

- [ ] **Step 1: Update `GAP_COLOR_IDS` to the 5 neon ids**

In `themeConfig.ts`, replace the 7-id array:

```ts
export const GAP_COLOR_IDS = [
  'cyan', 'magenta', 'green', 'purple', 'yellow',
] as const
```

Update the surrounding comment from "7-color palette" to "5-color neon palette".

- [ ] **Step 2: Recolor `gapPalette.ts` to neon hex**

Replace the `BORDER` and `FILL` maps so both use neon hex via Tailwind arbitrary values, keyed by the new 5 ids:

```ts
const BORDER: Record<string, string> = {
  cyan:    'border-[#22d3ee]',
  magenta: 'border-[#ff2d95]',
  green:   'border-[#39d98a]',
  purple:  'border-[#a855f7]',
  yellow:  'border-[#facc15]',
}

const FILL: Record<string, string> = {
  cyan:    'bg-[#22d3ee]',
  magenta: 'bg-[#ff2d95]',
  green:   'bg-[#39d98a]',
  purple:  'bg-[#a855f7]',
  yellow:  'bg-[#facc15]',
}
```

Update the doc comment to describe the neon set (cyan/magenta/green/purple/yellow; red dropped because neon-red and neon-magenta are too close). Keep the `gapBorderClass`/`gapFillClass` fallbacks (`'border-gray-300/70'` / `'bg-gray-400'`) unchanged.

- [ ] **Step 3: Run the existing color-coded generator test**

Run: `npx vitest run tests/engine/puzzleGenerator.colorCoded.test.ts`
Expected: PASS (3 gaps ≤ 5 colors, so distinct-color assertion still holds).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/core/themeConfig.ts src/lib/gapPalette.ts
git commit -m "feat(chromatic): 5-color neon gap palette (cyan/magenta/green/purple/yellow)"
```

---

### Task 2: Generalize the variety guard to multi-shape Chromatic

**Files:**
- Modify: `supabase/functions/_shared/engine/puzzleGenerator.ts:151` (the `if (input.sequential ...)` guard)
- Test: `tests/engine/puzzleGenerator.colorCoded.test.ts`

- [ ] **Step 1: Write the failing test (multi-shape variety)**

Add to `tests/engine/puzzleGenerator.colorCoded.test.ts`:

```ts
it('spans ≥2 distinct shapes when shapeTypeCount > 1', () => {
  const { gaps } = generatePuzzle(
    { gapCount: 6, complexity: 'medium', colorCoded: { shapeTypeCount: 3, palette: [...GAP_COLOR_IDS] } },
    makeRng('cc-multi'),
  )
  expect(gaps).toHaveLength(6)
  expect(new Set(gaps.map(g => g.pieceType)).size).toBeGreaterThanOrEqual(2)
})
```

- [ ] **Step 2: Run it — confirm it can fail without the guard**

Run: `npx vitest run tests/engine/puzzleGenerator.colorCoded.test.ts -t "spans"`
Note: this *may* pass by luck for this seed even before the fix. The guard's job is to make it hold for **every** seed; proceed to implement regardless.

- [ ] **Step 3: Generalize the guard condition**

In `puzzleGenerator.ts`, change the guard from:

```ts
  if (input.sequential && allowedTypes.length > 1) {
```

to:

```ts
  const wantsVariety = input.sequential || (!!input.colorCoded && input.colorCoded.shapeTypeCount > 1)
  if (wantsVariety && allowedTypes.length > 1) {
```

Update the comment above it to note it now also covers multi-shape color-coded puzzles (so Chromatic shows a genuine mix, never all-identical shapes).

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/engine/puzzleGenerator.colorCoded.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/engine/puzzleGenerator.ts tests/engine/puzzleGenerator.colorCoded.test.ts
git commit -m "feat(chromatic): variety guard for multi-shape color-coded boards"
```

---

### Task 3: Difficulty → shape-count helper, wired into startGame

**Files:**
- Modify: `src/store/gameStore.ts` (add exported `colorShapeTypeCount`; use it in `startGame`)
- Modify: `tests/store/gameStore.colorCoded.test.ts` (relax round-2 assertion; add helper unit test)

- [ ] **Step 1: Write the failing helper test**

Add to `tests/store/gameStore.colorCoded.test.ts` (import the helper at the top:
`import { useGameStore, colorShapeTypeCount } from '../../src/store/gameStore'`):

```ts
describe('colorShapeTypeCount', () => {
  it('scales 1→4 by gap count, starting at 1', () => {
    expect(colorShapeTypeCount(3)).toBe(1)
    expect(colorShapeTypeCount(4)).toBe(2)
    expect(colorShapeTypeCount(6)).toBe(2)
    expect(colorShapeTypeCount(7)).toBe(3)
    expect(colorShapeTypeCount(10)).toBe(3)
    expect(colorShapeTypeCount(11)).toBe(4)
    expect(colorShapeTypeCount(16)).toBe(4)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/store/gameStore.colorCoded.test.ts -t "colorShapeTypeCount"`
Expected: FAIL — `colorShapeTypeCount is not a function` (not exported yet).

- [ ] **Step 3: Implement and export the helper**

In `src/store/gameStore.ts`, near `getDifficulty` (~line 43):

```ts
/** Chromatic shape variety scales with board size: a gentle 1-shape on-ramp on
 *  the smallest boards, up to a 4-shape mix on the busiest. Capped downstream by
 *  the generator's available complexity pieces. */
export function colorShapeTypeCount(gapCount: number): number {
  if (gapCount <= 3) return 1
  if (gapCount <= 6) return 2
  if (gapCount <= 10) return 3
  return 4
}
```

- [ ] **Step 4: Use it in `startGame`**

In `startGame`, change the `colorCoded` puzzle-input branch (currently hardcoded `shapeTypeCount: 1`):

```ts
        ? {
            gapCount: difficulty.gapCount,
            complexity: difficulty.complexity,
            adjacency: difficulty.adjacency,
            colorCoded: { shapeTypeCount: colorShapeTypeCount(difficulty.gapCount), palette: [...GAP_COLOR_IDS] },
          }
```

- [ ] **Step 5: Update the round-2 Practice assertion**

In `tests/store/gameStore.colorCoded.test.ts`, the `round 2 is color-coded` test asserts a single shape. Round 2 → `DIFFICULTY_TABLE[1]` (gapCount 4) → 2 shapes with the variety guard. Replace:

```ts
    expect(new Set(s.gaps.map(g => g.pieceType)).size).toBe(1)
```

with:

```ts
    // gapCount 4 → up to 2 shapes; variety guard guarantees ≥2 distinct shapes.
    expect(new Set(s.gaps.map(g => g.pieceType)).size).toBe(2)
```

- [ ] **Step 6: Run the store color-coded tests**

Run: `npx vitest run tests/store/gameStore.colorCoded.test.ts`
Expected: PASS (helper test, round-2 now 2 shapes, all others unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.colorCoded.test.ts
git commit -m "feat(chromatic): scale shape count 1→4 by difficulty in startGame"
```

---

### Task 4: Two-panel "active selection" UI

**Files:**
- Modify: `src/components/SelectingPhase.tsx` (replace only the `colorMatters` branch + its cart rendering)
- Test: `tests/components/SelectingPhase.colorCoded.test.tsx` (rewrite for the new interaction)

- [ ] **Step 1: Rewrite the test for the two-panel interaction**

Replace the body of `tests/components/SelectingPhase.colorCoded.test.tsx`. Keep the `beforeEach` setup (gap = greenO, theme colorCoded). New tests:

```ts
describe('SelectingPhase — Chromatic two-panel selection', () => {
  it('renders 7 monochrome piece buttons and 5 color swatches', () => {
    render(<SelectingPhase />)
    expect(document.querySelectorAll('[data-piece-option]')).toHaveLength(7)
    expect(document.querySelectorAll('[data-color-option]')).toHaveLength(GAP_COLOR_IDS.length)
  })

  it('piece-first: activating a piece then tapping a color adds that colored piece', () => {
    render(<SelectingPhase />)
    fireEvent.click(document.querySelector('[data-piece-option="O"]') as HTMLButtonElement)
    fireEvent.click(document.querySelector('[data-color-option="green"]') as HTMLButtonElement)
    const sel = useGameStore.getState().selection
    expect(sel).toHaveLength(1)
    expect(sel[0]).toMatchObject({ pieceType: 'O', color: 'green', freeCount: 1 })
  })

  it('color-first: activating a color then tapping pieces adds them in that color', () => {
    render(<SelectingPhase />)
    fireEvent.click(document.querySelector('[data-color-option="cyan"]') as HTMLButtonElement)
    fireEvent.click(document.querySelector('[data-piece-option="T"]') as HTMLButtonElement)
    fireEvent.click(document.querySelector('[data-piece-option="T"]') as HTMLButtonElement)
    const sel = useGameStore.getState().selection
    expect(sel).toHaveLength(1)
    expect(sel[0]).toMatchObject({ pieceType: 'T', color: 'cyan', freeCount: 2 })
  })

  it('tapping the active piece again clears it (no add on a subsequent color tap)', () => {
    render(<SelectingPhase />)
    const o = document.querySelector('[data-piece-option="O"]') as HTMLButtonElement
    fireEvent.click(o)   // active = O
    fireEvent.click(o)   // active = undefined
    fireEvent.click(document.querySelector('[data-color-option="green"]') as HTMLButtonElement) // now just activates color
    expect(useGameStore.getState().selection).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/SelectingPhase.colorCoded.test.tsx`
Expected: FAIL — `[data-piece-option]` not found (old grid still rendered).

- [ ] **Step 3: Rewrite the `colorMatters` branch of `SelectingPhase.tsx`**

Add `useState` to the React import. Inside the component add local active-pick state and handlers:

```ts
const [active, setActive] = useState<string | undefined>(undefined)
const isPieceType = (v: string | undefined): v is PieceType =>
  !!v && PIECE_DEFINITIONS.some(d => d.type === v)

const clickPiece = (p: PieceType) => {
  if (active === p) setActive(undefined)
  else if (isPieceType(active)) setActive(p)
  else if (active) incrementSelection(p, active)   // a color is active → add
  else setActive(p)
}
const clickColor = (c: string) => {
  if (active === c) setActive(undefined)
  else if (active && !isPieceType(active)) setActive(c)
  else if (isPieceType(active)) incrementSelection(active, c)  // a piece is active → add
  else setActive(c)
}
```

Replace the **Your Selection** colorMatters cart (currently the `selection.filter(...)` mapping for the non-`orderMatters` case) so colored chips render with their neon color — it already uses `gapFillClass(entry.color)`; leave that working. Then replace the `colorMatters ? (...)` piece-menu block (the `grid-cols-4` of shape×color buttons) with a status line + two panels:

```tsx
{colorMatters ? (
  <>
    <div className={`text-center text-xs rounded-md border px-3 py-2 ${active ? 'border-neon-cyan/60 bg-white/[0.02]' : 'border-arcade-edge text-gray-500'}`}>
      {active === undefined
        ? 'Pick a piece or a color to start.'
        : isPieceType(active)
          ? <>Piece <b className="text-white">{active}</b> active — tap a color to add it.</>
          : <>Color <b className="text-white capitalize">{active}</b> active — tap a piece to add it.</>}
    </div>

    {/* Pieces (monochrome) */}
    <div className="grid grid-cols-7 gap-1.5">
      {PIECE_DEFINITIONS.map(def => {
        const on = active === def.type
        return (
          <button
            key={def.type}
            data-piece-option={def.type}
            onClick={() => clickPiece(def.type as PieceType)}
            className={`flex items-center justify-center p-1.5 rounded-md border-2 cursor-pointer transition
              ${on ? 'border-white shadow-[0_0_0_2px_#fff,0_0_14px_rgba(255,255,255,0.5)]' : 'border-arcade-edge bg-arcade-well hover:border-neon-cyan/50'}`}
          >
            <PieceShape pieceType={def.type as PieceType} cellSize={9} colorClass={on ? 'bg-gray-200' : 'bg-gray-500'} />
          </button>
        )
      })}
    </div>

    {/* Colors */}
    <div className="grid grid-cols-5 gap-2">
      {GAP_COLOR_IDS.map(colorId => {
        const on = active === colorId
        return (
          <button
            key={colorId}
            data-color-option={colorId}
            onClick={() => clickColor(colorId)}
            className={`aspect-square rounded-md border-2 cursor-pointer transition
              ${on ? 'border-white shadow-[0_0_0_2px_#fff,0_0_16px_rgba(255,255,255,0.6)]' : 'border-arcade-edge hover:opacity-90'}`}
          >
            <span className={`block w-full h-full rounded-[3px] ${gapFillClass(colorId)}`} />
          </button>
        )
      })}
    </>
  </>
) : orderMatters ? (
```

Note: these two panels REPLACE the single `colorMatters` `<div className="grid grid-cols-4 …">` block that was the first arm of the existing `colorMatters ? … : orderMatters ? … : …` ternary, and they live inside the existing **Pieces** `ArcadePanel`. Move the panel's header note ("tap to increment") to read "tap to activate · tap the other to add" for clarity, or leave as-is — cosmetic.

Add `useState` to the `import { useEffect } from 'react'` line → `import { useEffect, useState } from 'react'`.

- [ ] **Step 4: Run the component test**

Run: `npx vitest run tests/components/SelectingPhase.colorCoded.test.tsx`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/SelectingPhase.tsx tests/components/SelectingPhase.colorCoded.test.tsx
git commit -m "feat(chromatic): two-panel active-pick selection UI"
```

---

### Task 5: Full verification

- [ ] **Step 1: Type-check + build (catches noUnusedLocals)**

Run: `npm run build`
Expected: succeeds, no TS errors.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: all pass. If any unrelated color-coded test referenced a dropped id (`blue`/`red`/`orange`) for *rendering*, fix it; resolution/matching tests use string equality and are unaffected.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Live verification in the dev server**

Run `npm run dev`, drive into a Chromatic (True Colors / `colors`) round. Confirm: viewing shows a mix of shapes in neon colors; the two-panel selection adds colored pieces both piece-first and color-first; active toggles off; cart chips are removable; a correct multiset clears the round (perfect score) and a wrong one fails. Capture a screenshot of the selection screen.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "fix(chromatic): verification fixups"
```
```
```
