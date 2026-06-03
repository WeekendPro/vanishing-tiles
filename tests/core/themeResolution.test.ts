import { describe, it, expect } from 'vitest'
import { resolveSelection } from '@shared/core/themeResolution'
import type { Grid, Gap, Cell, SelectionEntry } from '@shared/types'
import { ROWS, COLS } from '@shared/types'

// Build a full grid, then carve the given gaps as empty cells.
function gridWith(gaps: Gap[]): Grid {
  const grid: Grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' })))
  for (const g of gaps) for (const [r, c] of g.cells) grid[r][c] = { status: 'empty' }
  return grid
}

// Two O-gaps of different colors.
const greenO: Gap = { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
  cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: 'green' }
const redO: Gap = { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 4,
  cells: [[0, 4], [0, 5], [1, 4], [1, 5]], color: 'red' }
const gaps = [greenO, redO]

describe('resolveSelection — color-coded', () => {
  it('clears when each gap is matched by a same-color piece', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'O', color: 'green', freeCount: 1 },
      { pieceType: 'O', color: 'red', freeCount: 1 },
    ]
    const res = resolveSelection({ selection, grid: gridWith(gaps), gaps, theme: 'colorCoded' })
    expect(res.solvable).toBe(true)
    expect(res.coverage).toBe(1)
    expect(res.placements).toHaveLength(2)
  })

  it('fails when colors are swapped even though shapes fit', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'O', color: 'red', freeCount: 1 },
      { pieceType: 'O', color: 'blue', freeCount: 1 },
    ]
    const res = resolveSelection({ selection, grid: gridWith(gaps), gaps, theme: 'colorCoded' })
    expect(res.solvable).toBe(false)
  })

  it('reports partial coverage when only one color is satisfied', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'O', color: 'green', freeCount: 1 },
    ]
    const res = resolveSelection({ selection, grid: gridWith(gaps), gaps, theme: 'colorCoded' })
    expect(res.solvable).toBe(false)
    expect(res.filledCells).toBe(4)   // green O placed
    expect(res.totalCells).toBe(8)    // both gaps
    expect(res.coverage).toBeCloseTo(0.5)
  })

  it('tags each color-coded placement with its gap color', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'O' as const, color: 'green', freeCount: 1 },
      { pieceType: 'O' as const, color: 'red', freeCount: 1 },
    ]
    const res = resolveSelection({ selection, grid: gridWith(gaps), gaps, theme: 'colorCoded' })
    expect(res.placements).toHaveLength(2)
    expect(new Set(res.placements.map(p => p.color))).toEqual(new Set(['green', 'red']))
  })
})

describe('resolveSelection — basic (colorblind passthrough)', () => {
  const basicGaps = [{ ...greenO, color: undefined }, { ...redO, color: undefined }]
  it('clears on shape-only tally, ignoring color', () => {
    const selection: SelectionEntry[] = [{ pieceType: 'O', freeCount: 2 }]
    const res = resolveSelection({ selection, grid: gridWith(basicGaps), gaps: basicGaps, theme: 'basic' })
    expect(res.solvable).toBe(true)
    expect(res.coverage).toBe(1)
  })
})
