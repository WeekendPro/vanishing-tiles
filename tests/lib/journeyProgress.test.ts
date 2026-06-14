import { describe, it, expect } from 'vitest'
import { applyClientProgress } from '../../src/lib/journeyProgress'
import { emptyLevelProgress, type ProgressMap } from '../../src/store/progressStore'
import { LEVEL_COMPONENTS } from '../../src/lib/components'
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

/** Build a LevelProgress whose best-per-puzzle sums to `total` (greedy, 100/puzzle). */
function fill(total: number) {
  const p = emptyLevelProgress()
  let rest = total
  for (const c of LEVEL_COMPONENTS) {
    const v = Math.min(100, Math.max(0, rest))
    p.best[c] = v
    rest -= v
  }
  p.timesPlayed = 1
  p.lastPlayed = 1
  return p
}

/** progress map from level-id → desired level total. */
function prog(totals: Record<string, number>): ProgressMap {
  const out: ProgressMap = {}
  for (const [id, total] of Object.entries(totals)) out[id] = fill(total)
  return out
}

function flat(themes: JourneyTheme[]) {
  return Object.fromEntries(themes.flatMap(t => t.levels).map(l => [l.level_id, l]))
}

describe('applyClientProgress (65% unlock threshold)', () => {
  it('with no progress: first level is current, the rest locked, none cleared', () => {
    const byId = flat(applyClientProgress(THEMES, {}))
    expect(byId.L1).toMatchObject({ cleared: false, current: true, locked: false })
    expect(byId.L2).toMatchObject({ cleared: false, current: false, locked: true })
    expect(byId.L3).toMatchObject({ cleared: false, current: false, locked: true })
  })

  it('clearing the 65% threshold (325) on L1 advances the frontier to L2', () => {
    const byId = flat(applyClientProgress(THEMES, prog({ L1: 325 })))
    expect(byId.L1).toMatchObject({ cleared: true, current: false, locked: false })
    expect(byId.L2).toMatchObject({ cleared: false, current: true, locked: false })
    expect(byId.L3).toMatchObject({ cleared: false, current: false, locked: true })
  })

  it('clearing L1 and L2 makes L3 current', () => {
    const byId = flat(applyClientProgress(THEMES, prog({ L1: 325, L2: 400 })))
    expect(byId.L2).toMatchObject({ cleared: true, current: false, locked: false })
    expect(byId.L3).toMatchObject({ cleared: false, current: true, locked: false })
  })

  it('all cleared: no current, no locked, all cleared', () => {
    const byId = flat(applyClientProgress(THEMES, prog({ L1: 325, L2: 400, L3: 500 })))
    for (const id of ['L1', 'L2', 'L3']) {
      expect(byId[id]).toMatchObject({ cleared: true, current: false, locked: false })
    }
  })

  it('a sub-threshold total (below 325) does NOT clear the level', () => {
    const byId = flat(applyClientProgress(THEMES, prog({ L1: 300 })))
    expect(byId.L1.cleared).toBe(false)
    expect(byId.L1.current).toBe(true)
  })

  it('derives per-station stars and PR from client progress', () => {
    const byId = flat(applyClientProgress(THEMES, prog({ L1: 325 })))
    expect(byId.L1.my_pr).toBe(325)
    expect(byId.L1.my_stars).toBe(3) // 325 → tier ≥250
    // unplayed level → 0 stars, null PR
    expect(byId.L2.my_stars).toBe(0)
    expect(byId.L2.my_pr).toBeNull()
  })
})
