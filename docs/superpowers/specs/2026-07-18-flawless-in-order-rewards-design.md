# Flawless / In-Order rewards + central-line messaging — Design

**Date:** 2026-07-18
**Status:** Approved (design)
**Scope:** Infinite Stagger only (`staggerStore` + `StaggerScreen` and its extracted pieces). No backend, no schema, no other modes/screens.

---

## Motivation

Two related gaps in the Infinite Stagger reward + feedback loop:

1. **No reward for going above and beyond.** Easy and Medium don't *require* recalling gaps in the reveal order. A player who does it anyway — or who clears a whole batch without a single miss — gets nothing extra for the harder, cleaner performance. We want to reward both the *clean* clear and the *ordered* clear, loudly.
2. **The central line above the grid is prime real estate that's being spent poorly.** Every mode funnels transient cues through the line above the grid (MEMORIZE / RECALL / STREAK). But at a batch clear it shows **CLEAR!**, which outranks the streak — even though the clear is self-evident (the board fills) and the streak count is *not* self-evident and matters more. Separately, Hard mode's "IN ORDER" reminder floats in an orphaned right-aligned chip beside the tray instead of going through that same central channel.

This design adds two stacking bonuses and rewires the central line's priority.

---

## The two rewards

Two **independent** per-batch rewards, both banked at clear (like the existing speed bonus), both scaling with batch size.

### FLAWLESS — "no mistakes"

- **Condition:** the batch was cleared **without losing a life** — i.e. zero misses during the (current attempt at the) batch.
- **Applies in:** **all modes** (Easy, Medium, Hard). A no-miss Hard clear is a genuinely hard feat and earns FLAWLESS.
- **Value:** `FLAWLESS_PER_GAP × gapCount`, with `FLAWLESS_PER_GAP = 150`.
  - 3 gaps → +450 · 6 gaps → +900 · 12 gaps → +1,800.

### IN ORDER — "flawless *and* in sequence"

- **Condition:** the batch was FLAWLESS **and** every gap the player filled followed the reveal order (`revealPlan`). Because it requires flawless, **IN ORDER implies FLAWLESS** — the two stack.
- **Applies in:** **Easy / Medium only.** In Hard, order is *mandatory* (enforced by `pickPiece`), so there is no separate reward for it — a Hard clear that satisfies IN ORDER simply earns FLAWLESS.
- **Value:** `IN_ORDER_PER_GAP × gapCount`, with `IN_ORDER_PER_GAP = 250`.
  - 3 gaps → +750 · 6 gaps → +1,500 · 12 gaps → +3,000.

### Truth table

| Batch outcome | Easy / Medium | Hard |
|---|---|---|
| Cleared, no misses, **in** reveal order | **FLAWLESS + IN ORDER** (150+250 = 400/gap) | **FLAWLESS** (order is mandatory) |
| Cleared, no misses, **out of** order | **FLAWLESS** (150/gap) | n/a — out-of-order is a miss in Hard |
| Cleared, but **≥1 life lost** | — neither — | — neither — |

One lost life forfeits **both** bonuses. This closes the "make six misses, then finish tidily" loophole: the bonuses reward the *whole* batch attempt being clean, not just its tail.

### Relationship to existing scoring

- The **streak** (`100 × currentStreak` per correct pick) remains the only *live* score multiplier and is unchanged.
- The **speed bonus** (≤500, banked at clear) is unchanged.
- FLAWLESS and IN ORDER are **flat per-gap** amounts (they do **not** compound with the streak), so they scale with batch difficulty but can't balloon the economy the way a "2×/3× round total" would. They read as siblings of the speed bonus in the clear payoff.

---

## Edge rulings

1. **Timeout replay resets the flags (per-attempt tracking).** A select-clock timeout (`timeoutBatch`) costs a life and replays the *same* batch (same gaps, reset unfilled). Flawless/in-order eligibility is tracked **per attempt** and resets when the replay begins, so a clean replay can still earn the bonuses. Rationale: the timeout already cost a life; the eligibility flags conceptually live with the gap state, which resets on replay. (The alternative — a timeout permanently forfeiting the batch's bonuses — was considered and rejected as double-punishing.)

2. **Same-shape ties resolve in the player's favor.** In Easy/Medium, `pickPiece` currently fills *any* unfilled gap matching the tapped shape (`gaps.find(...)`). For honest in-order tracking, when the tapped shape matches the **next-in-reveal-order** unfilled gap, we fill *that specific* gap and keep the in-order flag alive; only a tap that cannot be the next-in-order gap (its shape matches a later gap but not the next one) flips the flag off. So two identical shapes never accidentally cost the player IN ORDER.

3. **Demo earns no bonuses.** The guided demo already banks no speed bonus and pollutes no stats; FLAWLESS/IN ORDER are likewise suppressed while `demo` is set.

---

## Central-line messaging

The central line above the grid (`HudBar`, the region documented at `HudBar.tsx:69`) is re-prioritized.

### At batch clear → STREAK, not CLEAR!

- A batch only clears **on** a correct final pick, so `currentCombo` (the streak) is **always ≥ 1** at clear. The **STREAK ×N** takeover now owns the central line through the entire clear payoff window and the old **CLEAR!** label is retired (kept only as a defensive fallback that in practice never renders).
- The streak chip must be **pinned** (held, non-fading) for the duration of the payoff sequence rather than running its usual pop→hold→fade lifecycle, so it doesn't dissolve mid-celebration. It resolves naturally when the next batch's **MEMORIZE** label takes over on `advanceBatch`.

### Hard mode → RECALL label, IN ORDER flash on any miss

- The persistent right-aligned **"IN ORDER" chip beside the tray is deleted** (`StaggerScreen.tsx:414–425`).
- Hard's calm recall label stays **RECALL** (same as Easy/Medium).
- **Any** miss in Hard — a flat wrong shape *or* a right-shape-wrong-order tap — flashes **IN ORDER** (red, `vt-order-flash`) in the central line for `ORDER_HINT_MS`, then returns to RECALL. Today the flash fires only on the right-shape-wrong-order case; this broadens it to every Hard miss, validating the rule at the moment it's broken.
- Because a miss zeroes the streak, the IN ORDER flash and the STREAK takeover are mutually exclusive in practice — no new priority conflict. On a miss we also clear any lingering (fading) streak chip so the flash reads cleanly.

### Resulting priority (selecting phase)

1. **STREAK ×N** — on each correct pick, and pinned through the clear payoff.
2. **IN ORDER** (Hard, transient) — on any miss (streak is 0 here, so no clash with #1).
3. **RECALL** — the calm default (all modes).

(MEMORIZE owns the line during the reveal phase, unchanged.)

---

## The clear payoff — sequenced flyers

The existing clear payoff already "lifts" the speed bonus off the timer bar into the score (`StaggerScreen.tsx:233–258`, `LiftFlyer` in `FloatingFx.tsx`). We extend this into a short **sequence** of up to three labeled flyers, each rising into the score in turn:

```
FLAWLESS  +900     (cyan)   →   IN ORDER  +1,500  (lime)   →   SPEED  +420  (amber)
```

- Only the flyers that were *earned* appear (a flawless-but-unordered clear shows FLAWLESS + SPEED; a Hard clear shows FLAWLESS + SPEED; a lossy clear shows SPEED only, exactly as today).
- Each flyer: a brief pop-in, a short rise, a fade — staggered so they read one at a time; each plays its own sound and banks its amount into the score (the score counts up as each lands). The `LiftFlyer` component gains a **tag label** (`FLAWLESS` / `IN ORDER` / `SPEED`) and a **color variant**; the single-flyer model becomes a small ordered queue.
- The central **STREAK ×N** holds above the board throughout.
- After the last earned flyer resolves, `advanceBatch()` fires as it does today.

Timing constants (`LIFT_BEAT_MS`, `LIFT_MS`) are reused; a per-flyer stagger offset is added to `constants.ts`.

---

## Data-flow changes

### `staggerStore.ts`

**New per-attempt state** (reset at each batch attempt — `startRun`, `beginRunFromDemo`, `advanceBatch`, `timeoutBatch`):
- `batchFlawless: boolean` — starts `true`; set `false` on any miss during the attempt.
- `batchInOrder: boolean` — starts `true`; set `false` when a correct fill is not the next-in-reveal-order gap.

**`pickPiece` changes:**
- On a **miss** (non-demo): additionally set `batchFlawless = false`. (A miss already breaks the streak and costs a life.)
- On a **correct pick** in Easy/Medium: resolve the target gap preferring the next-in-reveal-order gap when the shape ties (edge ruling #2); if the filled gap is not the next-in-order gap, set `batchInOrder = false`.
- On the **clearing** pick: compute
  - `flawlessBonus = batchFlawless ? FLAWLESS_PER_GAP × gapCount : 0` (all modes),
  - `inOrderBonus  = (batchFlawless && batchInOrder && mode !== 'hard') ? IN_ORDER_PER_GAP × gapCount : 0`,
  - both `0` when `demo`.
- **`PickResult`** gains `flawlessBonus: number` and `inOrderBonus: number` (siblings of the existing `speedBonus`).

**Banking:** generalize `bankSpeedBonus(amount)` into a bonus-banking action reused by all three flyers (it already awards earned lives per `LIFE_EVERY` as points land). Name TBD in the plan (e.g. `bankBonus`); keep behavior identical.

### `staggerCurve.ts`

Add to the `STAGGER` constants:
- `FLAWLESS_PER_GAP: 150`
- `IN_ORDER_PER_GAP: 250`

### `StaggerScreen.tsx` + extracted pieces

- **Clear handler:** replace the single speed-bonus lift with the sequenced FLAWLESS → IN ORDER → SPEED queue; bank each; pin the streak chip; advance after the last.
- **Central line / `HudBar`:** streak outranks the (now-retired) CLEAR!; pin the chip through the payoff.
- **Hard miss flash:** fire the IN ORDER flash on any Hard miss (broaden from out-of-order-only); clear a lingering streak chip on miss.
- **Delete** the persistent Hard "IN ORDER" tray chip block.
- **`FloatingFx.tsx` (`LiftFlyer`):** add a `tag` label + color variant; support a short ordered queue of flyers.
- **`constants.ts`:** add the per-flyer stagger timing.

---

## Testing

Extend `tests/store/staggerStore.test.ts`:
- FLAWLESS awarded on a clean clear in **each** mode; amount = `150 × gapCount`.
- FLAWLESS forfeited when any miss occurred during the batch.
- IN ORDER awarded only in Easy/Medium on a clean **ordered** clear; amount = `250 × gapCount`; and it **stacks** with FLAWLESS.
- IN ORDER forfeited when a fill is out of reveal order (even if flawless).
- IN ORDER **not** awarded in Hard even on a clean clear (only FLAWLESS).
- Same-shape tie: a tap matching the next-in-order gap keeps IN ORDER alive (edge ruling #2).
- Timeout replay resets the flags; a clean replay earns the bonuses (edge ruling #1).
- Demo earns neither bonus.

Component tests (`tests/components/`) as needed for the payoff sequence and the retired CLEAR! / relocated IN ORDER messaging, following the existing `StaggerGameOver` / `StaggerRevealPause` patterns.

All existing tests must continue to pass (`npm run test`), and `npm run build` must stay clean (`noUnusedLocals`).

---

## Out of scope / deferred

- No changes to the difficulty ramp, the speed-bonus formula, lives economy, or the streak formula.
- No leaderboard/metric changes (FLAWLESS/IN ORDER are score contributions, not new tracked stats). A future "flawless batches" or "in-order batches" run stat could be added but is not part of this work.
- No changes to Training, Home, Leaderboard, or any other screen.
