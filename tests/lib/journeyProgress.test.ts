import { describe, it, expect } from 'vitest'
import { applyClientProgress } from '../../src/lib/journeyProgress'
import { emptyLevelProgress, type ProgressMap } from '../../src/store/progressStore'
import type { JourneyTheme } from '../../src/components/JourneyMap'

function lvl(level_id: string, display_number: number): JourneyTheme['levels'][number] {
  return {
    level_id, display_number, name: `L${display_number}`,
    my_pr: 999, my_stars: 3, completedCount: 0, cleared: true, current: true, locked: false,
    last_played: null, global_best: null,
  }
}

const THEMES: JourneyTheme[] = [
  { theme_id: 't1', slug: 'the_hollows', name: 'The Hollows', mechanic: '', sort_order: 1,
    levels: [lvl('L1', 1), lvl('L2', 2)] },
  { theme_id: 't2', slug: 'the_grid', name: 'Gridlock', mechanic: '', sort_order: 2,
    levels: [lvl('L3', 3)] },
]

function progressWithMain(map: Record<string, number>): ProgressMap {
  const out: ProgressMap = {}
  for (const [id, mainScore] of Object.entries(map)) {
    const p = emptyLevelProgress()
    p.best.main = mainScore
    p.timesPlayed = 1
    p.lastPlayed = 1
    out[id] = p
  }
  return out
}

function flat(themes: JourneyTheme[]) {
  return Object.fromEntries(themes.flatMap(t => t.levels).map(l => [l.level_id, l]))
}

describe('applyClientProgress', () => {
  it('with no progress: first level is current, the rest locked, none cleared', () => {
    const byId = flat(applyClientProgress(THEMES, {}))
    expect(byId.L1).toMatchObject({ cleared: false, current: true, locked: false })
    expect(byId.L2).toMatchObject({ cleared: false, current: false, locked: true })
    expect(byId.L3).toMatchObject({ cleared: false, current: false, locked: true })
  })

  it('clearing Main on L1 advances the frontier to L2', () => {
    const byId = flat(applyClientProgress(THEMES, progressWithMain({ L1: 80 })))
    expect(byId.L1).toMatchObject({ cleared: true, current: false, locked: false })
    expect(byId.L2).toMatchObject({ cleared: false, current: true, locked: false })
    expect(byId.L3).toMatchObject({ cleared: false, current: false, locked: true })
  })

  it('clearing L1 and L2 makes L3 current', () => {
    const byId = flat(applyClientProgress(THEMES, progressWithMain({ L1: 80, L2: 90 })))
    expect(byId.L2).toMatchObject({ cleared: true, current: false, locked: false })
    expect(byId.L3).toMatchObject({ cleared: false, current: true, locked: false })
  })

  it('all cleared: no current, no locked, all cleared', () => {
    const byId = flat(applyClientProgress(THEMES, progressWithMain({ L1: 80, L2: 90, L3: 70 })))
    for (const id of ['L1', 'L2', 'L3']) {
      expect(byId[id]).toMatchObject({ cleared: true, current: false, locked: false })
    }
  })

  it('a badge score alone (Main unsolved) does NOT clear the level', () => {
    const map: ProgressMap = {}
    const p = emptyLevelProgress()
    p.best.colors = 100 // a badge, but Main not solved
    map.L1 = p
    const byId = flat(applyClientProgress(THEMES, map))
    expect(byId.L1.cleared).toBe(false)
    expect(byId.L1.current).toBe(true)
  })

  it('derives per-station stars and PR from client progress', () => {
    // L1 main only (80) → total 80 → stars 1 (main solved, <150)
    const byId = flat(applyClientProgress(THEMES, progressWithMain({ L1: 80 })))
    expect(byId.L1.my_stars).toBe(1)
    expect(byId.L1.my_pr).toBe(80)
    // unplayed level → 0 stars, null PR
    expect(byId.L2.my_stars).toBe(0)
    expect(byId.L2.my_pr).toBeNull()
  })
})
