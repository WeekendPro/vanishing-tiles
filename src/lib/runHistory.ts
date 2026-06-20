import type { RunRecord, RunMetric } from '../store/runHistoryStore'

export interface MetricDef {
  key: RunMetric
  label: string    // tab label
  hex: string      // series color
  prefix?: string  // e.g. '×' for combo
  suffix?: string  // e.g. '%' for accuracy
}

// Order = tab order. Colors per Global Constraints.
export const METRICS: MetricDef[] = [
  { key: 'score',    label: 'Score',    hex: '#FFC23D' },
  { key: 'recalled', label: 'Recalled', hex: '#FF2D9B' },
  { key: 'combo',    label: 'Combo',    hex: '#B6FF3C', prefix: '×' },
  { key: 'accuracy', label: 'Accuracy', hex: '#28F0FF', suffix: '%' },
]

export function ordinal(n: number): string {
  const mod100 = n % 100
  // 11, 12, 13 are exceptions — always 'th'
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const mod10 = n % 10
  if (mod10 === 1) return `${n}st`
  if (mod10 === 2) return `${n}nd`
  if (mod10 === 3) return `${n}rd`
  return `${n}th`
}

export function formatMetric(def: MetricDef, value: number): string {
  return `${def.prefix ?? ''}${value}${def.suffix ?? ''}`
}

export function sortByMetric(records: RunRecord[], metric: RunMetric): RunRecord[] {
  return [...records].sort((a, b) => {
    const diff = b[metric] - a[metric]
    if (diff !== 0) return diff
    // tie-break: newer playedAt ranks higher (DESC)
    return b.playedAt - a.playedAt
  })
}

export function rankOf(records: RunRecord[], metric: RunMetric, id: string): number {
  const sorted = sortByMetric(records, metric)
  const idx = sorted.findIndex(r => r.id === id)
  return idx === -1 ? 0 : idx + 1
}

export function seriesStats(
  records: RunRecord[],
  metric: RunMetric,
): { min: number; max: number; avg: number } {
  if (records.length === 0) return { min: 0, max: 0, avg: 0 }
  const values = records.map(r => r[metric])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return { min, max, avg }
}

export function recentRuns(records: RunRecord[], n: number): RunRecord[] {
  if (n <= 0) return []
  // records are chronological (oldest first); take last n
  return records.slice(-n)
}

export interface LadderRow {
  rank: number
  record: RunRecord
  isCurrent: boolean
}

export function ladderRows(
  records: RunRecord[],
  metric: RunMetric,
  currentId: string,
  n = 5,
): LadderRow[] {
  if (records.length === 0) return []

  const sorted = sortByMetric(records, metric)
  const topN = sorted.slice(0, n)

  const currentRank = rankOf(records, metric, currentId)
  const currentInTopN = topN.some(r => r.id === currentId)

  const rows: LadderRow[] = topN.map((record, i) => ({
    rank: i + 1,
    record,
    isCurrent: record.id === currentId,
  }))

  if (!currentInTopN && currentRank > 0) {
    // Replace the last row with the current run at its true rank
    const currentRecord = sorted[currentRank - 1]
    rows[rows.length - 1] = {
      rank: currentRank,
      record: currentRecord,
      isCurrent: true,
    }
  }

  return rows
}
