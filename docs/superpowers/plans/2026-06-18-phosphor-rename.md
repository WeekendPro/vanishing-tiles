# Phosphor Rename — Implementation Plan

**Date:** 2026-06-18
**Spec/brand:** [`docs/design/phosphor-brand.md`](../../design/phosphor-brand.md)
**Goal:** Propagate the `Gap City → Phosphor` rebrand through the **runtime/player-facing**
surface only. Historical docs, mockups, and applied migrations are intentionally left as-is
(see brand bible §6).

## Scope

This is a string/identity change, not a behavior change. The runtime surface is small and
fully enumerated below. No game logic, scoring, or layout changes.

### In scope — files to change

| File | Current | Change |
|---|---|---|
| `src/components/ui/Wordmark.tsx` | `Gap`/`City`, `'Gap City'`, JSDoc | render `PHOSPHOR`; the `stacked` two-line treatment no longer splits cleanly — decide single-line vs. a deliberate stack (see Decisions). |
| `index.html` | `<title>Gap City</title>` | `<title>Phosphor</title>` |
| `package.json` | `"name": "gap-city"` | `"name": "phosphor"` |
| `src/components/JourneyScreen.tsx:84` | `Gap City cleared` | copy decision (see Decisions) |
| `src/components/JourneyMap/MentalMapBrain.tsx:284` | `GAP CITY` label | `PHOSPHOR` |
| `CLAUDE.md:1` | `# Gap City — Project Context` | `# Phosphor — Project Context` (+ first paragraph) |
| `tests/components/ui/Wordmark.test.tsx` | asserts wordmark text | update expected text to Phosphor |
| `tests/components/JourneyScreen.test.tsx:93,100` | `/Gap City cleared/i` | match the new copy |

### Out of scope — deliberately unchanged

- `docs/superpowers/specs/*` and `plans/*` dated docs — historical record.
- `mockups/*` — preserved per the "save all mockups" rule.
- `supabase/migrations/0008_gap_city_districts.sql`, `0009_gap_city_fictional_names.sql`
  — applied migration filenames are immutable.
- District slugs `the_hollows` / `the_stacks` / `the_grid` — not brand strings.
- `supabase/seed.sql`, `supabase/functions/_shared/core/levelConfig.ts`,
  `supabase/tests/*`, `tests/core/levelConfig.test.ts` — these match on internal
  `gap_city`/slug identifiers, not the player-facing brand. Leave unless a trivial comment.
- `docs/HANDOFF.md` — optional header touch-up, low priority.

## Decisions to confirm before implementing

1. **localStorage keys** (`gapcity:settings:v1`, `gapcity:progress:v1`).
   - **Recommended: keep them.** They're invisible to players; renaming them silently wipes
     saved progress and high scores. Revisit only if/when we add a real migration path.
   - Alternative: rename to `phosphor:*` with a one-time read-old-write-new migration.
2. **"Gap City cleared" copy.** This fires when the whole journey is complete. Options:
   - `Phosphor cleared` (literal swap), or
   - rephrase to fit the lexicon, e.g. `All lit.` / `Journey cleared`. Recommend `Journey
     cleared` — "Phosphor cleared" reads oddly since Phosphor is the product, not a place.
3. **Stacked wordmark.** `Gap`/`City` stacked over two lines was a hero treatment. `PHOSPHOR`
   is one word — either drop `stacked` (single-line hero) or stack as `PHOS`/`PHOR`.
   Recommend single-line; revisit with the Afterglow visual pass.

## Steps (TDD where tests exist)

1. **Wordmark.** Update `Wordmark.tsx` to render `PHOSPHOR`; resolve the `stacked` prop per
   Decision 3. Update `tests/components/ui/Wordmark.test.tsx` first (red → green).
2. **Journey strings.** Update `JourneyScreen.tsx:84` and `MentalMapBrain.tsx:284` per
   Decision 2; update the two assertions in `JourneyScreen.test.tsx`.
3. **App shell.** `index.html` title + `package.json` name.
4. **CLAUDE.md.** Header + the opening "A memory-and-speed puzzle game…" paragraph to name
   Phosphor. Keep the rest (architecture, rules) intact.
5. **Verify.** `npm run test` (all pass) → `npm run build` (catches `noUnusedLocals` + types)
   → run the dev server and eyeball the wordmark on Home, Auth, and Journey screens.

## Verification checklist

- [ ] `npm run test` green
- [ ] `npm run build` clean
- [ ] Wordmark reads `PHOSPHOR` on Home / Auth / Journey
- [ ] Browser tab title reads `Phosphor`
- [ ] No remaining player-facing "Gap City" (grep the runtime surface, not docs/mockups)
- [ ] Saved progress still loads (localStorage keys unchanged, per Decision 1)

## Risk

Low. Pure string/identity edits with test coverage on the two visible strings. The only
trap is the localStorage keys (Decision 1) — leaving them as-is is the safe default.

## Not in this plan (tracked elsewhere)

- **Afterglow visual system** rollout (palette/type/motion from the design-system doc) — a
  separate, larger effort.
- **DesignSync push** of the `design-system/` component library to Claude Design — blocked
  on `/login`; not code, handled interactively.
