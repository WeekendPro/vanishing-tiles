import { describe, it, expect } from 'vitest'
import { makeRng, randomSeed } from '@shared/core/prng'

describe('seeded PRNG', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng('seed-1'); const b = makeRng('seed-1')
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).toEqual(seqB)
  })
  it('differs across seeds', () => {
    const a = makeRng('seed-1'); const b = makeRng('seed-2')
    expect(a()).not.toBe(b())
  })
  it('returns values in [0,1)', () => {
    const r = makeRng('x')
    for (let i = 0; i < 100; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
  it('randomSeed produces distinct non-empty strings', () => {
    expect(randomSeed()).not.toBe(randomSeed())
    expect(randomSeed().length).toBeGreaterThan(0)
  })
})
