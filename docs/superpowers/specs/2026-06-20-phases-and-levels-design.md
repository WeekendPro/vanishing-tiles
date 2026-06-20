# Phases & Levels — structuring the Infinite run

**Status:** Draft / design proposal (awaiting calibration)
**Scope:** Infinite (Stagger) mode only. Journey, Practice, and the Git Map are untouched.
**Date:** 2026-06-20

---

## Why

The Infinite run currently escalates one global difficulty curve forever
(`staggerCurve.ts`: `gapCount = 3 + floor(batchIndex/2)`). Around batch ~9 the
challenge stops *changing* — it only gets *harder* on the same axis (more
tetrominoes to hold in working memory). The brain goes numb; engagement falls
off a cliff.

The fix is to break the run into **Phases**: bands of levels that periodically
swap the *kind* of memory the run tests, each opening with a gentle on-ramp so
the player gets to breathe and recalibrate before the screws tighten again.

## Vocabulary change

| Old term (code/UI) | New term | Meaning |
|---|---|---|
| `batchIndex` / "Phase {n}" HUD label (`StaggerScreen.tsx:493`) | **Level** | One reveal→recall round. Displayed `00, 01, 02 …` |
| *(new concept)* | **Phase** | A band of levels sharing one mechanic + theme |

So "Phase 2" in today's HUD becomes "**Level 01**", and "Phase" is promoted to
the higher grouping. The tens digit of the level number *is* the phase index
(Level 1X → Phase 2, Level 2X → Phase 3), which keeps the mental model legible.

> Note: `StaggerPhase` (the flow-state enum `'reveal' | 'selecting' | …`) is an
> unrelated internal type. To avoid a name clash we rename it `RunStep` (or
> similar) as part of this work.

## Phase bands (proposed calibration)

10-level bands. Each phase **restarts the gap-count ramp from a low floor** so
the first level or two of a phase is a breather, then climbs back up.

| Phase | Levels | Theme | Mechanic | Memory tested |
|---|---|---|---|---|
| 1 | 00–09 | **Classic** | Tetromino shape recall (today's game) | Spatial / shape |
| 2 | 10–19 | **Emoji** | Single-cell emoji tiles; recall which icons | Associative / iconic |
| 3 | 20–29 | **Chromatic** | Colored gaps; recall the colors, not shapes | Color |
| 4 | 30–39 | **Sequential** *(deferred)* | order-aware recall | Sequence |
| 5+ | 40+ | *remix / loop, TBD* | combine prior mechanics | — |

Level **00** is a one-time **instructional tutorial** (see below); on later runs
the run still starts at Level 00 but skips the guided steps.

Carried over unchanged across all phases: **combos** (×N streak scoring),
**earn-a-life every 5 000 pts** (`STAGGER.LIFE_EVERY`), shared life pool, the
reveal-bloom → recall-tray loop, speed bonus.

## Phase 1 · Classic — Level 00 tutorial (first run only)

Mockup: `mockups/ramp-up-tutorial.html`

1. Normal countdown → **reveal**: two *different* pieces bloom (an O and a T).
2. **Recall**: board lights out, tray appears. The screen **dims** (scrim) and
   the one correct piece is **spotlit** with a pulsing ring + a beckoning tap
   pointer. Coach caption: *"You saw this tile. Tap it."*
3. On the correct tap: a short success beat (lime pop + "+100" sparkle, the gap
   fills on the board). Coach: *"One more — tap the tile you saw."*
4. Spotlight the second piece, tap, success.
5. **Welcome card** → continues into Level 01.

Wrong taps during the tutorial are *nudged* (shake), never penalized.

**Gating:** a `settingsStore` flag `tutorialSeen` (localStorage). First ever run
plays the guided Level 00; afterwards Level 00 runs as a normal (very easy)
classic level.

### Welcome copy — options to pick from

- A. *"Nicely done — you've got the eye for it. Now catch the tiles before they fade."*
- B. *"That's the trick. From here the tiles vanish faster — trust your memory."*
- C. *"You're ready. Watch, remember, recall — and don't blink."*
- D. *"Perfect. The Vanishing Tiles won't wait for you now. Good luck."*

## Phase 2 · Emoji

Mockup: `mockups/phase-intros.html`

- Opens with a **phase-intro overlay** over the board: *"Phase 1 cleared → Emoji
  Tiles. New tiles, same instinct."* (tap to continue).
- Reveal blooms **single-cell emoji tiles** instead of tetrominoes. Set of 7:
  🍎 🍊 🌮 🍼 🥪 💡 🍾 (1:1 with the 7 tray slots, mirroring today's 7 pieces).
- Recall tray shows the 7 emojis; a pick is correct iff an unfilled tile of that
  emoji remains — identical resolution logic to shape-matching, with emoji
  identity standing in for piece type.
- Slightly steeper starting gap-count floor than Phase 1 (icons are quick to
  read, so the breather is shorter).

## Phase 3 · Chromatic

Mockup: `mockups/phase-intros.html`

- Phase-intro overlay: *"Chromatic — forget the shape, remember the colors."*
- Gaps are tetromino-shaped and bloom in **full color** (the 5 gap palette hues
  from `gapPalette.ts`: cyan / magenta / green / purple / yellow).
- Recall tray shows **5 color swatches**, not shapes. A pick is correct iff an
  unfilled gap of that color remains; shape is irrelevant. This is a *simpler*
  cousin of the existing `colorCoded` theme (which matches color **and** shape).

## Open calibration questions

1. **Band width** — 10 levels/phase (clean tens-digit mapping) vs 8 (matches the
   ~level-9 numbness point more tightly).
2. **Emoji semantics** — single-cell identity-recall tiles (proposed) vs emoji
   merely reskinning tetromino shapes (shape recall continues).
3. **Phase-1 length** — keep Classic at a full 10 before the first theme swap, or
   introduce Emoji sooner (e.g. Phase 1 = 00–07) to relieve the numbness earlier.

## Implementation sketch (first 3 phases)

- `src/lib/phases.ts` — `PHASES` table (`{ index, name, levels, mechanic, theme,
  intro }`), `phaseForLevel(level)`, `levelLabel(level)` → "07".
- `staggerCurve.ts` — gap ramp becomes phase-relative (reset floor per phase);
  `allowedTypesForBatch` generalized to "what tiles/colors this level draws from".
- `staggerStore.ts` — add `mechanic` to batch generation; emoji/color resolution
  variants alongside shape matching. Rename `StaggerPhase` → `RunStep`.
- `StaggerScreen.tsx` — "Phase N" label → "Level NN"; add phase-intro overlay,
  tutorial coach layer, emoji/color trays + boards.
- `settingsStore.ts` — `tutorialSeen` flag.
- Tests for `phaseForLevel`, per-phase difficulty floors, emoji/color resolution.
