# Journey Rework — Level Hub, Opt-in Badges, Simplified Scoring

**Date:** 2026-06-08
**Status:** Approved design, pre-implementation
**Supersedes:** the multi-round gauntlet behavior introduced in `7389d31 feat(journey): play all 4 themed rounds per level`

---

## 1. Summary

Journey mode today forces a 4-round gauntlet per level (`basic → colorCoded →
sequential → flashMob`) with three pooled lives and an aggregate score out of ~9000
mapped to 1–3 stars. This is too complex: the player must switch puzzle styles
back-to-back with no breathing room, and the level can only be cleared by surviving
all four.

This rework breaks the gauntlet apart:

- A level becomes a **hub page** (replacing today's level-detail modal).
- The level is completed by solving **one main puzzle** (the old `basic` theme).
- The other three themes become **opt-in badges** (Colors, In-Sequence, Flash), plus a
  new **Riddle** badge (placeholder for now). Badges add points and drive the star
  rating but are never required to complete the level.
- Scoring is simplified to a per-component **0–100** with a transparent
  completion + speed formula. A level totals up to **500** (5 components × 100) and
  maps to a **0–5 star** rating.

Persistence is **hybrid**: the existing level *catalog* RPCs stay as-is; the new
per-component best scores live in the client + localStorage. Global records are mocked
for now. This keeps the UI-iteration loop fast and leaves a clean seam to wire full
Supabase persistence later.

Out of scope: Training-mode simplification, Daily Challenge, the real Riddle mechanic,
and real global records / streaks.

---

## 2. Concepts & vocabulary

- **Component** — a single playable puzzle within a level. One of:
  `main · colors · inSequence · flash · riddle`. These map onto the existing
  `RoundTheme` values (`basic / colorCoded / sequential / flashMob`) plus a new
  `riddle` stub.
- **Play** — one attempt-session at a single component (countdown → viewing →
  selecting → resolving → result). Has its own 3 lives. Replayable freely.
- **Component score** — 0–100 result of a play (see §6).
- **Level total** — sum of the *best* component scores for that level (0–500).
- **Stars** — 0–5 rating derived from the level total (see §6).
- **Earned badge** — a badge component whose best score > 0.

---

## 3. Navigation & screens

```
Map (JourneyScreen, unchanged)
  └─ tap station ──► Level page (LevelScreen)         ← replaces LevelDetailScreen modal
                       ├─ Play (main) ─────► Play loop ─► Component result ─► back to Level page
                       └─ Badge tap ───────► Play loop ─► Component result ─► back to Level page
```

### 3.1 Level page (`LevelScreen`)

Full screen, not a modal. Sections:

1. **Header** — level name · difficulty pips (1–5) · current star rating (0–5).
2. **Metadata row** — Global Record (mocked) · Personal Record (best level total) ·
   Stars · Last Played.
3. **Play** — primary CTA running the **main** puzzle. Once played, shows the main's
   best component score.
4. **Badge row** — four badges in fixed display order: **Colors · In-Sequence · Flash ·
   Riddle**. Each shows its icon, name, and best score / earned state. State rules:
   - All four are **locked** (with a lock affordance) until the **main puzzle is
     solved** (main best > 0).
   - **Riddle** is always shown as a **"Coming soon" placeholder** — visible but not
     playable in this iteration.
   - Once unlocked, badges are playable in **any order** and **replayable freely**.

### 3.2 Component result screen

Replaces the old aggregate `ResultsScreen` level summary. Shown after every play
(main or badge). Contents:

- Component name and solved/failed state.
- Score breakdown: **base** (after lives lost) · **speed bonus** · **component total**.
- Updated **level total** and **star rating**, with a star-up beat when it improves.
- First time the **main** puzzle is solved: a **"Badges unlocked!"** message.
- CTAs: **Play Again** (re-roll the same component) · **Back to Level** (return to the
  hub) · **Next Level** (go to the next station's Level page; only when a next level
  exists and is unlocked — otherwise hidden/disabled).

---

## 4. The play loop

A play targets exactly one component. There is **no** multi-round iteration.

```
startPlay(levelId, component)
  → countdown → viewing → selecting → resolving → component result
```

- A **fresh puzzle** is generated each play, at the level's difficulty profile, with the
  component's twist applied (color-matching for Colors, ordering for In-Sequence, forced
  flash reveal for Flash; main has no twist).
- Replaying a component **re-rolls** the puzzle. Best score per component is what counts.

---

## 5. Lives & failure

- **3 lives per play.**
- A **wrong submission** costs 1 life and **retries the same puzzle on a fresh clock**
  (timer resets; speed is measured on the successful attempt only).
- Each lost life lowers the completion base by 10: **65 → 55 → 45**.
- Losing the **3rd life** without solving → the component scores **0** for this play.
  There is **no game-over**: the player simply returns to the result screen / hub and may
  replay. Best score is unaffected by a failed play.

---

## 6. Scoring

### 6.1 Component score

When a play is **solved**:

```
livesLost  = number of wrong submissions before the successful one   // 0, 1, or 2
base       = 65 − 10 × livesLost                                     // 65 / 55 / 45
consumed   = time used on the successful attempt
allotted   = full time budget for the attempt (see below)
speedBonus = 35 × (1 − consumed / allotted)        // clamped to [0, 35]
score      = clamp(ceil(base + speedBonus), 0, 100)
```

When a play is **not solved** (0 lives): `score = 0`.

**Allotted time** per component:

| Component    | Allotted = consumed clock        |
|--------------|----------------------------------|
| main         | viewDuration + selectDuration    |
| colors       | viewDuration + selectDuration    |
| inSequence   | viewDuration + selectDuration    |
| riddle       | viewDuration + selectDuration    |
| flash        | selectDuration only              |

(Flash forces the reveal, so viewing time is not "spent" by the player.)

Worked example: main, no lives lost, 10% of the clock consumed →
`speedBonus = 35 × 0.9 = 31.5`, `score = ceil(65 + 31.5) = 97`.

Note: 100 is unreachable in practice because some time is always consumed.

### 6.2 Level total & stars

- **Level total** = sum of best component scores across all five components (max 500).
- **Stars** (0–5):

  | Stars | Condition           |
  |-------|---------------------|
  | 0     | main not solved     |
  | 1     | main solved (>0)    |
  | 2     | level total ≥ 150   |
  | 3     | level total ≥ 250   |
  | 4     | level total ≥ 350   |
  | 5     | level total ≥ 450   |

  Because main alone caps at 100, **badges are the only way past 1 star**.

### 6.3 Difficulty pips

A 1–5 difficulty rating derived **client-side** from the level's profile (already
delivered by `get_level`: `gap_count`, `shape_complexity`, `adjacency`). Primary driver
is `gapCount` (range 3–16), nudged by complexity/adjacency. Suggested mapping (tune
during implementation):

| gapCount | pips |
|----------|------|
| 3–4      | 1    |
| 5–7      | 2    |
| 8–10     | 3    |
| 11–13    | 4    |
| 14–16    | 5    |

Implemented as a pure function `difficultyPips(profile) → 1..5`.

---

## 7. Data & persistence (Hybrid)

### 7.1 Keep as-is (catalog)
- `get_journey` — map / station list, names, unlock gating.
- `get_level` — difficulty profile and level identity. Its `my_pr / my_stars /
  last_played` (old aggregate model) are **ignored** by the new UI; records come from
  localStorage instead.

### 7.2 New: per-component records (client + localStorage)

A client-owned progress store, persisted to localStorage under a versioned key
(e.g. `gapcity:progress:v1`). Shape per level:

```ts
type LevelProgress = {
  best: {
    main: number        // 0 if unplayed/unsolved
    colors: number
    inSequence: number
    flash: number
    riddle: number
  }
  timesPlayed: number
  lastPlayed: number | null   // epoch ms
}
// keyed by levelId
type ProgressMap = Record<string, LevelProgress>
```

Derived selectors:
- `levelTotal(levelId)` = sum of `best.*`.
- `levelStars(levelId)` = star mapping of the total (with the main-solved gate).
- `isBadgeEarned(levelId, component)` = `best[component] > 0`.
- `areBadgesUnlocked(levelId)` = `best.main > 0`.

On finishing a play: update `best[component] = max(prev, score)`, bump `timesPlayed`,
set `lastPlayed`. Write through to localStorage.

### 7.3 Mocked / deferred
- **Global Record** — show a **plausible fake number** (deterministic per level so it’s
  stable across reloads; e.g. derived from levelId). Clearly a stand-in for future
  server-backed global bests.
- Stop calling `record_level_result` for now. Streaks / achievements / real global
  records are deferred and will be wired when the per-component model is promoted to the
  server.

---

## 8. Component / module changes

### Client
- **`src/components/LevelScreen.tsx`** (new) — replaces `LevelDetailScreen.tsx`
  (modal → page): header, metadata row, Play CTA, badge row.
- **`src/components/ResolutionPhase/`** — repurposed to end in a **single-component
  result** (breakdown + updated level total/stars + Play Again / Back to Level / Next
  Level). The old aggregate `ResultsScreen` summary is retired or folded in here.
- **`src/store/gameStore.ts`** — replace gauntlet actions with single-play actions:
  - add `activeComponent`; `startPlay(levelId, component)`.
  - lives = 3 per play; wrong submission → −1 life, retry same puzzle, fresh clock; 0
    lives → component score 0 → result.
  - successful submission → compute component score → update progress store → result.
  - retire `roundIndex`, `roundResults`, `advanceRound`, `startLevel` (4-round),
    `THEME_SEQUENCE` iteration, `submitJourneyLevel`.
- **`src/store/progressStore.ts`** (new, or a slice) — the localStorage-backed
  per-component records and derived selectors from §7.2.
- **`src/engine/scoring.ts`** (or `supabase/functions/_shared/core/scoring.ts` mirror) —
  new `componentScore(...)`, `levelTotal(...)`, `levelStars(...)`, `difficultyPips(...)`.
  Retire `roundSpeed` (2000-based), `livesBonus`, and the 9000-based `levelStars`.
  Practice/Training scoring is untouched (separate, out of scope).
- **`src/components/GameShell.tsx`** — header shows component name + lives (3 per play)
  instead of "round n/4".
- **`src/store/navStore.ts`** — `appView` for the level hub (rename `levelDetail` →
  `level` if desired) and a way to jump to the next level’s hub for the Next Level CTA.
- **New theme stub** — `riddle` added to the component/theme union as a non-playable
  placeholder.

### Docs
- **`CLAUDE.md`** — the Round-loop / Scoring sections are stale (they describe the old
  +800/+500/+300 practice scoring and the gauntlet). Update to describe the level hub,
  components/badges, the 65 + speed(35) model, 0–500 totals, and 0–5 stars.

---

## 9. Testing

- **Scoring unit tests** (`scoring.test.ts`): base after 0/1/2 lives; speedBonus at
  0%/10%/50%/100% consumed; `ceil` rounding (the 97 example); 100 cap; unsolved → 0;
  flash uses selectDuration only.
- **Star mapping tests**: boundaries 0 / main-only / 150 / 250 / 350 / 450; main-not-
  solved → 0 even if (impossible) total > 0.
- **Difficulty pips tests**: bucket boundaries.
- **Progress store tests**: best is a max (never downgrades); timesPlayed/lastPlayed
  update; localStorage round-trip; badge-unlock gate (`best.main > 0`).
- **Play-loop tests**: 3 lives, wrong submission decrements + retries with fresh clock;
  0 lives → score 0, no game-over; badge locked until main solved.

All existing tests must continue to pass (`npm run test`); verify with `npm run build`
(catches `noUnusedLocals` after retiring the gauntlet code) and `npm run lint`.

---

## 10. Open questions / deferred decisions

- Exact difficulty-pip thresholds (tune against the real 15-level table).
- Whether `riddle` should be visually distinct from the other locked badges (it’s
  "Coming soon" vs. "locked until main").
- Promotion path to full Supabase persistence (per-component columns + RPC + real global
  records + streaks) — intentionally deferred.
