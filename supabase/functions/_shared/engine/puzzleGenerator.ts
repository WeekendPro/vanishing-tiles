import type { Grid, Gap, Cell, DifficultyConfig, PieceType, Rotation } from '../types.ts'
import { ROWS, COLS } from '../types.ts'
import { getAllRotations, getRotatedCells } from './pieces.ts'

type PuzzleInput = Pick<DifficultyConfig, 'gapCount' | 'complexity'> & {
  adjacency?: number
  /** When set, restrict the puzzle to `shapeTypeCount` shape(s) and assign each
   *  gap a distinct color from `palette` (color-coded theme). */
  colorCoded?: { shapeTypeCount: number; palette: string[] }
  /** When true, stamp order 1..N across the gaps (Sequential theme). */
  sequential?: boolean
  /** Restrict the gaps to exactly these piece types (overrides the complexity
   *  band). Used by Infinite Stagger to introduce shapes gradually. */
  allowedTypes?: PieceType[]
  /** Force each listed type's gaps to a fixed rotation instead of varying it.
   *  Used by Infinite Stagger to keep early gaps matching the tray orientation. */
  lockedRotations?: Partial<Record<PieceType, Rotation>>
}

const COMPLEXITY_PIECES: Record<DifficultyConfig['complexity'], PieceType[]> = {
  simple:  ['I', 'O'],
  medium:  ['I', 'O', 'T', 'J', 'L'],
  complex: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'],
}

// Fisher–Yates shuffle of a COPY, driven by the seeded rng.
function shuffled<T>(items: T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
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

// Places `gapCount` gaps on a fresh full grid, drawing piece types/rotations/
// anchors from `rng`. Pulled out so the sequential variety guard can re-roll a
// whole board on the same advancing rng stream.
function placeGaps(
  gapCount: number,
  allowedTypes: PieceType[],
  adjacency: number,
  rng: () => number,
  lockedRotations?: Partial<Record<PieceType, Rotation>>
): { grid: Grid; gaps: Gap[] } {
  const grid = makeFullGrid()
  const gaps: Gap[] = []

  let attempts = 0
  while (gaps.length < gapCount && attempts < 4000) {
    attempts++
    const pieceType = allowedTypes[Math.floor(rng() * allowedTypes.length)]
    // A locked rotation pins the gap to its tray orientation; otherwise vary it.
    const locked = lockedRotations?.[pieceType]
    const rotations = locked !== undefined
      ? [{ rotation: locked, cells: getRotatedCells(pieceType, locked) }]
      : getAllRotations(pieceType)
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

// True when the gaps span at least 2 distinct piece types (the Sequential
// variety rule: a 1-gap board is trivially fine; a 2+ gap board must never be
// all-identical, e.g. three I-gaps or four O-gaps).
function hasTypeVariety(gaps: Gap[]): boolean {
  if (gaps.length < 2) return true
  return new Set(gaps.map(g => g.pieceType)).size >= 2
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
  const allowedTypes = input.allowedTypes
    ? input.allowedTypes
    : input.colorCoded
      ? shuffled(COMPLEXITY_PIECES[complexity], rng).slice(0, Math.max(1, input.colorCoded.shapeTypeCount))
      : COMPLEXITY_PIECES[complexity]

  let { grid, gaps } = placeGaps(gapCount, allowedTypes, adjacency, rng, input.lockedRotations)

  // Variety guard: a round that should exercise memory across different shapes
  // must never let every gap be the same piece type. Re-roll the whole board
  // (rng keeps advancing, so each retry differs) until the gaps span ≥2 types.
  // Applies to Sequential rounds and to multi-shape Color-coded rounds (so a
  // Chromatic board with shapeTypeCount>1 shows a genuine mix, never all-identical
  // by chance). Only attempt when >1 allowed type can actually satisfy it.
  const wantsVariety = input.sequential || (!!input.colorCoded && input.colorCoded.shapeTypeCount > 1)
  if (wantsVariety && allowedTypes.length > 1) {
    let retries = 0
    while (!hasTypeVariety(gaps) && retries < 50) {
      retries++
      ;({ grid, gaps } = placeGaps(gapCount, allowedTypes, adjacency, rng, input.lockedRotations))
    }
  }

  // Color-coded: assign each gap a distinct palette color (shuffled by rng).
  if (input.colorCoded) {
    const palette = shuffled(input.colorCoded.palette, rng)
    gaps.forEach((gap, i) => { gap.color = palette[i % palette.length] })
  }

  // Sequential: stamp a 1..N order badge across the gaps in placement order.
  // Gaps are already placed at random board positions, so ascending order
  // numbers are spatially scattered (no trivial top-to-bottom reading).
  if (input.sequential) {
    gaps.forEach((gap, i) => { gap.order = i + 1 })
  }

  return { grid, gaps }
}
