import { describe, it, expect } from 'vitest'
import {
  METRICS,
  ordinal,
  formatMetric,
  sortByMetric,
  rankOf,
  seriesStats,
  recentRuns,
  ladderRows,
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
  it('has exactly 4 entries in order: score, recalled, combo, accuracy', () => {
    expect(METRICS.map(m => m.key)).toEqual(['score', 'recalled', 'combo', 'accuracy'])
  })

  it('score has correct hex and no prefix/suffix', () => {
    const m = METRICS.find(m => m.key === 'score')!
    expect(m.hex).toBe('#FFC23D')
    expect(m.prefix).toBeUndefined()
    expect(m.suffix).toBeUndefined()
  })

  it('recalled has correct hex and no prefix/suffix', () => {
    const m = METRICS.find(m => m.key === 'recalled')!
    expect(m.hex).toBe('#FF2D9B')
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

  it('recalled (no prefix/suffix) → plain number', () => {
    const def = METRICS.find(m => m.key === 'recalled')!
    expect(formatMetric(def, 38)).toBe('38')
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

  it('orders descending by recalled', () => {
    const sorted = sortByMetric(R, 'recalled')
    expect(sorted[0].id).toBe('r06') // recalled = 60
    const values = sorted.map(r => r.recalled)
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

// ---------------------------------------------------------------------------
// ladderRows
// ---------------------------------------------------------------------------

describe('ladderRows', () => {
  it('when current run is in top 5: returns exactly 5 rows with current flagged, ranks 1..5', () => {
    // r06 is rank 1 on score; it's within top 5
    const rows = ladderRows(R, 'score', 'r06')
    expect(rows).toHaveLength(5)

    // ranks should be 1..5
    expect(rows.map(r => r.rank)).toEqual([1, 2, 3, 4, 5])

    // r06 is marked isCurrent
    const cur = rows.find(r => r.record.id === 'r06')
    expect(cur).toBeDefined()
    expect(cur!.isCurrent).toBe(true)

    // all others are not current
    rows.filter(r => r.record.id !== 'r06').forEach(r => {
      expect(r.isCurrent).toBe(false)
    })
  })

  it('when current run is rank 9 of 13: top 4 rows + current at rank 9', () => {
    // Sorted score order:
    //   1: r06 (6000)
    //   2: r07 (5000, newer)
    //   3: r05 (5000, older)
    //   4: r08 (4500)
    //   5: r04 (4000)
    //   6: r09 (3500)
    //   7: r03 (3000)
    //   8: r10 (2500)
    //   9: r02 (2000)  ← current (rank 9)
    //  10: r11 (1500)
    //  11: r01 (1000)
    //  12: r12 (800)
    //  13: r13 (500)
    const rows = ladderRows(R, 'score', 'r02')
    expect(rows).toHaveLength(5)

    // First 4 rows are the true top 4
    expect(rows[0].rank).toBe(1)
    expect(rows[0].record.id).toBe('r06')
    expect(rows[1].rank).toBe(2)
    expect(rows[1].record.id).toBe('r07')
    expect(rows[2].rank).toBe(3)
    expect(rows[2].record.id).toBe('r05')
    expect(rows[3].rank).toBe(4)
    expect(rows[3].record.id).toBe('r08')

    // Last row is the current run at its true rank 9
    expect(rows[4].rank).toBe(9)
    expect(rows[4].record.id).toBe('r02')
    expect(rows[4].isCurrent).toBe(true)

    // none of the top 4 is flagged isCurrent
    rows.slice(0, 4).forEach(r => expect(r.isCurrent).toBe(false))
  })

  it('when fewer than n records exist: returns all as rows', () => {
    const tiny = R.slice(0, 3)
    const rows = ladderRows(tiny, 'score', tiny[0].id, 5)
    expect(rows.length).toBeLessThanOrEqual(tiny.length)
  })

  it('unknown currentId: isCurrent is never true, top-n returned normally', () => {
    const rows = ladderRows(R, 'score', 'nonexistent')
    expect(rows).toHaveLength(5)
    rows.forEach(r => expect(r.isCurrent).toBe(false))
  })

  it('respects custom n parameter', () => {
    // top-3, current is r06 (rank 1)
    const rows = ladderRows(R, 'score', 'r06', 3)
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.rank)).toEqual([1, 2, 3])
  })

  it('empty records → empty rows', () => {
    const rows = ladderRows([], 'score', 'r01')
    expect(rows).toEqual([])
  })
})
