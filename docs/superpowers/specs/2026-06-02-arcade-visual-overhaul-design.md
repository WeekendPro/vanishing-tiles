# Arcade Visual Overhaul — Design Spec

**Date:** 2026-06-02
**Status:** Approved (aesthetic direction); ready for planning
**Audience:** A fresh Claude instance that will turn this into implementation plan(s) and execute them.

---

## 0. How to use this document

The visual *direction* is already chosen and approved by the product owner. The
canonical reference for the look — the "north star" — is the **already-shipped
loading overlay**: `src/components/ArcadeLoader.tsx` plus the arcade utilities in
`src/index.css` (`.font-pixel`, `.arcade-seg`, `.arcade-scanlines`). Open the app,
trigger the loader (see §9), and match *that* feel everywhere.

This is a large effort spanning every screen. **Do not implement it as one plan.**
Start with the **design-system foundation** (§4) as the first plan, get it merged,
then apply it surface-by-surface (§6) in follow-up plans. Use the
`superpowers:writing-plans` skill for each. Each plan must keep the full test
suite green (`npm run test`) and the build/lint clean (`npm run build`,
`npm run lint`) — see §8.

**Environment quirk:** the nvm shell shim errors on `&&`-chained Bash commands
(`__init_nvm:unalias:3: not enough arguments`). Run every `npm`/`npx`/`git`
command as a separate, un-chained call; treat `__init_nvm` lines as noise.

---

## 1. Goal

Make the *entire* app look and feel like a modern arcade cabinet — the same
language as the new loading overlay: **dark CRT background, cyan neon as the
brand color, the `Press Start 2P` pixel font, glow, segmented/blocky chrome, and
faint scanlines.** Today the app is a competent but generic dark-mode UI
(gray-950 pages, gray-900 cards, rounded-xl, blue/green/gray buttons, system
font). We are re-skinning it into a cohesive retro-arcade identity **without
changing behavior, game rules, or layout structure.**

This is a **presentational** overhaul. No game logic, store shape, routing, or
API surface changes.

---

## 2. Approved aesthetic (the look we're matching)

- **Background:** near-black `#030712` (keep `bg-gray-950`), with optional deep
  vignette/scanline treatment on full-screen routes.
- **Brand / primary accent:** cyan `#22d3ee` (this is now THE color — it already
  appears on the viewing timer, countdown, theme labels, and the loader).
- **Arcade pop / secondary accent:** magenta `#ff2d95` — used *sparingly* for
  emphasis (active states, special tags, headings underline). Not a default.
- **Reward:** yellow `#facc15` (scores, stars) — unchanged.
- **Type:** `Press Start 2P` pixel font for short UI strings (titles, labels,
  numbers, buttons, badges). A clean sans stays for multi-word body/meta text
  (see §3.2 — pixel fonts hurt readability in paragraphs).
- **Form language:** blocky. Crisper corners (`rounded-md`/`rounded-sm`, not
  `rounded-xl`/`2xl`), 2px neon-tinted borders, recessed inset shadows on panels,
  outer neon glow on interactive/active elements, faint CRT scanlines on
  overlays and chrome (never over the game grid — see §5).

---

## 3. Design system

### 3.1 Color tokens

Extend Tailwind (`tailwind.config.js`, currently `theme.extend: {}`). Proposed:

```js
theme: {
  extend: {
    colors: {
      neon: {
        cyan:    '#22d3ee',
        magenta: '#ff2d95',
        green:   '#39d98a', // "go" / success, brightened toward neon
        red:     '#ff4d4d', // danger
        yellow:  '#facc15', // reward / score
      },
      arcade: {
        bg:    '#030712', // page
        panel: '#060d12', // recessed panel fill (matches loader frame)
        edge:  '#0e2b33', // dim cyan-tinted border
        well:  '#0c1f25', // "off" segment / inset well
      },
    },
    boxShadow: {
      'neon-cyan':    '0 0 8px rgba(34,211,238,0.55), 0 0 2px rgba(255,255,255,0.6) inset',
      'neon-magenta': '0 0 8px rgba(255,45,149,0.55)',
      'neon-green':   '0 0 8px rgba(57,217,138,0.5)',
      'neon-red':     '0 0 8px rgba(255,77,77,0.5)',
      'panel-inset':  'inset 0 0 14px rgba(0,0,0,0.6)',
    },
    fontFamily: {
      pixel: ['"Press Start 2P"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      // keep a clean sans for body text:
      sans:  ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
    },
  },
}
```

**Semantic mapping (keep the existing learnability):**

| Role | Now | After |
|------|-----|-------|
| System / memorize / loading | cyan | **neon cyan** (unchanged hue, add glow) |
| Primary "go" CTA (PLAY, Done ✓, Next Round) | green | **neon green** + glow + pixel label |
| Danger (Sign Out, fail badge, hearts, reject ✕) | red | **neon red** + glow |
| Reward (score, stars) | yellow | **neon yellow** (unchanged) |
| Special emphasis / active | — | **neon magenta**, used sparingly |
| Warning (So Close!, retry) | amber | keep amber, treat as a neon |

Keep cyan = "system/memorize" and green = "go" distinct (they already split this
way) so the timer/loader never reads as a CTA.

### 3.2 Typography & scale

`Press Start 2P` is wide, uppercase-feeling, and unreadable in long runs. **Rule:**

- **Pixel font (`font-pixel`, UPPERCASE, generous `tracking`):** wordmark, screen
  titles, section labels, button labels, scores/numbers, badge text, countdown.
  Cap effective size sensibly — pixel glyphs read best at 10–14px for labels and
  large (≥32px) for hero numbers; avoid the awkward middle for long strings.
- **Sans (`font-sans`):** any multi-word body, helper text, level meta rows
  ("Your Best", "Last played"), error explanations, form placeholders.

Suggested scale (pixel unless noted):
- Wordmark / hero: `text-2xl`–`text-3xl` pixel.
- Screen title: `text-base`–`text-lg` pixel.
- Section label: `text-[10px]`–`text-xs` pixel, `tracking-[0.15em]`, uppercase.
- Button label: `text-xs`–`text-sm` pixel.
- Hero number (countdown digit, big score): `text-6xl`+ pixel.
- Body/meta: `text-sm` sans; helper: `text-xs` sans.

### 3.3 Reusable primitives (build these first)

Create a small UI kit in `src/components/ui/`. Each is presentational, typed, and
unit-light. These replace the ad-hoc class strings catalogued in §6.

- **`NeonButton`** — `variant: 'primary' | 'go' | 'danger' | 'ghost' | 'accent'`,
  `size`, `fullWidth`. Blocky (`rounded-md`), pixel label, 2px border in the
  variant color, `shadow-neon-*`, hover brightens, `active:translate-y-px` press.
  Replaces the ~12 bespoke button styles. Preserve the CLAUDE.md rule:
  full-width buttons match the grid width (382px) via the existing
  `inline-flex flex-col items-stretch` wrapper.
- **`ArcadePanel`** — recessed card: `bg-arcade-panel`, 2px `border-arcade-edge`,
  `shadow-panel-inset`, `rounded-md`. Replaces `bg-gray-900 border-gray-700 rounded-xl`.
- **`PixelHeading`** — uppercase pixel title with optional cyan glow
  (`text-shadow`), optional magenta underline rule.
- **`ScanlineOverlay`** — `absolute inset-0 arcade-scanlines opacity-20`,
  `aria-hidden`. Drop into full-screen routes/menus (NOT the grid).
- **`NeonBar`** (optional) — a reusable segmented power-meter row factored out of
  `ArcadeLoader` if it gets reused (e.g., styling `ProgressBar`/score bars).

Add matching CSS component classes to `src/index.css` if a class is cleaner than a
component (e.g. `.text-glow-cyan { text-shadow: 0 0 8px rgba(34,211,238,.6) }`).

---

## 4. First plan: design-system foundation (no visible feature change)

The first implementation plan establishes the system **without** redesigning
screens yet, so it can land safely:

1. Extend `tailwind.config.js` per §3.1 (fonts already load via `index.html`).
2. Add glow/text utilities + any component classes to `src/index.css`.
3. Build `src/components/ui/` primitives (§3.3) with light tests (render +
   variant class presence).
4. Pick **one** low-risk surface to validate the kit end-to-end — recommend the
   **AuthScreen** (self-contained, already has buttons + inputs + a title).
   Convert it to the primitives and screenshot-verify.

Merging this proves the system before the broad rollout.

---

## 5. Hard constraints (do not break these)

- **Tetromino piece colors are gameplay semantics — do NOT change their hues.**
  `getPieceColor()` in `src/engine/pieces.ts` maps I=cyan, O=yellow, T=purple,
  S=green, Z=red, J=blue, L=orange, SINGLE=gray. They already read as neon arcade
  colors. You may add a *subtle* uniform glow to placed cells, but the hues and
  their distinctness must remain identical (colorblind-adjacent pairs like
  S-green/Z-red must stay separable).
- **Grid legibility (`src/components/Grid.tsx`).** The filled (`bg-slate-600`),
  empty-gap (`bg-gray-800 border-gray-600`), placed (piece color), and preview
  (`bg-blue-400/50`) cell states are load-bearing for play. Keep them clearly
  distinct. **No scanline overlay, heavy glow, or vignette over the board** — it
  must stay crisp under time pressure. (Mirror the existing rule that scanlines
  are disabled over `GapShimmer`.)
- **`GapShimmer` stays.** It's a tuned gameplay aid (cool-white masked sweep). Do
  not recolor or obscure it.
- **Countdown timing & pre-roll, viewing/selecting timer behavior, all phase
  transitions** are unchanged — restyle only.
- **No layout restructuring.** Keep the mobile-first single-column layout,
  `max-w-sm`/`max-w-md` content widths, and the 382px grid-matched button width.
- **Behavior parity.** Every existing test must still pass with at most
  class-string updates (very few tests assert on classes/text — see §8).

---

## 6. Surface-by-surface application map

Apply after the foundation lands. Each is a candidate for its own small plan (or
group 2–3 closely related ones). For each surface: swap bespoke classes for the
primitives, apply pixel type per §3.2, add glow/scanlines per §3, screenshot.

1. **Global chrome**
   - **Wordmark:** "Mind The Gap" → pixel, uppercase, cyan glow (JourneyScreen
     header, AuthScreen title). Consider a magenta underline rule.
   - **`GlobalMenu`** (`src/components/GlobalMenu.tsx`): already a full-screen
     dark gradient; convert action items to pixel type, add a `ScanlineOverlay`,
     neon hover states (cyan for normal, red for Sign Out). Hamburger icon → neon.
2. **AuthScreen** (`src/components/AuthScreen.tsx`) — pixel title, `ArcadePanel`
   card, `NeonButton` for Sign in (primary/cyan), Create account (ghost), Guest
   (go/green), Google (keep light but blocky). Inputs: dark well + cyan focus ring.
3. **JourneyScreen** (`src/components/JourneyScreen.tsx`) — theme section labels
   → pixel; level cards → `ArcadePanel` mini, cyan border on hover, neon for
   cleared (✓) and PR. Locked themes keep the dimmed/🔒 treatment.
4. **LevelDetailScreen** (`src/components/LevelDetailScreen.tsx`) — modal becomes
   an `ArcadePanel` with neon edge + scanlines; PLAY → `NeonButton` go variant
   with glow. Meta rows stay sans for readability.
5. **ResultsScreen** + **ResolutionPhase ScorePanel** — score numbers → pixel
   with glow; the accuracy/speed/efficiency/attempts bars restyled toward the
   segmented power-meter look (reuse `NeonBar` concept). Totals = hero pixel.
   CTAs (`NextRoundButton`, Try Again, Back to Map) → `NeonButton` variants.
6. **GameShell header** (`src/components/GameShell.tsx`) — Level/Round, score,
   hearts → pixel/neon. Hearts (`♥`) get a red glow. Keep the timer slot exactly
   as-is (`ProgressBar` / in-game `TrickleBar` — already on-brand cyan/green).
7. **CountdownPhase** (`src/components/CountdownPhase.tsx`) — already close
   (cyan glow digits). Switch the rounded font to pixel; keep the framer-motion
   scale/fade. This is a good template for the hero-number treatment.
8. **Badges** — `CelebrationBadge` / `PartialBadge`: keep the existing glow
   shadows and motion; switch label text to pixel and align glow colors to the
   neon tokens.
9. **Phase buttons** — ViewingPhase "Ready →", SelectingPhase "Done ✓",
   error-alert button → `NeonButton`. Piece menu / selected-piece chips
   (`SelectingPhase`) → blocky neon selection state (active = magenta or cyan
   ring) while preserving the piece shapes/colors.

---

## 7. Portability & performance notes

- **React Native is the eventual target** (per CLAUDE.md). Keep visual decisions
  expressed as **tokens** (Tailwind theme + the `ui/` primitives) rather than
  scattered inline CSS, so an RN port can mirror the tokens. Don't hand-roll
  web-only tricks where a token/primitive is just as easy. This is guidance, not
  a mandate to abstract prematurely — the POC stays web.
- **Performance:** prefer cheap `box-shadow` glows over `filter: blur()`; use a
  single fixed `ScanlineOverlay` per route rather than many; the segmented
  animation is CSS-keyframe driven (cheap). Avoid stacking large blur + many
  animated glows on the gameplay screens.
- **Google Fonts:** `Press Start 2P` is already loaded via `index.html`
  (`<link>` + preconnect). For offline/RN later, consider self-hosting; out of
  scope now.

---

## 8. Testing

- The suite is **behavioral**, not snapshot-based; most tests assert on text and
  roles, not classes. Re-skinning should keep them green. Known text/asserts to
  watch: `data-testid="arcade-loader"`/`"trickle-bar"`, button names via role
  (`/PLAY/i`, `/Retry/i`, `/Done/i`, `/Sign in/i`), star/heart glyphs. If you
  rename a label, update the matching test.
- For each plan: `npm run test` (all green), `npm run build` (catches
  `noUnusedLocals` that `tsc --noEmit` misses), `npm run lint`.
- **Visual verification:** use the Claude Preview MCP. The dev build exposes
  `window.__store` (game store) and `window.__async` (async-status store) — set
  `__async.setState({ pending: 1 })` to force the loader; drive `__store` to land
  on any phase — then screenshot. Confirm the pixel font actually loads
  (`document.fonts.check("11px 'Press Start 2P'")`).
- Add light unit tests for new `ui/` primitives (renders, variant → expected
  class/glow). Don't over-test presentational detail.

---

## 9. Reference / north star

- **Canonical look:** `src/components/ArcadeLoader.tsx` + the arcade utilities in
  `src/index.css`. This is the approved Option A ("segmented power meter") the
  owner signed off on ("the font, color, overall visual effect is perfect").
- To see it live: `npm run dev`, then in the page console / preview eval:
  `window.__async.setState({ pending: 1 })`.
- The exploratory mockups live (gitignored) under
  `.superpowers/brainstorm/arcade-loading/loading.html` if still present;
  the shipped component supersedes them as the source of truth.

---

## 10. Out of scope

- Game logic, scoring, difficulty, store shape, routing, API — untouched.
- Layout/IA changes, new screens, new navigation.
- Sound effects (a natural arcade companion, but deferred).
- Accessibility hardening (ARIA/keyboard) — remains on the project's deferred
  list; just don't *reduce* contrast below legible.
- Changing tetromino piece hues or grid cell semantics.
- React Native port (guidance only here).
```
