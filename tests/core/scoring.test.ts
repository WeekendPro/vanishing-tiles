import { describe, it, expect } from 'vitest'
import {
  PILLAR_MAX, MAX_TOTAL, attemptsBonus, starsForTotal, maxScoreFor, computeStars,
  scoreClear,
} from '@shared/core/scoring'

describe('scoring pillars', () => {
  it('exposes constant pillar maxes summing to 2000 (efficiency retired into speed)', () => {
    expect(PILLAR_MAX).toEqual({ accuracy: 800, speed: 800, efficiency: 0, attempts: 400 })
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

describe('scoreClear', () => {
  it('combines pillars and attempts bonus into a total', () => {
    const s = scoreClear({
      triesUsed: 1,
      viewTimeRemaining: 5000, viewDuration: 10000,
      selectTimeRemaining: 7500, selectDuration: 15000,
      minPieces: 4, selectedPieces: 4,
    })
    expect(s.accuracy).toBe(800)
    // speed = 800 * 0.5 * (0.5 + 0.5) = 400
    expect(s.speed).toBe(400)
    // efficiency retired — always 0
    expect(s.efficiency).toBe(0)
    expect(s.attempts).toBe(400)
    expect(s.total).toBe(1600)
    expect(s.stars).toBe(3)
  })

  it('zeroes efficiency when no pieces selected', () => {
    const s = scoreClear({
      triesUsed: 3, viewTimeRemaining: 0, viewDuration: 10000,
      selectTimeRemaining: 0, selectDuration: 15000, minPieces: 4, selectedPieces: 0,
    })
    expect(s.efficiency).toBe(0)
    expect(s.attempts).toBe(0)
    expect(s.total).toBe(800)
  })
})
