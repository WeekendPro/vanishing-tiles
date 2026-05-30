import type { Grid, Gap, Cell, DifficultyConfig, PieceType } from '../types.ts'
import { ROWS, COLS } from '../types.ts'
import { getAllRotations } from './pieces.ts'

type PuzzleInput = Pick<DifficultyConfig, 'gapCount' | 'complexity'> & {
  adjacency?: number
}

const COMPLEXITY_PIECES: Record<DifficultyConfig['complexity'], PieceType[]> = {
  simple:  ['I', 'O'],
  medium:  ['I', 'O', 'T', 'J', 'L'],
  complex: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'],
}

function makeFullGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' }))
  )
}

function cellsAreFree(
  grid: Grid,
  cells: [number, number][],
  anchorRow: number,
  anchorCol: number
): boolean {
  return cells.every(([r, c]) => grid[r + anchorRow][c + anchorCol].status === 'filled')
}

function placeGap(
  grid: Grid,
  cells: [number, number][],
  anchorRow: number,
  anchorCol: number
): void {
  cells.forEach(([r, c]) => {
    grid[r + anchorRow][c + anchorCol] = { status: 'empty' }
  })
}

// True when any cell of the piece (anchored here) is orthogonally adjacent to an
// already-empty cell. Used to cluster gaps when adjacency > 0.
function anchorTouchesEmpty(
  grid: Grid,
  cells: [number, number][],
  anchorRow: number,
  anchorCol: number
): boolean {
  return cells.some(([r, c]) => {
    const ar = r + anchorRow
    const ac = c + anchorCol
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => {
      const nr = ar + dr
      const nc = ac + dc
      return nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc].status === 'empty'
    })
  })
}

// rng defaults to Math.random so existing free-play callers keep working; the
// server always passes a seeded rng (src/core/prng.makeRng) so a (config, seed)
// pair reproduces the exact board.
export function generatePuzzle(
  input: PuzzleInput,
  rng: () => number = Math.random
): { grid: Grid; gaps: Gap[] } {
  const { gapCount, complexity } = input
  const adjacency = input.adjacency ?? 0
  const allowedTypes = COMPLEXITY_PIECES[complexity]
  const grid = makeFullGrid()
  const gaps: Gap[] = []

  let attempts = 0
  while (gaps.length < gapCount && attempts < 4000) {
    attempts++
    const pieceType = allowedTypes[Math.floor(rng() * allowedTypes.length)]
    const rotations = getAllRotations(pieceType)
    const { rotation, cells } = rotations[Math.floor(rng() * rotations.length)]

    const maxRow = ROWS - Math.max(...cells.map(([r]) => r)) - 1
    const maxCol = COLS - Math.max(...cells.map(([, c]) => c)) - 1
    if (maxRow < 0 || maxCol < 0) continue

    // Enumerate every in-bounds anchor where the rotated piece fits on filled cells.
    const candidates: [number, number][] = []
    for (let r = 0; r <= maxRow; r++) {
      for (let c = 0; c <= maxCol; c++) {
        if (cellsAreFree(grid, cells, r, c)) candidates.push([r, c])
      }
    }
    if (candidates.length === 0) continue

    // When adjacency>0, prefer anchors that touch an existing empty cell so gaps
    // cluster; fall back to all candidates when none touch (e.g. the first gap).
    const near =
      adjacency > 0
        ? candidates.filter(([r, c]) => anchorTouchesEmpty(grid, cells, r, c))
        : []
    const pool = near.length > 0 ? near : candidates
    const [anchorRow, anchorCol] = pool[Math.floor(rng() * pool.length)]

    const absoluteCells = cells.map(([r, c]) => [r + anchorRow, c + anchorCol] as [number, number])
    placeGap(grid, cells, anchorRow, anchorCol)
    gaps.push({ pieceType, rotation, anchorRow, anchorCol, cells: absoluteCells })
  }

  return { grid, gaps }
}
