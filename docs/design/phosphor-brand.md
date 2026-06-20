# VANISHING TILES — Brand Bible

**Status:** Name changed 2026-06-20 to **Vanishing Tiles** (a refinement of **Vanishing Shapes**; full lineage: Gap City → Phosphor → Vanishing Shapes → Vanishing Tiles). The phosphor-inspired *visual* system keeps its name, **Afterglow**.
**Companion docs:** art direction lives in [`phosphor-design-system.md`](./phosphor-design-system.md) (palette, type, motion). This doc owns the *name*, the *voice*, and the *naming rules*.

---

## 1. The name

**VANISHING TILES.**

Chosen for clarity and app-store familiarity. The title names the player's experience in two
plain words: you watch the **tiles** (the tetromino gaps) light up, then they **vanish** — and
you race your own memory to refill them. A first-time player scrolling an app store grasps the
premise before reading a line of copy, with none of the explanation the previous "Phosphor"
name required.

It refines the earlier **Vanishing Shapes**: the same direct, names-the-experience idea, but
*tiles* reads as a native mobile-puzzle word (tile / match / mahjong / 2048 all live there), so
it's even more instantly legible as a phone game than *shapes*.

The original "Phosphor" name came from a CRT metaphor — a pixel blooms bright then decays on a
slow tail, the same shape as a fading memory. Elegant, but oblique: it only landed once
explained. We kept its *soul* where it earns its keep — the **visual system** — and moved the
*name* to something direct.

- **Product name:** Vanishing Tiles (display stacked as `VANISHING` / `TILES` in the pixel wordmark).
- **Art direction / design-system name:** *Afterglow* — the phosphor-inspired glow that
  lingers. Use "Afterglow" for the visual system, "Vanishing Tiles" for the game.

## 2. The promise (tagline)

**Primary (shipped on auth + home):** *A memory game.* — plain, frictionless, says what it is.

Alternates, by mood — keep in the drawer, don't ship more than one at a time:
- *Memorize the gaps. Fill them fast.* — the objective, spelled out.
- *Fill the fading.* — terse, imperative, good for an icon/splash.
- *Hold the afterimage.* — for the cerebral/store-copy register.

## 3. The lexicon — one vocabulary, drawn from the CRT

The phosphor world hands us a technically-accurate vocabulary that maps onto features. Use
these words consistently; never invent a synonym when one of these fits.

| Word | What it means (CRT) | What it means (game) |
|---|---|---|
| **Persistence** | how long a phosphor keeps glowing after the beam moves on | how long the image lasts in the player's mind — the thing being tested |
| **Decay** | the glow fading out on its tail | gaps vanishing; the clock/lives draining; the thing you race |
| **Bloom** | the bright over-shoot when a pixel is struck | a gap lighting up; a correct-pick snap |
| **Afterglow** | the residual emission | the art direction; the feeling we chase everywhere |
| **Refresh** | the beam repainting the screen | the next batch slamming in (the cyan wipe) |
| **Trace** | the lingering mark | the named feeling — what we push from timer to combo to failure |

## 4. Mode names — what changes, what stays

The rebrand is a **name change at the product level**, not a rename of every surface. Most
mode names are unbranded and survive untouched.

| Surface | Name | Verdict |
|---|---|---|
| The game | ~~Gap City~~ → ~~Phosphor~~ → ~~Vanishing Shapes~~ → **Vanishing Tiles** | **changes** |
| Endless flagship mode | **Infinite Stagger** | **keep** — "Stagger" (staggered decay + the reel under pressure) is loved and on-theme; it is the centerpiece in the design system. |
| Level-map mode | **Journey** | keep — generic, never "Gap City"-branded. |
| Legacy gauntlet | **Training** | keep. |
| Badges | True Colors · In Order · Don't Blink · Riddle | keep — already memory/light-flavored ("Don't Blink" especially). |

> Note: the in-fiction district slugs `the_hollows` / `the_stacks` / `the_grid` are **not**
> brand strings and do not change.

## 5. Voice & tone

Inherited from the design system's motion law — **fast attack, slow decay.** The writing
should feel the same: hit hard, then resolve.

- **Physical, not abstract.** Light *blooms*, *decays*, *seals*. Avoid generic game-speak
  ("Level up!", "Nice combo!"). Prefer the hardware register.
- **Terse in the action, generous in the payoff.** Mid-run copy is one or two words
  (`MEMORIZE`, `RECALL`, `CLEAR`). The clear/count-up is where it can breathe.
- **Confident, never cute.** It's a dark arcade cabinet, not a mascot platformer.
- **All-caps pixel for hardware** (score, phase prompts, wordmark); **Space Grotesk for
  human sentences** (instructions, store copy). Never let the pixel face write a sentence.

## 6. Naming rules (do / don't)

- **Do** write the product as `VANISHING TILES` (stacked) in the pixel wordmark, "Vanishing Tiles" in running text.
- **Do** use the `vt-*` design tokens in runtime code (renamed `phos-*` → `vs-*` → `vt-*`;
  the CRT-derived *visual* lexicon in §3 is unchanged).
- **Do** reach for the §3 lexicon before any new term.
- **Don't** rewrite dated historical docs (`docs/superpowers/specs/*`, `plans/*`) or old
  mockups — they are records of when the game was Gap City, then Phosphor, then Vanishing
  Shapes. Renaming them falsifies the trail. New docs use **Vanishing Tiles**.
- **Don't** rename applied Supabase migration files (`0008_gap_city_districts.sql`, etc.) —
  migration filenames are immutable history.
- **Don't** silently change localStorage keys (`gapcity:*`) without a migration — it wipes
  every player's saved progress. (Tracked as a decision in the rename plan.)

---

*Name changed to Vanishing Tiles (2026-06-20), refining Vanishing Shapes. Each rename sweep
renamed user-facing strings and the design tokens (`phos-*` → `vs-*` → `vt-*`); dated
specs/plans under `docs/superpowers/*` are left as historical record. Afterglow (the visual
system) is unchanged.*
