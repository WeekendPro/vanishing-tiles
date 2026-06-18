# Phosphor × Afterglow — Production Rollout Design

**Date:** 2026-06-18
**Status:** Draft for review
**Branch:** `phosphor-brand` (rename + re-skin land together — see Decisions)

## Goal

Roll the **Afterglow** design system into the live app **and** complete the **Gap City → Phosphor**
rename, as one coordinated, incremental, non-destructive rollout to production. Every surface ends
up in the Afterglow language under the Phosphor name, shipped in small, independently-revertible
steps.

## Source material (already produced)

- **Design system spec:** [`docs/design/phosphor-design-system.md`](../../design/phosphor-design-system.md)
- **Component library / mockups:** `design-system/` (11 cards) + `mockups/stagger-afterglow.html`, plus
  Afterglow screens for **Auth**, **Pause**, **Game Over**, and the reworked **Infinite Stagger** /
  **gap-cell**. Synced to Claude Design project **Phosphor**.
- **Brand bible:** [`docs/design/phosphor-brand.md`](../../design/phosphor-brand.md) — name, tagline, lexicon, voice.
- **Rename plan:** [`docs/superpowers/plans/2026-06-18-phosphor-rename.md`](../plans/2026-06-18-phosphor-rename.md) — player-facing string scope. **Folded into this rollout.**

## Non-destructive principle

Git is the history. We do **not** keep `*_old.tsx` shadow copies — they rot and confuse. Instead:

- Each surface is replaced in a **focused, single-purpose commit** so the diff itself is the record.
- Any prior version is one `git revert <sha>` or `git show <sha>:path` away.
- Work proceeds on `phosphor-brand`; each phase below is a self-contained commit (or PR) that keeps
  `npm run test`, `npm run build`, and `npx tsc --noEmit` green and ships a preview screenshot as proof.
- No phase leaves the app in a half-themed broken state — tokens land first so every later step renders
  correctly even before it's individually restyled.

## Current-state facts (from survey)

- **Styling:** Tailwind + tokens in [`tailwind.config.js`](../../../tailwind.config.js) and
  [`src/index.css`](../../../src/index.css) (existing `neon.*` / `arcade.*` palette, glow/scanline utilities,
  `pixel`/`display` fonts). A global restyle is a token swap + utility update.
- **Lives:** Stagger already starts at **5** (`STAGGER.START_LIVES` in [`src/lib/staggerCurve.ts`](../../../src/lib/staggerCurve.ts));
  Journey/Practice use `MAX_LIVES = 3` (`supabase/functions/_shared/core/scoring.ts`). Hearts render as a
  fixed row in `StaggerScreen.tsx` and `GameShell.tsx`. A `BriefingPhase` hardcodes "3 lives".
- **Screens exist:** Home (`HomeScreen.tsx`), Auth (`AuthScreen.tsx`), Pause (Stagger's own overlay +
  `GlobalMenu.tsx`), Stagger (`StaggerScreen.tsx` + `staggerStore.ts`, phases idle/countdown/reveal/selecting/gameOver).
- **Routing:** Zustand `AppView` enum in `navStore.ts`, switched in `App.tsx`. No React Router.
- **Wordmark:** `src/components/ui/Wordmark.tsx` renders "Gap City"; used by Home + Auth.

## Architecture / approach

### 1. Foundation — Afterglow tokens (must land first)

Remap the Tailwind theme **values** to the Afterglow palette while keeping class **names** stable where
sensible, to minimize churn:

- Colors: `void/panel/panel-raised/grid-line/filled/filled-edge` + semantic `magenta/cyan/amber/red/lime`
  (per the spec's token table). Keep the `neon.*`/`arcade.*` keys as aliases pointing at the new values so
  existing classes keep working during migration; new code uses the semantic names.
- `index.css`: the two-layer glow recipe, `scanlines`, vignette, the `attack/decay/mechanical` easings, and
  the **bloom** keyframe. Fonts: pixel (Silkscreen/Press Start 2P), 7-seg/mono (Departure Mono), Space Grotesk.
- Outcome: the whole app shifts toward Afterglow at the primitive level in one commit; later phases refine
  per-screen layout/copy.

### 2. Shared `LivesCounter` (♥×N)

New `src/components/ui/LivesCounter.tsx` rendering a single red ♥ glyph + `×N` (mono, tabular). Replaces the
fixed heart rows in `StaggerScreen.tsx` and `GameShell.tsx`. Props: `lives: number` (+ optional `size`).
Counts are **unchanged** (Stagger 5, Journey/Practice 3). The display scales past 5 with no layout change —
this is the only piece built for the future earn-a-life reward system; that system itself is **out of scope**.

### 3. Infinite Stagger — the soul (re-skin + behavior)

- Re-skin to the Afterglow Stagger screen (HUD, full-bleed timer bar with phase colors, sunken bezel board,
  lit tray, action row).
- **Reveal:** gaps bloom **per shape** — all 4 cells of a tetromino light together, hold, then decay and
  **re-seal into the surface** (staggered cascade across shapes). Implemented as grouping by shape, not by cell.
- **Recall uniformity rule:** at recall the whole board drops to one uniform lights-out tone; no gap leaves a
  readable hole. Correct picks bloom lime; misses shake + red.
- Drop in `LivesCounter`. Keep Replay/Pause confined here (Pause overlay = Resume + Exit only).

### 4. Screen re-skins (one commit each, in order)

`Auth` → `Pause overlay` → `Game Over` → then `Home` → `Journey/Practice` surfaces last. Each matches its
Afterglow mockup. Player-facing copy moves off **"Gaps"** → **"shapes"**, and de-emphasizes **batches**
(Game Over stats become **Shapes recalled / Best combo / Accuracy**).

### 5. Rename (folded in, per the rename plan)

Apply player-facing string changes alongside the re-skins: `Wordmark.tsx` → PHOSPHOR, `index.html` title,
`package.json` name, "Gap City cleared" → "Journey cleared", "GAP CITY" in `MentalMapBrain`, CLAUDE.md header,
auth tagline "Memory glows. Then it's gone." Keep `localStorage` keys `gapcity:*` unchanged (avoid wiping
player progress). Slugs (`the_hollows`/`the_stacks`/`the_grid`) and historical docs/migrations untouched.

## Rollout sequence (each = green tests + build + preview screenshot)

1. **Tokens & fonts** — Afterglow palette + utilities + easings + bloom keyframe in `tailwind.config.js` / `index.css`.
2. **LivesCounter** — component + tests; swap into Stagger & GameShell; remove "3 lives" hardcode.
3. **Infinite Stagger** — re-skin + shape-grouped reveal + lights-out recall + uniformity.
4. **Auth** — re-skin + PHOSPHOR wordmark + tagline + guest flow.
5. **Pause** — Afterglow overlay (Resume / Exit), lights-dimmed board.
6. **Game Over** — re-skin + new stat trio + "Memory fades".
7. **Home** — re-skin to Afterglow.
8. **Rename sweep** — remaining player-facing strings per rename plan; wordmark everywhere.
9. **Journey / Practice** — secondary surfaces brought into Afterglow last.

Steps are ordered so the highest-value, lowest-risk work (tokens, then the headline Stagger experience) lands
first, and secondary modes last. Any step can ship or revert on its own.

## Testing

- `npm run test` + `npm run build` (catches `noUnusedLocals`) + `npx tsc --noEmit` green before each commit.
- New unit tests: `LivesCounter` (renders ♥×N for N = 0,1,5,6+) and the reveal shape-grouping helper
  (groups map to correct tetromino cells; a group lights together).
- Manual proof: a preview screenshot per phase attached to its commit/PR.

## Out of scope (non-goals)

- The earn-extra-lives **reward system** (only the ♥×N display is built now, forward-compatible).
- Drag-and-drop placement, React Native port, leaderboard persistence.
- Renaming `localStorage` keys, DB slugs, or rewriting historical docs/migrations.
- Journey/Practice **balance** changes (their starting lives stay at 3).

## Decisions (resolved)

- **Rename folded into the redesign** — one coordinated rollout on `phosphor-brand`.
- **♥×N everywhere, counts unchanged** — shared `LivesCounter`; Stagger 5 / others 3.
- **Mock-first screens:** Auth, Pause, Game Over (done + approved); Home re-skinned without a separate mock.
- **Terminology:** player-facing copy uses **"shapes"**, not "gaps"; **batches de-emphasized**.
- **Auth tagline** "Then it's gone." / **Game Over** "Memory fades." (complementary, not duplicated).

## Open questions

- None blocking. (Future: define the reward-system rules when that work begins.)
