import { describe, it, expect } from 'vitest'
import { scoreRound } from '@shared/core/scoring'

// Flash Mob exception (spec §4): the viewing reveal is unskippable, so banked
// view-time is always 0 and Speed must be scored on the SELECT clock only:
// Speed = 1000 × selectRem / selectDur, ignoring the view clock entirely.
describe('scoreRound — flashMob select-only Speed', () => {
  it('ignores the view clock when selectOnly is set', () => {
    const r = scoreRound({
      viewTimeRemaining: 0,        // unskippable reveal banks no view time
      viewDuration: 3000,         // derived gapCount × 1000
      selectTimeRemaining: 5700,
      selectDuration: 10000,
      minPieces: 3,
      selectedPieces: 3,
      selectOnly: true,
    })
    // 5700/10000 → 570; perfect efficiency (3 used, 3 min) → 1000.
    expect(r.speed).toBe(570)
    expect(r.efficiency).toBe(1000)
    expect(r.total).toBe(1570)
  })

  it('a full-view-but-no-selectOnly clear would have scored the view clock (contrast)', () => {
    const r = scoreRound({
      viewTimeRemaining: 0,
      viewDuration: 3000,
      selectTimeRemaining: 5700,
      selectDuration: 10000,
      minPieces: 3,
      selectedPieces: 3,
      // no selectOnly → combined budget: 5700 / (3000+10000) ≈ 0.438 → 438
    })
    expect(r.speed).toBe(438)
  })
})
