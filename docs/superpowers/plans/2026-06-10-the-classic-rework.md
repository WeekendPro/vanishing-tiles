# The Classic Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the "main" puzzle to **The Classic** (ghost-T icon), simplify the level card, drop district names from the frontend, switch map stars to a 5★ completed-component count, and add a pre-countdown **puzzle-detail page** (per-puzzle how-to animation + PLAY) for every Journey component.

**Architecture:** Presentation-only changes over the existing Zustand/React/Vite app. A new `'briefing'` game phase sits between component entry and the countdown; `startGame` routes Journey entries to `briefing` while Practice stays on `countdown`. A new `BriefingPhase` renders objective copy + a small CSS-keyframe how-to animation + a PLAY button that calls a new `beginCountdown` action. No scoring/solver/DB changes.

**Tech Stack:** TypeScript, React 18, Zustand 5 (`useShallow` for object selectors), framer-motion (for `useReducedMotion`), Tailwind + a small co-located CSS file for the animations, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-10-the-classic-rework-design.md`
**Mockup:** `mockups/the-classic-rework.html`

---

## File Structure

**Create:**
- `src/lib/briefingCopy.ts` — per-component objective copy.
- `src/components/BriefingPhase.tsx` — the puzzle-detail page (title + objective + animation + PLAY).
- `src/components/briefing/HowToAnimation.tsx` — picks the right demo per component; honors reduced motion.
- `src/components/briefing/howto.css` — keyframes + cell/piece styles for the demos (ported from the mockup).
- `src/components/briefing/animations/ClassicDemo.tsx`
- `src/components/briefing/animations/ColorsDemo.tsx`
- `src/components/briefing/animations/OrderDemo.tsx`
- `src/components/briefing/animations/FlashDemo.tsx`
- `tests/components/BriefingPhase.test.tsx`
- `tests/lib/journeyProgress.completed.test.ts`

**Modify:**
- `src/lib/components.ts` — `COMPONENT_LABEL.main` → `'The Classic'`.
- `src/components/level/badgeGlyphs.tsx` — add `GapTetrominoGlyph` + `BADGE_CENTER_BG.classic`.
- `src/components/LevelScreen.tsx` — icon/ribbon/caption/hero/back-button changes.
- `src/components/JourneyMap/index.tsx` — remove name watermark; 5-star completed count; `JourneyLevel.completedCount`.
- `src/lib/journeyProgress.ts` — add `completedCount` per level.
- `supabase/functions/_shared/types.ts` — add `'briefing'` to `GamePhase`.
- `src/store/gameStore.ts` — `startGame` phase branch; add `beginCountdown`.
- `src/components/GameShell.tsx` — route + center the `briefing` phase.
- `tests/store/gameStore.component.test.ts` — expectation `'countdown'` → `'briefing'` for `startComponent`.

---

## Task 1: Rename "main" → "The Classic"

**Files:**
- Modify: `src/lib/components.ts:19-25`

- [ ] **Step 1: Change the label**

In `src/lib/components.ts`, update `COMPONENT_LABEL`:

```ts
export const COMPONENT_LABEL: Record<ComponentKey, string> = {
  main: 'The Classic',
  colors: 'True Colors',
  inSequence: 'In Order',
  flash: "Don't Blink",
  riddle: 'Riddle',
}
```

- [ ] **Step 2: Run the suite to surface any label assertions**

Run: `npm run test`
Expected: PASS. (GameShell hides the label for `main` in-play, so `queryByText(/Main/)` staying null is unaffected; no test asserts the literal `'Main'` string for `COMPONENT_LABEL.main`.) If any test fails on the old `'Main'` text, update it to `'The Classic'` — do not weaken the assertion.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components.ts
git commit -m "feat(the-classic): rename main puzzle label to The Classic"
```

---

## Task 2: Ghost-T gap glyph for the main badge

**Files:**
- Modify: `src/components/level/badgeGlyphs.tsx`

- [ ] **Step 1: Add the glyph + center background**

In `src/components/level/badgeGlyphs.tsx`, add a new exported component (place it after `PlayGlyph`):

```tsx
/** Upright-T tetromino drawn as empty/dashed "gap" cells — The Classic. */
export function GapTetrominoGlyph() {
  const gap: React.CSSProperties = {
    width: 15,
    height: 15,
    borderRadius: 3,
    border: '1.5px dashed rgba(34,211,238,0.85)',
    boxShadow: 'inset 0 0 8px rgba(34,211,238,0.25)',
  }
  const empty: React.CSSProperties = { width: 15, height: 15 }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 15px)', gap: 3 }}>
      <span style={gap} /><span style={gap} /><span style={gap} />
      <span style={empty} /><span style={gap} /><span style={empty} />
    </div>
  )
}
```

Add `import type { CSSProperties } from 'react'` is not needed — use `React.CSSProperties` via the existing React types. If the file has no React import, add at the top:

```tsx
import type { CSSProperties } from 'react'
```

and use `CSSProperties` instead of `React.CSSProperties` in the snippet above.

Then add a `classic` entry to `BADGE_CENTER_BG`:

```ts
export const BADGE_CENTER_BG: Record<string, string> = {
  play: 'linear-gradient(135deg,#34d399,#16a34a)',
  classic: 'linear-gradient(135deg,#0a1622,#05080f)',
  wheel: '#0a1226',
  seq: 'linear-gradient(135deg,#334155,#0f172a)',
  eyes: 'radial-gradient(circle at 50% 38%,#16233f,#070b18)',
  riddle: 'linear-gradient(135deg,#2dd4bf,#0f766e)',
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/level/badgeGlyphs.tsx
git commit -m "feat(the-classic): add ghost-T gap glyph + classic center bg"
```

---

## Task 3: Level-detail main card + back button

**Files:**
- Modify: `src/components/LevelScreen.tsx` (imports ~15-17; hero ~147-156; main badge ~187-203; back button ~133-135)
- Modify: `tests/components/LevelScreen.test.tsx`

- [ ] **Step 1: Update the test for the new card**

In `tests/components/LevelScreen.test.tsx`, replace the first test body (the `renders name, difficulty pips, a Play button and four badges` test, lines ~24-42) assertions about the hero/caption with the new expectations. Replace these two lines:

```ts
    // Level name appears in the hero (and again as the PLAY badge caption)
    expect((await screen.findAllByText('Cellar Door')).length).toBeGreaterThan(0)
    // PLAY badge button
    expect(screen.getByTestId('badge-main')).toBeTruthy()
```

with:

```ts
    // Level name appears in the hero exactly once (caption removed from the card)
    expect((await screen.findAllByText('Cellar Door'))).toHaveLength(1)
    // Main badge button now reads THE CLASSIC (no PLAY)
    expect(screen.getByTestId('badge-main')).toBeTruthy()
    expect(screen.getByText('THE CLASSIC')).toBeTruthy()
    expect(screen.queryByText('PLAY')).toBeNull()
    // District name is no longer shown
    expect(screen.queryByText('The Hollows')).toBeNull()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/LevelScreen.test.tsx`
Expected: FAIL — "THE CLASSIC" not found / "The Hollows" still present / two "Cellar Door" matches.

- [ ] **Step 3: Update the imports**

In `src/components/LevelScreen.tsx`, change the badgeGlyphs import to bring in the new glyph and drop `PlayGlyph`:

```tsx
import {
  GapTetrominoGlyph, ColorWheelGlyph, SequenceBlocksGlyph, EyesGlyph, RiddleGlyph, BADGE_CENTER_BG,
} from './level/badgeGlyphs'
```

- [ ] **Step 4: Brighten the back button**

Replace the back button (around line 134):

```tsx
      <button onClick={goJourney} className="mb-4 text-neon-cyan text-glow-cyan hover:text-neon-cyan text-sm font-semibold">
        ← Map
      </button>
```

- [ ] **Step 5: Remove the district name from the hero**

Delete the district-name `<div>` in the hero block (the `level.theme_name` line). The hero becomes:

```tsx
          {/* Hero: name / stars */}
          <div className="text-center mb-4">
            <h2 className="font-pixel text-[19px] leading-tight tracking-[0.04em] text-neon-cyan text-glow-cyan mb-3">
              {level.name}
            </h2>
            <Stars value={levelStars(p)} />
          </div>
```

- [ ] **Step 6: Swap the main badge to the gap glyph + THE CLASSIC, drop the caption**

Replace the main `RibbonBadge` (the `<div className="w-fit ...">` block around lines 187-203) with:

```tsx
          {/* The Classic — gap glyph + ribbon; centered, ~half width */}
          <div className="w-fit min-w-[55%] max-w-full mx-auto">
            <RibbonBadge
              data-testid="badge-main"
              glyph={<GapTetrominoGlyph />}
              centerBg={BADGE_CENTER_BG.classic}
              title="THE CLASSIC"
              state={p.best.main > 0 ? 'complete' : 'incomplete'}
              score={p.best.main > 0 ? p.best.main : undefined}
              ribbonColor="#16a34a"
              foldColor="#0e7a36"
              cardAccent="green"
              vibrant
              onClick={() => play('main')}
            />
          </div>
```

(Note: the `caption={level.name}` prop is removed; `RibbonBadge.caption` is optional, so nothing else changes.)

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/components/LevelScreen.test.tsx`
Expected: PASS.

- [ ] **Step 8: Type-check (catches the now-unused PlayGlyph import elsewhere)**

Run: `npx tsc --noEmit`
Expected: PASS. If `PlayGlyph` is now unused anywhere, remove the dead import.

- [ ] **Step 9: Commit**

```bash
git add src/components/LevelScreen.tsx tests/components/LevelScreen.test.tsx
git commit -m "feat(the-classic): gap glyph + THE CLASSIC card, brighter back button, drop district name"
```

---

## Task 4: Map — 5★ completed-component count

**Files:**
- Modify: `src/lib/journeyProgress.ts`
- Modify: `src/components/JourneyMap/index.tsx` (`JourneyLevel` interface ~5-16; `Stars` ~34-42; render ~215)
- Create: `tests/lib/journeyProgress.completed.test.ts`
- Modify: `tests/components/JourneyMap.test.tsx` (the `lvl` helper)

- [ ] **Step 1: Write the failing derivation test**

Create `tests/lib/journeyProgress.completed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyClientProgress } from '../../src/lib/journeyProgress'
import type { JourneyTheme } from '../../src/components/JourneyMap'
import type { ProgressMap } from '../../src/store/progressStore'

const themes: JourneyTheme[] = [{
  theme_id: 't1', slug: 'the_hollows', name: 'The Hollows', mechanic: '', sort_order: 1,
  levels: [
    { level_id: 'L1', display_number: 1, name: 'A', my_pr: null, my_stars: 0, cleared: false, current: false, locked: false, last_played: null, global_best: null },
    { level_id: 'L2', display_number: 2, name: 'B', my_pr: null, my_stars: 0, cleared: false, current: false, locked: false, last_played: null, global_best: null },
  ],
}]

describe('applyClientProgress completedCount', () => {
  it('counts components with a best score > 0 (0..5)', () => {
    const progress: ProgressMap = {
      L1: { best: { main: 80, colors: 50, inSequence: 0, flash: 0, riddle: 0 }, timesPlayed: 2, lastPlayed: 1 },
    }
    const out = applyClientProgress(themes, progress)
    const l1 = out[0].levels.find(l => l.level_id === 'L1')!
    const l2 = out[0].levels.find(l => l.level_id === 'L2')!
    expect(l1.completedCount).toBe(2) // main + colors
    expect(l2.completedCount).toBe(0) // unplayed
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/lib/journeyProgress.completed.test.ts`
Expected: FAIL — `completedCount` is `undefined`.

- [ ] **Step 3: Add `completedCount` to the JourneyLevel interface**

In `src/components/JourneyMap/index.tsx`, add the field to `JourneyLevel`:

```tsx
export interface JourneyLevel {
  level_id: string
  display_number: number
  name: string
  my_pr: number | null
  my_stars: number
  completedCount: number
  cleared: boolean
  current: boolean
  locked: boolean
  last_played: string | null
  global_best: number | null
}
```

- [ ] **Step 4: Derive `completedCount` in applyClientProgress**

In `src/lib/journeyProgress.ts`, import `LEVEL_COMPONENTS` and compute the count. Update the import and the mapped object:

```ts
import type { JourneyTheme } from '../components/JourneyMap'
import { LEVEL_COMPONENTS } from './components'
import { type ProgressMap, emptyLevelProgress, levelTotal, levelStars } from '../store/progressStore'
```

Inside the `.map` over levels, after `const total = levelTotal(p)`:

```ts
      const completedCount = LEVEL_COMPONENTS.filter(c => p.best[c] > 0).length
```

and add `completedCount,` to the returned object (next to `my_stars`).

- [ ] **Step 5: Run the derivation test to verify it passes**

Run: `npx vitest run tests/lib/journeyProgress.completed.test.ts`
Expected: PASS.

- [ ] **Step 6: Render 5 stars from completedCount on the map**

In `src/components/JourneyMap/index.tsx`, change the `Stars` component to render 5 slots:

```tsx
function Stars({ n }: { n: number }) {
  return (
    <span className="text-[10px] tracking-tight" aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={i < n ? 'text-yellow-400' : 'text-gray-700'}>★</span>
      ))}
    </span>
  )
}
```

And change the render call (currently `{s.cleared && <Stars n={s.my_stars} />}`) to use the completed count:

```tsx
              {s.cleared && <Stars n={s.completedCount} />}
```

- [ ] **Step 7: Update the JourneyMap test helper to supply completedCount**

In `tests/components/JourneyMap.test.tsx`, update the `lvl` helper return so cleared levels report a count (keeps the existing tests type-correct and lets us assert star counts):

```ts
  return {
    level_id: `l${n}`, display_number: n, name,
    my_pr: opts.cleared ? 900 : null, my_stars: opts.cleared ? 2 : 0,
    completedCount: opts.cleared ? 3 : 0,
    cleared: !!opts.cleared, current: !!opts.current, locked: !!opts.locked,
    last_played: null, global_best: null,
  }
```

Then add a test at the end of the `describe('TransitMap', ...)` block:

```ts
  it('renders 5 star slots with completedCount filled for a cleared station', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    const btn = screen.getByRole('button', { name: /Vacant Heights/i })
    const stars = [...btn.querySelectorAll('span')].filter(s => s.textContent === '★')
    expect(stars).toHaveLength(5)
    expect(stars.filter(s => s.className.includes('text-yellow-400'))).toHaveLength(3)
  })
```

- [ ] **Step 8: Run the JourneyMap tests**

Run: `npx vitest run tests/components/JourneyMap.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/journeyProgress.ts src/components/JourneyMap/index.tsx tests/lib/journeyProgress.completed.test.ts tests/components/JourneyMap.test.tsx
git commit -m "feat(the-classic): map shows 5-star completed-component count"
```

---

## Task 5: Remove the district-name watermark from the map

**Files:**
- Modify: `src/components/JourneyMap/index.tsx` (watermark block ~83-113; `slugToName` ~74)

- [ ] **Step 1: Delete the watermark text block and its helper**

In `src/components/JourneyMap/index.tsx`:

1. Remove the `const slugToName = Object.fromEntries(...)` line (~74).
2. Delete the entire first `{LINES.map(line => { ... })}` block that renders the `<text>` watermarks (the block whose comment starts `District watermarks:` and ends just before the second `{LINES.map(line => {` that draws the `<path>` lines). Keep the second `LINES.map` (the neon line paths) intact.

After this, the only `LINES.map` left is the one rendering `<path>` connectors/lines.

- [ ] **Step 2: Type-check for unused imports/vars**

Run: `npx tsc --noEmit`
Expected: PASS. If `VIEWBOX` / `LINE_COLOR` / `CONNECTOR_COLOR` are still used (they are — by the paths and station markers), leave them. Remove any import that became unused.

- [ ] **Step 3: Run the JourneyMap tests**

Run: `npx vitest run tests/components/JourneyMap.test.tsx`
Expected: PASS (no test asserted watermark text).

- [ ] **Step 4: Commit**

```bash
git add src/components/JourneyMap/index.tsx
git commit -m "feat(the-classic): drop district-name watermarks from the map (lines stay)"
```

---

## Task 6: Add the `briefing` phase + `beginCountdown` action

**Files:**
- Modify: `supabase/functions/_shared/types.ts:118-123`
- Modify: `src/store/gameStore.ts` (`startGame` ~180-181; actions interface ~59-91; add `beginCountdown`)
- Modify: `tests/store/gameStore.component.test.ts:32`

- [ ] **Step 1: Add `'briefing'` to the GamePhase union**

In `supabase/functions/_shared/types.ts`:

```ts
export type GamePhase =
  | 'idle'
  | 'briefing'
  | 'countdown'
  | 'viewing'
  | 'selecting'
  | 'resolving'
```

- [ ] **Step 2: Update the startComponent phase expectation (failing test)**

In `tests/store/gameStore.component.test.ts`, change line ~32 from:

```ts
    expect(s.phase).toBe('countdown')
```

to:

```ts
    expect(s.phase).toBe('briefing')
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/store/gameStore.component.test.ts`
Expected: FAIL — phase is still `'countdown'`.

- [ ] **Step 4: Branch the opening phase in startGame**

In `src/store/gameStore.ts`, inside `startGame`'s `set({ ... })`, change the `phase` line from `phase: 'countdown',` to:

```ts
      // Journey component entry opens on the briefing (puzzle-detail) page;
      // Practice rounds go straight to the countdown.
      phase: get().mode === 'journey' ? 'briefing' : 'countdown',
```

- [ ] **Step 5: Add the beginCountdown action**

In the actions interface (near `beginViewing: () => void` ~60), add:

```ts
  beginCountdown: () => void
```

In the store implementation (next to `beginViewing`), add:

```ts
  beginCountdown: () => set({ phase: 'countdown', paused: false }),
```

- [ ] **Step 6: Run the component-store test to verify it passes**

Run: `npx vitest run tests/store/gameStore.component.test.ts`
Expected: PASS. (The flow tests that call `beginViewing()`/`endViewing()` directly after `startComponent` are unaffected — `beginViewing` doesn't depend on the prior phase.)

- [ ] **Step 7: Run the full store suite (Practice stays on countdown)**

Run: `npx vitest run tests/store/`
Expected: PASS. (`startGame()` called bare runs in default `mode: 'practice'` → `'countdown'`; `newGame`/`startPractice`/`retryComponent` assertions of `'countdown'` are unchanged.)

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/types.ts src/store/gameStore.ts tests/store/gameStore.component.test.ts
git commit -m "feat(the-classic): add briefing phase + beginCountdown (journey entry opens on briefing)"
```

---

## Task 7: Briefing copy + BriefingPhase component

**Files:**
- Create: `src/lib/briefingCopy.ts`
- Create: `src/components/BriefingPhase.tsx`
- Create: `tests/components/BriefingPhase.test.tsx`

(Depends on Task 8's `HowToAnimation`. To keep this task self-contained for TDD, stub the animation import; Task 8 replaces the stub with the real component. If executing strictly in order, do Task 8 first — but the import path is stable either way.)

- [ ] **Step 1: Add the objective copy**

Create `src/lib/briefingCopy.ts`:

```ts
import type { PlayableComponent } from './components'

/** One-line objective shown on the puzzle-detail (briefing) page. Title comes
 * from COMPONENT_LABEL; this is just the "what you're trying to do" line. */
export const BRIEFING_OBJECTIVE: Record<PlayableComponent, string> = {
  main: 'Memorize where the gaps are, then pick the exact pieces to fill them — before the clock runs out.',
  colors: "Like The Classic — but the gaps are colored. Match each piece to its gap's color, not just its shape.",
  inSequence: 'Fill the gaps in the right sequence. Each gap is numbered — place 1, then 2, then 3.',
  flash: 'The gaps flash once, then vanish. Memorize fast — you only get a glimpse.',
}
```

- [ ] **Step 2: Write the failing BriefingPhase test**

Create `tests/components/BriefingPhase.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Stub the animation so the test isolates briefing layout + PLAY wiring.
vi.mock('../../src/components/briefing/HowToAnimation', () => ({
  HowToAnimation: ({ component }: { component: string }) => <div data-testid={`howto-${component}`} />,
}))

import { BriefingPhase } from '../../src/components/BriefingPhase'
import { useGameStore } from '../../src/store/gameStore'

beforeEach(() => { useGameStore.getState().resetGame() })

describe('BriefingPhase', () => {
  it('shows the component title, objective, animation, and a PLAY button', () => {
    useGameStore.setState({ activeComponent: 'main' } as any)
    render(<BriefingPhase />)
    expect(screen.getByText('THE CLASSIC')).toBeTruthy()
    expect(screen.getByText(/Memorize where the gaps are/i)).toBeTruthy()
    expect(screen.getByTestId('howto-main')).toBeTruthy()
    expect(screen.getByTestId('briefing-play')).toBeTruthy()
  })

  it('PLAY calls beginCountdown', () => {
    const spy = vi.fn()
    useGameStore.setState({ activeComponent: 'colors', beginCountdown: spy } as any)
    render(<BriefingPhase />)
    fireEvent.click(screen.getByTestId('briefing-play'))
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/components/BriefingPhase.test.tsx`
Expected: FAIL — `BriefingPhase` module not found.

- [ ] **Step 4: Implement BriefingPhase**

Create `src/components/BriefingPhase.tsx`:

```tsx
import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { COMPONENT_LABEL, isPlayable } from '../lib/components'
import { BRIEFING_OBJECTIVE } from '../lib/briefingCopy'
import { HowToAnimation } from './briefing/HowToAnimation'

export function BriefingPhase() {
  const { activeComponent, beginCountdown } = useGameStore(useShallow(s => ({
    activeComponent: s.activeComponent,
    beginCountdown: s.beginCountdown,
  })))

  // Riddle isn't reachable (not playable); render nothing rather than guess.
  if (!activeComponent || !isPlayable(activeComponent)) return null

  const title = COMPONENT_LABEL[activeComponent].toUpperCase()
  const objective = BRIEFING_OBJECTIVE[activeComponent]

  return (
    <div className="flex flex-col items-center text-center gap-5 w-full max-w-[360px]">
      <h2 className="font-pixel text-[15px] text-neon-cyan text-glow-cyan tracking-wide">{title}</h2>
      <p className="text-zinc-300 text-[15px] leading-relaxed max-w-[300px]">{objective}</p>

      <div className="text-[9px] font-pixel tracking-[0.2em] text-zinc-500">HOW IT WORKS</div>
      <div className="rounded-xl border border-arcade-edge bg-arcade-panel shadow-panel-inset p-5">
        <HowToAnimation component={activeComponent} />
      </div>

      <div className="inline-flex flex-col items-stretch w-full">
        <button
          data-testid="briefing-play"
          onClick={beginCountdown}
          className="font-pixel text-[15px] tracking-[0.15em] text-white rounded-2xl py-5 w-full transition active:translate-y-px"
          style={{
            background: 'linear-gradient(135deg,#22d3ee,#2563eb)',
            boxShadow: '0 0 22px rgba(34,211,238,.55), inset 0 2px 0 rgba(255,255,255,.35), inset 0 -3px 0 rgba(0,0,0,.25)',
          }}
        >
          PLAY
        </button>
        <div className="text-zinc-600 text-[11px] mt-3">3 lives · Play starts the countdown</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/components/BriefingPhase.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/briefingCopy.ts src/components/BriefingPhase.tsx tests/components/BriefingPhase.test.tsx
git commit -m "feat(the-classic): BriefingPhase puzzle-detail page + objective copy"
```

---

## Task 8: Per-puzzle how-to animations

**Files:**
- Create: `src/components/briefing/howto.css`
- Create: `src/components/briefing/HowToAnimation.tsx`
- Create: `src/components/briefing/animations/ClassicDemo.tsx`
- Create: `src/components/briefing/animations/ColorsDemo.tsx`
- Create: `src/components/briefing/animations/OrderDemo.tsx`
- Create: `src/components/briefing/animations/FlashDemo.tsx`

These are decorative (like `GapShimmer`) and touch no game state. The keyframes are ported verbatim from `mockups/the-classic-rework.html`. Base (non-animated) styles represent the **solved** board so `prefers-reduced-motion` shows a static finished state.

- [ ] **Step 1: Add the CSS (keyframes + cell/piece styles)**

Create `src/components/briefing/howto.css`:

```css
.howto { position: relative; width: 170px; height: 170px; }
.howto .grid4 { display: grid; grid-template-columns: repeat(4, 34px); gap: 6px; }
.howto .bcell { width: 34px; height: 34px; border-radius: 5px;
  background: linear-gradient(135deg,#1f3a44,#0c2027); box-shadow: inset 0 1px 0 rgba(255,255,255,.06); }
.howto .bgap { background: transparent; border: 2px dashed rgba(34,211,238,.85);
  box-shadow: 0 0 10px rgba(34,211,238,.3) inset; }
.howto .gapcyan  { background: transparent; border: 2px dashed #22d3ee; box-shadow: 0 0 10px #22d3ee55 inset; }
.howto .gapamber { background: transparent; border: 2px dashed #facc15; box-shadow: 0 0 10px #facc1555 inset; }
/* pieces default to PLACED (solved) so reduced-motion shows the finished board */
.howto .piece { position: absolute; width: 34px; height: 34px; border-radius: 5px; }
.howto .ov { position: absolute; }
.howto .num { display: grid; place-items: center; font-weight: 900; font-size: 15px; color: #0b1520; }
.howto .check { position: absolute; inset: 0; display: grid; place-items: center; font-size: 44px;
  color: #39d98a; text-shadow: 0 0 16px #39d98a; }

/* CLASSIC */
@keyframes cl-eye{0%,28%{opacity:1}40%,100%{opacity:0}}
@keyframes cl-a{0%,38%{transform:translate(-55px,-55px);opacity:0}54%,100%{transform:translate(0,0);opacity:1}}
@keyframes cl-b{0%,46%{transform:translate(60px,-45px);opacity:0}62%,100%{transform:translate(0,0);opacity:1}}
@keyframes cl-chk{0%,72%{opacity:0;transform:scale(.4)}82%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
.howto .cl-eye{animation:cl-eye 4.4s infinite}.howto .cl-a{animation:cl-a 4.4s infinite}
.howto .cl-b{animation:cl-b 4.4s infinite}.howto .cl-chk{animation:cl-chk 4.4s infinite}

/* TRUE COLORS */
@keyframes tc-cyan{0%,40%{transform:translate(-55px,-55px);opacity:0}56%,100%{transform:translate(0,0);opacity:1}}
@keyframes tc-wrong{0%,44%{transform:translate(55px,-20px);opacity:0}54%{transform:translate(0,0);opacity:1}60%{transform:translate(0,0);opacity:1}66%{transform:translate(40px,-20px);opacity:0}100%{opacity:0}}
@keyframes tc-x{0%,55%{opacity:0}58%{opacity:1}65%{opacity:1}68%,100%{opacity:0}}
@keyframes tc-amber{0%,68%{transform:translate(50px,40px);opacity:0}82%,100%{transform:translate(0,0);opacity:1}}
@keyframes tc-chk{0%,84%{opacity:0;transform:scale(.4)}92%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
.howto .tc-cyan{animation:tc-cyan 4.6s infinite}.howto .tc-wrong{animation:tc-wrong 4.6s infinite}
.howto .tc-x{animation:tc-x 4.6s infinite}.howto .tc-amber{animation:tc-amber 4.6s infinite}
.howto .tc-chk{animation:tc-chk 4.6s infinite}

/* IN ORDER */
@keyframes io-1{0%,24%{transform:translate(-50px,-50px);opacity:0}36%,100%{transform:translate(0,0);opacity:1}}
@keyframes io-2{0%,44%{transform:translate(55px,-40px);opacity:0}56%,100%{transform:translate(0,0);opacity:1}}
@keyframes io-3{0%,62%{transform:translate(-40px,55px);opacity:0}74%,100%{transform:translate(0,0);opacity:1}}
@keyframes io-chk{0%,80%{opacity:0;transform:scale(.4)}90%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
.howto .io-1{animation:io-1 4.8s infinite}.howto .io-2{animation:io-2 4.8s infinite}
.howto .io-3{animation:io-3 4.8s infinite}.howto .io-chk{animation:io-chk 4.8s infinite}

/* DON'T BLINK */
@keyframes db-flash{0%{opacity:0}4%{opacity:1}16%{opacity:1}22%{opacity:0}100%{opacity:0}}
@keyframes db-blind{0%,22%{opacity:0}30%{opacity:1}48%{opacity:1}54%,100%{opacity:0}}
@keyframes db-a{0%,52%{transform:translate(-55px,-55px);opacity:0}66%,100%{transform:translate(0,0);opacity:1}}
@keyframes db-b{0%,58%{transform:translate(55px,-45px);opacity:0}72%,100%{transform:translate(0,0);opacity:1}}
@keyframes db-chk{0%,80%{opacity:0;transform:scale(.4)}90%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
.howto .db-flash{animation:db-flash 4.6s infinite}.howto .db-blind{animation:db-blind 4.6s infinite}
.howto .db-a{animation:db-a 4.6s infinite}.howto .db-b{animation:db-b 4.6s infinite}
.howto .db-chk{animation:db-chk 4.6s infinite}

/* Reduced motion: freeze on the solved board (pieces already placed by default;
   transient overlays hidden, check shown). */
.howto.howto-static .cl-eye,.howto.howto-static .tc-wrong,.howto.howto-static .tc-x,
.howto.howto-static .db-flash,.howto.howto-static .db-blind { display: none; }
.howto.howto-static [class*="-chk"] { opacity: 1 !important; transform: none !important; }
.howto.howto-static * { animation: none !important; }
```

- [ ] **Step 2: Implement the demos**

Create `src/components/briefing/animations/ClassicDemo.tsx`:

```tsx
export function ClassicDemo() {
  return (
    <>
      <div className="grid4">
        <span className="bcell" /><span className="bcell bgap" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell bgap" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
      </div>
      <span className="piece cl-a" style={{ left: 40, top: 0, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="piece cl-b" style={{ left: 80, top: 40, background: '#ff2d95', boxShadow: '0 0 10px #ff2d95' }} />
      <span className="ov cl-eye" style={{ top: -6, right: -6, fontSize: 24 }}>👀</span>
      <span className="check cl-chk">✓</span>
    </>
  )
}
```

Create `src/components/briefing/animations/ColorsDemo.tsx`:

```tsx
export function ColorsDemo() {
  return (
    <>
      <div className="grid4">
        <span className="bcell" /><span className="bcell gapcyan" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell gapamber" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
      </div>
      <span className="piece tc-cyan" style={{ left: 40, top: 0, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="piece tc-wrong" style={{ left: 80, top: 80, background: '#ff2d95', boxShadow: '0 0 10px #ff2d95' }} />
      <span className="ov tc-x" style={{ left: 84, top: 78, fontSize: 24, color: '#ff4d4d', fontWeight: 900 }}>✕</span>
      <span className="piece tc-amber" style={{ left: 80, top: 80, background: '#facc15', boxShadow: '0 0 10px #facc15' }} />
      <span className="check tc-chk">✓</span>
    </>
  )
}
```

Create `src/components/briefing/animations/OrderDemo.tsx`:

```tsx
export function OrderDemo() {
  return (
    <>
      <div className="grid4">
        <span className="bcell" /><span className="bcell bgap num">1</span><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell bgap num">2</span><span className="bcell" />
        <span className="bcell" /><span className="bcell bgap num">3</span><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
      </div>
      <span className="piece io-1" style={{ left: 40, top: 0, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="piece io-2" style={{ left: 80, top: 40, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="piece io-3" style={{ left: 40, top: 80, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="check io-chk">✓</span>
    </>
  )
}
```

Create `src/components/briefing/animations/FlashDemo.tsx`:

```tsx
export function FlashDemo() {
  return (
    <>
      <div className="grid4">
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
      </div>
      <span className="ov db-flash" style={{ left: 40, top: 0, width: 34, height: 34, borderRadius: 5, border: '2px dashed #22d3ee', boxShadow: '0 0 14px #22d3ee inset, 0 0 14px #22d3ee' }} />
      <span className="ov db-flash" style={{ left: 80, top: 40, width: 34, height: 34, borderRadius: 5, border: '2px dashed #22d3ee', boxShadow: '0 0 14px #22d3ee inset, 0 0 14px #22d3ee' }} />
      <span className="ov db-blind" style={{ left: '50%', top: 46, transform: 'translateX(-50%)', fontSize: 30 }}>🙈</span>
      <span className="piece db-a" style={{ left: 40, top: 0, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="piece db-b" style={{ left: 80, top: 40, background: '#ff2d95', boxShadow: '0 0 10px #ff2d95' }} />
      <span className="check db-chk">✓</span>
    </>
  )
}
```

- [ ] **Step 3: Implement HowToAnimation**

Create `src/components/briefing/HowToAnimation.tsx`:

```tsx
import { useReducedMotion } from 'framer-motion'
import './howto.css'
import { ClassicDemo } from './animations/ClassicDemo'
import { ColorsDemo } from './animations/ColorsDemo'
import { OrderDemo } from './animations/OrderDemo'
import { FlashDemo } from './animations/FlashDemo'
import type { PlayableComponent } from '../../lib/components'

export function HowToAnimation({ component }: { component: PlayableComponent }) {
  const reduce = useReducedMotion()
  return (
    <div className={`howto${reduce ? ' howto-static' : ''}`} data-testid={`howto-${component}`}>
      {component === 'main' && <ClassicDemo />}
      {component === 'colors' && <ColorsDemo />}
      {component === 'inSequence' && <OrderDemo />}
      {component === 'flash' && <FlashDemo />}
    </div>
  )
}
```

- [ ] **Step 4: Write a render test for component selection**

Create `tests/components/HowToAnimation.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HowToAnimation } from '../../src/components/briefing/HowToAnimation'

describe('HowToAnimation', () => {
  it('renders a demo container keyed to the component', () => {
    const { rerender } = render(<HowToAnimation component="main" />)
    expect(screen.getByTestId('howto-main')).toBeTruthy()
    rerender(<HowToAnimation component="flash" />)
    expect(screen.getByTestId('howto-flash')).toBeTruthy()
  })
})
```

- [ ] **Step 5: Run the animation tests**

Run: `npx vitest run tests/components/HowToAnimation.test.tsx tests/components/BriefingPhase.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/briefing tests/components/HowToAnimation.test.tsx
git commit -m "feat(the-classic): per-puzzle how-to animations for the briefing page"
```

---

## Task 9: Route the briefing phase in GameShell

**Files:**
- Modify: `src/components/GameShell.tsx` (import; `centerContent` ~35; phase router ~86-89)

- [ ] **Step 1: Import BriefingPhase**

In `src/components/GameShell.tsx`, add:

```tsx
import { BriefingPhase } from './BriefingPhase'
```

- [ ] **Step 2: Center the briefing like the countdown**

Change:

```tsx
  const centerContent = phase === 'countdown'
```

to:

```tsx
  const centerContent = phase === 'countdown' || phase === 'briefing'
```

- [ ] **Step 3: Add the route**

In the phase-router block, add the briefing line above countdown:

```tsx
        {!paused && phase === 'briefing'   && <BriefingPhase />}
        {!paused && phase === 'countdown'  && <CountdownPhase />}
        {!paused && phase === 'viewing'    && <ViewingPhase />}
        {!paused && phase === 'selecting'  && <SelectingPhase />}
        {!paused && phase === 'resolving'  && <ResolutionPhase />}
```

- [ ] **Step 4: Run the GameShell tests**

Run: `npx vitest run tests/components/GameShell.test.tsx`
Expected: PASS (no test renders the `briefing` phase; existing phases unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/components/GameShell.tsx
git commit -m "feat(the-classic): route the briefing phase in GameShell"
```

---

## Task 10: Full verification + manual preview

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: PASS (all suites).

- [ ] **Step 2: Build (catches noUnusedLocals from removed watermark plumbing)**

Run: `npm run build`
Expected: PASS, no type/lint errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS. (If `npm run lint` is not defined, skip — `npm run build` already runs the type/unused checks.)

- [ ] **Step 4: Manual preview walkthrough**

Run: `npm run dev`, open http://localhost:5173, then in Journey mode:
- Open a level → main card shows the **ghost-T** icon + **THE CLASSIC** ribbon, **no** level-name caption, **no** district name; **← Map** is bright cyan.
- Tap **The Classic** → the **puzzle-detail page** appears (no auto-countdown), with the objective, a looping **how-to animation**, and a cyan **PLAY** button. Tap PLAY → 3-2-1 countdown → viewing.
- Repeat for **True Colors / In Order / Don't Blink** → each shows its own objective + animation.
- Fail a round with a life left → **Try Again** goes straight to the countdown (no briefing).
- Back on the map: a played station shows **5 star slots** with the completed-count filled, and the faint district-name watermarks are gone.

- [ ] **Step 5: Final commit (if any preview tweaks were needed)**

```bash
git add -A
git commit -m "polish(the-classic): preview-driven tweaks"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** A (Task 1) · B (Tasks 2–3) · C (Tasks 3 hero, 5 watermark) · D (Task 4) · E (Tasks 6–9) · per-puzzle animations F (Task 8). All spec sections map to tasks.
- **Practice unaffected:** `startGame` only routes to `briefing` when `mode === 'journey'`; default/Practice stays on `countdown` (verified against existing store tests).
- **Retry skips briefing:** `retryComponent` still sets `phase: 'countdown'` directly (unchanged) — confirmed by `gameStore.component.test.ts` retry assertion.
- **Type consistency:** `beginCountdown` (interface + impl + BriefingPhase), `completedCount` (interface + journeyProgress + map render + test helper), `GapTetrominoGlyph`/`BADGE_CENTER_BG.classic`, `BRIEFING_OBJECTIVE` keys = `PlayableComponent` all line up.
- **No DB changes:** districts/themes and the map lines are untouched; only the frontend name display is removed.
