import type { Grid, Gap, PieceType, Rotation } from '../types'
import { ROWS, COLS } from '../types'
import { getAllRotations } from './pieces'

export interface Placement {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: [number, number][]
}

export interface SolveResult {
  solvable: boolean
  placements: Placement[] | null
}

type PieceCount = Partial<Record<PieceType, number>>

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
    break // Only try one piece type per empty cell to avoid redundant branching
  }

  return false
}

export function solve(pieceCount: PieceCount, grid: Grid, _gaps: Gap[]): SolveResult {
  const totalPieceCells = Object.entries(pieceCount).reduce((sum, [type, count]) => {
    if ((count ?? 0) === 0) return sum
    const cellsPerPiece = type === 'SINGLE' ? 1 : 4
    return sum + (count ?? 0) * cellsPerPiece
  }, 0)
  const totalEmpty = grid.flat().filter(c => c.status === 'empty').length

  if (totalPieceCells !== totalEmpty) return { solvable: false, placements: null }

  const workGrid = cloneGrid(grid)
  const remaining: PieceCount = { ...pieceCount }
  const placements: Placement[] = []

  const solvable = backtrack(workGrid, remaining, placements)
  return { solvable, placements: solvable ? placements : null }
}
