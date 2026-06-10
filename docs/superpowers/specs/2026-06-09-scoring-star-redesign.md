# Scoring Star Redesign — Design Spec

**Date:** 2026-06-09
**Branch:** `scoring-star-redesign`
**Mockup:** `mockups/scoring-star.html` (open via the `mockups` launch config → http://localhost:8099/scoring-star.html)

## Summary

Polish the Journey **gameplay screen** and replace the per-component **scoring screen**
with an animated gold "shooting star" that visualizes the score being earned. The flat
score card (`ComponentScorePanel`) is removed entirely — the star *is* the score. The
scoring rubric changes so the animation maps cleanly onto the math. Bottom actions become
an icon-only button grid, which also fixes a layout bug where the pinned CTAs overlapped
and hid the old score card.

This spec covers Journey mode. Practice mode (legacy 4-round gauntlet) shares `GameShell`
and inherits the metadata-bar / timer / lives changes, but its scoring screen
(`ScorePanel`) and rubric are **unchanged**.

---

## 1. Metadata bar (`src/components/GameShell.tsx`)

The sticky top bar currently shows: level name + component label, the running score, and
a hearts (lives) row.

**Changes:**
- **Level label (Journey):** render `NN: Level Name`, where `NN` is the
  `levelDisplayNumber` zero-padded to two digits (e.g. `01: Vacant Heights`).
- **Component suffix:** if `activeComponent` is **not** `main`, append a dim divider and
  the component label → `01: Vacant Heights | True Colors`. For `main`, show **no** suffix
  (just `01: Vacant Heights`). Divider is a literal pipe `|` rendered in a dim color
  (`text-arcade-edge`) with horizontal padding.
- **Remove the score** readout from this bar.
- **Remove the hearts** (`Hearts` component) from this bar. The `Hearts` helper is deleted
  from `GameShell` (lives now render below the timer — see §3).
- **Practice mode:** keeps its `ROUND N / 4` label, but also loses the score readout and
  the hearts (shared bar). Lives still render in the new row (§3).

## 2. Timer bar is never a loader (`src/components/GameShell.tsx`)

The 1.5px slot beneath the metadata bar currently renders a `TrickleBar` loader when
`submitting`, otherwise the real `ProgressBar` countdown. Reusing the timer's position as
a loader undercuts the timer's credibility.

**Changes:**
- Remove the `submitting ? <TrickleBar> : …` branch. The timer slot **only** ever holds
  the real `ProgressBar` (shown during `viewing`/`selecting`), or nothing.
- When `submitting` is true, show the **official full-screen loader** instead: render
  `<ArcadeLoader active={submitting} />` (the same loader `GlobalLoadingOverlay` uses).
  Update the stale comment in `GlobalLoadingOverlay.tsx` that says the in-game submit
  "drives the GameShell timer slot instead".
- `TrickleBar` import is removed from `GameShell`. (The `TrickleBar` component file may
  remain unused for now; removing the file is out of scope.)

## 3. Lives row + remove memorize text

**Lives row (`GameShell.tsx`):**
- Add a **horizontally-centered lives row** directly under the timer slot and above the
  board, shown during `viewing` and `selecting` (the phases where the board is the focus).
  It renders `livesRemaining` filled hearts out of `MAX_LIVES` (reusing the same
  filled/empty heart glyphs the old top-bar `Hearts` used).
- Not shown during `countdown` (full-screen flourish, no board) or `resolving` (the star
  animation consumes the lives — see §5).

**Remove memorize text (`src/components/ViewingPhase.tsx`):**
- Delete the `Memorize the gaps` line. A dedicated helper screen will replace the
  countdown in later work; until then the viewing phase shows no instructional copy.
- The `Ready →` button stays.

## 4. Scoring rubric (`src/lib/journeyScoring.ts`)

Replace the current `completion (50 − 10·livesLost) + time (up to 50)` model with one
where **star fill % equals the score** and lives/time map directly to the animation:

```
livesRemaining = MAX_LIVES − livesLost            // 3 / 2 / 1 on a solve
score = 20 × livesRemaining + 40 × (1 − consumed/allotted)
score = clamp(ceil(score), 0, 100)
```

- Each life remaining at the moment of the successful solve contributes **+20**
  (max 60 for 3 lives).
- Leftover time contributes **up to +40**, scaled by the fraction of the clock saved
  (`1 − consumed/allotted`). Same `consumed`/`allotted` inputs as today (allotted =
  `viewDuration + selectDuration`, or `selectDuration` only for Don't Blink / flash).
- Unsolved (all lives lost) = **0**, unchanged.
- Cap remains 100. Level total (0–500) and level-star thresholds
  (`levelStarsFromTotal`: 150/250/350/450) are **unchanged** — they still sum per-component
  bests.

**Constants:** introduce `LIFE_VALUE = 20` and `TIME_MAX = 40`. The old
`COMPLETION_BASE = 50`, `LIFE_PENALTY = 10`, `SPEED_MAX = 50` are removed (or repurposed).
`componentScore()` is rewritten accordingly. `ComponentScoreInput` keeps its shape
(`solved`, `livesLost`, `consumed`, `allotted`).

**Tests:** `journeyScoring` tests are updated to the new math. Representative cases:
- 3 lives, instant solve (consumed≈0): `60 + 40 = 100`.
- 3 lives, half the clock used: `60 + 20 = 80`.
- 1 life left, instant solve: `20 + 40 = 60`.
- Unsolved: `0`.

## 5. Star animation (new component; Framer Motion)

A new component (e.g. `src/components/ResolutionPhase/ScoreStar.tsx`) renders on the
**Journey success** path in place of `CelebrationBadge` + `ComponentScorePanel`. It sits
over the dimmed board, centered, exactly where the old badge sat. Variant chosen:
**Drop arrival + abstract leftover-time**. (Practice success keeps `CelebrationBadge` — the
star is Journey-only.)

**Beats:**
1. **Arrival:** the gold star **drops in from above and springs** to a stop
   (spring/overshoot easing). It is a hollow gold star outline with a faint gold track
   inside and `0` rendered in the center (pixel font, white with shadow).
2. **Lives land:** for each life remaining, a heart token **floats up** from the lives-row
   position to the star center and lands with a **spark** burst. On each landing:
   - star fill rises by **+20%** (fill animates from the bottom up, clipped to the star
     shape — same technique as `RibbonBadge`'s `ScoreStar`),
   - the center number counts up by **+20**,
   - a brief settle pulse on the star.
3. **Leftover time:** after the lives land, the fill and number rise smoothly to the final
   score over a short eased tween, with **sparkles** raining into the star (abstract — **no
   seconds counter, no time ring**). Final fill = final score %.
4. **Settle:** a final pulse / glow; the star rests at the final fill with the final score
   inside.

**Reduced motion:** when `useReducedMotion()` is true, skip the choreography — render the
star at its final fill with the final score immediately (mirrors the existing reduced-motion
path in `ResolutionPhase`).

**Data:** the component receives `livesRemaining` and the final `score` (`roundScore.total`).
It derives the per-life fill steps (20 each) and the residual time portion (final −
20×livesRemaining) for the final tween. It does not recompute the score — `journeyScoring`
remains the single source of truth.

**Integration:** in `ResolutionPhase/index.tsx`, the existing stage machine
(`measuring → flying → badge → scoring → cta`) keeps driving the piece fly-in. On the
**success** path, the `badge`/`scoring` stages render `ScoreStar` instead of
`CelebrationBadge` + `ComponentScorePanel`. The CTA appears after the star settles. The
**failure** path is unchanged (see §7).

## 6. Score card removed + icon button grid (`src/components/ResolutionPhase/`)

**Remove the card:**
- Delete `ComponentScorePanel.tsx` and its usage. The success scoring screen shows only:
  dimmed board + `ScoreStar` + the cart (selection record) + the icon button grid. No
  name / completion / speed / level-total / stars rows. (Level total and level stars
  remain visible on the level hub `LevelScreen`.)

**Icon button grid (Journey CTAs):**
- Replace the stacked full-width `NeonButton`s with an **icon-only grid row**. Icons:
  - **‹ back chevron** → Back to Level (`openLevel(levelId)`)
  - **⟳ repeat/recycle** → Play Again (`replayComponent`) on success / out-of-lives, and
    **Try Again** (`retryComponent`) on a failure with lives left
  - **› forward chevron** → Next Level (`goNextLevel`), only when `hasNextLevel()`
- **Layout:** when all three apply, a 3-column grid; when only two apply (no next level, or
  failure-with-lives = Try Again + Back), **center the two** evenly sized — no empty slot.
- Buttons keep the arcade panel style (bordered, neon accent per action: back = edge/zinc,
  repeat = cyan, forward = green) and carry accessible labels (`aria-label`) since the text
  is gone.
- This removes the bottom-pinned-overlap bug: with no tall card to occlude, the action row
  sits cleanly below the star.

**Button case matrix (Journey):**

| State | Buttons (left → right) |
|---|---|
| Solved, next level exists | ‹ Back · ⟳ Play Again · › Next |
| Solved, no next level | ⟳ Play Again · ‹ Back (centered two) |
| Failure, lives remaining | ⟳ Try Again · ‹ Back (centered two) |
| Failure, out of lives, next level exists | ‹ Back · ⟳ Play Again · › Next |
| Failure, out of lives, no next level | ‹ Back · ⟳ Play Again (centered two) |

**Ordering rule:** the row is always, left → right, `‹ Back · ⟳ Repeat · › Next`, simply
dropping whichever action doesn't apply. Chevrons keep their natural direction (back points
left, next points right). So two-button cases read `‹ Back · ⟳ (Play/Try) Again`, centered.

## 7. Failure case (unsolved, 0 lives)

- Keep today's `PartialBadge` tier treatment (amber **So Close!** ≥66%, red **Tough Round**
  33–66%, red **Yikes** <33%) — only the SUCCESS path gets the star.
- The score card removal (§6) and the icon button grid (§6) **do** apply to the failure
  screen. The partial badge replaces the star; the icon buttons replace the stacked CTAs.

---

## Out of scope / unchanged

- Practice mode scoring (`ScorePanel`, `@shared/core/scoring`) and its rubric.
- The countdown helper-screen rework (future chunk).
- Level-hub (`LevelScreen`) star/total display and `RibbonBadge`.
- Removing the `TrickleBar` component file (left in place, just unused by `GameShell`).
- Drag-and-drop, sound, and other deferred POC items.

## Components touched

| File | Change |
|---|---|
| `src/components/GameShell.tsx` | New label format; remove score+hearts; remove TrickleBar branch; full-screen loader on submit; add centered lives row |
| `src/components/GlobalLoadingOverlay.tsx` | Update stale comment (submit now uses the full-screen loader) |
| `src/components/ViewingPhase.tsx` | Remove "Memorize the gaps" line |
| `src/lib/journeyScoring.ts` | New rubric: `20 × livesRemaining + 40 × timeSaved`; new constants |
| `src/components/ResolutionPhase/ScoreStar.tsx` | **New** — Framer Motion star animation (drop + lives + abstract time) |
| `src/components/ResolutionPhase/index.tsx` | Render `ScoreStar` on success; remove `ComponentScorePanel`; icon button grid |
| `src/components/ResolutionPhase/ComponentScorePanel.tsx` | **Deleted** |
| `src/components/ResolutionPhase/CelebrationBadge.tsx` | **Unchanged** — still used by the Practice success path; `ScoreStar` supersedes it only in the Journey branch |
| Tests | `journeyScoring` rubric tests updated; new `ScoreStar` behavior tests where sensible |

## Verification

Before claiming done: `npm run test`, `npm run build`, `npm run lint` all pass. Use
`useShallow` for any new Zustand object selector. Manually verify the live scoring screen
(Journey → station → Play → solve) shows the star building to the correct score and the
icon buttons behave across the case matrix.
