# Git Map — design spec

**Date:** 2026-06-15
**Status:** Approved (iterated via `mockups/tracks-gitgraph.html`)
**Branch:** `feat/git-map`

## Summary

A new Journey **map style** called **Git Map** that reorganizes the journey as a
git-style commit graph. `main` is **The Classic**; each other puzzle type
(**Chromatic / Sequential / Glimpse**) is a branch that sprouts off the graph once
you clear the branch commit. Each **point is a single puzzle**; clearing it grows a
path to the next point. The Git Map has its **own streamlined gameplay flow**,
distinct from the existing level-hub Journey and the Practice gauntlet, both of
which are **left functioning exactly as they are**.

The goal: reduce decision friction. The player digs into one track, and at branch
commits gains access to a new puzzle type — all while staying in-game as much as
possible (play → instructions → countdown → puzzle → next/home/replay).

This is the neon visual direction (pixel-art was explicitly rejected).

## What ships

1. A new `MapStyle = 'git'` selectable from the global menu as **"Git Map"**,
   alongside the existing Subway and Mental maps. The other maps are untouched.
2. A `GitMap` component (port of `mockups/tracks-gitgraph.html`): a pan/zoom SVG
   canvas of commit nodes, sprouted paths, rounded branch curves, a metadata card
   on the selected node, and a bottom dock (legend + zoom controls).
3. The Git Map's distinct play flow, reusing the existing round engine:
   **tap node → Play → instruction (briefing) page → countdown → puzzle →
   resolution** with a **Home / Replay / Next Level** end screen.
4. **Removal** of the in-code Mental Map (Complex): delete `MentalMapComplex.tsx`
   and the `'mentalBrainComplex'` map style + menu entry. Its `map-brain-*.html`
   mockups are **kept**.

## Track catalog (client-side)

The Git Map catalog is a **client-side config** (`src/lib/gitMap.ts`), matching the
existing "client progress, mocked global record" pattern. It is not in the DB and
does not touch `get_journey` / `get_level`.

| Track key   | Label        | Puzzle (component) | Levels | Branch                |
|-------------|--------------|--------------------|--------|-----------------------|
| `classic`   | The Classic  | `main`             | 45     | — (entry / `main`)    |
| `chromatic` | Chromatic    | `colors`           | 38     | from The Classic · 9  |
| `sequential`| Sequential   | `inSequence`       | 44     | from The Classic · 15 |
| `glimpse`   | Glimpse      | `flash`            | 51     | from Chromatic · 12   |

`component` reuses `COMPONENT_THEME` (`main→basic`, `colors→colorCoded`,
`inSequence→sequential`, `flash→flashMob`) so the engine already produces the right
puzzle variant per track.

A track is **available** when its parent's branch level is cleared (recursively).
`classic` is always available.

## State & progress (reuse)

- **Node id:** `git:${track}:${level}` (e.g. `git:classic:14`), used as the
  `progressStore` `levelId`. The track's `component` is the `ComponentKey`.
- **Cleared:** `getLevel(id).best[component] > 0`.
- **Best %:** `getLevel(id).best[component]` (0–100, the existing `componentScore`).
- **Current node** on a track = the lowest level that is not cleared (the playable
  head), but only if the track is available.
- **Sprouted path** between level *k* and *k+1* exists iff level *k* is cleared.
  A **branch sprout** (parent commit → child level 1) exists iff the parent's
  branch level is cleared. This is what produces "only dots until you progress":
  unavailable tracks render as a loose, pathless constellation of nodes.

No new persistence layer — `progressStore` (localStorage `gapcity:progress:v1`) is
reused as-is.

## Difficulty — stretched curve

A node's difficulty stretches the 15-rung `DIFFICULTY_TABLE` across the track's full
height, so each track's **final level hits the hardest rung**:

```
index = round( (level - 1) / (floors - 1) * (DIFFICULTY_TABLE.length - 1) )
gitDifficulty(track, level) = DIFFICULTY_TABLE[index]
```

(`src/lib/gitMap.ts`.) This gives an even ramp regardless of track length, rather
than plateauing at level 15.

## Gameplay flow

Reuses the existing **journey** round machinery (`mode: 'journey'`) plus a small
**git context** so navigation differs. Per play: **3 lives**, one puzzle round,
scored 0–100 via `componentScore` (same as level-hub components).

New gameStore state:
- `gitTrack: TrackKey | null`, `gitLevel: number | null` — non-null ⇒ a Git Map play.

New gameStore actions:
- `startGitLevel(track, level)` — set `gitTrack`/`gitLevel`, `activeComponent` =
  track component, `levelDifficulty` = `gitDifficulty(track, level)`,
  `levelId` = node id, `levelDisplayNumber` = level, `levelName` = track label;
  reset lives; `startGame()`.
- `nextGitLevel()` — start the next level on the same track if it exists.
- `replayGitLevel()` — restart the same node fresh (full lives, new puzzle).

`startGitLevel` opens the **briefing** page (unless the player opted out of this
puzzle's instructions, honoring the existing `hideBriefing` setting), then countdown,
then the puzzle — identical to the level-hub flow.

### End-of-round CTAs (Git context)

In `ResolutionPhase`, when `gitTrack` is set, the three buttons are:
- **Home** → `navStore.backToMap()` (returns to the Journey screen, which renders the
  Git Map because the style is `'git'`).
- **Replay** → on a failed attempt with lives left, `retryComponent()` (same board);
  otherwise `replayGitLevel()` (fresh puzzle).
- **Next Level** → `nextGitLevel()` (stays in `playing`; runs briefing→countdown→
  puzzle for the next node). Shown when the round was solved (or out of lives) **and**
  a next level exists on the track.

The existing non-git journey CTA (More Puzzles / Replay / Next Level via `levelOrder`)
and the Practice CTA are unchanged.

### Briefing back button (Git context)

`GameShell`'s briefing back button routes to `backToMap()` when `gitTrack` is set
(no level hub exists), instead of `openLevel(levelId)`.

### Top metadata bar (Git context)

When `gitTrack` is set, the bar reads simply **`CLASSIC | LEVEL 14`** (track label +
node level), avoiding the `@ levelName` hub framing.

## Navigation entry

`GitMap` node **Play** → `startGitLevel(track, level)` then `navStore.enterPlaying()`.
Tapping a node selects it and shows its metadata card (Best %, difficulty pips,
Play/Replay). Only **cleared** and **current** nodes are selectable/playable; loose
(unreached) nodes are inert.

`JourneyScreen` renders `<GitMap … />` when `mapStyle === 'git'`. The Git Map manages
its own pan/zoom and does not use the existing transit legend (it has its own dock).

## Files

**New**
- `src/lib/gitMap.ts` — track catalog, geometry (node positions, lanes, branch
  curves), `gitDifficulty`, and progress derivation (cleared/current/available,
  sprouted segments) over `progressStore`.
- `src/components/JourneyMap/GitMap.tsx` — the pan/zoom canvas component.

**Changed**
- `src/store/settingsStore.ts` — add `'git'` to `MapStyle`; remove
  `'mentalBrainComplex'`.
- `src/components/GlobalMenu.tsx` — add "Git Map" entry; remove "Mental Map (Complex)".
- `src/components/JourneyScreen.tsx` — render `GitMap` for `'git'`; drop
  `MentalMapComplex` import/branch; hide the transit legend for the Git Map.
- `src/store/gameStore.ts` — add `gitTrack`/`gitLevel` state + `startGitLevel` /
  `nextGitLevel` / `replayGitLevel`; ensure git context is reset by `resetGame` and
  preserved across the round loop.
- `src/components/GameShell.tsx` — git-aware briefing back button + metadata bar.
- `src/components/ResolutionPhase/index.tsx` — git-aware end-screen CTAs.

**Removed**
- `src/components/JourneyMap/MentalMapComplex.tsx` (mockups kept).

## Testing

- `gitMap.ts` unit tests: `gitDifficulty` endpoints (level 1 → rung 0; final level →
  last rung) per track; availability recursion; current-node selection; sprouted-
  segment derivation from a mocked progress map (including "all dots when unreached").
- gameStore tests: `startGitLevel` sets component/difficulty/id and opens
  briefing/countdown; `nextGitLevel` advances and stops at the track top;
  `replayGitLevel` resets lives.
- All existing tests must still pass (other maps + level-hub + practice unchanged).

## Out of scope (deferred)

- Server-backed Git Map catalog/progress (mock client-side for now).
- Tuning track lengths / branch points / difficulty curve.
- Pixel-art skin (rejected).
- Cross-fade/animation polish of path sprouting in-app (the mockup's one-time growth
  animation is a nice-to-have, not required for v1).
