import { describe, it, expect } from 'vitest'
import { scoreRound } from '@shared/core/scoring'

// Flash Mob exception (spec §4): the viewing reveal is unskippable, so banked
// view-time is always 0 and Speed must be scored on the SELECT clock only:
// Speed = 2000 × selectRem / selectDur, ignoring the view clock entirely.
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
    // 5700/10000 → 1140 (speed max 2000); efficiency retired → 0.
    expect(r.speed).toBe(1140)
    expect(r.efficiency).toBe(0)
    expect(r.total).toBe(1140)
  })

  it('a full-view-but-no-selectOnly clear would have scored the view clock (contrast)', () => {
    const r = scoreRound({
      viewTimeRemaining: 0,
      viewDuration: 3000,
      selectTimeRemaining: 5700,
      selectDuration: 10000,
      minPieces: 3,
      selectedPieces: 3,
      // no selectOnly → combined budget: 5700 / (3000+10000) ≈ 0.438 → 877 (max 2000)
    })
    expect(r.speed).toBe(877)
  })
})
