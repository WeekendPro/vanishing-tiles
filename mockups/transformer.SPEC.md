# Transformer Piece — design spec (exploration draft)

A new **revealable gap type** for **Medium mode** of Infinite Stagger. A Transformer
gap appears as one tetromino and **squeezes through a CHAIN of decoy shapes** before
resolving to the real one — `Decoy.A → Decoy.B → Decoy.C → Actual` (4 shapes, 3 morphs).
Each morph is a pressure-squeeze (cells strain/compress, then snap); the **final** morph
gets the big tension-shake. The player must recall the **final** shape — you can't
snapshot the first shape and look away. This doc is a mockup-stage proposal to react to,
not a production spec.

> **Design history:** v1 abstract 4-cell migration (hard to read). v2 directional
> one-squeeze with corner markers telegraphing the axis. v3 removed the markers and
> leaned into squash-and-stretch + a pre-resolve **shake**. **v4 (this doc)** makes the
> transform a **multi-step chain** of decoys (3 morphs) with **escalating pacing** —
> quick intermediate squeezes building to a full strain+shake+snap on the final resolve.

> **Mockups in this folder**
> - `transformer.html` — the full chain reveal, animated against the void. Auto-cycles the three canonical chains; buttons pick a chain (`L→T→J→O`, `S→T→Z→L`, `I→L→O→J`) + "Slow-mo ⅓×". Progress dots above the board track the chain (final shape tinted cyan).
> - `demarcation.html` — standard gap vs Transformer gap (the cyan-rim tell; the old corner brackets are retired — see §3).
> - Screenshots, per chain (`ltjo` / `stzl` / `iloj`): `*-1`…`*-4` (each of the 4 shapes settled) + `*-5-shake` (the final morph's tension peak). Plus `00-live-shake` (a live capture of a chain's final tension beat) and `08-demarcation`.

---

## 1. The chain model + per-morph pressure-squeeze

A Transformer gap holds an **ordered list of 4 shapes** and plays **3 morphs** in
sequence, folding **in place** (every shape is drawn on the same anchored footprint, so
the chain never drifts around the board). The first three shapes are **decoys**; the
**last** is the answer.

Each morph reuses the pressure-squeeze grammar: cells that change between A and B are
**movers** (they compress along their travel axis and ride to their new cell); cells in
both shapes are **fixed**; a fixed cell a mover lands on gets **knocked**. The number of
movers per morph depends on the pair (1 for a clean one-squeeze, up to 3 for a big
fold — see §2).

**Pacing — escalating tension (my call, justified).** *Intermediate* morphs are **quick
squeezes**; the **final** morph gets the **full drama**. Concretely:

- **Intermediate morph (steps 1 & 2):** light strain (compress to ~60%, ~180 ms) →
  immediate **quick snap** (~240 ms, small overshoot) with only a soft whole-body
  shudder. No hot core, no big shake. Fast, punchy, ~420 ms each.
- **Final morph (step 3):** **full strain** (compress to ~42%, hold, ~300 ms) → the big
  **TENSION shake** (high-freq judder + hot-white core + whole-body tremble, ~320 ms) →
  **overshoot snap** (~440 ms) → a **final-pop** flash + **long hold** on the answer.

Why: a single shake on *every* morph would (a) blow the time budget and (b) flatten the
drama — three equal peaks read as "stuff is happening," not "building to a climax."
Reserving the shake for the last morph makes the chain *accelerate emotionally* — the
decoys flick by under pressure, then the gap visibly **strains and shudders** right
before it commits, so the **final** snap is the loudest, most memorable beat. That
memorability is exactly what we want, because the final shape is what the player must
recall (§5).

---

## 2. The three canonical chains (and which steps need a non-trivial fold)

Footprints are anchored in a 3-row × 4-col local window; a morph's **movers** = the
A-cells not present in B (paired to nearest B-only cell). "Clean" = 1 mover.

| Chain (recall = last) | Step | Movers | Clean? |
|---|---|---|---|
| **L → T → J → O**  (recall **O**) | L→T | 2 | 2-cell fold |
| | T→J | 2 | 2-cell fold |
| | J→O | 1 | ✅ clean one-squeeze |
| **S → T → Z → L**  (recall **L**) | S→T | 1 | ✅ clean |
| | T→Z | 1 | ✅ clean |
| | Z→L | 2 | 2-cell fold |
| **I → L → O → J**  (recall **J**) | **I→L** | **3** | ⚠ **big fold** |
| | L→O | 1 | ✅ clean |
| | O→J | 1 | ✅ clean |

(Mover counts are with **fixed in-place footprints** — the honest visual choice for a
chain. If we instead re-aligned each shape to maximize overlap, several of these drop to
1 mover, but the shape would then jump around the window between steps, which reads worse
than a slightly bigger in-place fold.)

**Steps that aren't clean one-squeezes — flagged:**
- **I → L (3 movers, the biggest fold).** A flat 4-wide bar collapsing into an L is a
  genuine reshape: three of the four cells drop from the top row into the bottom row.
  It still reads well — it's a dramatic "the bar buckles and folds down" — and it's the
  **opening** morph of its chain, where a big motion is welcome. It is *not* a subtle
  one-cell squeeze; the mockup plays all three movers straining/snapping together.
- **The four 2-cell folds** (L→T, T→J, Z→L, and L→O when in-place) read as a clean
  "two cells swap sides" squeeze — both movers strain on the same axis and snap together.
  Comfortably believable.

Every step was verified in the mockup: `from cells \ shared = movers`, and
`movers→targets + shared = the next shape`'s exact footprint. The mockup's `planStep()`
is the source of truth and computes these mappings live from the `F` footprint table.

## 3. Demarcation decision (markers removed — what replaces them)

The corner markers are **gone** (they were also the identity tell). My call is a
**two-layer answer**, not "rely on the squeeze alone":

- **Primary, static tell — the cyan rim.** On the **appear** beat (and for the whole
  time the gap rests before it strains), the cell keeps the **cyan rim** piped inside
  its magenta core — the magenta/cyan hue split that says "unstable / two-state." It's a
  single box-shadow property (no extra DOM), survives the loss of the brackets, and is
  visible the instant the gap blooms. See `ltjo-1-l.png` (any `*-1` appear frame).
- **Confirming, kinetic tell — the squeeze itself.** The strain → shake → snap is so
  unlike a standard bloom that once it fires there is zero ambiguity.

**Why not lean on the motion alone?** The player must know a gap is special *during
memorize, before* the squeeze plays — otherwise a Transformer reads as an ordinary gap
for its first ~600 ms and the "feint" (§5) isn't fair. The cyan rim covers that window
cheaply; the dramatic motion then removes all doubt. (If playtesting shows the rim is
too subtle at 28 px, the fallback is a faint idle "pressure breathing" pulse on the
resting cells — a second-order cue already hinted at in the appear bloom.)

Standard Medium gaps stay a flat magenta flood — no cyan rim. `demarcation.html` still
renders the old side-by-side; treat its corner brackets as **retired** (the cyan-rim
contrast is the part that carries forward).

---

## 4. The reveal animation — chain timeline & timings

Replaces the standard single bloom for a Transformer gap. The gap is a **solo reveal
beat** already (it owns its whole beat), so it can run long. Timings are what the mockup
uses; all tunable.

| # | Phase | Duration | What happens |
|---|---|---|---|
| 0 | Pre-roll breath | ~300 ms | Token parked dim on **shape 1**. |
| 1 | **Appear** | ~560 ms + ~260 ms beat | The 4 cells bloom bright with the **cyan rim** (§3); a short beat to register shape 1. (any `*-1` frame) |
| 2 | **Morph 1 (quick)** | ~420 ms | Decoy 1 → Decoy 2. Light strain (~180 ms) → quick snap (~240 ms) + soft body shudder. No shake. (`*-2` frame = settled decoy 2) |
| 3 | **Morph 2 (quick)** | ~420 ms + ~180 ms | Decoy 2 → Decoy 3. Same quick squeeze. (`*-3` frame = settled decoy 3) |
| 4 | **Morph 3 (FINAL — full drama)** | ~1060 ms | Decoy 3 → **Actual**: full strain (~300 ms) → **TENSION shake** (~320 ms, hot core + body tremble) → overshoot snap (~440 ms). (`*-5-shake.png`, `00-live-shake.png`; `*-4` = settled answer) |
| 5 | **Final-pop + hold** | ~560 + ~900 ms | The answer flashes a white-cored `finalPop` ring, then **holds long and clean** — the memorable silhouette to bank. |
| 6 | **Decay to void** | ~900 ms (per-cell wave) | Cells fade magenta → void in the `vtBloom` per-cell wave (85 ms stagger). No readable hole. |

**Total ≈ 5.3 s** (appear + 2 quick morphs + final morph + long hold + decay). That's
~2× a single-morph reveal and ~2.5× a standard bloom beat — acceptable because it's a
solo beat. Tighten by trimming the quick morphs or the final hold if it drags.

Reduced-motion: collapse the whole chain to a static flash of the **final** shape with
the cyan rim (skip all morphs/shake), matching `prefers-reduced-motion` for `.vt-bloom`.
The high-frequency shake (single ~320 ms burst, motion-only, no color strobe) is gated
behind reduced-motion and is flash-safe.

---

## 5. Recall / scoring rule (PROPOSAL — flag for decision)

**Rule: the player recalls and picks the _final_ shape in the chain.** The three decoys
are the feint — you can't snapshot shape 1 and look away, because the gap keeps morphing
and only the **last** shape is the answer. This keeps the existing pick model untouched
(one gap → one piece type = the final shape), so `pickPiece` / shape-equality needs **no**
change. The design reinforces it three ways: the **final morph is the loudest** (the only
full strain+shake), a **final-pop** flash marks the resolve, and the answer **holds long**
before decay (§4) — so the most memorable beat *is* the correct answer.

**Scoring:** score it like a normal gap (`ACCURACY_PER_GAP`, combo, speed) — **no
bonus**. The Transformer is a *difficulty* lever, not a points lever (mirrors how Stagger
keeps levers independent). Optional future hook: a small "resisted the decoys" cosmetic.

**Flagged alternatives:** (a) *final only* — **proposed**, zero model change; (b) *recall
the whole sequence* — gap consumes 4 ordered picks (like In-Sequence), a big recall-load
escalation and a real model change; (c) *random pick from the chain announced after* —
too fiddly. Ship **(a)**; (b) is a possible "advanced Transformer" later.

---

## 6. Chain length & composition

Ship the **4-shape / 3-morph** chain (the brief's spec) on Medium, using a curated set
of chains (the three canonical ones to start; the generator can grow the set — §7). Keep
**every chain's final morph a clean-ish fold** where possible so the loudest beat reads
crisply, and allow at most **one big (3-mover) fold per chain**, placed **early** (like
I→L) where a dramatic motion is welcome and there's no shake competing with it. Longer
chains (5+) are possible but would push the solo beat past ~6 s and risk decoy fatigue —
hold them for a later Hard variant if wanted.

---

## 7. Integration sketch (how it grafts onto the bloom system)

The Transformer is a property of a **gap**, resolved by the existing reveal driver with
one branch.

**Gap shape (`StaggerGap` in `staggerStore.ts`):** the gap now carries an **ordered list
of shapes** (the chain), with `pieceType` = the last one.
```ts
interface StaggerGap extends Gap {
  filled: boolean
  // NEW — present only on Transformer gaps:
  chain?: {
    shapes: PieceType[]   // length 4 (decoys… + actual); gap.pieceType === shapes.at(-1)
    cells:  Cell[][]      // per-shape footprints in the gap's local frame, same anchor
    // Per-morph plans are DERIVED at render time (movers = A-cells not in B, nearest-
    // paired to B-only cells; axis = dominant travel axis) — see the mockup's planStep().
  }
}
```
Because `pieceType` is the **final** shape, every downstream consumer (`pickPiece` shape
match, tray, filled-cell render) already does the right thing with **no change** — a
Transformer is just a normal gap with a long, dramatic reveal.

**Generation (`staggerCurve.ts` / `makeBatch`):**
- A curated **`TRANSFORM_CHAINS`** table (the mockup's `CHAINS`): each entry is a
  validated 4-shape chain whose **final** shape is in the batch's allowed pool. Start
  with the three canonical chains; the generator can enumerate more chains from the `F`
  footprint table under the §6 rules (≤1 big fold, placed early).
- New lever `transformersForBatch(batchIndex)` (Medium-only; 0 on Easy/Hard for now),
  added as its **own curve column** so it ramps in isolation ("one lever per level").
- A Transformer owns its whole (long) reveal beat → mark its index a forced **single** in
  `buildRevealPlan` (never half of a pair).

**Reveal driver (`StaggerScreen.tsx`, the `show(idx)` beat loop):**
- Today each beat pushes a `Bloom`. Branch: if the beat's gap has `chain`, push a
  **`ChainBloom`** and run the §4 chain timeline (appear → quick morph → quick morph →
  **final** strain+shake+snap → final-pop+hold → decay) instead of the single `vtBloom`.
- Render the moving cells with `transform` + the strain/snap keyframes over a small
  **overlay token layer** (4 absolutely-positioned lit squares) — exactly what the mockup
  does — so the static `StaggerBoard` grid stays untouched. `bodyShake` is applied to the
  token wrapper during the final shake. (Optional: the chain progress-dots from the
  mockup as a subtle "X of 4" HUD cue — flag as a nice-to-have, not required.)
- Give it its own **`TRANSFORMER_BEAT_MS`** (much longer than `REVEAL_STEP_MS`) so the
  whole chain plays before the next flash.

**New constants (`STAGGER` in `staggerCurve.ts`):**
```
TRANSFORMER_APPEAR_MS:        560   // + ~260ms register beat
TRANSFORMER_MORPH_QUICK_MS:   420   // each intermediate morph (light strain + quick snap)
TRANSFORMER_STRAIN_MS:        300   // final morph: full compress + hold
TRANSFORMER_SHAKE_MS:         320   // final morph: judder + hot core + body shake
TRANSFORMER_SNAP_MS:          440   // final morph: overshoot snap + knock
TRANSFORMER_FINAL_HOLD_MS:    900   // long clean hold on the answer (+ ~560ms finalPop)
TRANSFORMER_DECAY_MS:         900   // per-cell wave back to void
TRANSFORMER_BEAT_MS:         ~5300  // whole chain; decay overlaps next beat
```

**CSS:** add `bloomIn`, `strainX/Y` + quick `strainX/Yq`, `braceX/Y`, `judX/judY`,
`bodyShake` + `bodyShakeSoft`, `snapX/Y` + quick `snapX/Yq`, `knock`, `finalPop`
keyframes + the `.hot` class from the mockup. Decay can reuse `vtBloom`.

---

## 8. Open risks / things to watch

- **Demarcation strength** — the cyan rim is now the *only* static tell (§3). Verify it
  reads at 28 px / mobile DPR; the fallback is an idle "pressure breathing" pulse on the
  resting cells.
- **Chain length vs reveal time** — the chain is now ~5.3 s, a *solo* beat but ~2.5× a
  normal one. Gate Transformer **count per batch low** (likely 1, occasionally 2) so the
  memorize phase doesn't balloon; never pair a Transformer.
- **Decoy fatigue / "is it done yet?"** — three morphs risk the player tuning out before
  the answer. Mitigated by the **escalation** (the final morph is unmistakably bigger) and
  the **progress dots**; watch in playtest that the final beat clearly reads as "this is
  the one."
- **Reading the FINAL, not a decoy** — the whole point is the last shape. The final-pop +
  long hold are there to lock it in; if testers still mis-recall a late decoy, lengthen
  `TRANSFORMER_FINAL_HOLD_MS` and/or make the quick morphs even quicker so decoys feel
  transient.
- **The I→L big fold** — three cells move at once; confirm it reads as "the bar buckles
  down into an L" and not as noise. It's deliberately the *opening* morph (no shake
  competing). If it's muddy, swap that chain's opener.
- **Shake / flash safety** — the final judder is a single ~320 ms burst of *motion* (no
  color strobe), gated behind `prefers-reduced-motion`; keep it motion-only.
