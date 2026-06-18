# PHOSPHOR — Brand Bible

**Status:** Name settled 2026-06-18. Replaces "Gap City."
**Companion docs:** art direction lives in [`phosphor-design-system.md`](./phosphor-design-system.md) (palette, type, motion). This doc owns the *name*, the *voice*, and the *naming rules*.

---

## 1. The name

**PHOSPHOR.**

Chosen because the metaphor *is* the mechanic. A phosphor pixel is struck, blooms
bright, then **decays on a slow tail** — leaving a ghost on the glass and a ghost on your
retina. That is exactly the act of play: a gap flashes, vanishes, and you race the decay of
your own short-term memory to refill it. The aesthetic (afterglow on black) and the
gameplay (hold the afterimage) are the same physical phenomenon. No other candidate name
fused identity and mechanic this cleanly.

- **Product name:** Phosphor (display as `PHOSPHOR` in the pixel wordmark).
- **Art direction / design-system name:** *Afterglow* — the sibling word, the glow that
  lingers. Use "Afterglow" when referring to the visual system, "Phosphor" for the game.

## 2. The promise (tagline)

**Primary:** *Memory glows. Then it's gone.*

Alternates, by mood — keep in the drawer, don't ship more than one at a time:
- *Fill the fading.* — terse, imperative, good for an icon/splash.
- *Catch the light before it dies.* — urgency-forward.
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
| The game | ~~Gap City~~ → **Phosphor** | **changes** |
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

- **Do** write the product as `PHOSPHOR` in the pixel wordmark, "Phosphor" in running text.
- **Do** reach for the §3 lexicon before any new term.
- **Don't** rewrite dated historical docs (`docs/superpowers/specs/*`, `plans/*`) or old
  mockups to say "Phosphor" — they are records of when the game was Gap City. Renaming them
  falsifies the trail. New docs use Phosphor.
- **Don't** rename applied Supabase migration files (`0008_gap_city_districts.sql`, etc.) —
  migration filenames are immutable history.
- **Don't** silently change localStorage keys (`gapcity:*`) without a migration — it wipes
  every player's saved progress. (Tracked as a decision in the rename plan.)

---

*Name settled. Next: propagate through the runtime (see
`docs/superpowers/plans/2026-06-18-phosphor-rename.md`) and push the Afterglow component
library to Claude Design once `/login` unblocks DesignSync.*
