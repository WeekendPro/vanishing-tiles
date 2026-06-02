# Arcade Design-System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the reusable arcade design system (Tailwind tokens, glow CSS utilities, and a small `src/components/ui/` primitive kit) and prove it end-to-end by converting one low-risk surface (AuthScreen) — with **no visible behavior change** and the full test suite staying green.

**Architecture:** This is the *foundation* slice of the larger Arcade Visual Overhaul (spec: `docs/superpowers/specs/2026-06-02-arcade-visual-overhaul-design.md`, §3–§4). We extend the empty `tailwind.config.js` with neon/arcade color tokens, neon `boxShadow`s, and a `pixel` font family; add `text-glow-*` utilities to `src/index.css`; build four presentational primitives (`NeonButton`, `ArcadePanel`, `PixelHeading`, `ScanlineOverlay`); then re-skin `AuthScreen` using them. The north star is the already-shipped `src/components/ArcadeLoader.tsx`. No game logic, store shape, routing, or layout structure changes.

**Tech Stack:** React + TypeScript, Vite, Tailwind CSS v3, Zustand, Vitest + React Testing Library (`@testing-library/react`, `@testing-library/user-event`). Tests live under `tests/`, mirroring `src/`.

**Scope notes / decisions baked in:**
- `NeonBar` (the optional segmented power-meter row from spec §3.3) is **deferred** to the ResultsScreen/ScorePanel surface plan, where it's actually reused (YAGNI). Not built here.
- The "Sign in with Google" button stays a bespoke *blocky* light button (spec §6.2: "Google — keep light but blocky"); it is **not** a `NeonButton` variant.
- **Environment quirk:** the nvm shell shim errors on `&&`-chained Bash commands (`__init_nvm:unalias:3: not enough arguments`). Run every `npm`/`npx`/`git` command as a **separate, un-chained** call; treat `__init_nvm` lines as noise.
- Work happens on the `feat/arcade-visual-overhaul` branch. Do **not** commit to `main`.

---

## File Structure

**Created:**
- `src/components/ui/NeonButton.tsx` — blocky neon button, variants `primary | go | danger | ghost | accent`, sizes, `fullWidth`.
- `src/components/ui/ArcadePanel.tsx` — recessed neon-edged card wrapper.
- `src/components/ui/PixelHeading.tsx` — uppercase pixel title with optional cyan glow + optional magenta underline rule.
- `src/components/ui/ScanlineOverlay.tsx` — `aria-hidden` absolute CRT scanline layer.
- `src/components/ui/index.ts` — barrel export for the kit.
- `tests/components/ui/NeonButton.test.tsx`
- `tests/components/ui/ArcadePanel.test.tsx`
- `tests/components/ui/PixelHeading.test.tsx`
- `tests/components/ui/ScanlineOverlay.test.tsx`

**Modified:**
- `tailwind.config.js` — `theme.extend` gains `colors.neon`, `colors.arcade`, `boxShadow.neon-*`/`panel-inset`, `fontFamily.pixel`/`sans`.
- `src/index.css` — add `.text-glow-*` utilities.
- `src/components/AuthScreen.tsx` — re-skin using the primitives (presentational only).

**Untouched (do not edit):** anything under `src/engine/`, `src/store/`, `src/components/Grid.tsx`, `src/components/GapShimmer.tsx`, `src/components/ArcadeLoader.tsx`.

---

## Task 1: Tailwind tokens + glow CSS utilities

Establish the design tokens. The fonts already load via `index.html`; `.font-pixel`, `.arcade-seg`, `.arcade-scanlines` already exist in `src/index.css`.

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/index.css`

- [ ] **Step 1: Extend the Tailwind theme**

Replace the contents of `tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './supabase/functions/_shared/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
      },
      boxShadow: {
        'neon-cyan': '0 0 8px rgba(34,211,238,0.55), 0 0 2px rgba(255,255,255,0.6) inset',
        'neon-magenta': '0 0 8px rgba(255,45,149,0.55)',
        'neon-green': '0 0 8px rgba(57,217,138,0.5)',
        'neon-red': '0 0 8px rgba(255,77,77,0.5)',
        'panel-inset': 'inset 0 0 14px rgba(0,0,0,0.6)',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Add glow text utilities to `src/index.css`**

Append below the existing `.arcade-scanlines` block (after line 36):

```css

/* Neon text glow utilities — cheap box-free text-shadow halos matching the
   neon color tokens. Pair with `.font-pixel` on titles/labels/numbers. */
.text-glow-cyan {
  text-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
}
.text-glow-magenta {
  text-shadow: 0 0 8px rgba(255, 45, 149, 0.6);
}
.text-glow-red {
  text-shadow: 0 0 8px rgba(255, 77, 77, 0.6);
}
.text-glow-yellow {
  text-shadow: 0 0 8px rgba(250, 204, 21, 0.6);
}
```

- [ ] **Step 3: Verify the build is clean**

Run: `npm run build`
Expected: PASS (tsc + vite build succeed; no `noUnusedLocals` errors). Treat any `__init_nvm` lines as noise.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js src/index.css
git commit -m "feat(ui): add arcade design tokens and neon glow utilities"
```

---

## Task 2: NeonButton primitive

Replaces the ~12 bespoke button styles. Blocky, pixel label, 2px variant-colored border + matching neon glow, hover brightens, `active:translate-y-px` press.

**Files:**
- Create: `src/components/ui/NeonButton.tsx`
- Test: `tests/components/ui/NeonButton.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NeonButton } from '../../../src/components/ui/NeonButton'

describe('NeonButton', () => {
  it('renders its label as a button (accessible name preserved)', () => {
    render(<NeonButton>Done ✓</NeonButton>)
    expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument()
  })

  it('defaults to the primary (cyan) variant', () => {
    render(<NeonButton>Play</NeonButton>)
    const btn = screen.getByRole('button', { name: /Play/i })
    expect(btn.className).toContain('border-neon-cyan')
    expect(btn.className).toContain('shadow-neon-cyan')
    expect(btn.className).toContain('font-pixel')
  })

  it('applies the go (green) variant classes', () => {
    render(<NeonButton variant="go">Go</NeonButton>)
    const btn = screen.getByRole('button', { name: /Go/i })
    expect(btn.className).toContain('border-neon-green')
    expect(btn.className).toContain('shadow-neon-green')
  })

  it('applies the danger (red) variant classes', () => {
    render(<NeonButton variant="danger">Sign Out</NeonButton>)
    expect(screen.getByRole('button', { name: /Sign Out/i }).className).toContain('border-neon-red')
  })

  it('adds w-full when fullWidth is set', () => {
    render(<NeonButton fullWidth>Wide</NeonButton>)
    expect(screen.getByRole('button', { name: /Wide/i }).className).toContain('w-full')
  })

  it('forwards disabled and onClick like a native button', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<NeonButton onClick={onClick}>Tap</NeonButton>)
    await user.click(screen.getByRole('button', { name: /Tap/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<NeonButton onClick={onClick} disabled>Tap</NeonButton>)
    expect(screen.getByRole('button', { name: /Tap/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ui/NeonButton.test.tsx`
Expected: FAIL — cannot resolve `../../../src/components/ui/NeonButton`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/NeonButton.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'go' | 'danger' | 'ghost' | 'accent'
type Size = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'border-neon-cyan text-neon-cyan shadow-neon-cyan hover:bg-neon-cyan/10',
  go: 'border-neon-green text-neon-green shadow-neon-green hover:bg-neon-green/10',
  danger: 'border-neon-red text-neon-red shadow-neon-red hover:bg-neon-red/10',
  accent: 'border-neon-magenta text-neon-magenta shadow-neon-magenta hover:bg-neon-magenta/10',
  ghost: 'border-arcade-edge text-gray-300 hover:border-neon-cyan hover:text-neon-cyan',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'py-2 px-3 text-[10px]',
  md: 'py-3 px-4 text-xs',
  lg: 'py-4 px-5 text-sm',
}

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  children: ReactNode
}

export function NeonButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: NeonButtonProps) {
  return (
    <button
      {...rest}
      className={[
        'font-pixel uppercase tracking-[0.08em] rounded-md border-2 bg-arcade-panel',
        'transition-colors active:translate-y-px',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/ui/NeonButton.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/NeonButton.tsx tests/components/ui/NeonButton.test.tsx
git commit -m "feat(ui): add NeonButton primitive"
```

---

## Task 3: ArcadePanel primitive

Recessed card: `bg-arcade-panel`, 2px `border-arcade-edge`, `shadow-panel-inset`, `rounded-md`. Replaces `bg-gray-900 border-gray-700 rounded-xl`.

**Files:**
- Create: `src/components/ui/ArcadePanel.tsx`
- Test: `tests/components/ui/ArcadePanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArcadePanel } from '../../../src/components/ui/ArcadePanel'

describe('ArcadePanel', () => {
  it('renders children', () => {
    render(<ArcadePanel><span>Inside</span></ArcadePanel>)
    expect(screen.getByText('Inside')).toBeInTheDocument()
  })

  it('applies recessed neon-edge panel classes', () => {
    render(<ArcadePanel data-testid="panel">x</ArcadePanel>)
    const el = screen.getByTestId('panel')
    expect(el.className).toContain('bg-arcade-panel')
    expect(el.className).toContain('border-arcade-edge')
    expect(el.className).toContain('shadow-panel-inset')
    expect(el.className).toContain('rounded-md')
  })

  it('merges a caller-supplied className', () => {
    render(<ArcadePanel data-testid="panel" className="p-6">x</ArcadePanel>)
    expect(screen.getByTestId('panel').className).toContain('p-6')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ui/ArcadePanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/ArcadePanel.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react'

interface ArcadePanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function ArcadePanel({ className = '', children, ...rest }: ArcadePanelProps) {
  return (
    <div
      {...rest}
      className={['bg-arcade-panel border-2 border-arcade-edge shadow-panel-inset rounded-md', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/ui/ArcadePanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ArcadePanel.tsx tests/components/ui/ArcadePanel.test.tsx
git commit -m "feat(ui): add ArcadePanel primitive"
```

---

## Task 4: PixelHeading primitive

Uppercase pixel title with optional cyan glow and optional magenta underline rule.

**Files:**
- Create: `src/components/ui/PixelHeading.tsx`
- Test: `tests/components/ui/PixelHeading.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PixelHeading } from '../../../src/components/ui/PixelHeading'

describe('PixelHeading', () => {
  it('renders an h1 by default with pixel + glow classes', () => {
    render(<PixelHeading>Mind The Gap</PixelHeading>)
    const h = screen.getByRole('heading', { level: 1, name: /Mind The Gap/i })
    expect(h.className).toContain('font-pixel')
    expect(h.className).toContain('text-glow-cyan')
  })

  it('honors the `as` tag (h2)', () => {
    render(<PixelHeading as="h2">Section</PixelHeading>)
    expect(screen.getByRole('heading', { level: 2, name: /Section/i })).toBeInTheDocument()
  })

  it('omits the glow class when glow is false', () => {
    render(<PixelHeading glow={false}>No Glow</PixelHeading>)
    expect(screen.getByRole('heading', { name: /No Glow/i }).className).not.toContain('text-glow-cyan')
  })

  it('adds a magenta underline rule when underline is set', () => {
    render(<PixelHeading underline>Ruled</PixelHeading>)
    expect(screen.getByRole('heading', { name: /Ruled/i }).className).toContain('border-neon-magenta')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ui/PixelHeading.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/PixelHeading.tsx`:

```tsx
import type { ReactNode } from 'react'

interface PixelHeadingProps {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3'
  glow?: boolean
  underline?: boolean
  className?: string
}

export function PixelHeading({
  children,
  as: Tag = 'h1',
  glow = true,
  underline = false,
  className = '',
}: PixelHeadingProps) {
  return (
    <Tag
      className={[
        'font-pixel uppercase tracking-[0.08em] text-neon-cyan',
        glow ? 'text-glow-cyan' : '',
        underline ? 'inline-block border-b-2 border-neon-magenta pb-1' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/ui/PixelHeading.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PixelHeading.tsx tests/components/ui/PixelHeading.test.tsx
git commit -m "feat(ui): add PixelHeading primitive"
```

---

## Task 5: ScanlineOverlay primitive

`aria-hidden` absolute CRT scanline layer for full-screen routes/menus. NOT for the game grid.

**Files:**
- Create: `src/components/ui/ScanlineOverlay.tsx`
- Test: `tests/components/ui/ScanlineOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ScanlineOverlay } from '../../../src/components/ui/ScanlineOverlay'

describe('ScanlineOverlay', () => {
  it('renders an aria-hidden absolute scanline layer', () => {
    const { container } = render(<ScanlineOverlay />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toBeTruthy()
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.className).toContain('absolute')
    expect(el.className).toContain('inset-0')
    expect(el.className).toContain('arcade-scanlines')
    expect(el.className).toContain('pointer-events-none')
  })

  it('merges a caller-supplied className', () => {
    const { container } = render(<ScanlineOverlay className="opacity-30" />)
    expect((container.firstElementChild as HTMLElement).className).toContain('opacity-30')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ui/ScanlineOverlay.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/ScanlineOverlay.tsx`:

```tsx
interface ScanlineOverlayProps {
  className?: string
}

export function ScanlineOverlay({ className = '' }: ScanlineOverlayProps) {
  return (
    <div
      aria-hidden
      className={['absolute inset-0 arcade-scanlines opacity-20 pointer-events-none', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/ui/ScanlineOverlay.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ScanlineOverlay.tsx tests/components/ui/ScanlineOverlay.test.tsx
git commit -m "feat(ui): add ScanlineOverlay primitive"
```

---

## Task 6: UI kit barrel export

Single import surface for the kit.

**Files:**
- Create: `src/components/ui/index.ts`

- [ ] **Step 1: Write the barrel**

Create `src/components/ui/index.ts`:

```ts
export { NeonButton } from './NeonButton'
export { ArcadePanel } from './ArcadePanel'
export { PixelHeading } from './PixelHeading'
export { ScanlineOverlay } from './ScanlineOverlay'
```

- [ ] **Step 2: Verify build + full test suite**

Run: `npm run build`
Expected: PASS (no unused-export/`noUnusedLocals` errors).

Run: `npm run test`
Expected: PASS — all existing tests plus the 15 new primitive tests green.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "feat(ui): add ui kit barrel export"
```

---

## Task 7: Re-skin AuthScreen with the primitives (validation surface)

Convert `AuthScreen` to use `PixelHeading`, `ArcadePanel`, and `NeonButton`, with a dark well + cyan focus ring on inputs. **Presentational only** — every existing assertion in `tests/components/AuthScreen.test.tsx` must still pass unchanged (button accessible names `^Sign in$`, `Create account`, `Google`, `Guest`; placeholders `Email`/`Password`; the inline error text; async-pending behavior).

**Files:**
- Modify: `src/components/AuthScreen.tsx`
- Reference (do not edit): `tests/components/AuthScreen.test.tsx`

- [ ] **Step 1: Confirm the AuthScreen tests pass before changes (baseline)**

Run: `npx vitest run tests/components/AuthScreen.test.tsx`
Expected: PASS (5 tests) — this is the regression baseline.

- [ ] **Step 2: Rewrite the component body**

Replace `src/components/AuthScreen.tsx` with:

```tsx
import { useState } from 'react'
import { signInAsGuest, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../lib/auth'
import { useNavStore } from '../store/navStore'
import { track } from '../store/asyncStatus'
import { NeonButton } from './ui/NeonButton'
import { ArcadePanel } from './ui/ArcadePanel'
import { PixelHeading } from './ui/PixelHeading'
import { ScanlineOverlay } from './ui/ScanlineOverlay'

export function AuthScreen() {
  const goJourney = useNavStore(s => s.goJourney)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, navigate: boolean) => {
    setError(null)
    setBusy(true)
    try {
      const { error } = await track(fn())
      if (error) { setError(error.message); return }
      if (navigate) goJourney()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy

  const inputClass =
    'w-full py-3 px-4 mb-3 rounded-md bg-arcade-well text-white placeholder-gray-500 ' +
    'border-2 border-arcade-edge focus:outline-none focus:border-neon-cyan ' +
    'focus:shadow-neon-cyan disabled:opacity-50'

  return (
    <div className="relative min-h-dvh bg-arcade-bg flex items-center justify-center px-4 overflow-hidden">
      <ScanlineOverlay />
      <div className="relative inline-flex flex-col items-stretch w-full max-w-sm text-center">
        <PixelHeading className="mb-3 text-2xl">Mind The Gap</PixelHeading>
        <p className="font-sans text-gray-400 mb-8">Sign in to start your journey.</p>

        <ArcadePanel className="p-5">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={busy}
            autoComplete="email"
            placeholder="Email"
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="current-password"
            placeholder="Password"
            className={inputClass}
          />
          <NeonButton fullWidth variant="primary" disabled={!canSubmit}
            onClick={() => run(() => signInWithEmail(email, password), true)} className="mb-3">
            Sign in
          </NeonButton>
          <NeonButton fullWidth variant="ghost" disabled={!canSubmit}
            onClick={() => run(() => signUpWithEmail(email, password), true)}>
            Create account
          </NeonButton>

          <div className="flex items-center gap-3 my-5">
            <span className="h-px flex-1 bg-arcade-edge" />
            <span className="font-pixel text-gray-500 text-[10px] uppercase tracking-[0.15em]">or</span>
            <span className="h-px flex-1 bg-arcade-edge" />
          </div>

          <button disabled={busy} onClick={() => run(signInWithGoogle, false)}
            className="w-full py-3 mb-3 rounded-md font-bold bg-gray-100 text-black hover:bg-gray-300 disabled:opacity-50 inline-flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
              <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
            </svg>
            Sign in with Google
          </button>
          <NeonButton fullWidth variant="go" disabled={busy}
            onClick={() => run(signInAsGuest, true)}>
            Play as Guest
          </NeonButton>

          {error && <p className="font-sans text-neon-red text-sm mt-4">{error}</p>}
        </ArcadePanel>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run the AuthScreen tests to verify no regression**

Run: `npx vitest run tests/components/AuthScreen.test.tsx`
Expected: PASS (5 tests) — accessible names, placeholders, error text, and async-pending behavior unchanged.

- [ ] **Step 4: Run the full suite + build + lint**

Run: `npm run test`
Expected: PASS (all green).

Run: `npm run build`
Expected: PASS.

Run: `npm run lint`
Expected: PASS (no eslint errors).

- [ ] **Step 5: Visual verification (Claude Preview MCP)**

Start the dev server and screenshot the auth route:
- `preview_start` (or reuse a running server) → load `http://localhost:5173`.
- The app boots on the auth screen when signed out. If needed, drive `window.__store` / `window.__async` per spec §8 to land on it.
- Confirm the pixel font is actually applied: `preview_eval` → `document.fonts.check("11px 'Press Start 2P'")` should return `true`.
- `preview_screenshot` the auth screen. Verify against the north star (`ArcadeLoader`): cyan pixel wordmark with glow, recessed neon-edged panel, blocky neon buttons (cyan Sign in, ghost Create account, green Play as Guest), dark-well inputs with cyan focus ring, faint scanlines behind the panel (not over it illegibly). Google button stays light + blocky.

- [ ] **Step 6: Commit**

```bash
git add src/components/AuthScreen.tsx
git commit -m "feat(ui): re-skin AuthScreen with arcade primitives"
```

---

## Self-Review (completed during planning)

- **Spec coverage (§3–§4):** §3.1 tokens → Task 1. §3.2 typography → encoded in primitives (`font-pixel`, `uppercase`, `tracking`, `font-sans` for body) and applied in Task 7. §3.3 primitives `NeonButton`/`ArcadePanel`/`PixelHeading`/`ScanlineOverlay` → Tasks 2–5; `NeonBar` explicitly deferred (optional, reused later). §3.3 component CSS classes (`.text-glow-*`) → Task 1. §4.1 Tailwind extend → Task 1. §4.2 css utilities → Task 1. §4.3 primitives + light tests → Tasks 2–6. §4.4 validate on AuthScreen + screenshot → Task 7.
- **Hard constraints (§5):** no edits to `Grid.tsx`, `GapShimmer.tsx`, `pieces.ts`, store, routing — none of those files appear in this plan. AuthScreen change is class-string + structure-preserving (same buttons, placeholders, handlers, layout wrapper `inline-flex flex-col items-stretch w-full max-w-sm`).
- **Placeholder scan:** every code step contains full, runnable code; no TBD/TODO.
- **Type consistency:** `NeonButton` props (`variant`, `size`, `fullWidth`) used in Task 7 match Task 2's definition; variant names (`primary|go|ghost`) match. Barrel exports (Task 6) match component export names.
- **Test-name preservation:** AuthScreen accessible names unchanged (`Sign in`, `Create account`, `Sign in with Google`, `Play as Guest`), placeholders unchanged — existing `tests/components/AuthScreen.test.tsx` stays green.
```