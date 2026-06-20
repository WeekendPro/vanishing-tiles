# Naming Decision — Phosphor → Vanishing Shapes → Vanishing Tiles

**Date:** 2026-06-19 (Phosphor → Vanishing Shapes) · updated 2026-06-20 (→ Vanishing Tiles)
**Status:** Decided and shipped (runtime + living docs renamed on `main`).
**Companion docs:** [`phosphor-brand.md`](./phosphor-brand.md) (brand bible — now titled
*Vanishing Tiles*) · [`phosphor-design-system.md`](./phosphor-design-system.md) (Afterglow
visual system, unchanged).

> **This doc records a chain of renames.** The body below explains the Phosphor → Vanishing
> Shapes decision; the **Update (2026-06-20)** section right after the TL;DR covers the
> refinement to **Vanishing Tiles**. Vanishing Shapes was a real, shipped decision, so its
> rationale is kept intact rather than rewritten.

---

## TL;DR

The game is renamed **Phosphor → Vanishing Shapes**. The driver is **friction of
understanding**: "Phosphor" is a strong name *once explained*, but a first-time player can't
decode it on sight. "Vanishing Shapes" describes the actual experience — you memorize gap
**shapes**, they **vanish**, and you race to refill them — so a stranger grasps the premise
before reading a word. The **Afterglow** visual system (which is genuinely phosphor-inspired)
is kept as-is; only the product *name* changed.

This is the third name in the project's history: **Gap City → Phosphor → Vanishing Shapes.**
(Since refined once more — see the Update below — making **Vanishing Tiles** the fourth.)

---

## Update — 2026-06-20: Vanishing Shapes → Vanishing Tiles

Vanishing Shapes shipped, but the word *Shapes* didn't land as hoped in practice. We swapped
the noun to **Tiles**, keeping everything else about the decision intact:

- **Same rationale, sharper execution.** The goal is unchanged — name the player's experience
  with maximum legibility. *Tiles* is simply a more **app-native** word than *Shapes*: it reads
  instantly as "a phone puzzle game" because the whole tile / match / mahjong / 2048 category
  has trained players to expect it.
- **Small trade-off, eyes open.** The gaps are technically multi-cell **tetromino** shapes, and
  *tile* can imply a single square. In practice a newcomer reads "tile" as "game piece" and
  doesn't over-think it — the gain in familiarity outweighs the literal imprecision.
- **Scope:** a further sweep identical in shape to the first — all user-facing strings plus the
  internal design tokens, which moved `vs-*` → `vt-*` (Vanishing **S**hapes → Vanishing
  **T**iles). The font and the Afterglow visual system were untouched; only text and token
  names changed.

Everything in the sections below still applies — it's the same memorize-then-refill game with
the same Afterglow look. Only the noun in the title moved one notch toward clarity.

---

## Context

"Phosphor" was settled on 2026-06-18 (replacing the "Gap City" codename). Its rationale was
elegant: a CRT phosphor pixel is struck, blooms bright, then **decays on a slow tail**,
leaving a ghost on the glass and on your retina — the same shape as a fading memory. The
aesthetic (afterglow on black) and the mechanic (hold the afterimage) are literally the same
physical phenomenon.

That cleverness is also the problem.

## The problem with "Phosphor"

Feedback on the name was consistent: it reads **mature and makes sense — but only once it's
been explained.** Understanding it requires knowing what a phosphor is, knowing that
phosphors have *persistence / afterglow*, and then mapping that decay onto human memory.
That's a three-hop metaphor. A common person scrolling an app store next to *Candy Crush*
makes none of those hops.

For a mobile app aimed at the broadest possible audience, the goal is **minimal friction to
understanding the premise and objective.** A name that needs a paragraph of explanation works
against that goal, however poetic it is.

## What we were optimizing for

1. **Instant legibility** — the common person grasps the premise on sight.
2. **Describes the experience** — names what the player actually does, not a metaphor for it.
3. **App-store viable** — short, memorable, reasonably ownable/searchable.
4. **Not pretentious** — a dark arcade cabinet, not a "thinking man's game."

## Alternatives considered

| Candidate | Why not |
|---|---|
| **Mind the Gap** | Strong double-meaning and tied to the (then-present) transit map, but: under-30 US players were unfamiliar with the phrase; "Mind" read as a *thinking-man's* game (pretentious); and we're moving away from map concepts entirely. |
| **Fill the Gaps / Gapfill** | Maximally clear and on-objective; "Gapfill" is very ownable. Kept as a strong fallback, but "fill the gaps" is a crowded idiom and leans utilitarian. |
| **Vacant Spaces** | Accurate but static/real-estate flat; "Spaces" is generic and collides with productivity apps. |
| **"…Pieces" variants** (Vanishing/Fading/Decaying Pieces) | Mechanically backwards — pieces are the *tools* you place; they don't vanish. The fleeting thing is the gap. |
| **Avoid the Void / Vanishing Void** | Catchy, but markets the *opposite* action: you **fill** the void, you don't avoid it. |
| **Decay family** (Space/Shape Decay) | "Decay" leans rot/sci-fi and is arguably more obscure than "Mind." |

### The sorting insight

The brainstorm paired an **ephemeral adjective** (*vanishing / fading / dissolving*) with a
**noun**, and the noun decided everything:

- **"Pieces"** are the permanent tools you place — they don't vanish (backwards).
- **"Spaces"** is abstract and crowded (productivity-app collisions).
- **"Shapes"** is the winner — the gaps you memorize *are* tetromino shapes, they're the
  thing that's actually fleeting, and "shape" is concrete and visual.

→ **ephemeral adjective + "Shapes"**, which lands on **Vanishing Shapes**.

## Decision

**Vanishing Shapes.** It names the player's experience in two plain words: you watch the
**shapes**, they **vanish**, and you race your own memory to refill them. It needs no
explanation, it's concrete and visual, and it's distinct enough to own.

### Tagline

- **Primary (shipped on auth + home):** *A memory game.* — plain, frictionless.
- **Alternate:** *Memorize the gaps. Fill them fast.* — the objective, spelled out.

### What we kept from "Phosphor"

The CRT metaphor's *soul* still earns its keep in the **visual system**, which remains
**Afterglow** — gaps bloom and decay on a slow tail; the wordmark glows on void-black. The
title's signature motif is a mini board where tetromino gap shapes bloom, then **vanish** —
the name demonstrating the mechanic. So the phosphor idea didn't die; it moved from the
*name* (where it was oblique) to the *art direction* (where it's just a beautiful look).

## Scope of the rename

A string/identity change, not a behavior change. See the brand bible §6 for the standing
rules. In short:

- **Changed:** the wordmark, page title, package name, all user-facing labels, the runtime
  design tokens (`phos-*` → `vs-*`), test assertions, `CLAUDE.md`, and the living
  design-system / brand docs.
- **Kept deliberately:** dated `docs/superpowers/*` specs/plans and pre-existing mockups
  (historical record), applied Supabase migration filenames (immutable history), and the
  `gapcity:*` localStorage keys (changing them silently would wipe player progress).
- **Visual system unchanged:** Afterglow keeps its name and its phosphor-derived lexicon
  (bloom / decay / persistence) — that vocabulary describes the *light*, not the title.

## Trade-offs we're accepting

- **"Shapes" / two-word titles** are slightly less ownable than a coined single word
  (e.g. "Gapfill"); mitigated by the distinctive stacked wordmark and the vanishing-gap
  motif.
- **The name doesn't signal *speed*** (the time-pressure half of the game). The tagline and
  store copy carry that; the title carries the premise.
- A small amount of internal lineage now spans three names (Gap City → Phosphor → Vanishing
  Shapes); kept honest by leaving historical docs as records rather than rewriting them.
