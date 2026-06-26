import { describe, it, expect } from 'vitest'
import {
  STAGGER_LEVELS,
  levelIndexForScore,
  levelForScore,
  nextThreshold,
  isWon,
  levelByKey,
  levelIndexByKey,
} from './staggerLevels'

describe('STAGGER_LEVELS', () => {
  it('has the exact 5 keys/names/thresholds/multipliers, in order', () => {
    expect(STAGGER_LEVELS.map(l => l.key)).toEqual([
      'solos', 'twins', 'triplets', 'transformers', 'crawlers',
    ])
    expect(STAGGER_LEVELS.map(l => l.name)).toEqual([
      'SOLOS', 'TWINS', 'TRIPLETS', 'TRANSFORMERS', 'CRAWLERS',
    ])
    expect(STAGGER_LEVELS.map(l => l.threshold)).toEqual([
      20000, 50000, 100000, 200000, 500000,
    ])
    expect(STAGGER_LEVELS.map(l => l.multiplier)).toEqual([1, 2, 3, 4, 5])
  })

  it('maps each level to its mechanic kind', () => {
    expect(STAGGER_LEVELS.map(l => l.mechanic.kind)).toEqual([
      'singles', 'pairs', 'triples', 'transform', 'crawl',
    ])
  })
})

// Boundary semantics: thresholds are the score at which a level *completes*.
// While climbing a level, the active level is the one being climbed; at
// exactly its threshold the player has completed it and the NEXT level
// becomes active. `levelIndexForScore` therefore uses `score >= threshold`
// to advance past a level.
describe('boundary semantics', () => {
  const cases: { score: number; index: number; key: string; nextThreshold: number; isWon: boolean }[] = [
    { score: 0,      index: 0, key: 'solos',        nextThreshold: 20000,  isWon: false },
    { score: 19999,  index: 0, key: 'solos',        nextThreshold: 20000,  isWon: false },
    { score: 20000,  index: 1, key: 'twins',        nextThreshold: 50000,  isWon: false },
    { score: 49999,  index: 1, key: 'twins',        nextThreshold: 50000,  isWon: false },
    { score: 50000,  index: 2, key: 'triplets',     nextThreshold: 100000, isWon: false },
    { score: 100000, index: 3, key: 'transformers', nextThreshold: 200000, isWon: false },
    { score: 199999, index: 3, key: 'transformers', nextThreshold: 200000, isWon: false },
    { score: 200000, index: 4, key: 'crawlers',     nextThreshold: 500000, isWon: false },
    { score: 499999, index: 4, key: 'crawlers',     nextThreshold: 500000, isWon: false },
    { score: 500000, index: 4, key: 'crawlers',     nextThreshold: 500000, isWon: true },
    { score: 999999, index: 4, key: 'crawlers',     nextThreshold: 500000, isWon: true },
  ]

  for (const c of cases) {
    it(`score ${c.score} -> index ${c.index} (${c.key}), nextThreshold ${c.nextThreshold}, isWon ${c.isWon}`, () => {
      expect(levelIndexForScore(c.score)).toBe(c.index)
      expect(levelForScore(c.score).key).toBe(c.key)
      expect(nextThreshold(c.score)).toBe(c.nextThreshold)
      expect(isWon(c.score)).toBe(c.isWon)
    })
  }
})

describe('levelByKey / levelIndexByKey', () => {
  it('looks up the level object and index by key', () => {
    expect(levelByKey('solos').key).toBe('solos')
    expect(levelByKey('crawlers').threshold).toBe(500000)
    expect(levelIndexByKey('solos')).toBe(0)
    expect(levelIndexByKey('twins')).toBe(1)
    expect(levelIndexByKey('triplets')).toBe(2)
    expect(levelIndexByKey('transformers')).toBe(3)
    expect(levelIndexByKey('crawlers')).toBe(4)
  })
})
