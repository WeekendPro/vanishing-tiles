import { describe, it, expect } from 'vitest'
import {
  componentScore, levelStarsFromTotal, difficultyPips, sumBests, mockGlobalRecord,
} from '../../src/lib/journeyScoring'

describe('componentScore', () => {
  it('returns 0 when unsolved', () => {
    expect(componentScore({ solved: false, livesLost: 0, consumed: 0, allotted: 1000 })).toBe(0)
  })
  it('the 97 example: no lives lost, 10% consumed → ceil(65 + 31.5) = 97', () => {
    expect(componentScore({ solved: true, livesLost: 0, consumed: 100, allotted: 1000 })).toBe(97)
  })
  it('subtracts 10 per life lost from the base', () => {
    expect(componentScore({ solved: true, livesLost: 1, consumed: 0, allotted: 1000 })).toBe(90)
    expect(componentScore({ solved: true, livesLost: 2, consumed: 0, allotted: 1000 })).toBe(80)
  })
  it('caps at 100 and floors speed at 0', () => {
    expect(componentScore({ solved: true, livesLost: 0, consumed: 0, allotted: 1000 })).toBe(100)
    expect(componentScore({ solved: true, livesLost: 0, consumed: 5000, allotted: 1000 })).toBe(65)
  })
  it('treats a zero/negative allotted as fully consumed (speed 0)', () => {
    expect(componentScore({ solved: true, livesLost: 0, consumed: 0, allotted: 0 })).toBe(65)
  })
})

describe('levelStarsFromTotal', () => {
  it('is 0 when main is not solved, regardless of total', () => {
    expect(levelStarsFromTotal(300, false)).toBe(0)
  })
  it('maps totals to stars at the tier boundaries', () => {
    expect(levelStarsFromTotal(1, true)).toBe(1)
    expect(levelStarsFromTotal(149, true)).toBe(1)
    expect(levelStarsFromTotal(150, true)).toBe(2)
    expect(levelStarsFromTotal(250, true)).toBe(3)
    expect(levelStarsFromTotal(350, true)).toBe(4)
    expect(levelStarsFromTotal(450, true)).toBe(5)
    expect(levelStarsFromTotal(500, true)).toBe(5)
  })
})

describe('difficultyPips', () => {
  it('buckets gapCount into 1..5', () => {
    expect(difficultyPips(3)).toBe(1)
    expect(difficultyPips(4)).toBe(1)
    expect(difficultyPips(5)).toBe(2)
    expect(difficultyPips(7)).toBe(2)
    expect(difficultyPips(8)).toBe(3)
    expect(difficultyPips(10)).toBe(3)
    expect(difficultyPips(11)).toBe(4)
    expect(difficultyPips(13)).toBe(4)
    expect(difficultyPips(14)).toBe(5)
    expect(difficultyPips(16)).toBe(5)
  })
  it('clamps out-of-range inputs', () => {
    expect(difficultyPips(1)).toBe(1)
    expect(difficultyPips(99)).toBe(5)
  })
})

describe('sumBests', () => {
  it('sums all five component bests', () => {
    expect(sumBests({ main: 97, colors: 80, inSequence: 0, flash: 50, riddle: 0 })).toBe(227)
  })
})

describe('mockGlobalRecord', () => {
  it('is deterministic per level and within a plausible band (300..500)', () => {
    const a = mockGlobalRecord('level-7')
    expect(mockGlobalRecord('level-7')).toBe(a)
    expect(a).toBeGreaterThanOrEqual(300)
    expect(a).toBeLessThanOrEqual(500)
  })
})
