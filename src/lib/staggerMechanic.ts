/**
 * Sandbox mechanic coupling + override resolution for Infinite Stagger's
 * calibration sandbox (dev/preview only).
 *
 * Normal runs drive the reveal mechanic (pairs/triples/inverted) from the
 * difficulty CURVE via `batchIndex` (see staggerCurve.ts). In a sandbox the
 * level is LOCKED but `batchIndex` keeps climbing, so the curve would drift the
 * mechanic off the locked level name. These pure helpers re-couple the reveal
 * to the locked level's `mechanic.kind`, and layer the live tuning-panel
 * overrides on top — each override is a thin "use this instead of the default"
 * value that maps cleanly back onto the curve constants (null = use default).
 *
 * All functions are pure (unit-tested in tests/lib/staggerMechanic.test.ts);
 * the store calls them only when `sandboxLevel != null`.
 */
import { STAGGER, gapCountForBatch, selectDurationForBatch } from './staggerCurve'
import type { LevelMechanic, StaggerLevel } from './staggerLevels'

/** How many of a batch's gaps reveal as pairs / triples / inverted solos. The
 *  rest are plain single beats. Mirrors the curve's pair/triple/inverted levers
 *  so the same downstream reveal-plan code (buildRevealPlan) consumes it. */
export interface RevealCounts {
  pairs: number
  triples: number
  inverted: number
}

/** The ephemeral tuning-panel overrides. `null` = "use the mechanic/curve/
 *  constant default"; a number replaces that default for the sandbox run. Reset
 *  to all-null on every `startRun`; never persisted. */
export interface SandboxOverrides {
  gapCount: number | null
  pairs: number | null
  revealStepMs: number | null
  revealBloomMs: number | null
  revealWaveMs: number | null
  twinOffsetMs: number | null
  multiplier: number | null
  selectDuration: number | null
}

/** The neutral overrides object — every field deferring to its default. */
export const NO_OVERRIDES: SandboxOverrides = {
  gapCount: null,
  pairs: null,
  revealStepMs: null,
  revealBloomMs: null,
  revealWaveMs: null,
  twinOffsetMs: null,
  multiplier: null,
  selectDuration: null,
}

/** Map a level's defining `mechanic.kind` to the reveal counts for a board of
 *  `gapCount` gaps. Each mechanic uses ONE chunk type, so the feasibility rule
 *  (2·P + 3·Tr + Inv ≤ N) holds by construction:
 *
 *    singles    → all solo beats
 *    pairs      → ⌊N/2⌋ pairs           (TWINS: max pairing, the acceptance target)
 *    triples    → ⌊N/3⌋ triples
 *    transform  → ⌊N/3⌋ triples, then pairs from the leftover gaps (densest blend)
 *    crawl      → singles fallback this pass (mechanic deferred)
 */
export function revealCountsForMechanic(kind: LevelMechanic['kind'], gapCount: number): RevealCounts {
  const n = Math.max(0, gapCount)
  switch (kind) {
    case 'pairs':
      return { pairs: Math.floor(n / 2), triples: 0, inverted: 0 }
    case 'triples':
      return { pairs: 0, triples: Math.floor(n / 3), inverted: 0 }
    case 'transform': {
      const triples = Math.floor(n / 3)
      const pairs = Math.floor((n - 3 * triples) / 2)
      return { pairs, triples, inverted: 0 }
    }
    case 'singles':
    case 'crawl':
    default:
      return { pairs: 0, triples: 0, inverted: 0 }
  }
}

/** Effective gap count for a sandbox batch: the override, else the curve value,
 *  clamped to a playable [1, MAX_GAPS]. */
export function resolveGapCount(batchIndex: number, o: SandboxOverrides): number {
  const base = o.gapCount ?? gapCountForBatch(batchIndex)
  return Math.max(1, Math.min(STAGGER.MAX_GAPS, Math.floor(base)))
}

/** Effective reveal counts for a sandbox batch: start from the locked level's
 *  mechanic, then let a `pairs` override substitute the pair count — clamped to
 *  the gaps left after the mechanic's triples/inverted (2·P ≤ N − 3·Tr − Inv) so
 *  it can never overflow the board. */
export function resolveRevealCounts(level: StaggerLevel, gapCount: number, o: SandboxOverrides): RevealCounts {
  const base = revealCountsForMechanic(level.mechanic.kind, gapCount)
  if (o.pairs == null) return base
  const maxPairs = Math.max(0, Math.floor((gapCount - 3 * base.triples - base.inverted) / 2))
  return { ...base, pairs: Math.max(0, Math.min(Math.floor(o.pairs), maxPairs)) }
}

/** The reveal/decay timing the screen's reveal driver should use this batch. */
export interface ResolvedTiming {
  stepMs: number
  bloomMs: number
  waveMs: number
  twinOffsetMs: number
}

/** Effective reveal timing: each field is its override, else the STAGGER constant. */
export function resolveTiming(o: SandboxOverrides): ResolvedTiming {
  return {
    stepMs: o.revealStepMs ?? STAGGER.REVEAL_STEP_MS,
    bloomMs: o.revealBloomMs ?? STAGGER.REVEAL_BLOOM_MS,
    waveMs: o.revealWaveMs ?? STAGGER.REVEAL_WAVE_MS,
    twinOffsetMs: o.twinOffsetMs ?? STAGGER.REVEAL_TWIN_OFFSET_MS,
  }
}

/** Effective per-pick score multiplier: the override, else the level's. */
export function resolveMultiplier(level: StaggerLevel, o: SandboxOverrides): number {
  return o.multiplier ?? level.multiplier
}

/** Effective select-clock duration (ms): the override, else the curve value. */
export function resolveSelectDuration(batchIndex: number, o: SandboxOverrides): number {
  return o.selectDuration ?? selectDurationForBatch(batchIndex)
}
