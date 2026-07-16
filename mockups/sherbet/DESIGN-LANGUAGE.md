# SHERBET — the Vanishing Tiles design language

> The opposite of Afterglow. Where Afterglow was a dark monitor decaying in the
> night, **Sherbet** is a sunlit windowsill full of candy. Same magic — tiles that
> bloom and vanish — but now it's a *treat*, not a ghost.

---

## 1. Mood / north star

**Adjectives:** bright · soft · springy · sweet · uncluttered

**Touchstones:** Two Dots (clean candy palette, generous whitespace) · Threes!
(friendly chunky type, tactile tiles) · Alto's Odyssey / Monument Valley (calm,
low-stress confidence) · Apple Arcade puzzle vibes (toy-like polish).

**Manifesto:** *Bright as a popsicle, soft as a cloud — every tile is a toy you want
to touch, and even when it melts away it makes you smile.*

The conceptual hook is **sherbet**: candy-bright pastels that *melt* rather than
switch off. That single idea drives the palette (sweet, light) **and** the signature
vanish (a soft effervescent dissolve, never a hard cut).

---

## 2. Color system

Everything sits on **warm white**, never grey — the warmth is what makes it feel
friendly instead of clinical.

| Role | Token | Hex |
|---|---|---|
| Page background | `--vt-bg` | `#FFF7F0` |
| Board well | `--vt-bg-board` | `#FBEFE6` |
| Card / tray surface | `--vt-surface` | `#FFFFFF` |
| Sunken slot | `--vt-surface-2` | `#FFF1E8` |
| Primary ink | `--vt-ink` | `#46383B` (warm charcoal, not black) |
| Secondary ink | `--vt-ink-soft` | `#9B8B8E` |

**Candy tile palette** — 8 hues, deliberately spread across *lightness* as well as
hue so they survive colour-blindness and small sizes:

🍓 `#FF6B6B` · 🍊 `#FF9E45` · 🍋 `#FFCE3A` · 🍏 `#5BC16E` · 🌊 `#1FC7B6` ·
💧 `#46AEF7` · 🍇 `#9B8CFF` · 🌸 `#FF8FCF`

Each hue ships with a paired **rim** colour (~14% darker, same hue) used as the inset
ring on pure-colour swatch tiles so a swatch reads as a deliberate object, not a
blank cell.

**Semantic colours**

- **Success** mint `#2FD09B` — correct picks and perfect clears. Fresh, not loud.
- **Combo / streak** a warm gradient `#FF6B6B → #FFA94D` with a gold `#FFCE3A` spark.
  Heat = excitement, never danger.
- **Lives** heart coral `#FF6B81`.
- **Timer / urgency** eases through **three friendly stops**: calm teal
  `#46C7B6` (>50% left) → amber `#FFB13C` (20–50%) → **coral** `#FF8A5B` (<20%).
  It never hits a punishing red, and it always pairs colour with a *shrinking ring +
  number* so the warning is shape-encoded, not colour-only.

**Colour-blind safety:** the 8 tile hues differ in lightness, not just hue. Pure-colour
swatch tiles additionally support an opt-in **Symbols mode** that embosses a distinct
glyph (●▲■◆★ …) per hue, so colour is never the *only* signal. Correctness is also
never colour-only — a correct pick gets a ✓ + bounce, a miss gets a soft shake.

**Soft dark mode** (optional): warm plum `#211A24` ground, cream ink, tiles keep their
hue at ~8% lower saturation. Moody-but-cosy, still not neon. Tokens included.

---

## 3. Typography

A rounded, high-legibility pairing, both variable, both with clean React-Native
fallbacks (`ui-rounded`).

- **Display — Fredoka** (600/500): score numbers, titles, "Perfect!", combo
  multipliers. Chunky, geometric, rounded — reads instantly at a glance.
- **UI — Nunito** (700/600/500): everything else. Rounded terminals, excellent at
  small sizes under a clock.

| Use | Font | Size / weight |
|---|---|---|
| Game-over score | Fredoka | 44 / 700 |
| Screen title, "Perfect!" | Fredoka | 30 / 600 |
| HUD score | Fredoka | 22 / 600, tabular |
| Body / buttons | Nunito | 16 / 600 |
| Caption, pills | Nunito | 13 / 700, +2% tracking, UPPER |

Numbers are **tabular** so the score/timer don't jitter as they tick.

---

## 4. Tile & board treatment

**The universal 2×2 canvas** is one silhouette that can hold anything. Consistency
comes from keeping *everything but the content* identical:

- **Same squircle** — `border-radius: var(--vt-r-tile)` (~26px on a 64–72px tile).
- **Same elevation** — `--vt-shadow-2` drop shadow + `--vt-inset-top` gloss (a 2px
  white inner highlight along the top edge → candy/plastic sheen).
- **Same inner "stage"** — every tile has a small padding ring; content lives on an
  inset stage so emoji, shapes and swatches share identical framing.

Three content modes, one frame:

| Content | Tile face | Content |
|---|---|---|
| **Emoji** | near-white stage `#FFFDFB` | large centred emoji (~62% of tile) |
| **Solid shape** | near-white stage | solid-colour glyph (●▲■◆…) at ~58% |
| **Pure colour** | the hue itself fills the stage | inset **rim** ring (the paired darker hue) + gloss, so it reads as a swatch, not an empty cell |

The near-white stage behind emoji/shapes is what lets *multicolour emoji and flat
colour all look at home together* — the busy emoji gets calm breathing room, the flat
shape gets the same room, and the pure swatch borrows the same silhouette and gloss.

**Board:** a sunken warm "well" (`--vt-bg-board`) with a faint lattice of empty
rounded slots (`--vt-surface-2`, 1px `--vt-hairline`). The lattice is *quiet* — barely
there — so filled tiles are obviously the stars. Generous gutters; the board never
crowds the screen edges.

---

## 5. The signature reveal + vanish

This is the soul of the game. Springy, bright, effervescent — like soap bubbles
surfacing and popping into glitter.

**Bloom-in** (`--vt-bloom-ms` ≈ 420ms, spring with overshoot):
- scale `0.4 → 1.11 → 1.0`, opacity `0 → 1`, tiny rotate jitter `±3°` that settles to 0.
- a soft radial **pop-ring** of light expands from the tile and fades.
- tiles stagger `~70ms` apart → a gentle *pop-pop-pop* of popcorn, left-to-right.

**Linger:** at rest the tile *breathes* — `scale 1.0 ↔ 1.015`, ~2.4s, almost
subliminal. Keeps the board feeling alive while you memorize.

**Vanish — the sherbet melt** (`--vt-vanish-ms` ≈ 360ms per tile, staggered in a
diagonal wave `~70ms` apart):
1. **anticipate** — a quick squash + 4px *lift* (scale to 1.08). The tile gathers
   itself.
2. **poof** — scale `→ 0.7`, opacity `→ 0`, blur `0 → 4px` *upward*, while **4–6 tiny
   confetti dots / sparkles** in the tile's own hue puff outward and fade.

The result feels like the tile *dissolves up into light*, not switches off. It's a
bright dissolve, never a fade-to-black — that's the whole difference from Afterglow.

**Reduced motion:** cross-fade + a 0.96→1 scale, uniform 200ms, **no blur, no
confetti, no rotation**. Still legible, still gentle.

---

## 6. Screens & components

**HUD** (top bar, light, floating): left = **score** (Fredoka, tabular, with a tiny
+N pop on gain); center = **level pill**; right = **lives** as a row of coral hearts
that *pop-deflate* when lost and *bounce-in* when earned. A slim **memorize ring** /
**recall bar** carries the timer using the calm→amber→coral easing + a number.

**Recall tray** (bottom sheet, `--vt-surface`, `--vt-r-card`, `--vt-shadow-3`): a
row of **5 candidate tiles** as big tappable squircles (≥56px, ≥44px hit target).
Tap → tile presses (scale 0.94), springs back, and if correct the matching board slot
**re-blooms** with a ✓ and a success glow; a wrong tap does a soft horizontal shake
and a gentle "boop" — no red flash, no shame.

**Combo / streak:** a horizontal **combo meter** fills with the `--vt-combo` gradient;
each correct pick bumps the multiplier `×2 → ×3 …` which **springs up bigger** with a
gold spark and a rising chime. At milestones a short ribbon of confetti crosses the
top.

**Buttons:**
- **Primary** — full-width pill, `--vt-success` or hue-tinted fill, white ink, gloss
  highlight, `--vt-shadow-2`; press = scale 0.96 + shadow compress (a real *squish*).
- **Secondary** — surface fill, ink text, hairline border, same squish.
- Match the board width (the established `inline-flex flex-col items-stretch` pattern).

**Level-up / phase transition:** the board's tiles do the **sherbet melt** all at
once in a wave, the well briefly brightens, a soft "Level 4" plaque springs in and
out — a breath between rounds, ~700ms, encouraging not interrupting.

**Game over:** never a "fail" screen. Big friendly **score** (Fredoka 44), a row of
stars filling to your result, one upbeat line ("Sweet run!" / "So close — one more?"),
and a fat primary **Play again** + secondary **Home**. Warm, no red, no buzzer.

**Encouraging copy** throughout: "Nice eye!", "On a roll!", "So close!", "Sweet!" —
short, kind, never scolding.

---

## 7. Motion principles

- **Springy & tactile** — entrances overshoot then settle (stiffness ~260, damping
  ~20). Everything you touch *squishes* (scale 0.94–0.96) and bounces back.
- **Stagger creates life** — boards bloom and vanish in waves, never all-at-once
  (except the deliberate level-up melt).
- **Fast in, soft out** — `--vt-ease-out` for exits; spring for entrances.
- **Restraint** — motion serves memory and delight, never decoration for its own
  sake. The board is the star; chrome stays calm.
- **Reduced-motion mode** swaps every spring for a calm cross-fade, kills blur and
  confetti, shortens to 200ms uniform. Fully playable, never jarring.

---

## 8. Sound & haptics mood

**Personality:** a friendly toy xylophone / kalimba in a sunlit room. Warm wooden
tones, soft mallets, a little sparkle on top — never electronic, never harsh.

- **Bloom** — a rising soft wooden "pock", pitched up slightly per tile in the wave.
- **Vanish** — an airy "shhk" + a tiny wind-chime sparkle as it melts.
- **Correct pick** — a happy marimba *ding* that **climbs the scale with your combo**.
- **Combo milestone** — a short bright bell fanfare.
- **Life lost** — a soft descending "boop" (gentle, apologetic — never a buzzer).
- **Level up** — a warm two-note chime + shimmer.

**Haptics:** light impact on every tap; soft success pattern on a correct pick;
medium on a combo milestone; a gentle double-tap on level-up. All subtle, all opt-out.

---

## 9. Accessibility

- **Contrast:** body/UI ink `#46383B` on warm-white backgrounds ≥ 4.5:1; large display
  type ≥ 3:1. White ink only on fills dark enough to pass (success, hot timer, deep
  rims) — light fills (lemon, etc.) use ink, not white.
- **Colour-blind:** 8 tile hues spread across lightness; opt-in **Symbols mode** adds
  per-hue glyphs to pure-colour swatches; timer is **shape + number**, not colour
  alone; correctness uses **✓ / shake**, not colour alone.
- **Reduced motion:** honoured via `prefers-reduced-motion` (calm cross-fades, no blur
  or confetti).
- **Targets:** every interactive element ≥ 44×44px; tray tiles ≥ 56px.
- **Legibility under a clock:** tabular numbers, high-contrast HUD, generous spacing so
  nothing is misread in a hurry.

---

### Token sheet → `tokens.css` (CSS variables + Tailwind/RN snippet).
### Live mockups → `01-memorize.html`, `02-recall-tray.html`, `03-success-combo.html`.
