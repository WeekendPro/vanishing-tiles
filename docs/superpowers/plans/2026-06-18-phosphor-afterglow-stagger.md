# Phosphor Afterglow — Infinite Stagger Re-skin Implementation Plan

> **For agentic workers:** Execute task-by-task. This is a visual + behavioral re-skin of one screen; the **pixel target is the approved mockup** `mockups/stagger-afterglow.html` (and `design-system/screens/infinite-stagger.html`). Iterate against the live preview (dev server `puzzle-game`, port 5179) — screenshot, compare to the mockup, adjust. Keep all existing Stagger tests green.

**Goal:** Re-skin `src/components/StaggerScreen.tsx` into the Afterglow language (consuming the `phos.*` tokens + `index.css` primitives already landed), and convert the board to the phosphor model: magenta **shape-bloom** reveal that decays & re-seals, **lights-out uniform** recall, and a phase-colored timer bar.

**Architecture:** All changes are in `StaggerScreen.tsx` (+ its sub-components `StaggerBoard`, `PieceTray`, `StaggerCountdown`). No store/logic changes to the game rules — only the reveal *driver* mechanism changes (from an opacity toggle to applying the `.phos-bloom` animation class). Use `phos-*` Tailwind classes and `.phos-*` CSS utilities; do not touch `neon.*`/`arcade.*` tokens (other screens still use them).

**Tech Stack:** React, TypeScript, Tailwind (phos tokens live), framer-motion, Zustand. Verify: `npm run test`, `npm run build`, `npx tsc --noEmit`, and live preview screenshots. **Run each npm/npx command as its own Bash call (no `&&` chaining — nvm quirk).**

---

## Visual source of truth

Open `mockups/stagger-afterglow.html` in the browser and match it. Key facts from it and the design spec (`docs/design/phosphor-design-system.md`):

- **Ground:** near-black void, sunken bezel around the board.
- **Filled board cells:** inert graphite (`.phos-filled` — gradient `#3A3E4F→#2A2D3A`, inset shadow). Never glow.
- **Reveal:** each gap's cells bloom magenta **together** (`.phos-bloom`), hold, then decay and **re-seal to graphite** — never a darker hole. Staggered across gaps.
- **Recall (selecting):** the whole board drops to ONE uniform lights-out tone (`.phos-dim`, `#0c0c14`). Gaps are concealed; only the player's correct picks light up.
- **Timer bar:** magenta while revealing (filling) → amber while recalling (draining) → red pulse under 25% → lime on a clear.
- **Combo:** lime burst (was yellow).
- **Buttons:** Replay = amber lit; Pause = slim cyan. Pause overlay = Resume + Exit only.

---

### Task 1: Re-skin the screen chrome (HUD, timer bar, labels, buttons, overlays)

**Files:** Modify `src/components/StaggerScreen.tsx`

- [ ] **Step 1: Background + HUD.** Change the root `bg-arcade-bg` to the Afterglow ground (`bg-phos-void` + the `.phos-vignette` feel). Score numerals → `font-silk text-phos-cyan text-glow-phos-cyan`. Replace the `gaps` label word "gaps" with "shapes" in the fraction (`{filled} / {total} shapes`). Keep `<LivesCounter lives={lives} />`.

- [ ] **Step 2: Timer bar phase colors.** The bar currently uses `barColor: 'magenta' | 'green'`. Extend to cover the Afterglow states: reveal = `bg-phos-magenta` + `shadow-phos-magenta`; selecting = `bg-phos-amber` + `shadow-phos-amber`, and when `barPct < 25` during selecting, switch to `bg-phos-red` + a `≤3Hz` pulse; cleared = `bg-phos-lime` + `shadow-phos-lime`. Implement by computing the bar color class from phase + barPct + cleared (extend the existing `barColor` state to `'magenta' | 'amber' | 'red' | 'lime'`, set it where the driver sets the old values).

- [ ] **Step 3: Phase label, combo, buttons.** Phase label `text-phos-dim`. Combo burst: `text-phos-lime` + lime drop-shadow (was `text-neon-yellow`). Replay button → amber (`border-phos-amber text-phos-amber shadow-phos-amber`); Pause slim button → cyan hover. Countdown numerals → `text-phos-cyan`.

- [ ] **Step 4: Pause overlay + Game Over overlay.** Pause overlay: `bg-phos-void`, "PAUSED" in `font-silk text-phos-cyan text-glow-phos-cyan`, Resume + Exit (unchanged set). Game Over overlay: re-skin to the game-over mockup look — label "Game Over" + a faint "Memory fades" line + final score in `font-silk text-phos-amber`, **Play again** (cyan) + **Home** (ghost). (The richer stat trio — Shapes recalled / Best combo / Accuracy — is the separate Game Over screen phase; for now keep score only, drop the "reached batch N" line to de-emphasize batches.)

- [ ] **Step 5: Verify chrome.** `npm run test` (all pass). `npm run build`. `npx tsc --noEmit`. Live preview: drive to Stagger, screenshot each phase, compare to mockup. Commit: `style(stagger): re-skin chrome to Afterglow (HUD, timer, buttons, overlays)`.

---

### Task 2: Convert the board to the phosphor model

**Files:** Modify `StaggerBoard` and the reveal driver in `src/components/StaggerScreen.tsx`

- [ ] **Step 1: Board surface tones.** In `StaggerBoard`, change the bezel to a near-black (`bg-[#04040a]`). Empty cells: render `.phos-filled` (graphite) during reveal/countdown, and `.phos-dim` during selecting (lights-out). Filled/placed cells keep their piece color via `getPieceColor(piece)` but add a soft glow ring (these are the correct picks lighting out of the dark — keep piece identity; do NOT change to lime). Pass the current `phase` (or a `recall` boolean) into `StaggerBoard` so it picks `.phos-filled` vs `.phos-dim` for empty cells.

- [ ] **Step 2: Reveal driver → shape-bloom.** Replace the opacity-toggle reveal (the `revealOn`/`revealIndex` `setRevealOn(true/false)` mechanism, and the dashed-cyan `revealing` overlay in `StaggerBoard`) with: for each gap in sequence, apply `.phos-bloom` to ALL of that gap's cells at once (a whole tetromino blooms together), keyed so the animation (re)starts; advance to the next gap after `holdMsForBatch(batchIndex)` + a short inter-shape gap; advance the bar one step per gap. Because `.phos-bloom` forwards-fills to the graphite surface (identical to `.phos-filled`), past gaps re-seal seamlessly — no readable hole remains. Keep the `350ms` pre-roll breath and the `beginSelecting()` handoff. Preserve the existing cancellation/cleanup (`cancelled` + timers).

- [ ] **Step 3: Recall uniformity check.** During `selecting`, confirm every empty cell renders `.phos-dim` (one identical tone) — no cell darker/lighter than its neighbours, so the gap pattern is unreadable. Only placed (piece-color) cells differ. (This matches the existing "board reads solid during recall" intent, restyled.)

- [ ] **Step 4: Verify board.** `npm run test`. `npm run build`. `npx tsc --noEmit`. Live preview: watch a full reveal → recall → clear cycle; confirm (a) each shape blooms together as a recognizable tetromino, (b) shapes decay and re-seal (board uniform between/after blooms), (c) recall board is uniform lights-out, (d) correct picks light up. Screenshot reveal + recall + clear. Commit: `feat(stagger): phosphor board — shape-bloom reveal, lights-out recall`.

---

### Task 3: Final verification

- [ ] **Step 1:** `npm run test` (all pass), `npm run build` (no `noUnusedLocals`), `npx tsc --noEmit` (clean).
- [ ] **Step 2:** Remove any now-unused imports/state left from the old reveal mechanism (e.g. `STAGGER.FADE_MS` usage, `revealOn` if fully replaced) — let `npm run build` catch unused locals; clean them up.
- [ ] **Step 3:** Capture a reveal frame (a tetromino mid-bloom), a recall frame (uniform lights-out + a couple lime/colored placed picks), and a clear frame for the review/PR.

---

## Notes
- Existing Stagger tests (`tests/components/` — search for stagger/FlashReveal/GameOverReveal etc.) must keep passing; if a test asserts an old class like `border-neon-cyan` on a reveal cell, update it to the new bloom class **only if** the test is asserting visual styling that legitimately changed, and keep its behavioral intent.
- Do not alter `staggerStore.ts` game logic. This is presentation only.
- The richer **Game Over** screen (stat trio, "New best", etc.) and the **Auth/Pause/Home** re-skins are SEPARATE later tasks (the parallel fan-out) — do not build them here.
