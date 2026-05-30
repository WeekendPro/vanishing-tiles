import { describe, it, expect } from 'vitest'
import {
  PILLAR_MAX, MAX_TOTAL, attemptsBonus, starsForTotal, maxScoreFor, computeStars,
} from '../../src/core/scoring'

describe('scoring pillars', () => {
  it('exposes constant pillar maxes summing to 2000', () => {
    expect(PILLAR_MAX).toEqual({ accuracy: 800, speed: 500, efficiency: 300, attempts: 400 })
    expect(MAX_TOTAL).toBe(2000)
    expect(maxScoreFor()).toBe(2000)
  })

  it('attempts bonus: try 1=400, try 2=200, try 3=0', () => {
    expect(attemptsBonus(1)).toBe(400)
    expect(attemptsBonus(2)).toBe(200)
    expect(attemptsBonus(3)).toBe(0)
  })

  it('stars from total: >=75% ->3, >=50% ->2, any clear ->1', () => {
    expect(starsForTotal(2000)).toBe(3)
    expect(starsForTotal(1500)).toBe(3)
    expect(starsForTotal(1499)).toBe(2)
    expect(starsForTotal(1000)).toBe(2)
    expect(starsForTotal(999)).toBe(1)
    expect(starsForTotal(1)).toBe(1)
  })

  it('computeStars returns 0 when not cleared', () => {
    expect(computeStars({ solved: false, total: 0 })).toBe(0)
    expect(computeStars({ solved: true, total: 1600 })).toBe(3)
  })
})
