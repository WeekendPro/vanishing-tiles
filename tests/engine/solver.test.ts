import { describe, it, expect } from 'vitest'
import { solve } from '../../src/engine/solver'
import type { Grid, Gap } from '../../src/types'
import { ROWS, COLS } from '../../src/types'

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
