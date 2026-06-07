import { describe, it, expect } from 'vitest'
import { solve, bestFit } from '@shared/engine/solver'
import type { Grid, Gap, Cell } from '@shared/types'
import { ROWS, COLS } from '@shared/types'

function makeGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ status: 'filled' as const }))
  )
}

describe('solve', () => {
  it('returns solution for a single I-piece gap with exact I selection', () => {
    const grid = makeGrid()
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    const gaps: Gap[] = [{
      pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0,0],[0,1],[0,2],[0,3]],
    }]
    const result = solve({ I: 1 }, grid, gaps)
    expect(result.solvable).toBe(true)
  })

  it('returns not solvable when wrong piece selected', () => {
    const grid = makeGrid()
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    const gaps: Gap[] = [{
      pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0,0],[0,1],[0,2],[0,3]],
    }]
    const result = solve({ O: 1 }, grid, gaps)
    expect(result.solvable).toBe(false)
  })

  it('returns not solvable when too many pieces selected', () => {
    const grid = makeGrid()
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    const gaps: Gap[] = [{
      pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0,0],[0,1],[0,2],[0,3]],
    }]
    const result = solve({ I: 2 }, grid, gaps)
    expect(result.solvable).toBe(false)
  })

  it('solves two non-overlapping gaps', () => {
    const grid = makeGrid()
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    grid[2][0] = { status: 'empty' }
    grid[2][1] = { status: 'empty' }
    grid[3][0] = { status: 'empty' }
    grid[3][1] = { status: 'empty' }

    const gaps: Gap[] = [
      { pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0,0],[0,1],[0,2],[0,3]] },
      { pieceType: 'O', rotation: 0, anchorRow: 2, anchorCol: 0, cells: [[2,0],[2,1],[3,0],[3,1]] },
    ]

    const result = solve({ I: 1, O: 1 }, grid, gaps)
    expect(result.solvable).toBe(true)
  })

  it('returns placement positions in solution', () => {
    const grid = makeGrid()
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    const gaps: Gap[] = [{
      pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0,0],[0,1],[0,2],[0,3]],
    }]
    const result = solve({ I: 1 }, grid, gaps)
    expect(result.solvable).toBe(true)
    expect(result.placements).toHaveLength(1)
    expect(result.placements![0].pieceType).toBe('I')
    expect(result.placements![0].anchorRow).toBe(0)
    expect(result.placements![0].anchorCol).toBe(0)
  })

  it('solves two gaps regardless of piece type iteration order', () => {
    const grid = makeGrid()
    for (let c = 0; c < 4; c++) grid[0][c] = { status: 'empty' }
    grid[2][0] = { status: 'empty' }
    grid[2][1] = { status: 'empty' }
    grid[3][0] = { status: 'empty' }
    grid[3][1] = { status: 'empty' }

    const gaps: Gap[] = [
      { pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0,0],[0,1],[0,2],[0,3]] },
      { pieceType: 'O', rotation: 0, anchorRow: 2, anchorCol: 0, cells: [[2,0],[2,1],[3,0],[3,1]] },
    ]

    // O listed first — would fail with the break bug
    const result = solve({ O: 1, I: 1 }, grid, gaps)
    expect(result.solvable).toBe(true)
  })

  it('solves a gap requiring piece rotation', () => {
    const grid = makeGrid()
    // Vertical I-gap at col 0, rows 0-3
    for (let r = 0; r < 4; r++) grid[r][0] = { status: 'empty' }
    const gaps: Gap[] = [{
      pieceType: 'I', rotation: 1, anchorRow: 0, anchorCol: 0,
      cells: [[0,0],[1,0],[2,0],[3,0]],
    }]
    const result = solve({ I: 1 }, grid, gaps)
    expect(result.solvable).toBe(true)
  })
})

function fullGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' })))
}
function emptyAt(grid: Grid, cells: [number, number][]): Grid {
  for (const [r, c] of cells) grid[r][c] = { status: 'empty' }
  return grid
}

describe('bestFit', () => {
  it('fills a gap exactly and leaves the extra piece unused', () => {
    const grid = emptyAt(fullGrid(), [[0, 0], [0, 1], [1, 0], [1, 1]]) // one O gap
    const res = bestFit({ O: 1, T: 1 }, grid)
    expect(res.totalCells).toBe(4)
    expect(res.filledCells).toBe(4)
    expect(res.placements).toHaveLength(1)
    expect(res.placements[0].pieceType).toBe('O')
  })

  it('covers as many cells as possible when pieces are insufficient', () => {
    const grid = emptyAt(fullGrid(), [
      [0, 0], [0, 1], [1, 0], [1, 1],   // O gap A
      [5, 5], [5, 6], [6, 5], [6, 6],   // O gap B
    ])
    const res = bestFit({ O: 1 }, grid) // only enough for one
    expect(res.totalCells).toBe(8)
    expect(res.filledCells).toBe(4)
    expect(res.placements).toHaveLength(1)
  })

  it('leaves genuinely unfillable cells uncovered', () => {
    const grid = emptyAt(fullGrid(), [[0, 0], [0, 1], [0, 2]]) // 3-cell row, no 2x2
    const res = bestFit({ O: 1 }, grid)                        // O cannot fit
    expect(res.filledCells).toBe(0)
    expect(res.placements).toHaveLength(0)
  })

  it('returns within a time budget on a large dense board instead of freezing', () => {
    // Entire 12×12 board empty (144 cells) — the pathological case for the search.
    const grid = makeGrid().map(row => row.map(() => ({ status: 'empty' as const })))
    const start = performance.now()
    const res = bestFit({ I: 5, O: 5, T: 5, L: 5 }, grid)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(1000)          // pre-fix this ran for several seconds
    expect(res.totalCells).toBe(144)
    expect(res.filledCells).toBeGreaterThan(0)  // it still places what it can (best-so-far)
    expect(res.filledCells).toBeLessThanOrEqual(144)
  })
})
