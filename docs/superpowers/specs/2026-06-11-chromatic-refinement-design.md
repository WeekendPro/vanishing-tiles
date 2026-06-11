# Chromatic Refinement — Design Spec

**Date:** 2026-06-11
**Component:** `colors` (Chromatic badge) / `colorCoded` theme
**Status:** Approved, ready for implementation plan

## Problem

Chromatic gameplay is flat: every puzzle uses a **single** piece shape rendered in
multiple colors. The challenge is "match the color" only — shape memory never
engages. We want a genuine **mix of shapes in multiple neon colors**, plus a
selection UI that scales to that (the current shape×color button grid is unworkable
past one shape).

Two parts:
1. **Viewing** — let a Chromatic puzzle mix multiple shapes (small change).
2. **Selection UI** — replace the combinatorial button grid with a clean
   two-panel "active selection" model (the real work).

## Part 1 — Multi-shape viewing

`startGame()` in `src/store/gameStore.ts` builds the color-coded puzzle with a
hardcoded `colorCoded: { shapeTypeCount: 1, palette: [...GAP_COLOR_IDS] }`. The
`shapeTypeCount: 1` is the cause of the flatness.

**Change:** derive `shapeTypeCount` from the puzzle's gap count:

```
colorShapeTypeCount(gapCount):
  ≤ 3  → 1
  ≤ 6  → 2
  ≤ 10 → 3
  else → 4
```

- First level (gapCount 3) stays a single shape — a gentle on-ramp; difficulty
  increments from there. (The overall difficulty curve is being recalibrated
  separately; this 1→4 mapping is the starting point.)
- The generator (`supabase/functions/_shared/engine/puzzleGenerator.ts`,
  `colorCoded` branch) already slices `COMPLEXITY_PIECES[complexity]` to
  `shapeTypeCount` distinct shapes and assigns each gap a distinct shuffled
  palette color. It self-caps: `simple` complexity only has `[I, O]`, so
  `slice(0, n)` can never request more shapes than exist.
- **Solvability is guaranteed:** every gap is a placed tetromino, so a
  one-piece-per-gap (matching shape + color) solution always exists regardless
  of `shapeTypeCount`. Multi-shape puzzles stay solvable.
- **Reliable mix (variety guard):** the generator already re-rolls the board for
  the Sequential theme until the gaps span ≥2 distinct piece types
  (`hasTypeVariety`). Generalize that guard to also fire for color-coded puzzles
  when `shapeTypeCount > 1`, so a multi-shape Chromatic board never comes out
  all-one-shape by chance (without it, a 2-shape / 4-gap board is all-identical
  ~1/8 of the time). Guard condition becomes:
  `(input.sequential || (input.colorCoded && input.colorCoded.shapeTypeCount > 1)) && allowedTypes.length > 1`.
- The viewing render (`ViewingPhase` + `Grid` + `GapBorder`) already draws
  whatever shapes/colors the generator emits — no change needed; verify only.

No difficulty-table / `levelConfig.ts` / `seed.sql` changes — durations are
untouched; only the per-puzzle `shapeTypeCount` (a client-side generator arg)
changes.

## Part 2 — Neon palette (the shared color set)

The gaps' rendered colors and the selectable colors **must be the same set** so
matching is fair. Today `GAP_COLOR_IDS` has 7 ids (`green, red, blue, yellow,
orange, purple, cyan`) rendered with flat web shades (`bg-red-500`, …). Recolor
to a cohesive 5-id **neon** set:

| id        | hex        | source token            |
|-----------|------------|-------------------------|
| `cyan`    | `#22d3ee`  | neon-cyan               |
| `magenta` | `#ff2d95`  | neon-magenta            |
| `green`   | `#39d98a`  | neon-green              |
| `purple`  | `#a855f7`  | purple-family neon (new)|
| `yellow`  | `#facc15`  | neon-yellow             |

Note: `red` (#ff4d4d) was dropped in favor of `purple` — neon-red and
neon-magenta are both warm/pinkish and the hardest pair to disambiguate under
time pressure. `blue` and `orange` are dropped to keep the set tight and on-brand.

**Files (the only two that need to change):**
- `supabase/functions/_shared/core/themeConfig.ts` — `GAP_COLOR_IDS` becomes the
  5-id list above.
- `src/lib/gapPalette.ts` — `FILL` / `BORDER` maps recolored to neon hex via
  Tailwind arbitrary values (`bg-[#22d3ee]`, `border-[#22d3ee]`, …), since the
  existing flat `bg-red-500`-style classes aren't neon.

With up to 16 gaps and 5 colors, colors repeat across gaps (generator uses
`palette[i % len]`) — expected and fine; color is one matching axis, not a
uniqueness guarantee.

## Part 3 — Two-panel "active selection" UI

`src/components/SelectingPhase.tsx`. Replace **only** the `colorMatters` branch
(the shape×color button grid, ~lines 101–116, and the color cart rendering). The
`orderMatters` and basic branches are untouched.

### State

A single component-local value:

```ts
const [active, setActive] = useState<string | undefined>(undefined)
```

`active` holds a piece type (`"O"`), a color id (`"purple"`), or `undefined`.
A guard `isPieceType(active)` distinguishes the two — piece ids are uppercase
tetromino letters, color ids are lowercase words, so no overlap. This stays
local UI state; it is selection-*staging* only and does not touch the store.

### Layout (top → bottom, matching the existing grid width)

1. **Your Selection** — reuse the existing cart styling. Renders colored
   shape+color chips; tapping a chip calls `decrementSelection(type, color)`.
2. **Status line** — narrates the active mode so it's obvious:
   - none active → "Pick a piece or a color to start."
   - piece active → "Piece **O** active — tap a color to add it."
   - color active → "Color **purple** active — tap a piece to add it."
3. **Pieces** — the 7 tetrominoes (`I O T S Z J L`) via `PieceShape` rendered
   **monochrome** (neutral gray `colorClass`). The active piece gets a white
   glow ring.
4. **Colors** — 5 neon swatches (`gapFillClass(id)`). The active color gets a
   white glow ring.

### Interaction (symmetric)

```
clickPiece(p):
  active === p           → setActive(undefined)        // toggle off
  active is a piece       → setActive(p)                // switch active piece
  active is a color       → incrementSelection(p, active)   // add; active stays
  active === undefined    → setActive(p)

clickColor(c):  (mirror image)
  active === c           → setActive(undefined)
  active is a color       → setActive(c)
  active is a piece       → incrementSelection(active, c)   // add; active stays
  active === undefined    → setActive(c)
```

- Adding to the selection does **not** clear `active` — so the user can
  rapid-fire add multiples of the active thing.
- Tapping the currently-active piece/color toggles it off (the clear affordance).

Example trace (from the user):
```
active === undefined
click O    -> active = "O"
click O    -> active = undefined   (toggle off)
click blue -> active = "blue"
click T    -> add T in blue to selection
```

### Wiring

- Add a colored piece = `incrementSelection(type, colorId)` — the store's
  color-coded path already supports the optional `color` arg.
- Remove from cart = `decrementSelection(type, colorId)`.
- Validation/solver is **unchanged**: a pick fills a gap only if BOTH shape and
  color match (`solver.ts` / `@shared/core/themeResolution`). Do not weaken it.

## Out of scope

- Difficulty-table / duration recalibration (separate dedicated effort).
- The other badges (`sequential` / `flashMob` / `riddle`) and the basic theme.
- Drag-and-drop placement (deferred POC-wide).

## Definition of done

Chromatic puzzles show a genuine mix of shapes in the 5-neon palette; the
selection screen is the two-panel active-pick UI that feels intuitive for
multi-shape/multi-color picking; perfect/partial scoring still works end-to-end;
`npm run build` + `npm run test` + `npm run lint` all green; verified live in a
Chromatic round (viewing + selection + scoring).
