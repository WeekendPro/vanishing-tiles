# The Classic Rework — Design Spec

**Date:** 2026-06-10
**Status:** Approved (design); ready for implementation plan
**Mockup:** `mockups/the-classic-rework.html`

## Summary

A bundle of Journey-mode UX changes:

1. Rename the "main" puzzle to **The Classic**, with a gap-themed icon (an upright-T "ghost piece").
2. Simplify the level-detail main card and brighten the back button.
3. Drop the district/territory **name** from the frontend (map watermarks + level-page label) — keep the colored map lines and the backend grouping.
4. Map station stars: 3★ → **5★ max**, reflecting completed-component count.
5. A new **puzzle-detail page** shown before the countdown, for every component — objective text + a per-puzzle how-to animation + a PLAY button. Tapping PLAY starts the countdown.

Internal component keys are unchanged (`main` / `colors` / `inSequence` / `flash` / `riddle`). This is presentation-only — no scoring, solver, or DB changes.

---

## A. Rename "main" → "The Classic"

- `COMPONENT_LABEL.main` becomes `"The Classic"` (`src/lib/components.ts`). This automatically updates the GameShell top-bar label and any other consumer of the label.
  - Note: GameShell currently hides the component label when `activeComponent === 'main'`. With the rename we **show** "The Classic" alongside the level number on the new detail page and (optionally) keep the top-bar behavior as-is during play. Decision: keep the in-play top bar unchanged (level number + name); "The Classic" appears on the detail page and the card ribbon. (Low-risk; revisit if it reads oddly.)
- The level-card ribbon title changes from `"PLAY"` to `"THE CLASSIC"`.

## B. Level-detail main card (`src/components/LevelScreen.tsx`)

- **Icon:** Replace `PlayGlyph` with a new **GapTetrominoGlyph** — an upright **T** tetromino rendered as empty/dashed cells in the established "gap" style (dashed cyan border, faint inner glow), matching the in-game gap aesthetic. Layout (3×2 grid):
  ```
  ▢ ▢ ▢      (gap gap gap)
  ·  ▢  ·     (·  gap  ·)
  ```
- **Ribbon:** title `"THE CLASSIC"`, keep the green ribbon/card accent.
- **Remove the caption** — drop the `caption={level.name}` level-name under the card. (RibbonBadge already treats `caption` as optional.)
- **Hero:** remove the district name line (`<div>{level.theme_name}</div>`). Keep the level name `<h2>` and the stars.
- **Back button:** change `← Map` from `text-arcade-edge` to `text-neon-cyan` + glow (`text-glow-cyan`), matching the hamburger in `GlobalMenu.tsx`.

The `BADGE_CENTER_BG.play` gradient and the `play` glyph become the new gap glyph's backing; the green center-disc background can stay (the gap cells read well over it) — final color tuned during implementation against the mockup.

## C. Kill the district name (frontend only)

No DB migration. Keep `themes`/grouping and the map's colored lines exactly as they are.

- **Map** (`src/components/JourneyMap/index.tsx`): remove the district-name **watermark** text block (the large faint `<text>` per line, lines ~83–113). The `LINES`/colors and `slugToName` plumbing that feed only the watermark can be removed; the line `<path>` rendering stays.
- **Level page** (`LevelScreen.tsx`): remove the `theme_name` hero line (covered in B).
- `theme_name` may remain in the API/`LevelDetail` type unused — leave it; removing the field from RPCs is out of scope.

## D. Map stars → 5★ completed-component count

- The map `Stars` component (`JourneyMap/index.tsx`) renders 3 stars today using `s.my_stars`. Change to **5 stars**, filled = number of completed components for that level.
- **New metric:** completed-component count = number of components (`main` + 4 badges) whose best score > 0, derived from `progressStore`. Range 0–5.
  - This is intentionally **distinct** from the level-page hero stars (`levelStars`, score-threshold based). The two surfaces measure different things by design (map = "how many puzzles cleared"; level page = "how good is your score").
  - Riddle is not playable, so the practical max a player can reach today is 4/5; the 5th star is reserved for when Riddle ships. (Acceptable — the star track shows 5 slots.)
- Wiring: the map already re-derives cleared/current/locked from client progress via `applyClientProgress` (`src/lib/journeyProgress.ts`). Add a completed-count there (or compute in the map from the same progress source) so `my_stars`/a new field carries 0–5. Prefer adding a `completedCount` to the per-level shape rather than overloading `my_stars`.

## E. New puzzle-detail page (pre-countdown briefing)

### Flow change

A new phase **`briefing`** is inserted before `countdown`.

- The `GamePhase` union gains `'briefing'` (`supabase/functions/_shared/types.ts`, imported as `@shared/types`).
- `startGame` (`gameStore.ts`) sets `phase: 'briefing'` instead of `'countdown'` for **component entry** (Journey). A new action **`beginCountdown`** sets `phase: 'countdown'` (and resets the countdown). The new `BriefingPhase` PLAY button calls `beginCountdown`.
- **Retry behavior:** same-life **Try Again** (`retryComponent`) and Practice round transitions go **straight to `countdown`**, skipping the briefing — the player already knows the puzzle. Only fresh component entry (`startComponent`, and `replayComponent` which routes through it) shows the briefing.
- **Practice mode:** out of scope for the briefing — Practice keeps going straight to countdown. The briefing is Journey-only. (Guard on `mode === 'journey'`.)
- GameShell routes `phase === 'briefing'` to `<BriefingPhase />`, centered like the countdown.

### BriefingPhase content (`src/components/BriefingPhase.tsx`)

- Component title (e.g. "THE CLASSIC") in pixel font.
- Objective text (per-component copy below).
- A looping **how-to animation** for the component (see F).
- A rectangular **PLAY** button: full grid width, rounded corners (`rounded-2xl`), **Press Start 2P** font, cyan→blue gradient with neon glow and inset highlight/shadow. Calls `beginCountdown`.
- A small "3 lives · Play starts the countdown" footnote.

### Objective copy

| Component | Copy |
|---|---|
| The Classic | "Memorize where the gaps are, then pick the exact pieces to fill them — before the clock runs out." |
| True Colors | "Like The Classic — but the gaps are colored. Match each piece to its gap's color, not just its shape." |
| In Order | "Fill the gaps in the right sequence. Each gap is numbered — place 1, then 2, then 3." |
| Don't Blink | "The gaps flash once, then vanish. Memorize fast — you only get a glimpse." |
| Riddle | Not reachable (not playable); no briefing. |

## F. Per-puzzle how-to animations

A small, self-contained looping demo per component, rendered on the briefing page. Built for real (approved), one tailored animation per puzzle type. Reference timings/beats are in the mockup (`mockups/the-classic-rework.html`).

- **Shared base:** a 4×4 mini-board of "filled" cells with specific cells marked as gaps; absolutely-positioned mini "pieces" that fly into the gap positions; an optional eye/blind glyph and a final ✓.
- **The Classic:** gaps pulse (👀 memorize) → two pieces fly in → ✓.
- **True Colors:** colored gaps (cyan, amber) → cyan piece locks in → a wrong-color (magenta) piece approaches the amber gap and bounces with ✕ → amber piece locks in → ✓.
- **In Order:** three numbered gaps (1/2/3); each number lights in turn as its piece drops, in sequence → ✓.
- **Don't Blink:** gap glows flash once → board goes solid (gaps hidden, 🙈) → pieces fly in "from memory" → ✓.

### Implementation approach

- A `HowToAnimation` component keyed by component, honoring `prefers-reduced-motion` (show a static end-state — pieces placed + ✓ — when reduced).
- CSS keyframe loops (framer-motion optional). Each animation is ~4.2–4.8s and loops continuously while the briefing is shown. No game state is touched; purely decorative, like `GapShimmer`.
- Keep each puzzle's animation in its own small unit (e.g. a `briefing/animations/` folder) so they're independently understandable and testable.

---

## Testing

- **Unit:** completed-component count derivation (0 through 5; counts only best > 0; independent of `levelStars`).
- **Component/RTL:**
  - LevelScreen renders the gap glyph + "THE CLASSIC" ribbon, no level-name caption, no district name; back button has the neon-cyan class.
  - Map station renders 5 star slots with N filled = completed count.
  - Briefing appears on component entry; PLAY advances to countdown; Try Again (same life) skips briefing.
- **Existing tests** (in `tests/`): likely touch points are `tests/components/LevelScreen.test.tsx` (PLAY ribbon, caption, district name), `tests/components/JourneyMap.test.tsx` (3-star), `tests/components/GameShell.test.tsx` (label / phase routing), `tests/components/JourneyScreen.test.tsx`, and `tests/lib/journeyProgress.test.ts` (completed-count). Update any asserting `Main`, the `PLAY` ribbon, the district-name element, or the 3-star map to the new spec — do not weaken assertions.
- `npm run test`, `npm run build` (catches `noUnusedLocals` — relevant since we remove watermark plumbing), and lint must pass.

## Out of scope

- DB/RPC removal of `theme`/`theme_name` (kept; only the frontend name display is removed).
- Practice-mode briefing.
- Riddle puzzle implementation.
- Scoring, solver, difficulty changes.
- Changing the level-page hero stars metric (stays score-based `levelStars`).
