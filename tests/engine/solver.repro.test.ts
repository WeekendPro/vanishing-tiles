import { describe, it, expect } from 'vitest'
import { solve, bestFit } from '@shared/engine/solver'
import type { Grid, Gap, Cell } from '@shared/types'
import { ROWS, COLS } from '@shared/types'

// Regression guard for solve() on a multi-gap (Level 2 shaped) board: four
// piece-shaped holes (3×I + 1×O) where { I:3, O:1 } is the exact one-per-gap
// selection. solve() MUST find this exact cover. (This board was built while
// investigating a reported "100% coverage yet solved=false" result, which
// turned out to be an OVER-selection — extra pieces trip solve()'s
// totalPieceCells===totalEmpty guard while bestFit still tiles a subset. The
// exact selection below is solvable and must stay that way.)
function board(): { grid: Grid; gaps: Gap[] } {
  const grid: Grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' })))
  const empties: [number, number][] = [
    [0, 0], [0, 6], [0, 7],
    [1, 0], [1, 1], [1, 6], [1, 7],
    [2, 0], [2, 1],
    [3, 0], [3, 1],
    [4, 1], [4, 8], [4, 9], [4, 10], [4, 11],
  ]
  for (const [r, c] of empties) grid[r][c] = { status: 'empty' }
  const gaps: Gap[] = [
    { pieceType: 'I', rotation: 1, anchorRow: 0, anchorCol: 0, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
    { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 6, cells: [[0, 6], [0, 7], [1, 6], [1, 7]] },
    { pieceType: 'I', rotation: 0, anchorRow: 4, anchorCol: 8, cells: [[4, 8], [4, 9], [4, 10], [4, 11]] },
    { pieceType: 'I', rotation: 1, anchorRow: 1, anchorCol: 1, cells: [[1, 1], [2, 1], [3, 1], [4, 1]] },
  ]
  return { grid, gaps }
}

describe('solve regression: 3xI + 1xO exact cover', () => {
  it('bestFit tiles the whole board (sanity)', () => {
    const { grid } = board()
    const fit = bestFit({ I: 3, O: 1 }, grid)
    expect(fit.totalCells).toBe(16)
    expect(fit.filledCells).toBe(16)
  })

  it('solve finds the exact cover that bestFit proves exists', () => {
    const { grid, gaps } = board()
    const result = solve({ I: 3, O: 1 }, grid, gaps)
    expect(result.solvable).toBe(true)
  })

  // Over-selection (correct pieces + one extra) is NOT a clear: solve() requires
  // an exact cover using ALL selected pieces, so the surplus cells trip its
  // totalPieceCells===totalEmpty guard. bestFit still tiles a subset → 100%
  // coverage. This (solvable=false, coverage=1) is the intended outcome and the
  // explanation for the field-reported "100% coverage yet 0 points".
  it('over-selection: solve=false but bestFit still covers 100%', () => {
    const { grid, gaps } = board()
    const oversel = { I: 4, O: 1 } as const // one extra I beyond the 3×I+1×O cover

    expect(solve(oversel, grid, gaps).solvable).toBe(false)

    const fit = bestFit(oversel, grid)
    expect(fit.totalCells).toBe(16)
    expect(fit.filledCells).toBe(16)
  })
})
