import { describe, it, expect } from 'vitest'
import {
  revealCountsForMechanic,
  resolveRevealCounts,
  resolveGapCount,
  resolveTiming,
  resolveMultiplier,
  resolveSelectDuration,
  NO_OVERRIDES,
  type SandboxOverrides,
} from '../../src/lib/staggerMechanic'
import { STAGGER, gapCountForBatch, selectDurationForBatch } from '../../src/lib/staggerCurve'
import { levelByKey } from '../../src/lib/staggerLevels'

/** An overrides object with the given fields patched onto the all-null default. */
function ov(patch: Partial<SandboxOverrides>): SandboxOverrides {
  return { ...NO_OVERRIDES, ...patch }
}

describe('revealCountsForMechanic', () => {
  it('singles → all solo beats (no chunks)', () => {
    expect(revealCountsForMechanic('singles', 6)).toEqual({ pairs: 0, triples: 0, inverted: 0 })
  })

  it('pairs → max pairing, floor(N/2)', () => {
    expect(revealCountsForMechanic('pairs', 6)).toEqual({ pairs: 3, triples: 0, inverted: 0 })
    expect(revealCountsForMechanic('pairs', 5)).toEqual({ pairs: 2, triples: 0, inverted: 0 })
    expect(revealCountsForMechanic('pairs', 1)).toEqual({ pairs: 0, triples: 0, inverted: 0 })
  })

  it('triples → max tripling, floor(N/3)', () => {
    expect(revealCountsForMechanic('triples', 12)).toEqual({ pairs: 0, triples: 4, inverted: 0 })
    expect(revealCountsForMechanic('triples', 7)).toEqual({ pairs: 0, triples: 2, inverted: 0 })
  })

  it('transform → triples first, then pairs from the remainder (feasible blend)', () => {
    // N=8: triples=2 (uses 6 gaps), remainder 2 → 1 pair. 2·1 + 3·2 = 8 ≤ 8 ✓
    expect(revealCountsForMechanic('transform', 8)).toEqual({ pairs: 1, triples: 2, inverted: 0 })
  })

  it('crawl → singles fallback this pass (no chunks)', () => {
    expect(revealCountsForMechanic('crawl', 6)).toEqual({ pairs: 0, triples: 0, inverted: 0 })
  })

  it('never exceeds the feasibility budget 2·P + 3·Tr ≤ N for any kind/N', () => {
    for (const kind of ['singles', 'pairs', 'triples', 'transform', 'crawl'] as const) {
      for (let n = 0; n <= 12; n++) {
        const c = revealCountsForMechanic(kind, n)
        expect(2 * c.pairs + 3 * c.triples + c.inverted).toBeLessThanOrEqual(n)
      }
    }
  })
})

describe('resolveGapCount', () => {
  it('falls through to the curve when not overridden', () => {
    expect(resolveGapCount(0, NO_OVERRIDES)).toBe(gapCountForBatch(0))
  })

  it('honors an override, clamped to [1, MAX_GAPS]', () => {
    expect(resolveGapCount(0, ov({ gapCount: 8 }))).toBe(8)
    expect(resolveGapCount(0, ov({ gapCount: 99 }))).toBe(STAGGER.MAX_GAPS)
    expect(resolveGapCount(0, ov({ gapCount: 0 }))).toBe(1)
  })
})

describe('resolveRevealCounts', () => {
  const twins = levelByKey('twins')
  const solos = levelByKey('solos')

  it('uses the level mechanic when pairs not overridden', () => {
    expect(resolveRevealCounts(twins, 6, NO_OVERRIDES)).toEqual({ pairs: 3, triples: 0, inverted: 0 })
  })

  it('a pairs override wins, clamped to the feasible max', () => {
    expect(resolveRevealCounts(twins, 6, ov({ pairs: 1 }))).toEqual({ pairs: 1, triples: 0, inverted: 0 })
    expect(resolveRevealCounts(twins, 6, ov({ pairs: 99 }))).toEqual({ pairs: 3, triples: 0, inverted: 0 })
  })

  it('a pairs override can force pairs onto a non-pairs mechanic', () => {
    expect(resolveRevealCounts(solos, 6, ov({ pairs: 2 }))).toEqual({ pairs: 2, triples: 0, inverted: 0 })
  })

  it('clamps a pairs override against gaps already spent on triples/inverted', () => {
    // transform base at N=8 is { pairs:1, triples:2 } → 6 gaps spent on triples,
    // leaving floor((8-6)/2)=1 pair max regardless of the requested override.
    const transformers = levelByKey('transformers')
    expect(resolveRevealCounts(transformers, 8, ov({ pairs: 9 }))).toEqual({ pairs: 1, triples: 2, inverted: 0 })
  })
})

describe('resolveTiming', () => {
  it('falls through to the STAGGER constants when not overridden', () => {
    expect(resolveTiming(NO_OVERRIDES)).toEqual({
      stepMs: STAGGER.REVEAL_STEP_MS,
      bloomMs: STAGGER.REVEAL_BLOOM_MS,
      waveMs: STAGGER.REVEAL_WAVE_MS,
      twinOffsetMs: STAGGER.REVEAL_TWIN_OFFSET_MS,
    })
  })

  it('honors per-field overrides, leaving the rest at default', () => {
    expect(resolveTiming(ov({ revealStepMs: 500, twinOffsetMs: 0 }))).toEqual({
      stepMs: 500,
      bloomMs: STAGGER.REVEAL_BLOOM_MS,
      waveMs: STAGGER.REVEAL_WAVE_MS,
      twinOffsetMs: 0,
    })
  })
})

describe('resolveMultiplier', () => {
  it('uses the level multiplier by default, an override otherwise', () => {
    const twins = levelByKey('twins')
    expect(resolveMultiplier(twins, NO_OVERRIDES)).toBe(2)
    expect(resolveMultiplier(twins, ov({ multiplier: 5 }))).toBe(5)
  })
})

describe('resolveSelectDuration', () => {
  it('falls through to the curve, honors an override', () => {
    expect(resolveSelectDuration(0, NO_OVERRIDES)).toBe(selectDurationForBatch(0))
    expect(resolveSelectDuration(0, ov({ selectDuration: 8000 }))).toBe(8000)
  })
})
