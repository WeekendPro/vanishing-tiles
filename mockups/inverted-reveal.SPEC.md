# Inverted Reveal Piece — Design Spec (exploration)

> A new revealable piece type for **Medium mode** of Infinite Stagger. This is a
> mockup/iteration spec, not a production feature. Mockup: `inverted-reveal.html`;
> key frames captured as `frame-*.png` alongside it.

## 1. The idea in one line

The standard reveal **front-loads** attention — all four cells flash bright at
once, then decay to the void in a per-cell wave (`vt-bloom`). The Inverted Reveal
**back-loads** it: a single seed cell appears, neighbors fill in one at a time, the
full tetromino stands complete for a held instant, then the whole shape **poofs**
out together. The memory payload lands at the *end* of the piece's time on screen,
so the player must keep watching rather than snapshot-and-look-away.

## 2. Demarcation — how the player knows it's an inverted gap

**The seed-cell ember is the tell, reinforced by the build-up pattern itself.**

- Before the build starts, the seed cell shows a **faint magenta "ember"**: a thin
  inset ring (`inset 0 0 0 1px rgba(255,45,155,.45)`) over a near-void fill
  (`#140810`) with a slow ~1.6s breathing pulse. It is *clearly not* a normal
  bloom (no flood, no scale pop) — it reads as "something is about to grow here."
- This single distinct treatment answers the demarcation question without a HUD
  label or a legend. Once one or two neighbors light up dim, the *growing* motion
  is itself unmistakable versus a standard all-at-once flash.
- Rationale for an explicit ember (vs. "let the build-up be the only tell"): on a
  busy late board with overlapping standard blooms, the first single dim cell of a
  build could be mistaken for a stray bloom cell mid-decay. The ember pre-announces
  it ~600ms before motion, which also gives the eye somewhere to land. **Open
  question for tuning below.**

## 3. The reveal, in phases (concrete ms)

All timings are proposed starting points (the mockup uses exactly these). They are
deliberately a touch *longer* per piece than the standard `REVEAL_BLOOM_MS` (2080ms)
because the inverted piece is doing more storytelling.

| Phase | Duration | What happens |
|---|---|---|
| **0 · Seed** | `SEED_HOLD = 600ms` | Seed cell shows the breathing ember. No flood. |
| **1 · Build (smooth flow)** | `BUILD_STEP = 230ms` between cell *starts* | Neighbors **flow** in as **dim** magenta cells (≈55% brightness). Each cell eases in over a long `flowIn` ramp (~640ms: opacity 0→1, `scale .86→1`, glow ramps up) on `cubic-bezier(.25,.6,.2,1)`. **Crucially the step between starts (230ms) is much shorter than the ease (640ms), so the ramps OVERLAP** — the growth reads as one continuous flow spreading outward from the seed, not a steppy one-tile-at-a-time pop. No scale-snap. |
| **1b · Seed equalize** | ~420ms after last cell starts | The seed drops its ember ring and matches the other dim flow cells, so the shape reads as one uniform dim outline an instant before completion. |
| **2 · Complete** | `COMPLETE_HOLD = 520ms` | All cells **snap to full bright** neon magenta + strong glow (`0 0 14px + 0 0 30px`) and a `scale(1.13)` pop on the same tick. **This is the memory payload** — the only moment the player sees the finished, full-brightness shape. *(Lou-approved — keep as is.)* |
| **3 · Poof (magenta contract)** | `POOF = 320ms` | The whole shape vanishes **together** as an **in-brand magenta contract**: a quick brighter glow-swell (`scale 1.18`, glow up to `0 0 20px + 0 0 40px`), then it pulls *inward* — scales down to `~.55`, fades, and snaps back to the void. **No white flash.** `cubic-bezier(.5,0,.75,0)` (fast-in pull). |
| **4 · Dark beat** | `GAP_AFTER ≈ 700ms` | Void before the next beat (paces continuous batches). |

**Total on-screen time per inverted piece ≈ 600 + (~1110 build incl. overlap) + 160 + 520 + 320 ≈ 2700ms**
(vs. 2080ms standard). The *payload window* (complete hold) is only ~520ms — the
tension is that you've watched ~2s of build-up for a half-second of truth.

### Cell fill order (Phase 1)

**Adjacency walk from the seed** (BFS/connected growth): each next cell is always
orthogonally adjacent to an already-lit cell, so the shape grows like a connected
organism rather than teleporting cells. Example orders the mockup uses (offsets
from seed):

- **T**: center → right → left → down-stem (arms first, stem last)
- **L**: down → down → foot (grows the spine, then the foot)
- **I**: left-to-right along the bar
- **O**: top-left → top-right → bottom-left → bottom-right
- **S/Z**: the two halves grow outward from the elbow

The seed is chosen as a **central/anchor cell** of the tetromino (the T-junction,
the L-elbow, an O corner) so growth radiates rather than crawling from one end.
*This is a tuning lever — see questions.*

## 4. Recall & scoring implications

- **No new pick mechanic.** An inverted gap resolves exactly like any Medium gap:
  the player picks the matching tetromino shape from the tray. The inversion is
  purely a *reveal/encoding* difficulty, not a *resolution* difficulty.
- It is strictly **harder to encode** than a standard bloom (short payload window,
  attention must be sustained), so it should be treated as a **premium beat**:
  - Suggestion: an inverted gap **banks a small bonus** on correct recall (e.g.
    `ACCURACY_PER_GAP × 1.25`, or a flat `+25`), since it carried more memory load.
  - Alternatively keep scoring flat and let the *difficulty* be the reward (more of
    them late = more misses = combo risk). **Open question.**
- **Pairing interaction:** for v1, an inverted gap is always revealed as a **single
  beat** (never the two-at-once `pair`). Two simultaneous build-ups would be very
  hard to track and muddy the "growing organism" read. So in the reveal plan an
  inverted gap occupies a solo beat.
- **Combo:** unchanged — a correct inverted recall extends the streak like any gap.

## 5. Integration sketch (where it branches in the existing system)

The current reveal driver (`StaggerScreen.tsx`, the `phase === 'reveal'` effect)
loops `show(idx)` over `revealPlan` beats, and for each beat calls `bloomForGap(...)`
→ pushes a `Bloom` whose cells get `vt-bloom`. The inverted piece slots in as a
**second kind of beat**.

### New state / flags

- **`StaggerGap`** (`staggerStore.ts`): add `inverted?: boolean`. Set on a subset of
  gaps when `makeBatch` builds a Medium batch (see selection rule below).
- **`buildRevealPlan` / beats**: an inverted gap must occupy a **solo beat** (no
  pairing). Easiest: when choosing pairs, exclude inverted-flagged gaps from the
  pair pool, so they fall through to singles automatically.
- **Reveal driver branch**: in `show(idx)`, for each gap index in the beat, check
  `gaps[gi].inverted`:
  - **standard** → today's path (`bloomForGap` + `vt-bloom`).
  - **inverted** → drive a new `InvertedBloom` state machine: emit per-cell
    timers (seed → build steps → complete → poof) using the Phase table above.
    Because the build-up cells stay lit *dim* until completion (they don't
    decay individually), this needs a small per-gap sub-timeline rather than the
    single forwards-fill CSS animation the standard bloom uses.
- **Board rendering** (`StaggerBoard`): today `bloomByCell` maps a cell → one bloom
  descriptor. Add a parallel `invertedByCell` map carrying the cell's current
  inverted sub-state (`'seed' | 'build' | 'complete' | 'poof'`), and render the
  matching class (`iv-seed` / `iv-build` / `iv-complete` / `iv-poof`). These are 4
  new CSS classes mirroring the mockup's keyframes; the existing `vt-dim` void and
  filled-cell rendering are untouched.

### New CSS (mirrors the mockup)

`iv-seed` (breathing ember), `iv-build` (smooth dim `flowIn` — opacity/scale/glow
ramp, deliberately long so overlapping cells flow as one growth), `iv-complete`
(snap to full neon magenta — the payload), `iv-poof` (in-brand **magenta contract**:
glow-swell → scale-down → fade to void, **no white**). All magenta-keyed for Medium;
if this ever extends to Easy/Hard the flood color would swap the same way `vt-bloom`
already does (`--bloom-color` / `vt-paint`).

### Selection rule (which gaps are inverted)

Medium-only, schedule-gated so it doesn't stack with another difficulty lever on
the same level (matching the existing "one lever moves per level" philosophy):
introduce inverted gaps from some `INVERTED_FROM` batch index, starting at **1 per
batch**, optionally climbing. Reuse the `makeBatch` re-roll loop to flag N random
non-paired gaps as inverted.

### Timing constants

Add to the `STAGGER` block in `staggerCurve.ts`:
`INV_SEED_MS=600`, `INV_BUILD_STEP_MS=230` (start-to-start; the per-cell `flowIn`
ease is ~640ms so steps overlap), `INV_COMPLETE_HOLD_MS=520`, `INV_POOF_MS=320`.
Like the standard reveal, these are **constant per batch** (the run never speeds the
reveal up — complexity comes from other levers).

## 6. Open tuning questions (also in the final report)

1. **Payload hold** — is `COMPLETE_HOLD = 520ms` the right "truth window"? Shorter
   = crueler/more memorable; longer = gentler. Should it *shrink* as the run
   escalates (the one place we'd break the constant-reveal rule)?
2. **Build cells: dim or fully dark?** The mockup fills build-up cells **dim
   magenta**. Alternative: build cells are **barely-there ghosts** (≈25%) so only
   the *complete* snap is truly readable — maximizing the back-load. Tradeoff:
   ghost build-up risks looking like noise on a busy board.
3. **Demarcation strength** — keep the explicit pre-build **ember**, or trust the
   build-up motion alone as the tell (no special seed marker)? The ember is safer
   on dense late boards but adds one more glowing thing on screen.
