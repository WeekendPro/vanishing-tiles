import type { Grid, Gap, Cell, DifficultyConfig, PieceType, Rotation } from '../types'
import { ROWS, COLS } from '../types'
import { getAllRotations } from './pieces'

type PuzzleInput = Pick<DifficultyConfig, 'gapCount' | 'complexity'>

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

function cellsInBounds(cells: [number, number][], anchorRow: number, anchorCol: number): boolean {
  return cells.every(([r, c]) => {
    const ar = r + anchorRow
    const ac = c + anchorCol
    return ar >= 0 && ar < ROWS && ac >= 0 && ac < COLS
  })
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

export function generatePuzzle(input: PuzzleInput): { grid: Grid; gaps: Gap[] } {
  const { gapCount, complexity } = input
  const allowedTypes = COMPLEXITY_PIECES[complexity]
  const grid = makeFullGrid()
  const gaps: Gap[] = []

  let attempts = 0
  while (gaps.length < gapCount && attempts < 1000) {
    attempts++
    const pieceType = allowedTypes[Math.floor(Math.random() * allowedTypes.length)]
    const rotations = getAllRotations(pieceType)
    const { rotation, cells } = rotations[Math.floor(Math.random() * rotations.length)]

    const maxRow = ROWS - Math.max(...cells.map(([r]) => r)) - 1
    const maxCol = COLS - Math.max(...cells.map(([, c]) => c)) - 1
    if (maxRow < 0 || maxCol < 0) continue

    const anchorRow = Math.floor(Math.random() * (maxRow + 1))
    const anchorCol = Math.floor(Math.random() * (maxCol + 1))

    if (!cellsInBounds(cells, anchorRow, anchorCol)) continue
    if (!cellsAreFree(grid, cells, anchorRow, anchorCol)) continue

    const absoluteCells = cells.map(([r, c]) => [r + anchorRow, c + anchorCol] as [number, number])
    placeGap(grid, cells, anchorRow, anchorCol)
    gaps.push({ pieceType, rotation, anchorRow, anchorCol, cells: absoluteCells })
  }

  return { grid, gaps }
}
