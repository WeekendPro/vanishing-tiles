# Scoring Star Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Journey gameplay/scoring screens — new metadata bar, timer-bar-never-a-loader, centered lives row, a new `20×lives + 40×time` rubric, an animated drop-in gold "shooting star" replacing the flat score card, and an icon-only CTA grid.

**Architecture:** Pure-math rubric change in `journeyScoring.ts` (TDD). UI changes localized to `GameShell.tsx` (bar/loader/lives), `ViewingPhase.tsx` (text removal), and `ResolutionPhase/` (new `ScoreStar` component + icon CTA grid, deleting `ComponentScorePanel`). Practice mode is untouched.

**Tech Stack:** React + TypeScript, Zustand 5 (`useShallow` for object selectors), Framer Motion, Vitest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-09-scoring-star-redesign.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/journeyScoring.ts` | New `componentScore` rubric + `LIFE_VALUE`/`TIME_MAX` constants (Task 1) |
| `src/components/GameShell.tsx` | New label format, remove score/hearts from bar, full-screen loader on submit, centered lives row (Tasks 2–4) |
| `src/components/GlobalLoadingOverlay.tsx` | Update stale comment (Task 3) |
| `src/components/ViewingPhase.tsx` | Remove "Memorize the gaps" line (Task 5) |
| `src/components/ResolutionPhase/ScoreStar.tsx` | **New** — Framer Motion star animation (Task 6) |
| `src/components/ResolutionPhase/IconButton.tsx` | **New** — presentational icon button + chevron/repeat SVGs (Task 7) |
| `src/components/ResolutionPhase/index.tsx` | Render `ScoreStar` on journey success, remove `ComponentScorePanel`, icon CTA grid (Task 7) |
| `src/components/ResolutionPhase/ComponentScorePanel.tsx` | **Deleted** (Task 7) |

**Tests touched:** `tests/lib/journeyScoring.test.ts` (Task 1), `tests/components/GameShell.test.tsx` (Tasks 2–4), `tests/components/ResolutionPhase.test.tsx` (Task 7), `tests/components/ComponentScorePanel.test.tsx` (deleted, Task 7), new `tests/components/ScoreStar.test.tsx` (Task 6).

**Note on nvm quirk:** run `npm`/`npx` as standalone shell calls, never chained with `&&`.

---

## Task 1: New scoring rubric (`journeyScoring.ts`)

**Files:**
- Modify: `src/lib/journeyScoring.ts`
- Test: `tests/lib/journeyScoring.test.ts`

New rubric: `score = 20 × livesRemaining + 40 × (1 − consumed/allotted)`, ceil, clamped 0..100, where `livesRemaining = 3 − clamp(livesLost, 0, 2)` (so 3/2/1 lives → 60/40/20 base). Unsolved = 0. `ComponentScoreInput` shape is unchanged (`solved`, `livesLost`, `consumed`, `allotted`).

- [ ] **Step 1: Replace the `componentScore` test cases with the new math**

In `tests/lib/journeyScoring.test.ts`, replace the entire `describe('componentScore', …)` block (lines 6–25) with:

```ts
describe('componentScore', () => {
  it('returns 0 when unsolved', () => {
    expect(componentScore({ solved: false, livesLost: 0, consumed: 0, allotted: 1000 })).toBe(0)
  })
  it('lives base is 60 / 40 / 20 for 0 / 1 / 2 lives lost (out of time → base only)', () => {
    expect(componentScore({ solved: true, livesLost: 0, consumed: 1000, allotted: 1000 })).toBe(60)
    expect(componentScore({ solved: true, livesLost: 1, consumed: 1000, allotted: 1000 })).toBe(40)
    expect(componentScore({ solved: true, livesLost: 2, consumed: 1000, allotted: 1000 })).toBe(20)
  })
  it('full time bonus adds up to 40 → 100 / 80 / 60 with 3 / 2 / 1 lives remaining', () => {
    expect(componentScore({ solved: true, livesLost: 0, consumed: 0, allotted: 1000 })).toBe(100)
    expect(componentScore({ solved: true, livesLost: 1, consumed: 0, allotted: 1000 })).toBe(80)
    expect(componentScore({ solved: true, livesLost: 2, consumed: 0, allotted: 1000 })).toBe(60)
  })
  it('time bonus scales with the fraction of the clock saved (ceil)', () => {
    // 50% saved → 20 time; 60 base + 20 = 80
    expect(componentScore({ solved: true, livesLost: 0, consumed: 500, allotted: 1000 })).toBe(80)
    // 90% saved → 36 time; 60 + 36 = 96
    expect(componentScore({ solved: true, livesLost: 0, consumed: 100, allotted: 1000 })).toBe(96)
  })
  it('caps at 100 and floors the time bonus at 0', () => {
    expect(componentScore({ solved: true, livesLost: 0, consumed: 5000, allotted: 1000 })).toBe(60)
  })
  it('treats a zero/negative allotted as fully consumed (time 0 → base only)', () => {
    expect(componentScore({ solved: true, livesLost: 0, consumed: 0, allotted: 0 })).toBe(60)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/journeyScoring.test.ts`
Expected: FAIL — the `componentScore` cases now expect 60/40/20-based numbers but the implementation still returns the old 50/40/30 + 50-time values.

- [ ] **Step 3: Rewrite `componentScore` and constants**

In `src/lib/journeyScoring.ts`, replace lines 5–29 (the constants block through the end of `componentScore`) with:

```ts
export const LIFE_VALUE = 20            // points per life remaining at solve
export const LIVES_TOTAL = 3            // lives per component play
export const TIME_MAX = 40              // max points from leftover time
export const COMPONENT_MAX = 100
export const COMPONENT_COUNT = 5
export const LEVEL_MAX = COMPONENT_MAX * COMPONENT_COUNT // 500

export interface ComponentScoreInput {
  solved: boolean
  /** Wrong submissions before the successful one (0, 1, or 2). */
  livesLost: number
  /** Time consumed on the successful attempt (ms). */
  consumed: number
  /** Full time budget for the attempt (ms): view+select, or select-only for flash. */
  allotted: number
}

/**
 * score = LIFE_VALUE·livesRemaining + TIME_MAX·(1 − consumed/allotted),
 * ceil, clamped 0..100; 0 if unsolved. Star fill % equals this score.
 * livesRemaining = LIVES_TOTAL − livesLost (3/2/1 for 0/1/2 lost).
 */
export function componentScore(i: ComponentScoreInput): number {
  if (!i.solved) return 0
  const livesRemaining = LIVES_TOTAL - clamp(i.livesLost, 0, LIVES_TOTAL - 1)
  const base = LIFE_VALUE * livesRemaining
  const fraction = i.allotted > 0 ? clamp(i.consumed / i.allotted, 0, 1) : 1
  const time = TIME_MAX * (1 - fraction)
  return clamp(Math.ceil(base + time), 0, COMPONENT_MAX)
}
```

(The `clamp` helper at the top of the file and everything below `componentScore` — `ComponentBests`, `sumBests`, `levelStarsFromTotal`, `difficultyPips`, `mockGlobalRecord` — stay exactly as-is. The old `COMPLETION_BASE` / `LIFE_PENALTY` / `SPEED_MAX` exports are removed here; their only consumer, `ComponentScorePanel`, is deleted in Task 7, which still type-checks because nothing imports them after this task except that soon-to-be-deleted file — verify in Step 4.)

- [ ] **Step 4: Run tests + typecheck to verify green**

Run: `npx vitest run tests/lib/journeyScoring.test.ts`
Expected: PASS (all `componentScore` cases green).

Run: `npx tsc --noEmit`
Expected: ONE error in `src/components/ResolutionPhase/ComponentScorePanel.tsx` — `COMPLETION_BASE`/`LIFE_PENALTY` no longer exported. That file is deleted in Task 7. To keep the tree compiling **between** tasks, apply this temporary shim now: in `ComponentScorePanel.tsx` replace line 2 `import { COMPLETION_BASE, LIFE_PENALTY } from '../../lib/journeyScoring'` and line 15's `const base = …` with:

```ts
// (temporary until ComponentScorePanel is removed in Task 7)
const LIVES_TOTAL = 3, LIFE_VALUE = 20
```

and line 15:

```ts
  const base = solved ? LIFE_VALUE * (LIVES_TOTAL - Math.min(2, livesLost)) : 0
```

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/journeyScoring.ts tests/lib/journeyScoring.test.ts src/components/ResolutionPhase/ComponentScorePanel.tsx
git commit -m "feat(scoring): new journey rubric — 20 per life + 40 time, star fill = score"
```

---

## Task 2: Metadata bar — number-prefixed label, remove score + hearts

**Files:**
- Modify: `src/components/GameShell.tsx`
- Test: `tests/components/GameShell.test.tsx`

Journey label becomes `NN: Level Name` (zero-padded display number); if the component is not `main`, append a dim ` | Badge Name`. Score readout and the `Hearts` row are removed from the bar.

- [ ] **Step 1: Update the header test for the new label + no score/hearts**

In `tests/components/GameShell.test.tsx`, replace the `describe('GameShell header', …)` block (lines 32–51) with:

```ts
describe('GameShell header', () => {
  it('shows round-of-4 in practice level mode', () => {
    act(() => {
      useGameStore.setState({ mode: 'practice', phase: 'viewing', roundIndex: 1, livesRemaining: 2, score: 1400, levelComplete: false })
    })
    render(<GameShell />)
    expect(screen.getByText(/ROUND/i)).toBeInTheDocument()
    expect(screen.getByText(/2\s*\/\s*4|2 OF 4/i)).toBeInTheDocument()
  })

  it('journey header shows "NN: Name | Badge" and no score', () => {
    useGameStore.setState({
      mode: 'journey', activeComponent: 'colors', levelName: 'Cellar Door',
      levelDisplayNumber: 3, phase: 'viewing', livesRemaining: 3, score: 1400,
    } as any)
    render(<GameShell />)
    expect(screen.getByText(/03: Cellar Door/i)).toBeTruthy()
    expect(screen.getByText(/True Colors/i)).toBeTruthy()
    expect(screen.queryByText(/\/ 4/)).toBeNull()
    expect(screen.queryByText('1,400')).toBeNull()   // score no longer in the bar
  })

  it('journey main puzzle shows no badge suffix', () => {
    useGameStore.setState({
      mode: 'journey', activeComponent: 'main', levelName: 'Cellar Door',
      levelDisplayNumber: 1, phase: 'viewing', livesRemaining: 3,
    } as any)
    render(<GameShell />)
    expect(screen.getByText(/01: Cellar Door/i)).toBeTruthy()
    expect(screen.queryByText(/Main/)).toBeNull()    // 'main' has no suffix
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/GameShell.test.tsx -t "GameShell header"`
Expected: FAIL — the bar still renders `Cellar Door` without the `03:` prefix and still shows the score.

- [ ] **Step 3: Rewrite the metadata bar markup**

In `src/components/GameShell.tsx`, replace the bar `<span>` block (lines 52–67, the whole `<div className="sticky top-0 …">…</div>`) with:

```tsx
      <div className="sticky top-0 z-30 bg-arcade-bg flex items-center gap-4 px-4 py-3 border-b-2 border-arcade-edge">
        <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-neon-cyan">
          {mode === 'journey' ? (
            <>
              <strong className="text-white">
                {levelDisplayNumber != null ? `${String(levelDisplayNumber).padStart(2, '0')}: ` : ''}
                {levelName ?? `Level ${levelDisplayNumber ?? ''}`}
              </strong>
              {activeComponent && activeComponent !== 'main' && (
                <>
                  <span className="text-arcade-edge px-2" aria-hidden>|</span>
                  <span>{COMPONENT_LABEL[activeComponent]}</span>
                </>
              )}
            </>
          ) : (
            <>ROUND <strong className="text-white">{roundIndex + 1} / 4</strong></>
          )}
        </span>
        <span className="flex-1" />
      </div>
```

Then delete the now-unused `Hearts` component (lines 12–24) and remove `score` from the `useShallow` selector object (line 31) and its destructure (line 27). Leave `livesRemaining` in the selector — it is used by Task 4. Remove the `import { MAX_LIVES } from '@shared/core/scoring'` only if Task 4 hasn't added it back — keep it for now since Task 4 needs it (the lives row), so leave the import in place.

- [ ] **Step 4: Run the tests to verify green**

Run: `npx vitest run tests/components/GameShell.test.tsx -t "GameShell header"`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS (no unused `Hearts`/`score`).

- [ ] **Step 5: Commit**

```bash
git add src/components/GameShell.tsx tests/components/GameShell.test.tsx
git commit -m "feat(gameshell): number-prefixed level label, drop score + hearts from bar"
```

---

## Task 3: Timer bar is never a loader — use the full-screen ArcadeLoader

**Files:**
- Modify: `src/components/GameShell.tsx`, `src/components/GlobalLoadingOverlay.tsx`
- Test: `tests/components/GameShell.test.tsx`

The 1.5px timer slot must only ever hold the real `ProgressBar`. When `submitting`, show the full-screen `ArcadeLoader` instead of a `TrickleBar` in the timer slot.

- [ ] **Step 1: Update the loading-slot tests**

In `tests/components/GameShell.test.tsx`, replace the `describe('GameShell loading slot', …)` block (lines 16–30) with:

```ts
describe('GameShell loading slot', () => {
  it('shows the full-screen loader (not the timer slot) while submitting', () => {
    act(() => { useGameStore.setState({ phase: 'selecting', mode: 'journey', submitting: true }) })
    render(<GameShell />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.getByTestId('arcade-loader')).toBeInTheDocument()
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })

  it('shows no loader when not submitting', () => {
    act(() => { useGameStore.setState({ phase: 'selecting', mode: 'journey', submitting: false }) })
    render(<GameShell />)
    act(() => { vi.advanceTimersByTime(120) })
    expect(screen.queryByTestId('arcade-loader')).toBeNull()
    expect(screen.queryByTestId('trickle-bar')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/GameShell.test.tsx -t "loading slot"`
Expected: FAIL — the timer slot still renders `trickle-bar` and there is no `arcade-loader`.

- [ ] **Step 3: Replace the TrickleBar branch with the timer-only slot + full-screen loader**

In `src/components/GameShell.tsx`:

1. Change the imports: remove `import { TrickleBar } from './TrickleBar'` and add `import { ArcadeLoader } from './ArcadeLoader'`.

2. Replace the timer slot block (lines 72–83, the `<div className="h-1.5">…</div>`) with:

```tsx
      <div className="h-1.5">
        {showTimer ? (
          <ProgressBar
            startTime={phaseStartTime}
            duration={phaseDuration}
            color={phase === 'viewing' ? 'bg-cyan-400' : 'bg-green-400'}
            rounded="rounded-none"
          />
        ) : null}
      </div>
```

3. Add the full-screen loader just before the final closing `</div>` of the component (after the phase-content `<div>` that ends at line 90):

```tsx
      <ArcadeLoader active={submitting} />
```

`submitting` is already in the selector — keep it.

- [ ] **Step 4: Update the stale comment in GlobalLoadingOverlay**

In `src/components/GlobalLoadingOverlay.tsx`, replace the doc comment lines 4–7 with:

```ts
/**
 * App-root arcade loading overlay; reflects all tracked async work on the
 * full-screen routes (auth, journey load, level load, start session). The
 * in-game answer submit shows its own full-screen ArcadeLoader from GameShell.
 */
```

- [ ] **Step 5: Run the tests to verify green**

Run: `npx vitest run tests/components/GameShell.test.tsx -t "loading slot"`
Expected: PASS.

Run: `npx vitest run tests/components/ArcadeLoader.test.tsx`
Expected: PASS (unchanged loader still works).

- [ ] **Step 6: Commit**

```bash
git add src/components/GameShell.tsx src/components/GlobalLoadingOverlay.tsx tests/components/GameShell.test.tsx
git commit -m "fix(gameshell): submit shows full-screen loader, never the timer slot"
```

---

## Task 4: Centered lives row below the timer

**Files:**
- Modify: `src/components/GameShell.tsx`
- Test: `tests/components/GameShell.test.tsx`

Add a horizontally-centered hearts row directly under the timer slot, shown during `viewing`/`selecting`.

- [ ] **Step 1: Add a lives-row test**

Append this block to `tests/components/GameShell.test.tsx`:

```ts
describe('GameShell lives row', () => {
  it('renders a centered lives row during viewing, hidden in resolving', () => {
    act(() => { useGameStore.setState({ mode: 'journey', phase: 'viewing', livesRemaining: 2 }) })
    const { rerender } = render(<GameShell />)
    const row = screen.getByTestId('lives-row')
    expect(row).toBeInTheDocument()
    expect(row.textContent).toContain('♥')
    act(() => { useGameStore.setState({ phase: 'resolving' }) })
    rerender(<GameShell />)
    expect(screen.queryByTestId('lives-row')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/GameShell.test.tsx -t "lives row"`
Expected: FAIL — no `lives-row` testid exists yet.

- [ ] **Step 3: Add the lives row**

In `src/components/GameShell.tsx`, add this derived flag next to `showTimer` (after line 43):

```tsx
  const showLives = (phase === 'viewing' || phase === 'selecting') && !paused
```

Then, immediately after the timer-slot `<div className="h-1.5">…</div>` block, add:

```tsx
      {showLives && (
        <div data-testid="lives-row" className="flex justify-center gap-1 pt-2 text-sm">
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span key={i} className={i < livesRemaining ? 'text-neon-red text-glow-red' : 'text-arcade-edge'}>♥</span>
          ))}
        </div>
      )}
```

`MAX_LIVES` and `livesRemaining` are already imported / selected from Task 2/3.

- [ ] **Step 4: Run the tests to verify green**

Run: `npx vitest run tests/components/GameShell.test.tsx`
Expected: PASS (all GameShell describes).

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameShell.tsx tests/components/GameShell.test.tsx
git commit -m "feat(gameshell): centered lives row below the timer during play"
```

---

## Task 5: Remove the "Memorize the gaps" line

**Files:**
- Modify: `src/components/ViewingPhase.tsx`

- [ ] **Step 1: Delete the instructional line**

In `src/components/ViewingPhase.tsx`, delete line 54 entirely:

```tsx
      <p className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan text-center">Memorize the gaps</p>
```

The `<div ref={gridWrapRef} …>` block and the `Ready →` `NeonButton` stay.

- [ ] **Step 2: Verify nothing referenced it**

Run: `npx vitest run tests/components/FlashReveal.test.tsx`
Expected: PASS (closest viewing-phase-adjacent test; no test asserts "Memorize").

Run: `grep -rn "Memorize" src tests`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add src/components/ViewingPhase.tsx
git commit -m "chore(viewing): remove 'Memorize the gaps' copy (helper screen comes later)"
```

---

## Task 6: ScoreStar animation component

**Files:**
- Create: `src/components/ResolutionPhase/ScoreStar.tsx`
- Test: `tests/components/ScoreStar.test.tsx`

A self-contained Framer Motion star. Drop-in spring arrival (hollow, `0` inside), each remaining life floats up and sparks (+20% fill / +20 score), then leftover time tweens fill+score to the final value with sparkles (abstract — no seconds). Reduced motion renders the final state immediately.

- [ ] **Step 1: Write the failing test (reduced-motion contract)**

Create `tests/components/ScoreStar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, useReducedMotion: () => true }
})

import { ScoreStar } from '../../src/components/ResolutionPhase/ScoreStar'

describe('ScoreStar (reduced motion)', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(<ScoreStar show={false} score={80} livesRemaining={3} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the final score and fills the star to that percentage immediately', () => {
    render(<ScoreStar show score={80} livesRemaining={3} />)
    expect(screen.getByTestId('score-star-value').textContent).toBe('80')
    const fill = screen.getByTestId('score-star-fill') as HTMLElement
    expect(fill.style.height).toBe('80%')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/ScoreStar.test.tsx`
Expected: FAIL — `ScoreStar` does not exist.

- [ ] **Step 3: Implement `ScoreStar`**

Create `src/components/ResolutionPhase/ScoreStar.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const STAR_CLIP =
  'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)'
const STAR_POINTS = '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35'
const LIFE_VALUE = 20

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
function tween(from: number, to: number, ms: number, onUpdate: (v: number) => void) {
  return new Promise<void>(res => {
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - k, 2) // easeOut
      onUpdate(from + (to - from) * e)
      if (k < 1) requestAnimationFrame(step)
      else res()
    }
    requestAnimationFrame(step)
  })
}

interface Props {
  show: boolean
  score: number
  livesRemaining: number
}

/**
 * Gold "shooting star" scoring visual. Drops in and springs to a stop (hollow,
 * 0 inside); each remaining life floats up and sparks (+20% fill / +20 score);
 * then leftover time tweens fill + score to the final value. The star fill % is
 * the score. Reduced motion renders the final state immediately.
 */
export function ScoreStar({ show, score, livesRemaining }: Props) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(0)
  const [fill, setFill] = useState(0)
  const [landed, setLanded] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!show) { started.current = false; return }
    if (reduce) { setDisplay(score); setFill(score); setLanded(livesRemaining); return }
    if (started.current) return
    started.current = true
    let cancelled = false
    const run = async () => {
      await wait(700) // drop-in spring settles
      let running = 0
      for (let i = 0; i < livesRemaining; i++) {
        if (cancelled) return
        await wait(420)                 // life travels up
        setLanded(i + 1)                // spark + token consumed
        const from = running
        running = Math.min(score, running + LIFE_VALUE)
        await tween(from, running, 280, v => { setDisplay(Math.round(v)); setFill(v) })
        await wait(120)
      }
      if (cancelled) return
      await tween(running, score, 900, v => { setDisplay(Math.round(v)); setFill(v) }) // leftover time
    }
    run()
    return () => { cancelled = true }
  }, [show, reduce, score, livesRemaining])

  if (!show) return null

  const spread = 26
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
      <motion.div
        className="relative"
        style={{ width: 128, height: 128 }}
        initial={reduce ? false : { y: -220, scale: 0.7, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 16 }}
      >
        {/* fill clipped to the star shape */}
        <div className="absolute inset-0" style={{ clipPath: STAR_CLIP }}>
          <div className="absolute inset-0" style={{ background: 'rgba(250,204,21,0.14)' }} />
          <div
            data-testid="score-star-fill"
            className="absolute inset-x-0 bottom-0"
            style={{ height: `${Math.max(0, Math.min(100, fill))}%`, background: 'linear-gradient(0deg,#f59e0b,#fde047)' }}
          />
        </div>
        {/* crisp outline */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          style={{ overflow: 'visible', filter: 'drop-shadow(0 0 8px rgba(250,204,21,.6))' }}
        >
          <polygon points={STAR_POINTS} fill="none" stroke="#fbbf24" strokeWidth="4.5" strokeLinejoin="round" />
        </svg>
        {/* score */}
        <span
          data-testid="score-star-value"
          className="absolute inset-0 grid place-items-center font-pixel text-[20px] text-white"
          style={{ textShadow: '0 2px 4px rgba(0,0,0,.85)' }}
        >
          {display}
        </span>

        {/* spark on each landing */}
        {landed > 0 && !reduce && (
          <motion.span
            key={landed}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{ width: 10, height: 10, margin: -5, background: '#fff', boxShadow: '0 0 12px 5px rgba(250,204,21,.9)' }}
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}

        {/* life tokens float up from below and disappear into the star as they land */}
        {!reduce && Array.from({ length: livesRemaining }, (_, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 text-neon-red text-glow-red text-sm"
            initial={{ x: (i - (livesRemaining - 1) / 2) * spread - 6, y: 86, opacity: 1, scale: 1 }}
            animate={i < landed
              ? { x: -6, y: -6, opacity: 0, scale: 0.4 }
              : { x: (i - (livesRemaining - 1) / 2) * spread - 6, y: 86, opacity: 1, scale: 1 }}
            transition={{ duration: 0.42, ease: 'easeIn' }}
          >♥</motion.span>
        ))}
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/ScoreStar.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/ResolutionPhase/ScoreStar.tsx tests/components/ScoreStar.test.tsx
git commit -m "feat(resolution): ScoreStar — drop-in gold star that fills to the score"
```

---

## Task 7: Integrate ScoreStar, remove the score card, icon CTA grid

**Files:**
- Create: `src/components/ResolutionPhase/IconButton.tsx`
- Modify: `src/components/ResolutionPhase/index.tsx`
- Delete: `src/components/ResolutionPhase/ComponentScorePanel.tsx`, `tests/components/ComponentScorePanel.test.tsx`
- Test: `tests/components/ResolutionPhase.test.tsx`

On the **journey** path: the success badge becomes `ScoreStar`, the `ComponentScorePanel` is removed, and the stacked CTAs become an icon-only grid (`‹ Back · ⟳ Repeat · › Next`, dropping whichever doesn't apply). Practice path unchanged.

- [ ] **Step 1: Create the icon button component**

Create `src/components/ResolutionPhase/IconButton.tsx`:

```tsx
import type { ReactNode } from 'react'

type Accent = 'edge' | 'cyan' | 'green'
const ACCENT: Record<Accent, string> = {
  edge: 'border-arcade-edge text-gray-300 hover:border-neon-cyan hover:text-neon-cyan',
  cyan: 'border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10',
  green: 'border-neon-green text-neon-green hover:bg-neon-green/10',
}

export function IconButton({
  label, accent, onClick, children,
}: { label: string; accent: Accent; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`grid place-items-center py-3 rounded-xl border-2 bg-arcade-panel transition-colors active:translate-y-px ${ACCENT[accent]}`}
    >
      {children}
    </button>
  )
}

export const BackIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)
export const RepeatIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
  </svg>
)
export const ForwardIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18l6-6-6-6" />
  </svg>
)
```

- [ ] **Step 2: Update the journey CTA tests to use aria-labels + assert no score card**

In `tests/components/ResolutionPhase.test.tsx`:

(a) In `describe('ResolutionPhase — journey single play', …)` replace the three `findByText`/`getByText` assertions (lines 335–337) with:

```ts
    expect(await screen.findByLabelText(/Play Again/i)).toBeTruthy()
    expect(screen.getByLabelText(/Back to Level/i)).toBeTruthy()
    expect(screen.getByLabelText(/Next Level/i)).toBeTruthy()
    // the flat score card is gone — no "Level Total" / "Completion" rows
    expect(screen.queryByText(/Level Total/i)).toBeNull()
    expect(screen.queryByText(/Completion/i)).toBeNull()
```

(b) In `describe('ResolutionPhase — journey failure CTA', …)`, first test, replace lines 355–358 with:

```ts
    expect(await screen.findByLabelText(/Try Again/i)).toBeTruthy()
    expect(screen.getByLabelText(/Back to Level/i)).toBeTruthy()
    expect(screen.queryByLabelText(/Play Again/i)).toBeNull()
    expect(screen.queryByLabelText(/Next Level/i)).toBeNull()
```

second test, replace lines 374–375 with:

```ts
    expect(await screen.findByLabelText(/Play Again/i)).toBeTruthy()
    expect(screen.queryByLabelText(/Try Again/i)).toBeNull()
```

(c) In `describe('ResolutionPhase in journey mode', …)`, first test replace lines 405–406 with:

```ts
    expect(screen.getByLabelText(/Play Again/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Back to Level/i)).toBeInTheDocument()
```

and in the "Back to Level navigates" test, replace line 436 `await user.click(screen.getByText(/Back to Level/i))` with:

```ts
    await user.click(screen.getByLabelText(/Back to Level/i))
```

(The practice-mode describes — "score panel (reduced motion)", "partial (reduced motion)", "badge copy", "bad pieces" — are unchanged; they assert the Practice `ScorePanel`/`PartialBadge`, which stay.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: FAIL — the CTAs are still text `NeonButton`s (no `aria-label`), and `ComponentScorePanel` still renders.

- [ ] **Step 4: Wire ScoreStar + icon grid into `index.tsx`**

In `src/components/ResolutionPhase/index.tsx`:

1. Imports: remove `import { ComponentScorePanel } from './ComponentScorePanel'`. Add:

```tsx
import { ScoreStar } from './ScoreStar'
import { IconButton, BackIcon, RepeatIcon, ForwardIcon } from './IconButton'
import { MAX_LIVES } from '@shared/core/scoring'
```

(`NeonButton` is still used by nothing in the journey block after this change — verify and remove its import if now unused. The practice CTA uses `NextRoundButton`, not `NeonButton`, so the `NeonButton` import is removed.)

2. Replace the badge-over-board conditional (lines 230–232) with:

```tsx
          {resolution?.kind === 'partial' ? (
            <PartialBadge show={badgeShown} coverage={resolution.coverage} reason={resolution.reason} />
          ) : isJourney ? (
            <ScoreStar show={badgeShown} score={roundScore?.total ?? 0} livesRemaining={MAX_LIVES - livesLost} />
          ) : (
            <CelebrationBadge show={badgeShown} />
          )}
```

3. Replace the score-panel block (lines 247–270, the `{isJourney ? ( … ComponentScorePanel … ) : ( … ScorePanel … )}`) with the practice-only panel:

```tsx
        {/* Practice shows its multi-pillar score panel; Journey's score lives in the star. */}
        {!isJourney && roundScore && (
          <ScorePanel
            roundScore={roundScore}
            grandTotal={grandTotal}
            show={stage === 'scoring' || stage === 'cta'}
            isFailure={isFailure}
            speedSlow={speedSlow}
          />
        )}
```

4. Replace the journey CTA block (lines 283–315, the `{stage === 'cta' && isJourney && ( … )}`) with the icon grid:

```tsx
      {stage === 'cta' && isJourney && (() => {
        const showNext = (!isFailure || outOfLives) && hasNextLevel()
        const repeatLabel = isFailure && !outOfLives ? 'Try Again' : 'Play Again'
        const onRepeat = isFailure && !outOfLives ? retryComponent : replayComponent
        const buttons = [
          <IconButton key="back" label="Back to Level" accent="edge" onClick={() => { if (levelId) openLevel(levelId) }}>{BackIcon}</IconButton>,
          <IconButton key="repeat" label={repeatLabel} accent="cyan" onClick={() => onRepeat()}>{RepeatIcon}</IconButton>,
          ...(showNext ? [<IconButton key="next" label="Next Level" accent="green" onClick={() => goNextLevel()}>{ForwardIcon}</IconButton>] : []),
        ]
        return (
          <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pt-10 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent pointer-events-none">
            <div
              className="w-full max-w-sm pointer-events-auto grid gap-3"
              style={{ gridTemplateColumns: `repeat(${buttons.length}, minmax(0, 1fr))` }}
            >
              {buttons}
            </div>
          </div>
        )
      })()}
```

- [ ] **Step 5: Delete the old score card and its test**

```bash
git rm src/components/ResolutionPhase/ComponentScorePanel.tsx tests/components/ComponentScorePanel.test.tsx
```

- [ ] **Step 6: Remove the now-dead old constants from journeyScoring (cleanup from Task 1)**

Confirm nothing still imports `COMPLETION_BASE`/`LIFE_PENALTY`/`SPEED_MAX`:

Run: `grep -rn "COMPLETION_BASE\|LIFE_PENALTY\|SPEED_MAX" src tests`
Expected: no matches (the temporary shim in `ComponentScorePanel` was deleted with the file in Step 5). If any remain, fix them. No code change to `journeyScoring.ts` is needed here — Task 1 already removed those exports.

- [ ] **Step 7: Run the full ResolutionPhase suite to verify green**

Run: `npx vitest run tests/components/ResolutionPhase.test.tsx`
Expected: PASS (journey CTAs found by label; practice describes still green).

Run: `npx tsc --noEmit`
Expected: PASS (no unused imports; `NeonButton` import removed from index).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(resolution): ScoreStar replaces the journey score card; icon-only CTA grid"
```

---

## Task 8: Full verification + live check

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 2: Build (catches `noUnusedLocals`)**

Run: `npm run build`
Expected: success, no type/unused errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Manual live check**

Start the app (`npm run db:start`, then `npm run dev` as separate calls). Sign in as Guest → tap a station → Play → solve the main puzzle. Confirm:
- Top bar reads `NN: Level Name` (no badge suffix for Main; `| Badge` for a badge).
- No score / hearts in the bar; a centered hearts row sits under the timer during viewing/selecting.
- No "Memorize the gaps" text.
- On solve: the gold star drops in, lives float up and spark (+20 each), then the score finishes filling to the final value; star fill matches the score.
- Bottom shows the icon grid (‹ ⟳ ›), centered as 2 when there's no next level.
- Failure (lose all 3 lives) still shows the partial badge + icon grid.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: scoring-star redesign verification fixes"
```

---

## Self-Review notes

- **Spec coverage:** §1 bar → Task 2; §2 loader → Task 3; §3 lives row + memorize text → Tasks 4–5; §4 rubric → Task 1; §5 star → Task 6; §6 card removal + icon grid → Task 7; §7 failure (partial badge kept) → Task 7 (PartialBadge branch unchanged). All covered.
- **Type consistency:** `ScoreStar` props `{ show, score, livesRemaining }` used identically in Task 6 and Task 7. `IconButton` props `{ label, accent, onClick, children }` match between Task 7 Step 1 and Step 4. `livesRemaining = MAX_LIVES − livesLost` (store caps `livesLost` at 2, so 3/2/1).
- **Inter-task build safety:** Task 1 removes old constants but adds a temporary shim to `ComponentScorePanel` so the tree compiles until Task 7 deletes that file.
