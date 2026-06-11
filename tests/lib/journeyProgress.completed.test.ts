import { describe, it, expect } from 'vitest'
import { applyClientProgress } from '../../src/lib/journeyProgress'
import type { JourneyTheme } from '../../src/components/JourneyMap'
import type { ProgressMap } from '../../src/store/progressStore'

const themes: JourneyTheme[] = [{
  theme_id: 't1', slug: 'the_hollows', name: 'The Hollows', mechanic: '', sort_order: 1,
  levels: [
    { level_id: 'L1', display_number: 1, name: 'A', my_pr: null, my_stars: 0, completedCount: 0, cleared: false, current: false, locked: false, last_played: null, global_best: null },
    { level_id: 'L2', display_number: 2, name: 'B', my_pr: null, my_stars: 0, completedCount: 0, cleared: false, current: false, locked: false, last_played: null, global_best: null },
  ],
}]

describe('applyClientProgress completedCount', () => {
  it('counts components with a best score > 0 (0..5)', () => {
    const progress: ProgressMap = {
      L1: { best: { main: 80, colors: 50, inSequence: 0, flash: 0, riddle: 0 }, timesPlayed: 2, lastPlayed: 1 },
    }
    const out = applyClientProgress(themes, progress)
    const l1 = out[0].levels.find(l => l.level_id === 'L1')!
    const l2 = out[0].levels.find(l => l.level_id === 'L2')!
    expect(l1.completedCount).toBe(2) // main + colors
    expect(l2.completedCount).toBe(0) // unplayed
  })
})
