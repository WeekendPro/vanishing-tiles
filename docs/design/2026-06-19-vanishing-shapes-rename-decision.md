# Naming Decision — Phosphor → Vanishing Shapes

**Date:** 2026-06-19
**Status:** Decided and shipped (runtime + living docs renamed; see commit on
`claude/game-title-brainstorm-eccbbe`).
**Companion docs:** [`phosphor-brand.md`](./phosphor-brand.md) (brand bible — now titled
*Vanishing Shapes*) · [`phosphor-design-system.md`](./phosphor-design-system.md) (Afterglow
visual system, unchanged).

---

## TL;DR

The game is renamed **Phosphor → Vanishing Shapes**. The driver is **friction of
understanding**: "Phosphor" is a strong name *once explained*, but a first-time player can't
decode it on sight. "Vanishing Shapes" describes the actual experience — you memorize gap
**shapes**, they **vanish**, and you race to refill them — so a stranger grasps the premise
before reading a word. The **Afterglow** visual system (which is genuinely phosphor-inspired)
is kept as-is; only the product *name* changed.

This is the third name in the project's history: **Gap City → Phosphor → Vanishing Shapes.**

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
