# Hard Mode — Impasto "Glossy Black Paint" Reveal

**Date:** 2026-06-20
**Status:** Approved (design)
**Surface:** Staggered Vanishing Tiles (`StaggerScreen.tsx`), Hard difficulty only.

## Summary

Replace Hard mode's bright-magenta gap reveal with a **heavy graphite "impasto" paint
bloom** — deep near-black tiles with a glossy, ridged sheen that barely lift off the dark
void. Inspired by the heavy glossy black paint / dream-sludge in the TV show *Severance*.
The low-contrast murk becomes the defining challenge of Hard.

Easy (per-piece color) and Medium (uniform magenta) reveals are **unchanged**.

Visual reference: `mockups/hard-mode-paint-impasto.html` (final),
`mockups/hard-mode-paint-bloom.html` and `mockups/hard-mode-paint.html` (exploration).

## Behavior

The reveal keeps the existing rhythm exactly: each gap's cells flash together, hold ~1s,
then decay back into the void in a per-cell diagonal wave; gaps cascade `REVEAL_STEP_MS`
apart. Only the *look* of a Hard gap changes, plus its *speed*:

- **Surface:** graphite impasto — a layered gradient (`#20202b → #121219 → #08080d`) with
  radial ridge highlights and an inset gloss, self-colored (no `--bloom-color` flood).
- **"Bright at first":** because the base is near-black, the flash reads as a
  **brightness boost + a soft halo** (not a color flood) at the peak, then settles to the
  murky surface for the hold, then decays to the void tone (`#0c0c14`).
- **No glare/sheen sweep.** The moving specular streak trialled in the mockups is dropped —
  the brightness pop alone carries the flash.
- **Speed:** Hard plays at **normal reveal speed** — the `HARD_REVEAL_SCALE` (×0.62) time
  compression is removed. Murky tiles are the whole added difficulty.

## Implementation

### `src/index.css`
Add `.vt-paint` + `@keyframes vtPaint`, mirroring `.vt-bloom`'s mechanics so the existing
per-cell `animation-duration` wave and reduced-motion handling carry over:
- Resting/peak surface = the impasto gradient + box-shadow from the final mockup.
- Keyframe: `0%` void/dark → `4%` brightness ~1.9 + halo (flash) → `52%` settled surface
  (~1s hold) → `70/88%` opacity fade → `100%` back to `#0c0c14` void.
- `prefers-reduced-motion`: static impasto surface, no animation (matches `.vt-bloom`).

### `src/components/StaggerScreen.tsx`
- Add a `paint: boolean` to `Bloom` and to the `bloomByCell` entries; set it `true` when
  `difficulty === 'hard'`.
- In `StaggerBoard`, a `paint` bloom renders `className="… vt-paint"` (no `--bloom-color`);
  otherwise the existing `vt-bloom` + `--bloom-color` path is used.
- In the reveal driver, set `const scale = 1` (remove `HARD_REVEAL_SCALE` usage and the
  constant). `colorFor` is unused for Hard but harmless to keep.

## Out of scope / unchanged

- Easy and Medium reveals (color + magenta), all timing for those tiers.
- Gap counts and every other Hard difficulty knob.
- Selecting/recall phase, scoring, lives.

## Verification

- `npm run test` (all pass) and `npm run build` (catches `noUnusedLocals` — ensure the
  removed constant leaves no dangling reference).
- Visual check in-app on Hard: reveal is murky graphite, flashes readably, decays in the
  wave, plays at normal speed; Easy/Medium look identical to before.
