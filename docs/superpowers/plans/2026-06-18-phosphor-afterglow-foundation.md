# Phosphor Afterglow — Foundation (Tokens + LivesCounter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Afterglow design primitives (color tokens, glow/bloom utilities, fonts) and a shared `LivesCounter` (♥×N) component, as the non-destructive foundation every later screen re-skin builds on.

**Architecture:** Purely **additive** — add a new `phos` Tailwind color namespace, Afterglow `boxShadow`/font families, and `index.css` primitive classes, **without changing existing `neon.*`/`arcade.*` tokens**. Untouched screens stay pixel-identical; each later phase migrates its classes from `neon-*` → `phos-*`. Then build `LivesCounter` and swap it in for the two hardcoded heart rows.

**Tech Stack:** Vite, React, TypeScript, Tailwind, Zustand, Vitest + @testing-library/react (jsdom). Tests live in `tests/`. Verify with `npm run test`, `npm run build` (catches `noUnusedLocals`), and `npx tsc --noEmit`.

---

### Task 1: Load Afterglow fonts

**Files:**
- Modify: `index.html:9`

- [ ] **Step 1: Add Silkscreen + Space Grotesk to the Google Fonts link**

Replace the existing font `<link>` (line 9) with:

```html
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen:wght@400;700&family=Space+Grotesk:wght@400;500;600;700&family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(afterglow): load Silkscreen + Space Grotesk fonts"
```

---

### Task 2: Add `phos` color tokens, glows, and font families

**Files:**
- Modify: `tailwind.config.js:6-32`

- [ ] **Step 1: Add the `phos` palette, Afterglow shadows, and font families**

In `tailwind.config.js`, inside `theme.extend`, **add** (do not remove `neon`/`arcade`) so the blocks become:

```js
      colors: {
        neon: {
          cyan: '#22d3ee',
          magenta: '#ff2d95',
          green: '#39d98a',
          red: '#ff4d4d',
          yellow: '#facc15',
        },
        arcade: {
          bg: '#030712',
          panel: '#060d12',
          edge: '#0e2b33',
          well: '#0c1f25',
        },
        // ── Afterglow (Phosphor) semantic palette ──
        phos: {
          void: '#06060B',
          panel: '#0E0E16',
          raised: '#15151F',
          grid: '#1C1C28',
          filled: '#2A2D3A',
          edge: '#3A3E4F',
          magenta: '#FF2D9B', // memory / the gap
          cyan: '#28F0FF',    // system / active
          amber: '#FFC23D',   // time / score
          red: '#FF3B47',     // danger / miss
          lime: '#B6FF3C',    // success / streak
          text: '#EAEAF2',
          dim: '#8A8AA0',
          faint: '#4A4A5C',
        },
      },
      boxShadow: {
        'neon-cyan': '0 0 8px rgba(34,211,238,0.55), 0 0 2px rgba(255,255,255,0.6) inset',
        'neon-magenta': '0 0 8px rgba(255,45,149,0.55)',
        'neon-green': '0 0 8px rgba(57,217,138,0.5)',
        'neon-red': '0 0 8px rgba(255,77,77,0.5)',
        'panel-inset': 'inset 0 0 14px rgba(0,0,0,0.6)',
        'phos-cyan': '0 0 6px #28F0FF, 0 0 22px rgba(40,240,255,0.45)',
        'phos-magenta': '0 0 6px #FF2D9B, 0 0 22px rgba(255,45,155,0.45)',
        'phos-amber': '0 0 6px #FFC23D, 0 0 22px rgba(255,194,61,0.45)',
        'phos-red': '0 0 6px #FF3B47, 0 0 22px rgba(255,59,71,0.45)',
        'phos-lime': '0 0 6px #B6FF3C, 0 0 22px rgba(182,255,60,0.45)',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['Sora', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        silk: ['Silkscreen', '"Press Start 2P"', 'ui-monospace', 'monospace'],
        grotesk: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
```

- [ ] **Step 2: Verify build + existing tests still pass**

Run: `npm run build`
Expected: succeeds.
Run: `npm run test`
Expected: all existing tests pass (additive change — class names unchanged).

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat(afterglow): add phos color tokens, glow shadows, font families"
```

---

### Task 3: Add Afterglow CSS primitives to `index.css`

**Files:**
- Modify: `src/index.css` (append after line 102, before nothing — end of file)

- [ ] **Step 1: Append the Afterglow primitives block to the end of `src/index.css`**

```css

/* ── Afterglow (Phosphor) primitives ──────────────────────────────────────
   The phosphor look: two-layer glow, the gap "bloom" (light → hold → decay →
   re-seal into the surface), the lights-out recall tone, and easing tokens.
   Additive — existing arcade utilities above are untouched. */
:root {
  --phos-attack: cubic-bezier(0.1, 0.9, 0.2, 1);
  --phos-decay: cubic-bezier(0.3, 0, 0.1, 1);
  --phos-mechanical: cubic-bezier(0.7, 0, 0.3, 1);
}

/* Screen ground: void + corner vignette so lit UI floats. */
.phos-vignette {
  background: radial-gradient(120% 90% at 50% 40%, transparent 55%, #000 130%), #06060b;
}

/* Two-layer glow boxes (tight core + soft halo) per accent. */
.phos-glow-cyan { box-shadow: 0 0 6px #28f0ff, 0 0 22px rgba(40, 240, 255, 0.45); }
.phos-glow-magenta { box-shadow: 0 0 6px #ff2d9b, 0 0 22px rgba(255, 45, 155, 0.45); }
.phos-glow-lime { box-shadow: 0 0 6px #b6ff3c, 0 0 22px rgba(182, 255, 60, 0.45); }
.phos-glow-amber { box-shadow: 0 0 6px #ffc23d, 0 0 22px rgba(255, 194, 61, 0.45); }
.phos-glow-red { box-shadow: 0 0 6px #ff3b47, 0 0 22px rgba(255, 59, 71, 0.45); }

/* Text halos (numerals / labels only — never body copy). */
.text-glow-phos-cyan { text-shadow: 0 0 10px rgba(40, 240, 255, 0.5); }
.text-glow-phos-magenta { text-shadow: 0 0 10px rgba(255, 45, 155, 0.55); }
.text-glow-phos-amber { text-shadow: 0 0 10px rgba(255, 194, 61, 0.5); }
.text-glow-phos-red { text-shadow: 0 0 12px rgba(255, 59, 71, 0.4); }

/* Recall "lights-out" cell tone — every cell renders this at recall so gaps
   leave no readable hole (the uniformity rule). */
.phos-dim { background: #0c0c14; box-shadow: none; }

/* A filled-surface cell (graphite, inert). */
.phos-filled {
  background: linear-gradient(160deg, #3a3e4f, #2a2d3a);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.33);
}

/* The gap bloom: light floods the shape, holds, then decays and RE-SEALS into
   the filled surface — never a darker hole. Apply to a cell that is also a
   member of a tetromino group whose cells all get this class at the same tick. */
@keyframes phosBloom {
  0% {
    background: linear-gradient(160deg, #3a3e4f, #2a2d3a);
    box-shadow: none;
    transform: scale(1);
  }
  10% {
    background: #ff2d9b;
    box-shadow: 0 0 10px #ff2d9b, 0 0 22px #ff2d9b;
    transform: scale(1.1);
  }
  24%, 55% {
    background: #ff2d9b;
    box-shadow: 0 0 8px #ff2d9b;
    transform: scale(1);
  }
  82% {
    background: #2c1c2a;
    box-shadow: 0 0 4px rgba(255, 45, 155, 0.33);
  }
  100% {
    background: linear-gradient(160deg, #3a3e4f, #2a2d3a);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.33);
    transform: scale(1);
  }
}
.phos-bloom { animation: phosBloom 1.3s var(--phos-decay) forwards; }

@media (prefers-reduced-motion: reduce) {
  .phos-bloom { animation: none; }
}
```

- [ ] **Step 2: Verify build + tests**

Run: `npm run build`
Expected: succeeds.
Run: `npm run test`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(afterglow): add phosphor CSS primitives (glow, bloom, lights-out, easings)"
```

---

### Task 4: Build the `LivesCounter` (♥×N) component — TDD

**Files:**
- Create: `src/components/ui/LivesCounter.tsx`
- Modify: `src/components/ui/index.ts:6` (add export)
- Test: `tests/components/ui/LivesCounter.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/LivesCounter.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LivesCounter } from '../../../src/components/ui/LivesCounter'

describe('LivesCounter', () => {
  it('renders a heart glyph and the count for a normal value', () => {
    render(<LivesCounter lives={5} />)
    expect(screen.getByText('♥')).toBeInTheDocument()
    expect(screen.getByText('×5')).toBeInTheDocument()
  })

  it('shows a count above the starting five (future earned lives)', () => {
    render(<LivesCounter lives={6} />)
    expect(screen.getByText('×6')).toBeInTheDocument()
  })

  it('renders ×0 when out of lives', () => {
    render(<LivesCounter lives={0} />)
    expect(screen.getByText('×0')).toBeInTheDocument()
  })

  it('exposes an accessible label of the count', () => {
    render(<LivesCounter lives={3} />)
    expect(screen.getByLabelText('3 lives')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- LivesCounter`
Expected: FAIL — cannot find module `LivesCounter`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/ui/LivesCounter.tsx`:

```tsx
/**
 * LivesCounter — the ♥×N lives display.
 *
 * A single heart glyph plus a tabular count, replacing fixed heart rows so the
 * value can scale past the starting count (future earn-a-life reward system).
 * At 0 the whole thing dims to read as "out".
 */
export function LivesCounter({ lives, className = '' }: { lives: number; className?: string }) {
  const out = lives <= 0
  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      aria-label={`${lives} lives`}
    >
      <span
        className={`text-base leading-none ${out ? 'text-phos-faint' : 'text-phos-red text-glow-phos-red'}`}
        aria-hidden="true"
      >
        ♥
      </span>
      <span
        className={`font-mono text-sm leading-none tabular-nums ${out ? 'text-phos-faint' : 'text-phos-text'}`}
        aria-hidden="true"
      >
        ×{lives}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Add the barrel export**

In `src/components/ui/index.ts`, add after the existing exports:

```ts
export { LivesCounter } from './LivesCounter'
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- LivesCounter`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/components/ui/LivesCounter.tsx src/components/ui/index.ts tests/components/ui/LivesCounter.test.tsx
git commit -m "feat(afterglow): add shared LivesCounter (♥×N) component"
```

---

### Task 5: Use `LivesCounter` in Stagger

**Files:**
- Modify: `src/components/StaggerScreen.tsx:154-162` (remove local `Hearts`), `:327` (use `LivesCounter`), import line near top.

- [ ] **Step 1: Replace the local `Hearts` component definition (lines 154-162) with an import**

Delete the entire `Hearts` function (lines 154-162):

```tsx
// ── HUD ─────────────────────────────────────────────────────────────────────
function Hearts({ lives }: { lives: number }) {
  return (
    <div className="flex gap-1" aria-label={`${lives} lives`}>
      {Array.from({ length: STAGGER.START_LIVES }, (_, i) => (
        <span key={i} className={`text-lg leading-none ${i < lives ? 'text-neon-red text-glow-red' : 'text-arcade-edge'}`}>♥</span>
      ))}
    </div>
  )
}
```

Replace with just the section comment:

```tsx
// ── HUD ─────────────────────────────────────────────────────────────────────
```

- [ ] **Step 2: Add the `LivesCounter` import**

At the top of `StaggerScreen.tsx`, add to the existing `ui` imports (find the line importing from `./ui` or add a new import). If there is no `./ui` import, add:

```tsx
import { LivesCounter } from './ui/LivesCounter'
```

- [ ] **Step 3: Swap the usage at line ~327**

Change `<Hearts lives={lives} />` to:

```tsx
<LivesCounter lives={lives} />
```

- [ ] **Step 4: Verify the `STAGGER` import is still used elsewhere; if now unused, remove it**

Run: `npx tsc --noEmit`
Expected: no errors (in particular no "STAGGER is declared but never read"; if it errors, remove the now-unused `STAGGER` import from the import block).

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/StaggerScreen.tsx
git commit -m "feat(afterglow): use LivesCounter in Stagger HUD"
```

---

### Task 6: Use `LivesCounter` in GameShell (Journey/Practice)

**Files:**
- Modify: `src/components/GameShell.tsx:111-117`, imports near top (`:4`).

- [ ] **Step 1: Replace the lives-row markup (lines 111-117)**

Change:

```tsx
      {showLives && (
        <div data-testid="lives-row" className="flex justify-center gap-1 pt-2 text-sm">
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span key={i} className={i < livesRemaining ? 'text-neon-red text-glow-red' : 'text-arcade-edge'}>♥</span>
          ))}
        </div>
      )}
```

to:

```tsx
      {showLives && (
        <div data-testid="lives-row" className="flex justify-center pt-2">
          <LivesCounter lives={livesRemaining} />
        </div>
      )}
```

- [ ] **Step 2: Add the import, remove now-unused `MAX_LIVES`**

At the top of `GameShell.tsx`: add `import { LivesCounter } from './ui/LivesCounter'`. Then check whether `MAX_LIVES` (imported on line 4 from `@shared/core/scoring`) is used anywhere else in the file.

Run: `grep -n "MAX_LIVES" src/components/GameShell.tsx`
If the only hit is the import line, remove `MAX_LIVES` from that import (delete the whole import line if it imports nothing else).

- [ ] **Step 3: Check the GameShell test still matches (`lives-row` testid preserved)**

Run: `npm run test -- GameShell`
Expected: PASS. (The `data-testid="lives-row"` is preserved, so existing assertions on its presence hold. If a test counts individual ♥ spans, update it to assert the `×N` text instead — show the updated assertion in the same commit.)

- [ ] **Step 4: Full test + typecheck**

Run: `npm run test`
Expected: all pass.
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameShell.tsx tests/components/GameShell.test.tsx
git commit -m "feat(afterglow): use LivesCounter in GameShell lives row"
```

---

### Task 7: Verify the foundation end-to-end

- [ ] **Step 1: Full suite + build + types**

Run: `npm run test`
Expected: all pass.
Run: `npm run build`
Expected: succeeds (no `noUnusedLocals` errors).
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Visual smoke check (preview)**

Start the dev server (`puzzle-game` launch config) and confirm the Stagger HUD now shows **♥ ×5** (count, not a row) and Journey/Practice show **♥ ×3**. Capture a screenshot for the PR.

- [ ] **Step 3: Tag the foundation done**

No code change. The `phos` tokens, Afterglow CSS primitives, fonts, and `LivesCounter` are now available for every subsequent screen re-skin phase.

---

## Notes for the next plan (screen re-skins — NOT in this plan)

Once this foundation is green, the screen re-skins (Stagger, Auth, Pause, Game Over, Home) parallelize — each touches mostly its own component file and consumes `phos-*` tokens + Afterglow primitives. The Stagger reveal rework (shape-grouped bloom + lights-out recall) and the rename sweep are part of that next plan, referencing `mockups/stagger-afterglow.html` and the `design-system/screens/*` cards as the visual source of truth.
