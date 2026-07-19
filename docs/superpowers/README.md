# Design archive — dated historical records (NOT current state)

> **Read this before treating anything in `specs/` or `plans/` as true.**

Every file under `specs/` and `plans/` is a **point-in-time design or implementation
record**, named with the date it was written. They are a lab notebook, not documentation
of how the game works today.

**The rule:** these capture *what we decided and why, on that date*. They are **frozen** —
we don't edit them to match later changes; when direction moves, a newer dated doc
supersedes an older one. Many of these describe features that were later reworked or
**removed entirely** — Journey, Practice, multi-round themed levels, the Gap City transit
map, per-station gating, the git/brain map variants, star scoring, and more. A doc
describing one of those isn't "wrong," it's history.

**When one of these conflicts with the code, the code wins.** For how the game actually
works today, read (in order): `README.md`, `CLAUDE.md`, and the living design docs under
`docs/design/`. For the *rationale* behind a past decision, read the relevant dated file
here.

Why keep them at all? The **"why"** is the single most expensive thing to reconstruct
later, and it doesn't go stale the way "current state" does. They also record the arc of
the design as it evolved — deliberately preserved.

Anchors worth knowing:
- **Infinite Stagger, original design** — `specs/2026-06-16-infinite-stagger-design.md`
- **Three-mode MVP simplification** (the pivot to today's shipped shape) — `plans/2026-07-15-three-mode-mvp-simplification.md`
- **Naming history** (Gap City → Phosphor → Vanishing Shapes → Vanishing Tiles) — `../design/2026-06-19-vanishing-shapes-rename-decision.md`
