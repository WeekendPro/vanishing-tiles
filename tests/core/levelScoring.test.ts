import { describe, it, expect } from 'vitest'
import {
  ROUND_PILLAR_MAX, LIVES_BONUS_MAX, MAX_LIVES, ROUNDS_PER_LEVEL, MAX_LEVEL_TOTAL,
  roundSpeed, roundEfficiency, scoreRound, livesBonus, levelStars, levelTotal,
} from '@shared/core/scoring'

describe('level scoring constants', () => {
  it('exposes the round/level maxes', () => {
    expect(ROUND_PILLAR_MAX).toEqual({ speed: 1000, efficiency: 1000 })
    expect(LIVES_BONUS_MAX).toBe(1000)
    expect(MAX_LIVES).toBe(3)
    expect(ROUNDS_PER_LEVEL).toBe(4)
    expect(MAX_LEVEL_TOTAL).toBe(9000) // 4*(1000+1000) + 1000
  })
})

describe('roundSpeed', () => {
  it('combined budget: fraction of total time remaining', () => {
    // 40% used => 60% remaining => 600
    expect(roundSpeed({ viewTimeRemaining: 6000, viewDuration: 10000, selectTimeRemaining: 0, selectDuration: 0 })).toBe(600)
    // weighted across both clocks: (3000+4500)/(5000+10000) = 0.5 => 500
    expect(roundSpeed({ viewTimeRemaining: 3000, viewDuration: 5000, selectTimeRemaining: 4500, selectDuration: 10000 })).toBe(500)
  })

  it('select-only (Flash Mob exception) ignores the view clock', () => {
    expect(roundSpeed({ viewTimeRemaining: 9999, viewDuration: 10000, selectTimeRemaining: 5700, selectDuration: 10000, selectOnly: true })).toBe(570)
  })

  it('is 0 when no time budget exists', () => {
    expect(roundSpeed({ viewTimeRemaining: 0, viewDuration: 0, selectTimeRemaining: 0, selectDuration: 0 })).toBe(0)
  })
})

describe('roundEfficiency', () => {
  it('matches the spec examples (min 5)', () => {
    expect(roundEfficiency(5, 5)).toBe(1000)  // 0 extra
    expect(roundEfficiency(5, 6)).toBe(800)   // 1 extra
    expect(roundEfficiency(5, 9)).toBe(200)   // 4 extra
    expect(roundEfficiency(5, 12)).toBe(-400) // 7 extra
  })

  it('clamps to [-1000, 1000]', () => {
    expect(roundEfficiency(5, 20)).toBe(-1000) // 15 extra => -2000 clamped
    expect(roundEfficiency(5, 0)).toBe(0)      // guard: zero pieces => 0
  })
})

describe('livesBonus', () => {
  it('floors at the spec values', () => {
    expect(livesBonus(3)).toBe(1000)
    expect(livesBonus(2)).toBe(666)
    expect(livesBonus(1)).toBe(333)
    expect(livesBonus(0)).toBe(0)
  })
})

describe('scoreRound', () => {
  it('sums speed + efficiency', () => {
    const r = scoreRound({
      viewTimeRemaining: 6000, viewDuration: 10000, selectTimeRemaining: 0, selectDuration: 0,
      minPieces: 5, selectedPieces: 6,
    })
    expect(r).toEqual({ speed: 600, efficiency: 800, total: 1400 })
  })
})

describe('levelTotal & levelStars', () => {
  it('sums round totals plus lives bonus, floored at 0', () => {
    expect(levelTotal([1400, 1400, 1400, 1400], 3)).toBe(6600) // 5600 + 1000
    expect(levelTotal([-1000, -1000, 0, 0], 1)).toBe(0)        // -2000 + 333 -> floored
  })

  it('stars from the level total / 9000 ratio', () => {
    expect(levelStars(9000)).toBe(3)
    expect(levelStars(6750)).toBe(3)  // 0.75
    expect(levelStars(6749)).toBe(2)
    expect(levelStars(4500)).toBe(2)  // 0.5
    expect(levelStars(4499)).toBe(1)
    expect(levelStars(0)).toBe(1)
  })
})
