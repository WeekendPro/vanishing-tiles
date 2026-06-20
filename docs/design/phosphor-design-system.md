# VANISHING TILES — Design System

**Product: VANISHING TILES** · Art direction: *Afterglow*
A visual identity for a remember-then-race memory game.
Mobile-first. Built to be handed to Claude Design and turned into UI.

---

## 0. The one-line thesis

> **Memory is an afterimage. So we build the entire game out of light that lingers.**

The core act of Vanishing Tiles is holding a picture in your mind's eye *after it's gone* — the
gap flashed, then vanished, and now you're racing the decay of your own short-term memory.
There is one material in the universe that behaves exactly like that: **phosphor**. A CRT
pixel gets hit, blooms bright, then fades on a slow tail, leaving a ghost on the glass and
a ghost on your retina.

So this isn't "neon arcade because arcades are cool." It's **phosphor afterglow because
afterglow *is* the mechanic.** Every light in this game has an attack and a *decay*: a gap
lights up — light **flowing through the shape** like current through a filament — holds for a
beat, then decays on a slow tail until it's **completely gone**. The gaps *must* vanish in
full, or there's no game. What lingers isn't on the glass — it's the afterimage burned into
*you*. The board goes fully solid; the only trace left is in your memory, and racing that fade
is the whole challenge. The aesthetic and the gameplay are the same physical phenomenon.
That's the POV.

> **The decay is staggered, and that's the magic.** The gaps don't fade in unison — their
> decays *cascade*, so you watch a sequence of lights going out one after another and have to
> hold the whole vanishing pattern in your head. By the time the last one dies, the board is
> **inert and blank** and the picture exists only in your memory. (Critical for build: the
> render must reach a clean, residue-free state before Recall — any lingering trace on the
> board deletes the challenge.)

> **Recall uniformity — the make-or-break rule.** At Recall **every cell renders in one
> identical tone** — filled cells and former gaps alike. If a decayed gap stays even slightly
> darker (or lighter) than the surface around it, the *absence of light* draws the answer for
> free. So a gap never decays into a dark **hole**; the **whole board settles to a single
> uniform field** at Recall (lights-out near-void is the most on-theme; a uniform
> filled-graphite "seal" also works). A gap is only ever exposed by its **live bloom** —
> before, between, and after blooms the surface is seamless. The pattern lives only in memory.

**What that buys us over generic neon:** a real motion language (fast attack / slow decay),
a reason for the darkness (light-on-black is the only place an afterimage is legible), and a
named feeling — *the trace* — that we can push everywhere from the timer bar to the combo
burst to the failure flicker.

See [§10](#10-the-road-not-taken) for the alternative I considered and why I didn't take it.

---

## 1. Palette — semantic, not decorative

Near-black ground so emitted light reads as *emitted*. Filled board cells are dead,
graphite, inert — they don't glow, because they aren't the thing you're trying to remember.
**Only meaning glows.** Five accent colors, each owns one idea and never borrows another's.

### Ground & structure
| Token | Hex | Use |
|---|---|---|
| `--void` | `#06060B` | App background. Unlit CRT black with a whisper of blue-violet. |
| `--panel` | `#0E0E16` | Recessed panels, the board bezel interior. |
| `--panel-raised` | `#15151F` | Tray tiles, buttons at rest. |
| `--grid-line` | `#1C1C28` | Board gridlines, hairlines. |
| `--filled` | `#2A2D3A` | Filled board cells — graphite, cool, **inert (no glow)**. |
| `--filled-edge` | `#3A3E4F` | Top/left bevel on filled cells (sunken-tile read). |

### Accents — each carries exactly one meaning
| Token | Hex | **Meaning** | Where it appears |
|---|---|---|---|
| `--magenta` | `#FF2D9B` | **MEMORY** — the gap; "burn this in" | Gaps blooming, the reveal/memorize bar, ghost trails |
| `--cyan` | `#28F0FF` | **SYSTEM / ACTIVE** — watch, ready, live | Active tray, "Ready", batch-wipe, focus states |
| `--amber` | `#FFC23D` | **TIME & SCORE** — the clock, the count-up | Recall timer, score digits, speed-bonus tally |
| `--red` | `#FF3B47` | **DANGER / MISS** — you lost something | Critical drain, wrong-pick ✕, life lost |
| `--lime` | `#B6FF3C` | **SUCCESS / STREAK** — correct, banked | Correct snap, combo bursts, "Clear!" |

### Text
| Token | Hex | Use |
|---|---|---|
| `--text` | `#EAEAF2` | Primary text on dark. |
| `--text-dim` | `#8A8AA0` | Labels, secondary. |
| `--text-faint` | `#4A4A5C` | Disabled, locked, hairline labels. |

### The temperature arc (read the rhythm by color)
The two timer states deliberately shift **cool → hot** to telegraph the phase change:

```
REVEAL (watch) ........ MAGENTA fill, calm     → "memorize"
RECALL (race) ......... AMBER drain → RED       → "hurry"
CLEAR  (payoff) ....... AMBER → LIME count-up    → "banked"
```

> **Glow recipe.** Every accent uses the same two-layer bloom so the whole game feels lit by
> one technology: a tight `0 0 6px` core + a soft `0 0 22px` halo at ~45% of the accent, on a
> dark fill. Never glow text below 16px — glow is for shapes and big numerals, never body copy.

---

## 2. Typography — a scoreboard and a clean voice

Two-tier, with a third for the literal clock. The display face is *hardware*; the UI face is
*human*. Never let the pixel face do a sentence's job.

| Role | Face (primary → fallback) | Notes |
|---|---|---|
| **Big numerals / HUD** (score, batch, combo ×, "CLEAR") | `Silkscreen` → `Press Start 2P` → monospace | Chunky pixel. **Reserve for large sizes only** — it's iconic but unreadable small. |
| **The countdown clock** | `DSEG7` (7-segment) → `Departure Mono` → monospace | Literal LED timer numerals. Optional — the bar carries time; digits are the assist. |
| **UI / buttons / labels / instructions** | `Space Grotesk` → `Inter` → system-ui | Geometric sans with a little character; stays crisp at mobile sizes. |
| **Piece labels & counts** | `Departure Mono` → `ui-monospace` | Tabular figures for count badges that don't jiggle. |

### Type scale (mobile)
| Token | px / line | Use |
|---|---|---|
| `display-xl` | 40 / 1.0 | Score, "CLEAR!", "GAME OVER" |
| `display-l` | 28 / 1.0 | Batch number, combo multiplier |
| `title` | 20 / 1.2 | Phase prompts ("MEMORIZE", "RECALL") |
| `body` | 16 / 1.4 | Instructions, modal copy |
| `label` | 13 / 1.2, +0.08em tracking, UPPERCASE | HUD labels, button text |
| `micro` | 11 / 1.2, tabular | Count badges, cost chips |

**Rule:** pixel and 7-segment faces get **letter-spacing ≥ 0.04em** — pixel glyphs need air
or they smear under glow.

---

## 3. Texture — the glass, used with restraint

The CRT is implied, never literal. Four layers, all **subordinate to legibility** — every one
must survive a `reduce-texture` toggle and never sit on top of body text.

1. **Scanlines** — 2px repeating linear-gradient at **3–5% opacity**, only over the board and
   big panels. Off on text. On small screens, drop to 2% or off.
2. **Phosphor bloom** — the §1 glow recipe. The signature.
3. **Sunken bezel** — panels read as *recessed into the cabinet*: 1px dark top-inset + 1px
   light bottom-inset + soft inner shadow. The board sits in a bezel like a screen in a frame.
4. **Vignette** — a slow radial darkening at the screen edges (~12% at corners) so the lit
   board floats. This is what makes it feel like a darkened arcade rather than a flat web page.

**The afterimage / ghost trail** is the *trailing edge of the decay*, **not** a persistent
crutch: as a gap dies, its magenta **light** fades over ~300ms (through an `8% --magenta` tail)
to zero — and the cell resolves to **exactly the tone of the surface around it, never a darker
hole**. It is **gone before Recall begins**, and the board at Recall is a **uniform field — no
residue, no readable negative space** (see the uniformity rule in §0). The only ghost the
player chases is the one on their retina, not on the screen.

> Forbidden: heavy CRT curvature/barrel distortion, chromatic aberration on text, animated
> noise over the tray. They look cool in a hero shot and wreck a 12×12 grid on a phone.

---

## 4. Motion language — attack & decay

One easing philosophy governs everything: **fast attack, slow decay.** Light arrives hard and
leaves soft — like a struck pixel, like a remembered image fading.

| Curve token | cubic-bezier | Use |
|---|---|---|
| `attack` | `(0.1, 0.9, 0.2, 1.0)` | Things lighting up — bloom in, snap, button press |
| `decay` | `(0.3, 0.0, 0.1, 1.0)` *(long tail)* | Things fading — gap fade-out, ghost trail, glow cooldown |
| `mechanical` | `(0.7, 0, 0.3, 1)` | Bar fills/drains, deliberate UI moves |

### Signature motions
- **Gap bloom** — light **flows through the shape** on `attack` (a ~120ms sweep filling the
  cells with a slight brightness overshoot) → hold (difficulty-scaled, ~600ms early → ~250ms
  deep) → `decay` ~550ms as the light fades to zero and the cell **re-seals to the surface
  tone** (never a darker hole). The final ~300ms is the faint ghost tail; decays are
  **staggered** so the reveal reads as a cascade of lights going out. Between and after blooms
  the board is **uniform** — only a live bloom ever exposes a gap; at Recall the whole surface
  settles to one tone (lights-out).
- **Correct snap** — piece scales 1.0→0.92→1.0 in 90ms (`attack`), lime core-flash, 6–10
  particle burst on the cleared gap. *Punchy, not floaty.*
- **Miss** — 6px horizontal shake, 3 oscillations, 180ms; red full-cell flash; a heart drains
  with a 1-frame white flicker before going to outline. It should physically flinch.
- **Timer drain** — `mechanical`, linear width, but the **glow intensifies** as it shortens;
  under 25% it pulses red at ~2Hz. The clock doesn't just shrink, it *heats up*.
- **Clear count-up** — world pulses lime once, timer freezes, then the bar **luxuriously**
  empties amber→lime over ~900ms while score digits tick (`attack` per tick). This is the
  exhale. Don't rush it — the slowness *is* the reward.
- **Batch wipe** — a cyan vertical sweep wipes the cleared board and slams the next batch in
  (~350ms). Re-tension is immediate.

**`prefers-reduced-motion`:** keep the *information* (state colors, count-up, ghost as a static
fade), drop the *spectacle* (shakes, particle bursts, overshoot). Bloom becomes a plain
opacity fade. Nothing essential is carried by motion alone.

---

## 5. The centerpiece — Infinite Stagger (mobile portrait)

Top to bottom, the screen is a **vertical signal chain**: status → time → the memory → the
input → the controls. Time (the bar) sits directly under the HUD because it is the second-most
important thing on screen after the board itself.

```
┌─────────────────────────────────────────┐
│  ♥♥♡        0 1 2 4 0 0        BATCH 07   │  HUD  (lives · score · batch)
├─────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░  0:08 │  TIMER BAR (the spine)
├─────────────────────────────────────────┤
│                                         │
│      ┌───────────────────────────┐      │
│      │                           │      │
│      │     12 × 12 BOARD         │      │  THE HERO
│      │   (recessed in bezel)     │      │  + combo layer floats here
│      │        ×4  ↑              │      │
│      └───────────────────────────┘      │
│                                         │
├─────────────────────────────────────────┤
│   [ I ] [ O ] [ T ] [ S ] [ Z ] [ J ]   │  PIECE TRAY (lit tiles + counts)
├─────────────────────────────────────────┤
│   ↻ REPLAY  (−50)          ⏸ PAUSE       │  ACTION ROW (thumb zone)
└─────────────────────────────────────────┘
```

### Anatomy
- **HUD (top, ~56px).** Left: **lives** as hearts (filled = red glow; lost = drained outline).
  Center: **score** in pixel numerals, the loudest text on screen. Right: **BATCH 07** — the
  badge of honor and the difficulty read. Calm, recessed, doesn't compete with the board.
- **Timer bar (full-bleed, ~12px + a 7-seg digit).** *The single most important status
  element.* Full width, no margins — it's the heartbeat. Color = current phase (§1 arc). The
  digit clock is a redundant assist for accessibility, not the primary read.
- **The board (hero).** `min(92vw, 420px)`, square, centered, **sunken into a bezel** so the
  lit gaps float inside a dark frame. Filled cells inert graphite; gridlines barely there.
  This is where the eye lives.
- **Combo layer.** Floats *over* the board, never reflows it: the multiplier (`×4`) rises and
  fades near the last-filled gap; bursts pop on the gap itself.
- **Piece tray.** A horizontal row of **lit tiles**, each showing its tetromino in cyan with a
  count badge. Tap to pick (count ticks up). Dimmed/locked during REVEAL, alive during RECALL.
- **Action row (bottom thumb arc).** **Replay** with its cost chip (`−50`) and **Pause**. Big
  targets, in the natural thumb zone. Replay is styled as a *panic button you pay for* — amber
  outline, cost always visible.

### The rhythm, moment to moment
| Phase | Bar | Board | Tray | Mood |
|---|---|---|---|---|
| **REVEAL** *(watch)* | magenta, **filling** | uniform surface; gaps **bloom & flow one at a time**, then re-seal into it (staggered cascade) | dimmed / locked | held breath |
| **RECALL** *(race)* | amber, **draining** → red under 25% | **uniform blackout** — gaps concealed; correct picks bloom lime | **lit, live** | heating, urgent |
| **CLEAR** *(payoff)* | freezes, then empties amber→lime | lime world-pulse | locks | exhale |
| **ESCALATE** | resets | cyan wipe → new batch slams in | re-lights | re-tension |

The whole loop is a **breath**: inhale on REVEAL (watch the lights), hold through RECALL
(race), exhale on CLEAR (the slow count-up), then snap back in. Pace the count-up generously
and the escalation instantly — reward should feel earned and luxurious; danger should feel
immediate.

---

## 6. Core moments — how they *feel*

> The brief asked for the feel of five moments. These are the spec for "juice."

- **The flash of a gap.** Light floods *through* a magenta shape — flowing across its cells —
  overshoots bright, holds, then decays on the long tail until it's **gone** — the cell sealing
  seamlessly back into the surface, leaving no hole. The only thing you can still half-see is the
  afterimage on your own retina. *You're not shown a gap — you're shown a light going out, and
  told to remember where.* With staggered decays you watch a whole constellation wink out in
  sequence. Optional soft "tick" SFX per flash; a light haptic on the hold.

- **The draining clock.** Amber bar retreating right-to-left, glow *thickening* as it narrows.
  Cross 25% and it pulses red at ~2Hz — peripheral-vision panic without a number you have to
  read. The bar gets *louder* as you run out, not quieter. Rising-pitch SFX optional.

- **The pop of a combo.** Correct pick → lime snap + particle burst on the gap + the multiplier
  rises (`×2 → ×3 → ×4`) brighter and bigger each step. Past the threshold each correct pick
  *celebrates*. Crisp ascending blip; a confident haptic tap. Streaks should feel like
  momentum you don't want to drop.

- **The sting of a miss.** Hard 6px shake, red full-cell flash, a heart flickers white then
  drains to a hollow outline, the combo number shatters and resets to ×1. Buzzer SFX; a sharp
  double-haptic. It should make you flinch — the loss of the *streak* should sting more than
  the lost life.

- **The payoff of a clear.** Everything pulses lime once, the clock stops, and the bar
  **luxuriously** empties amber→lime while the score counts up tick-by-tick — *the more clock
  you left, the longer and richer the count*. A held warm chord, an exhale. Then **BATCH 08**
  wipes in on cyan and the tension snaps back before you've finished smiling.

---

## 7. Components

**Button (lit hardware).** Dark fill (`--panel-raised`), 2px accent border with the §1 glow,
inner top sheen, uppercase `label` text. Press: depress 2px + brighten glow + haptic. Primary
= cyan; destructive/cost = amber; disabled = `--text-faint` border, no glow, no sheen.

**Panel (recessed).** `--panel` fill, sunken bezel (§3.3), optional 3% scanlines. Everything
the player reads sits *inside* the cabinet, never floating flat on top of it.

**Heart (life).** Filled: solid `--red` with glow. Lost: 1-frame white flicker → hollow
outline in `--text-faint`. Count is always implied by the row, never color alone.

**Gap cell.** During REVEAL: light flows through the shape, blooms `--magenta`, holds, then the
light decays to zero and the cell **re-seals to the exact tone of the surface** (the last ~300ms
through an `8% --magenta` tail). At RECALL the cell is **indistinguishable from every other
cell** — the board is one uniform field, the target lives only in your head — and a correct pick
blooms lime.

**Piece tray tile.** `--panel-raised` tile, tetromino rendered in `--cyan`, mono count badge
top-right. Rest: faint cyan edge. Active (RECALL): full glow. Locked (REVEAL): desaturated,
`--text-faint`. Tap: quick `attack` scale-pulse.

**Cost chip.** Tiny amber-outlined pill (`−50`) riding the Replay button — the price is never
hidden.

---

## 8. Accessibility & mobile guardrails (non-negotiable)

Color carries meaning here, so **every meaning has a non-color backup.** This is a hard
requirement, not a nice-to-have.

- **Redundant cues.** Lives = hearts **+** their count. Correct = lime **+** ✓ **+** snap.
  Miss = red **+** ✕ **+** shake. Time = bar width **+** the 7-seg digit. A fully color-blind
  player can still play.
- **Contrast.** All *text* meets ≥ 4.5:1 against its panel. Glow never substitutes for
  contrast — dim the glow before you dim the legibility.
- **Touch.** Targets ≥ 44px. Primary actions live in the bottom thumb arc. The board never
  requires a reach to the top of a tall phone.
- **Motion.** Honor `prefers-reduced-motion` (§4): keep state changes and the count-up, drop
  shakes/particles/overshoot.
- **Texture toggle.** Scanlines, bloom, and vignette are user-dimmable in one setting for
  photosensitivity and low-end GPUs. The game is fully playable with all of it off.
- **No flash hazard.** The red sub-25% pulse stays ≤ 3Hz; no full-screen strobe ever.

---

## 9. Desktop / landscape take

Confident, not just stretched. The board stays the hero, centered, larger, in a deeper bezel
with a stronger vignette so it reads as a cabinet screen in a dark room. The **piece tray
becomes a vertical rail to the right** of the board (thumb logic gives way to mouse logic);
HUD stays a top strip; combo bursts and the count-up scale up — there's room to be theatrical.
The timer bar can hug the board's top edge rather than going full-bleed. Same signal chain,
reflowed for a wide canvas.

---

## 10. The road not taken

I owe you the counter-argument. The real alternative to a dark game is to go the *opposite*
way entirely:

**BLUEPRINT — the drafting table.** Thesis: *memory is spatial, so render the board as an
architect's plan.* Warm paper or cool blueprint-cyan ground, ink-line grid, gaps as drafted
voids, pieces snapping in like stamped components, a quiet T-square precision. Calm, smart,
adult, beautiful — and genuinely good for a *slow* memory game.

**Why I didn't pick it for Stagger:** this mode's verb is **RACE**, and racing wants
adrenaline, not serenity. More decisively — **the central mechanic is an afterimage, and an
afterimage is only legible as light on darkness.** A glowing trace fading on black *is* the
memory crutch; the same trace on white paper is just a smudge. Afterglow makes the art and the
gameplay the same physics. Blueprint makes a lovely poster and a worse game.

(If the slower **Journey** map ever wants its own calmer skin, Blueprint is the one to revive —
the city-map metaphor and drafting language fit it perfectly. Keep it in the drawer.)

---

## Appendix — token starter (CSS custom properties)

```css
:root {
  /* ground */
  --void:#06060B; --panel:#0E0E16; --panel-raised:#15151F;
  --grid-line:#1C1C28; --filled:#2A2D3A; --filled-edge:#3A3E4F;
  /* accents (each = one meaning) */
  --magenta:#FF2D9B;  /* MEMORY  */
  --cyan:#28F0FF;     /* SYSTEM  */
  --amber:#FFC23D;    /* TIME    */
  --red:#FF3B47;      /* DANGER  */
  --lime:#B6FF3C;     /* SUCCESS */
  /* text */
  --text:#EAEAF2; --text-dim:#8A8AA0; --text-faint:#4A4A5C;
  /* glow recipe — swap the color per accent */
  --glow-core: 0 0 6px;   /* tight */
  --glow-halo: 0 0 22px;  /* soft, ~45% alpha */
  /* easing */
  --attack:cubic-bezier(.1,.9,.2,1);
  --decay:cubic-bezier(.3,0,.1,1);
  --mechanical:cubic-bezier(.7,0,.3,1);
}
/* example: a glowing accent shape */
.glow-magenta{ box-shadow: var(--glow-core) var(--magenta),
                           var(--glow-halo) #FF2D9B73; }
```

---

*Product: VANISHING TILES. Art direction: Afterglow — committed; §10 documents the alternative and
why it lost. Hand this to Claude Design with the companion mockup
`mockups/stagger-afterglow.html` for the visual reference.*
