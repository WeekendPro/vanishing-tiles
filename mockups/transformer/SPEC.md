# Transformer Piece — design spec (exploration draft)

A new **revealable gap type** for **Medium mode** of Infinite Stagger. A Transformer
gap appears as one tetromino and **folds into another** during its reveal via a
**directional corner-push squeeze**: four corner markers telegraph the push axis, two
of them drive inward, a single cell is squeezed off and rides to a new slot, and the
shape resolves into the next tetromino. This doc is a mockup-stage proposal to react
to, not a production spec.

> **Mockups in this folder**
> - `transformer.html` — the full corner-push-squeeze reveal, animated against the void (auto-cycles L→O, J→O, T→S; per-transition buttons + "Slow-mo ⅓×").
> - `demarcation.html` — a side-by-side of a **standard** gap vs a **Transformer** gap (the four-corner demarcation Lou approved).
> - Screenshots: for each transition, three frames — `*-1-telegraph` (markers show direction) → `*-2-squeeze` (mid-fold) → `*-3-resolved` (new shape). Plus `08-demarcation` and `00-live`.

---

## 1. The corner-push-squeeze model

Every tetromino is 4 cells, so most are **one squeeze apart**: collapse a 3-long
footprint axis down to 2-long and the squeezed-off cell displaces perpendicular to
complete the next shape. The **four corner markers are functional, not decorative** —
they show the player *which way the gap is about to fold* before it moves:

- All four markers ride the gap's **bounding box** (the demarcation Lou liked).
- On the **push side**, two markers go **active** (bright cyan) and **nudge inward**
  along the squeeze axis; the opposite pair **dims**. This is the *telegraph*.
- When the squeeze fires, the active markers **drive in once, hard**. A single
  **mover** cell **compresses along the push axis** (squashes thin + brightens) and
  rides to its new slot; the **displaced** anchor it shoves **recoils** into place.
  The other two cells are fixed anchors.

So the player reads the markers, predicts the fold, and watches the shape collapse the
way the arrows promised — a tight, physical fold, not an abstract cell migration.

---

## 2. The three chosen transitions (and why)

All three are **exactly one directional squeeze**: one mover, one displaced anchor,
two fixed anchors. They were picked to cover **both axes** and to read unambiguously.

| Transition | Push | Mover (from→to) | Reads as |
|---|---|---|---|
| **L → O** | left markers push **right** | bottom-left `(1,0)` → `(0,1)` | the L's long bottom row is squeezed from the left; the lone left cell rides up, folding the L into a 2×2 O on the right. *(Lou's canonical example.)* |
| **J → O** | right markers push **left** | bottom-right `(1,2)` → `(0,1)` | the **mirror** of L→O — proves the model is symmetric and the markers, not the shape, carry the direction. |
| **T → S** | left markers push **down** | top-left `(0,0)` → `(1,0)` | the **vertical** axis: the T's top-left arm folds straight down into the bottom row, tipping the T into an S. |

Why these three: L→O is the brief's canonical fold; J→O shows the squeeze is a pure
*directional* operator (same end shape, opposite push); T→S exercises the **other
axis** (a downward fold) so the marker language clearly means "this axis," not "always
horizontal." Each has a *single* mover so the eye can track the fold.

> **More folds the model supports** (for later): Z→O (mirror of an S→O, left push),
> S→O / Z→O families, and any 3-long↔2-long pair where one cell is squeezed off. The
> generator (§7) can enumerate these from the footprints; we ship the three above first.

### Exact cell bookkeeping (L → O)

Footprints in the shared 3-wide × 2-tall window (`#` = cell):

```
L:  ..#      O (right):  .##
    ###                  .##
```

| L cell | role | → |
|---|---|---|
| `(1,1)`, `(1,2)` | fixed anchors | stay |
| `(0,2)` | fixed anchor | stays (becomes O's top-right) |
| `(1,0)` | **mover** | squeezed right off col 0, rides up to `(0,1)` |
| `(1,1)` | **displaced** | recoils as the row repacks |

Two cells hold, one is squeezed off, one recoils — `mover + 3 anchors` reconstruct the
L, and `moverTo + 3 anchors` reconstruct the O. (J→O and T→S verified the same way; the
mockup's `TRANSITIONS` table is the source of truth.)

---

## 3. Demarcation — unchanged (the four corner markers Lou approved)

A Transformer is distinguishable the instant it blooms, before it folds:
1. **Four corner markers** on the bounding box — cyan L-brackets (the approved look).
2. **Cyan rim** piped inside the magenta core (a hue split = "unstable / two-state").
3. A slow shimmer the standard gap never has.

Now the markers do **double duty**: identity *and* direction (§1). Standard Medium gaps
stay a flat magenta flood — no corners, no cyan. See `08-demarcation.png`.

---

## 4. The reveal animation — phases & timings

Replaces the standard single bloom for a Transformer gap. ≈ **2.7–3.0 s** total (about
1.3 standard beats). Timings are what the mockup uses; all tunable.

| # | Phase | Duration | What happens |
|---|---|---|---|
| 0 | Pre-roll breath | 300 ms | Token parked dim on shape A. |
| 1 | **Appear / bloom-in** | ~560 ms | The 4 cells flash bright magenta + cyan rim, pop to `scale(1.14)`; all four corner markers fade up (idle). *(`*-1` is captured just after, in telegraph.)* |
| 2 | **Telegraph** | ~950 ms | The two push-side markers go **active** (bright) and **nudge inward** along the axis; the opposite pair **dims**. The hold is long enough to *read the direction*. (`*-1-telegraph.png`) |
| 3 | **Squeeze** | ~620 ms | Active markers **drive in** once (240 ms). The **mover** runs `squashX`/`squashY` (compress to ~50% along the axis + brighten) from its old cell to its new slot; the **displaced** anchor runs `recoil` (squash-pop) ~110 ms later. (`*-2-squeeze.png`) |
| 4 | **Settle / recall** | ~820 ms | Holds the **final** shape steady + bright; markers re-seat on the *new* bounding box. This is the silhouette to bank. (`*-3-resolved.png`) |
| 5 | **Decay to void** | ~900 ms (per-cell wave) | Cells fade magenta → void in the `vtBloom` per-cell wave (90 ms stagger), markers fade out. No readable hole — uniformity rule holds. |

Reduced-motion: collapse to a static **final-shape** flash with the cyan rim + corners
(skip telegraph + squeeze), matching the existing `prefers-reduced-motion` treatment of
`.vt-bloom`.

---

## 5. Recall / scoring rule (PROPOSAL — flag for decision)

**Proposed: the player recalls and picks the _final_ resting shape (B).** The fold A→B
is a *memory feint* — A is the bait, B is the answer. This keeps the existing pick model
untouched (one gap → one piece type = the final shape), so `pickPiece` / shape-equality
needs **no** change; the settle phase lingers on exactly the shape to pick; and the
markers end on B's bounding box.

**Scoring:** score it like a normal gap (`ACCURACY_PER_GAP`, combo, speed) — **no
bonus**. The Transformer is a *difficulty* lever, not a points lever (mirrors how Stagger
keeps levers independent). A "didn't take the bait" cosmetic is a future option.

**Flagged alternatives:** (a) *final only* — **proposed**, zero model change; (b) *both* —
gap consumes two picks A-then-B (like In-Sequence), doubles recall load, needs a 2-pick
gap state; (c) *first only* — pick A, the fold is pure misdirection; (d) *loop* — A↔B,
pick either (weakest identity, not recommended). Ship **(a)**; keep **(b)** as an
"advanced Transformer."

---

## 6. Single fold vs chains

Ship **single folds** (A→B) on Medium — one telegraph, one squeeze, one answer, fully
legible (it's why the squeeze reads at all). Multi-hop chains would stack telegraphs and
muddy the direction language; reserve them for a possible later Hard variant.

---

## 7. Integration sketch (how it grafts onto the bloom system)

The Transformer is a property of a **gap**, resolved by the existing reveal driver with
one branch.

**Gap shape (`StaggerGap` in `staggerStore.ts`):**
```ts
interface StaggerGap extends Gap {
  filled: boolean
  // NEW — present only on Transformer gaps:
  squeeze?: {
    // both footprints in the gap's local frame; gap.pieceType === toType (rule a)
    fromType: PieceType
    toType: PieceType
    fromCells: Cell[]; toCells: Cell[]
    mover: { from: Cell; to: Cell; axis: 'X' | 'Y' }
    displaced: Cell
    push: 'left' | 'right' | 'up' | 'down'
    activeCorners: ('tl'|'tr'|'bl'|'br')[]
  }
}
```
Because rule (a) makes `pieceType` the **final** shape, every downstream consumer
(`pickPiece` shape match, tray, filled-cell render) already does the right thing with
**no change** — a Transformer is just a normal gap with a fancier, directional reveal.

**Generation (`staggerCurve.ts` / `makeBatch`):**
- A small **`SQUEEZE_FOLDS`** table (the mockup's `TRANSITIONS`): each entry is a
  validated one-squeeze fold (mover + displaced + push + active corners). Generation
  picks a fold whose `toType` is in the batch's allowed shapes.
- New lever `transformersForBatch(batchIndex)` (Medium-only; 0 on Easy/Hard for now),
  added as its **own curve column** so it ramps in isolation ("one lever per level").
- A Transformer owns its whole reveal beat → mark its index a forced **single** in
  `buildRevealPlan` (never half of a pair).

**Reveal driver (`StaggerScreen.tsx`, the `show(idx)` beat loop):**
- Today each beat pushes a `Bloom`. Branch: if the beat's gap has `squeeze`, push a
  **`SqueezeBloom`** and run the §4 timeline (appear → telegraph → squeeze → settle →
  decay) instead of the single `vtBloom`.
- Render the moving cells with `transform: translate` + the squash keyframes over a
  small **overlay token layer** (4 absolutely-positioned lit squares + the 4 corner
  markers) — exactly what the mockup does — so the static `StaggerBoard` grid stays
  untouched. The four corner markers are new DOM the standard path never mounts.
- Give it its own **`TRANSFORMER_BEAT_MS`** (longer than `REVEAL_STEP_MS`) so the fold
  never collides with the next flash.

**New constants (`STAGGER` in `staggerCurve.ts`):**
```
TRANSFORMER_APPEAR_MS:   560
TRANSFORMER_TELEGRAPH_MS: 950   // hold so the push direction is readable
TRANSFORMER_DRIVE_MS:    240    // the corners' hard inward stroke
TRANSFORMER_SQUEEZE_MS:  500    // mover squash-and-ride (squashX/squashY)
TRANSFORMER_SETTLE_MS:   820
TRANSFORMER_DECAY_MS:    900    // per-cell wave back to void
TRANSFORMER_BEAT_MS:    ~2600   // appear+telegraph+squeeze+settle; decay overlaps next beat
```

**CSS:** add the `bloomIn`, `nudgeR/L/D`, `squashX/squashY`, `recoil` keyframes from the
mockup, plus the `.corner` / `.corner.active.push-*` classes. Decay can reuse `vtBloom`.

---

## 8. Open risks / things to watch

- **Telegraph legibility at 28 px** — an active corner can sit under a lit cell (visible
  in the L→O telegraph frame, where the bottom-left marker overlaps a cell). Consider
  drawing active markers slightly **outside** the bbox, or adding a 1-cell arrow glyph
  on the push side, so direction reads even when a corner overlaps a cell.
- **Reveal length vs pacing** — a Transformer beat is ~1.3× a normal beat; gate the
  count low so the memorize phase doesn't balloon.
- **Two folds, same end shape** — L→O and J→O both resolve to O. Fine (the fold is the
  challenge, not the answer), but watch that a board doesn't read as "two identical O
  gaps" once decayed.
- **Reduced-motion / flash safety** — honour `prefers-reduced-motion` (static final
  shape); the squeeze has no strobe so flash-hazard is a non-issue here.
