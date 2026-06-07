import type { Grid, Gap, PieceType, Placement } from '../types.ts'
import { ROWS, COLS } from '../types.ts'
import { getAllRotations } from './pieces.ts'

export interface SolveResult {
  solvable: boolean
  placements: Placement[] | null
}

type PieceCount = Partial<Record<PieceType, number>>

/** Max wall-clock time bestFit's search may run before returning the best
 *  packing found so far. Prevents the branch-and-bound from freezing the UI
 *  on the large 12×12 board with high gap counts. Small inputs finish long
 *  before this fires, so their results stay optimal. */
const BEST_FIT_BUDGET_MS = 100

function cloneGrid(grid: Grid): Grid {
  return grid.map(row => row.map(cell => ({ ...cell })))
}

function findFirstEmpty(grid: Grid): [number, number] | null {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c].status === 'empty') return [r, c]
  return null
}

function canPlace(grid: Grid, cells: [number, number][], anchorRow: number, anchorCol: number): boolean {
  return cells.every(([r, c]) => {
    const ar = r + anchorRow
    const ac = c + anchorCol
    return ar >= 0 && ar < ROWS && ac >= 0 && ac < COLS && grid[ar][ac].status === 'empty'
  })
}

function applyPlacement(grid: Grid, cells: [number, number][], anchorRow: number, anchorCol: number, status: 'placed' | 'empty'): void {
  cells.forEach(([r, c]) => {
    grid[r + anchorRow][c + anchorCol] = { status }
  })
}

function backtrack(
  grid: Grid,
  remaining: PieceCount,
  placements: Placement[]
): boolean {
  const empty = findFirstEmpty(grid)
  if (!empty) {
    const hasRemaining = Object.values(remaining).some(n => (n ?? 0) > 0)
    return !hasRemaining
  }

  const [targetRow, targetCol] = empty

  for (const [pieceTypeKey, count] of Object.entries(remaining)) {
    if ((count ?? 0) <= 0) continue
    const pieceType = pieceTypeKey as PieceType

    for (const { rotation, cells } of getAllRotations(pieceType)) {
      for (const [dr, dc] of cells) {
        const anchorRow = targetRow - dr
        const anchorCol = targetCol - dc
        if (!canPlace(grid, cells, anchorRow, anchorCol)) continue

        const absoluteCells = cells.map(([r, c]) => [r + anchorRow, c + anchorCol] as [number, number])
        applyPlacement(grid, cells, anchorRow, anchorCol, 'placed')
        remaining[pieceType] = (count ?? 0) - 1
        placements.push({ pieceType, rotation, anchorRow, anchorCol, cells: absoluteCells })

        if (backtrack(grid, remaining, placements)) return true

        placements.pop()
        remaining[pieceType] = count
        applyPlacement(grid, cells, anchorRow, anchorCol, 'empty')
      }
    }
  }

  return false
}

export interface BestFitResult {
  placements: Placement[]   // the winning packing — the "good" pieces
  filledCells: number       // empty cells covered by `placements`
  totalCells: number        // empty cells before placement
}

/**
 * Find the placement of a SUBSET of the given pieces that covers the most
 * empty cells (max-coverage). Tie-break: fewest pieces used. Pieces not in
 * `placements` are the "bad" pieces (caller derives them from the selection).
 */
export function bestFit(pieceCount: PieceCount, grid: Grid): BestFitResult {
  const totalCells = grid.flat().filter(c => c.status === 'empty').length
  const workGrid = cloneGrid(grid)
  const remaining: PieceCount = { ...pieceCount }

  let best: Placement[] = []
  let bestFilled = -1
  let bestPieces = Infinity

  const current: Placement[] = []
  let currentFilled = 0
  let currentPieces = 0

  const deadline = performance.now() + BEST_FIT_BUDGET_MS
  let aborted = false
  let nodes = 0

  function record(): void {
    if (currentFilled > bestFilled ||
        (currentFilled === bestFilled && currentPieces < bestPieces)) {
      bestFilled = currentFilled
      bestPieces = currentPieces
      best = current.map(p => ({ ...p, cells: p.cells.map(([r, c]) => [r, c] as [number, number]) }))
    }
  }

  function search(): void {
    if (aborted) return
    if ((++nodes & 0x7ff) === 0 && performance.now() > deadline) { aborted = true; return }
    const empty = findFirstEmpty(workGrid)
    if (!empty) { record(); return }

    // No pieces left to place — the rest of the grid stays uncovered.
    const piecesLeft = Object.values(remaining).some(n => (n ?? 0) > 0)
    if (!piecesLeft) { record(); return }

    // Branch-and-bound: best achievable from here = currentFilled + all
    // still-empty cells. (Cells skipped via Branch B are marked 'filled', so
    // this is strictly less than totalCells - currentFilled once any are
    // skipped — which is what makes the prune actually fire.)
    const remainingEmpty = workGrid.flat().filter(c => c.status === 'empty').length
    if (currentFilled + remainingEmpty < bestFilled) return

    const [targetRow, targetCol] = empty

    // Branch A: cover this cell with each available piece/rotation.
    for (const [pieceTypeKey, count] of Object.entries(remaining)) {
      if ((count ?? 0) <= 0) continue
      const pieceType = pieceTypeKey as PieceType
      for (const { rotation, cells } of getAllRotations(pieceType)) {
        for (const [dr, dc] of cells) {
          const anchorRow = targetRow - dr
          const anchorCol = targetCol - dc
          if (!canPlace(workGrid, cells, anchorRow, anchorCol)) continue

          const absoluteCells = cells.map(([r, c]) => [r + anchorRow, c + anchorCol] as [number, number])
          applyPlacement(workGrid, cells, anchorRow, anchorCol, 'placed')
          remaining[pieceType] = (count ?? 0) - 1
          current.push({ pieceType, rotation, anchorRow, anchorCol, cells: absoluteCells })
          currentFilled += cells.length
          currentPieces += 1

          search()

          currentPieces -= 1
          currentFilled -= cells.length
          current.pop()
          remaining[pieceType] = count
          applyPlacement(workGrid, cells, anchorRow, anchorCol, 'empty')
        }
      }
    }

    // Branch B: leave this cell uncovered, then continue with the rest.
    workGrid[targetRow][targetCol] = { status: 'filled' }
    search()
    workGrid[targetRow][targetCol] = { status: 'empty' }
  }

  search()
  return { placements: best, filledCells: Math.max(bestFilled, 0), totalCells }
}

export function solve(pieceCount: PieceCount, grid: Grid, _gaps: Gap[]): SolveResult {
  const totalPieceCells = Object.entries(pieceCount).reduce((sum, [, count]) => {
    if ((count ?? 0) === 0) return sum
    return sum + (count ?? 0) * 4
  }, 0)
  const totalEmpty = grid.flat().filter(c => c.status === 'empty').length

  if (totalPieceCells !== totalEmpty) return { solvable: false, placements: null }

  const workGrid = cloneGrid(grid)
  const remaining: PieceCount = { ...pieceCount }
  const placements: Placement[] = []

  const solvable = backtrack(workGrid, remaining, placements)
  return { solvable, placements: solvable ? placements : null }
}
