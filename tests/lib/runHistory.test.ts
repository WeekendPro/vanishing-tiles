import { describe, it, expect } from 'vitest'
import {
  METRICS,
  ordinal,
  formatMetric,
  sortByMetric,
  rankOf,
  seriesStats,
  recentRuns,
} from '../../src/lib/runHistory'
import type { RunRecord } from '../../src/store/runHistoryStore'

// ---------------------------------------------------------------------------
// Fixture — 13 records with known, varied metric values
// ---------------------------------------------------------------------------

function makeRecord(
  id: string,
  score: number,
  recalled: number,
  combo: number,
  accuracy: number,
  playedAt: number,
): RunRecord {
  return { id, score, recalled, combo, accuracy, playedAt }
}

// Ordered chronologically (oldest first); playedAt is epoch ms
const R: RunRecord[] = [
  makeRecord('r01', 1000, 10, 3, 60, 1000),
  makeRecord('r02', 2000, 20, 5, 70, 2000),
  makeRecord('r03', 3000, 30, 7, 80, 3000),
  makeRecord('r04', 4000, 40, 9, 90, 4000),
  makeRecord('r05', 5000, 50, 11, 95, 5000),
  makeRecord('r06', 6000, 60, 13, 100, 6000), // rank-1 score
  makeRecord('r07', 5000, 55, 12, 92, 7000), // tie with r05 on score (r07 newer)
  makeRecord('r08', 4500, 45, 10, 88, 8000),
  makeRecord('r09', 3500, 35, 8,  75, 9000),
  makeRecord('r10', 2500, 25, 6,  65, 10000),
  makeRecord('r11', 1500, 15, 4,  55, 11000),
  makeRecord('r12', 800,  8,  2,  45, 12000),
  makeRecord('r13', 500,  5,  1,  40, 13000),
]

// ---------------------------------------------------------------------------
// METRICS constant
// ---------------------------------------------------------------------------

describe('METRICS', () => {
  it('has exactly 3 entries in order: score, combo, accuracy', () => {
    expect(METRICS.map(m => m.key)).toEqual(['score', 'combo', 'accuracy'])
  })

  it('score has correct hex and no prefix/suffix', () => {
    const m = METRICS.find(m => m.key === 'score')!
    expect(m.hex).toBe('#FFC23D')
    expect(m.prefix).toBeUndefined()
    expect(m.suffix).toBeUndefined()
  })

  it('combo has correct hex and prefix × and no suffix', () => {
    const m = METRICS.find(m => m.key === 'combo')!
    expect(m.hex).toBe('#B6FF3C')
    expect(m.prefix).toBe('×')
    expect(m.suffix).toBeUndefined()
  })

  it('accuracy has correct hex and suffix % and no prefix', () => {
    const m = METRICS.find(m => m.key === 'accuracy')!
    expect(m.hex).toBe('#28F0FF')
    expect(m.prefix).toBeUndefined()
    expect(m.suffix).toBe('%')
  })
})

// ---------------------------------------------------------------------------
// ordinal
// ---------------------------------------------------------------------------

describe('ordinal', () => {
  it.each([
    [1,   '1st'],
    [2,   '2nd'],
    [3,   '3rd'],
    [4,   '4th'],
    [11,  '11th'],
    [12,  '12th'],
    [13,  '13th'],
    [21,  '21st'],
    [22,  '22nd'],
    [23,  '23rd'],
    [100, '100th'],
    [101, '101st'],
    [111, '111th'],
  ])('%i → %s', (n, expected) => {
    expect(ordinal(n)).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// formatMetric
// ---------------------------------------------------------------------------

describe('formatMetric', () => {
  it('score (no prefix/suffix) → plain number', () => {
    const def = METRICS.find(m => m.key === 'score')!
    expect(formatMetric(def, 4820)).toBe('4820')
  })

  it('combo (prefix ×) → ×12', () => {
    const def = METRICS.find(m => m.key === 'combo')!
    expect(formatMetric(def, 12)).toBe('×12')
  })

  it('accuracy (suffix %) → 91%', () => {
    const def = METRICS.find(m => m.key === 'accuracy')!
    expect(formatMetric(def, 91)).toBe('91%')
  })
})

// ---------------------------------------------------------------------------
// sortByMetric
// ---------------------------------------------------------------------------

describe('sortByMetric', () => {
  it('orders descending by score', () => {
    const sorted = sortByMetric(R, 'score')
    const scores = sorted.map(r => r.score)
    // should be descending (may have ties)
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
    }
  })

  it('first record is the one with highest score (r06 = 6000)', () => {
    const sorted = sortByMetric(R, 'score')
    expect(sorted[0].id).toBe('r06')
  })

  it('tie-breaks by playedAt DESC (newer ranks higher): r07 before r05 on score', () => {
    // r05 and r07 both have score 5000; r07 playedAt=7000, r05 playedAt=5000 → r07 first
    const sorted = sortByMetric(R, 'score')
    const idx07 = sorted.findIndex(r => r.id === 'r07')
    const idx05 = sorted.findIndex(r => r.id === 'r05')
    expect(idx07).toBeLessThan(idx05)
  })

  it('does not mutate the input array', () => {
    const original = [...R]
    sortByMetric(R, 'score')
    expect(R.map(r => r.id)).toEqual(original.map(r => r.id))
  })

  it('orders descending by combo', () => {
    const sorted = sortByMetric(R, 'combo')
    expect(sorted[0].id).toBe('r06') // combo = 13
    const values = sorted.map(r => r.combo)
    for (let i = 0; i < values.length - 1; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i + 1])
    }
  })
})

// ---------------------------------------------------------------------------
// rankOf
// ---------------------------------------------------------------------------

describe('rankOf', () => {
  it('returns 1 for the record with the top score', () => {
    expect(rankOf(R, 'score', 'r06')).toBe(1)
  })

  it('returns the correct 1-based rank for a mid-range record', () => {
    // r05 score=5000 ties with r07=5000; r07 is newer so r07 is rank 2, r05 is rank 3
    expect(rankOf(R, 'score', 'r07')).toBe(2)
    expect(rankOf(R, 'score', 'r05')).toBe(3)
  })

  it('returns 0 for an unknown id', () => {
    expect(rankOf(R, 'score', 'unknown-id')).toBe(0)
  })

  it('returns 0 on an empty array', () => {
    expect(rankOf([], 'score', 'r01')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// seriesStats
// ---------------------------------------------------------------------------

describe('seriesStats', () => {
  it('computes correct min/max/avg for score across all records', () => {
    const stats = seriesStats(R, 'score')
    const scores = R.map(r => r.score)
    expect(stats.min).toBe(Math.min(...scores)) // 500
    expect(stats.max).toBe(Math.max(...scores)) // 6000
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    expect(stats.avg).toBeCloseTo(avg, 5)
  })

  it('returns { min: 0, max: 0, avg: 0 } for empty array', () => {
    expect(seriesStats([], 'score')).toEqual({ min: 0, max: 0, avg: 0 })
  })

  it('handles a single record', () => {
    const single = [makeRecord('x', 999, 5, 3, 70, 1)]
    const stats = seriesStats(single, 'score')
    expect(stats).toEqual({ min: 999, max: 999, avg: 999 })
  })
})

// ---------------------------------------------------------------------------
// recentRuns
// ---------------------------------------------------------------------------

describe('recentRuns', () => {
  it('returns the last n records in chronological order', () => {
    const last3 = recentRuns(R, 3)
    expect(last3.map(r => r.id)).toEqual(['r11', 'r12', 'r13'])
  })

  it('returns all records when n >= length', () => {
    const all = recentRuns(R, 100)
    expect(all.map(r => r.id)).toEqual(R.map(r => r.id))
  })

  it('returns [] when n = 0', () => {
    expect(recentRuns(R, 0)).toEqual([])
  })

  it('returns [] for empty array', () => {
    expect(recentRuns([], 5)).toEqual([])
  })
})
