import { create } from 'zustand'

export const RUN_HISTORY_STORAGE_KEY = 'gapcity:runhistory:v1'
export const MAX_RUN_HISTORY = 100

export type RunMetric = 'score' | 'recalled' | 'combo' | 'accuracy'

export interface RunRecord {
  id: string       // unique within the list
  score: number
  recalled: number // shapesRecalled
  combo: number    // bestCombo
  accuracy: number // integer 0..100
  playedAt: number // epoch ms (Date.now())
}

export type RunStats = Pick<RunRecord, 'score' | 'recalled' | 'combo' | 'accuracy'>

interface RunHistoryStore {
  records: RunRecord[]         // chronological (oldest first)
  recordRun: (stats: RunStats) => RunRecord
  clear: () => void            // wipe history + storage (dev/admin)
}

// Module-level monotonic counter for unique id generation without Math.random()
let seq = 0

function load(): RunRecord[] {
  try {
    const raw = localStorage.getItem(RUN_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const records = JSON.parse(raw) as RunRecord[]
    // Seed seq above the highest counter already persisted so ids never
    // collide after a page reload (each id has the form "<playedAt>-<counter>").
    let maxCounter = -1
    for (const r of records) {
      const lastDash = r.id.lastIndexOf('-')
      if (lastDash !== -1) {
        const n = parseInt(r.id.slice(lastDash + 1), 10)
        if (!isNaN(n) && n > maxCounter) maxCounter = n
      }
    }
    if (maxCounter >= seq) seq = maxCounter + 1
    return records
  } catch {
    return []
  }
}

function save(records: RunRecord[]): void {
  try {
    localStorage.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify(records))
  } catch {
    /* ignore quota / unavailable storage */
  }
}

export const useRunHistoryStore = create<RunHistoryStore>((set) => ({
  records: load(),

  recordRun: (stats) => {
    const playedAt = Date.now()
    const id = `${playedAt}-${seq++}`
    const record: RunRecord = { id, playedAt, ...stats }

    set((state) => {
      const next = [...state.records, record]
      // Trim to the last MAX_RUN_HISTORY (keep newest)
      const trimmed = next.length > MAX_RUN_HISTORY
        ? next.slice(next.length - MAX_RUN_HISTORY)
        : next
      save(trimmed)
      return { records: trimmed }
    })

    return record
  },

  clear: () => {
    try {
      localStorage.removeItem(RUN_HISTORY_STORAGE_KEY)
    } catch {
      /* ignore unavailable storage */
    }
    set({ records: [] })
  },
}))
