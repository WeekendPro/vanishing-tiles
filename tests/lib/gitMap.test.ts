import { describe, it, expect } from 'vitest'
import {
  GIT_TRACKS, nodeId, nodePos, SP,
  isCleared, bestScore, isAvailable, currentLevel, sproutedSegments,
} from '../../src/lib/gitMap'
import type { ProgressMap } from '../../src/store/progressStore'

// Build a progress map marking the given nodes cleared with a best score.
function progressWith(entries: Array<[string, number, number]>): ProgressMap {
  const map: ProgressMap = {}
  for (const [track, level, score] of entries as Array<[keyof typeof GIT_TRACKS, number, number]>) {
    const comp = GIT_TRACKS[track].component
    map[nodeId(track as keyof typeof GIT_TRACKS, level)] = {
      best: { main: 0, colors: 0, inSequence: 0, flash: 0, riddle: 0, [comp]: score },
      timesPlayed: 1, lastPlayed: 1,
    }
  }
  return map
}

describe('gitMap geometry', () => {
  it('places main bottom-up and branches one step above their branch commit', () => {
    expect(nodePos('classic', 1)).toEqual({ x: 0, y: 0 })
    expect(nodePos('classic', 3)).toEqual({ x: 0, y: -2 * SP })
    expect(nodePos('classic', 1).y).not.toBe(-0)
    // chromatic branches off classic@9, its level 1 sits one SP above classic@9
    const c9 = nodePos('classic', 9)
    expect(nodePos('chromatic', 1)).toEqual({ x: GIT_TRACKS.chromatic.lane, y: c9.y - SP })
  })
})

describe('gitMap progress', () => {
  it('classic is always available; branches require their branch commit cleared', () => {
    const empty: ProgressMap = {}
    expect(isAvailable(empty, 'classic')).toBe(true)
    expect(isAvailable(empty, 'chromatic')).toBe(false)
    // clear classic 1..9 → chromatic available, sequential still locked (needs 15)
    const p = progressWith(Array.from({ length: 9 }, (_, i) => ['classic', i + 1, 80] as [string, number, number]))
    expect(isAvailable(p, 'chromatic')).toBe(true)
    expect(isAvailable(p, 'sequential')).toBe(false)
  })

  it('currentLevel is the lowest uncleared level, or null when unavailable', () => {
    const p = progressWith([['classic', 1, 90], ['classic', 2, 90]])
    expect(currentLevel(p, 'classic')).toBe(3)
    expect(currentLevel(p, 'chromatic')).toBeNull()
  })

  it('isCleared / bestScore read the track component', () => {
    const p = progressWith([['classic', 5, 73]])
    expect(isCleared(p, 'classic', 5)).toBe(true)
    expect(bestScore(p, 'classic', 5)).toBe(73)
    expect(isCleared(p, 'classic', 6)).toBe(false)
  })

  it('sprouts intra-track paths only from cleared nodes and branch paths only when the branch commit is cleared', () => {
    // No progress → no segments at all (the "all dots" state)
    expect(sproutedSegments({})).toHaveLength(0)
    // Clear classic 1..9 → 9 intra segments (1->2 .. 9->10, since level 9 is cleared)
    // + 1 branch sprout (classic9 -> chromatic1)
    const p = progressWith(Array.from({ length: 9 }, (_, i) => ['classic', i + 1, 80] as [string, number, number]))
    const segs = sproutedSegments(p)
    expect(segs.filter(s => s.key.startsWith('classic-')).length).toBe(9)
    expect(segs.some(s => s.key === 'branch-chromatic')).toBe(true)
    expect(segs.some(s => s.key === 'branch-sequential')).toBe(false)
  })
})
