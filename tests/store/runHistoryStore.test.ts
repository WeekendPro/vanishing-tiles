import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useRunHistoryStore,
  RUN_HISTORY_STORAGE_KEY,
  MAX_RUN_HISTORY,
  type RunStats,
  type RunRecord,
} from '../../src/store/runHistoryStore'

const sampleStats: RunStats = {
  score: 42,
  recalled: 7,
  combo: 3,
  accuracy: 85,
}

beforeEach(() => {
  localStorage.clear()
  useRunHistoryStore.setState({ records: [] })
})

describe('runHistoryStore', () => {
  it('starts empty when storage is empty', () => {
    expect(useRunHistoryStore.getState().records).toEqual([])
  })

  it('recordRun appends a record and returns it with all fields populated', () => {
    const { recordRun } = useRunHistoryStore.getState()
    const rec = recordRun(sampleStats)

    expect(rec.score).toBe(42)
    expect(rec.recalled).toBe(7)
    expect(rec.combo).toBe(3)
    expect(rec.accuracy).toBe(85)
    expect(typeof rec.playedAt).toBe('number')
    expect(rec.playedAt).toBeGreaterThan(0)
    expect(typeof rec.id).toBe('string')
    expect(rec.id.length).toBeGreaterThan(0)

    const records = useRunHistoryStore.getState().records
    expect(records).toHaveLength(1)
    expect(records[0]).toEqual(rec)
  })

  it('returned record id is unique across two consecutive recordRun calls', () => {
    const { recordRun } = useRunHistoryStore.getState()
    const rec1 = recordRun(sampleStats)
    const rec2 = recordRun(sampleStats)
    expect(rec1.id).not.toBe(rec2.id)
  })

  it('records persist: after recordRun a fresh load yields the saved array', () => {
    useRunHistoryStore.getState().recordRun(sampleStats)

    const raw = localStorage.getItem(RUN_HISTORY_STORAGE_KEY)
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].score).toBe(42)
  })

  it('history is capped at MAX_RUN_HISTORY; oldest is dropped, newest retained', () => {
    const { recordRun } = useRunHistoryStore.getState()

    // Record MAX_RUN_HISTORY + 1 runs; first has distinct score 999
    recordRun({ score: 999, recalled: 0, combo: 0, accuracy: 0 })
    for (let i = 0; i < MAX_RUN_HISTORY; i++) {
      recordRun({ score: i, recalled: 0, combo: 0, accuracy: 0 })
    }

    const records = useRunHistoryStore.getState().records
    expect(records).toHaveLength(MAX_RUN_HISTORY)
    // The first record (score 999) should have been dropped
    expect(records[0].score).not.toBe(999)
    // The last record should be the most recent
    expect(records[MAX_RUN_HISTORY - 1].score).toBe(MAX_RUN_HISTORY - 1)
  })

  it('clear() empties records and removes the storage key', () => {
    const { recordRun, clear } = useRunHistoryStore.getState()
    recordRun(sampleStats)
    expect(useRunHistoryStore.getState().records).toHaveLength(1)
    expect(localStorage.getItem(RUN_HISTORY_STORAGE_KEY)).not.toBeNull()

    clear()

    expect(useRunHistoryStore.getState().records).toEqual([])
    expect(localStorage.getItem(RUN_HISTORY_STORAGE_KEY)).toBeNull()
  })

  it('seq is seeded above persisted ids after a fresh module load: no id collision', async () => {
    // Pre-populate localStorage with a record whose id counter suffix is 7.
    const highCounterRecord: RunRecord = {
      id: `1700000000000-7`,
      score: 100,
      recalled: 5,
      combo: 2,
      accuracy: 70,
      playedAt: 1700000000000,
    }
    localStorage.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify([highCounterRecord]))

    // Re-import the module fresh so load() runs again and seeds seq.
    vi.resetModules()
    const { useRunHistoryStore: freshStore } = await import('../../src/store/runHistoryStore')

    const rec = freshStore.getState().recordRun(sampleStats)

    // The new id's counter must be strictly greater than 7 to avoid collision.
    const lastDash = rec.id.lastIndexOf('-')
    const counter = parseInt(rec.id.slice(lastDash + 1), 10)
    expect(counter).toBeGreaterThan(7)
    expect(rec.id).not.toBe(highCounterRecord.id)
  })

  it('tolerates unavailable storage: recordRun still returns a record and updates in-memory state', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const { recordRun } = useRunHistoryStore.getState()
    let rec: ReturnType<typeof recordRun> | undefined
    expect(() => {
      rec = recordRun(sampleStats)
    }).not.toThrow()

    expect(rec).toBeDefined()
    expect(rec!.score).toBe(42)
    expect(useRunHistoryStore.getState().records).toHaveLength(1)

    vi.restoreAllMocks()
  })
})
