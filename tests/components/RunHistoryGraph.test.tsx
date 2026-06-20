import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RunHistoryGraph } from '../../src/components/RunHistoryGraph'
import type { RunRecord } from '../../src/store/runHistoryStore'

// Helper to build a RunRecord
function makeRun(overrides: Partial<RunRecord> & { id: string }): RunRecord {
  return {
    score: 1000,
    recalled: 10,
    combo: 5,
    accuracy: 80,
    playedAt: Date.now(),
    ...overrides,
  }
}

// A set of sample records (chronological, oldest first)
function makeSampleRecords(): RunRecord[] {
  const base = Date.now() - 1000 * 60 * 60 * 24 * 7 // 7 days ago
  return [
    makeRun({ id: 'r1', score: 2100, recalled: 18, combo: 5, accuracy: 74, playedAt: base }),
    makeRun({ id: 'r2', score: 1850, recalled: 16, combo: 4, accuracy: 69, playedAt: base + 1000 }),
    makeRun({ id: 'r3', score: 3200, recalled: 25, combo: 7, accuracy: 80, playedAt: base + 2000 }),
    makeRun({ id: 'r4', score: 2750, recalled: 22, combo: 6, accuracy: 77, playedAt: base + 3000 }),
    makeRun({ id: 'r5', score: 5100, recalled: 41, combo: 14, accuracy: 93, playedAt: base + 4000 }),
    makeRun({ id: 'r6', score: 3900, recalled: 30, combo: 9, accuracy: 84, playedAt: base + 5000 }),
    makeRun({ id: 'r7', score: 4820, recalled: 38, combo: 12, accuracy: 91, playedAt: base + 6000 }),
  ]
}

describe('RunHistoryGraph', () => {
  it('renders 4 series tabs with the metric labels', () => {
    const records = makeSampleRecords()
    render(<RunHistoryGraph records={records} currentId="r7" />)

    expect(screen.getByRole('button', { name: /score/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /recall/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /combo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accuracy/i })).toBeInTheDocument()
  })

  it('renders one ladder row per ladderRows result, and current run shows "You"', () => {
    const records = makeSampleRecords()
    render(<RunHistoryGraph records={records} currentId="r7" />)

    // "You" tag appears once (on the current run's row)
    const youTags = screen.getAllByText('You')
    expect(youTags).toHaveLength(1)

    // The ladder should have 5 rows (or fewer if records < 5)
    // We check that rank numbers 1-5 (or however many) appear
    // Use data-testid for robustness
    const rows = screen.getAllByTestId('ladder-row')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows.length).toBeLessThanOrEqual(5)
  })

  it('clicking a non-active tab switches the active series', () => {
    const records = makeSampleRecords()
    render(<RunHistoryGraph records={records} currentId="r7" />)

    // Default is 'score'. Click 'Combo' tab.
    const comboTab = screen.getByRole('button', { name: /combo/i })
    fireEvent.click(comboTab)

    // After switching to combo, the active tab should have the data-active attr or aria-pressed
    // We use data-testid="active-tab" on the active tab button
    const activeTab = screen.getByTestId('active-tab')
    expect(activeTab.textContent?.toLowerCase()).toContain('combo')
  })

  it('renders without throwing for records.length === 1 (current run only)', () => {
    const records = [makeRun({ id: 'only', score: 4820, recalled: 38, combo: 12, accuracy: 91, playedAt: Date.now() })]
    expect(() => {
      render(<RunHistoryGraph records={records} currentId="only" />)
    }).not.toThrow()

    // Should still render tabs
    expect(screen.getByRole('button', { name: /score/i })).toBeInTheDocument()
    // Should render a ladder row
    expect(screen.getAllByTestId('ladder-row')).toHaveLength(1)
  })

  it('renders without throwing when currentId is not found in records', () => {
    const records = makeSampleRecords()
    expect(() => {
      render(<RunHistoryGraph records={records} currentId="nonexistent-id" />)
    }).not.toThrow()

    // Should still render tabs and ladder
    expect(screen.getByRole('button', { name: /score/i })).toBeInTheDocument()
  })
})
