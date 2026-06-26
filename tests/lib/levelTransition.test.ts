import { describe, it, expect } from 'vitest'
import { levelTransition } from '../../src/lib/levelTransition'

// levelTransition decides — at a BATCH BOUNDARY only — whether the run stays
// in its current level, completes a level (advancing to whichever level the
// new score now falls in, possibly skipping several), or wins outright by
// crossing the final (crawlers) threshold. Sandbox runs never advance.
describe('levelTransition', () => {
  it('sandbox always continues, regardless of score', () => {
    expect(levelTransition(0, 0, true)).toEqual({ kind: 'continue', nextLevelIndex: 0 })
    expect(levelTransition(20000, 0, true)).toEqual({ kind: 'continue', nextLevelIndex: 0 })
    expect(levelTransition(500000, 4, true)).toEqual({ kind: 'continue', nextLevelIndex: 4 })
    expect(levelTransition(999999, 2, true)).toEqual({ kind: 'continue', nextLevelIndex: 2 })
  })

  it('no threshold crossed → continue at the same level', () => {
    expect(levelTransition(19999, 0, false)).toEqual({ kind: 'continue', nextLevelIndex: 0 })
    expect(levelTransition(0, 0, false)).toEqual({ kind: 'continue', nextLevelIndex: 0 })
  })

  it('crossing 20000 at level 0 → levelComplete, advances to level 1 (twins)', () => {
    expect(levelTransition(20000, 0, false)).toEqual({ kind: 'levelComplete', nextLevelIndex: 1 })
  })

  it('a multi-threshold jump skips straight to the level the score lands in', () => {
    // 120000 is past both solos (20000) and twins (50000) thresholds, landing
    // inside triplets (idx 2, < 200000 transformers threshold)... but
    // levelIndexForScore(120000) actually resolves to idx 3 (>= 100000 triplets
    // threshold crossed too) — verify against the real boundary semantics.
    expect(levelTransition(120000, 0, false)).toEqual({ kind: 'levelComplete', nextLevelIndex: 3 })
  })

  it('score >= 500000 at level 4 → won', () => {
    expect(levelTransition(500000, 4, false)).toEqual({ kind: 'won', nextLevelIndex: 4 })
    expect(levelTransition(999999, 4, false)).toEqual({ kind: 'won', nextLevelIndex: 4 })
  })

  it('won takes priority even if currentLevelIndex lags behind', () => {
    expect(levelTransition(500000, 0, false)).toEqual({ kind: 'won', nextLevelIndex: 0 })
  })
})
