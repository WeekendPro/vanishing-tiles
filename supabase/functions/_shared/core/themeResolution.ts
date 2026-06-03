import type { Grid, Gap, PieceType, Placement, SelectionEntry, RoundTheme } from '../types.ts'
import { solve, bestFit } from '../engine/solver.ts'
import { THEME_CONFIG } from './themeConfig.ts'

export interface ResolveResult {
  solvable: boolean
  placements: Placement[]
  coverage: number      // 1 on a clear; filledCells/totalCells otherwise
  filledCells: number
  totalCells: number
}

type PieceCount = Partial<Record<PieceType, number>>

function emptyCount(grid: Grid): number {
  return grid.flat().filter(c => c.status === 'empty').length
}

function tally(entries: SelectionEntry[]): PieceCount {
  const t: PieceCount = {}
  for (const e of entries) if (e.freeCount > 0) t[e.pieceType] = (t[e.pieceType] ?? 0) + e.freeCount
  return t
}

// A clone of `grid` where only `color`'s gap cells remain empty — every other
// gap's cells are refilled, so solve/bestFit see one color group in isolation.
function subgridForColor(grid: Grid, gaps: Gap[], color: string | undefined): Grid {
  const g = grid.map(row => row.map(cell => ({ ...cell })))
  for (const gap of gaps) {
    if (gap.color !== color) for (const [r, c] of gap.cells) g[r][c] = { status: 'filled' }
  }
  return g
}

export function resolveSelection(args: {
  selection: SelectionEntry[]
  grid: Grid
  gaps: Gap[]
  theme: RoundTheme
}): ResolveResult {
  const { selection, grid, gaps, theme } = args
  const { colorMatters, orderMatters } = THEME_CONFIG[theme]

  if (orderMatters) {
    // Sequential: the k-th pick must match the shape of the gap labelled k.
    // Compare positionally against gaps sorted by `order`; any mismatch (count,
    // shape, or order) fails the whole round with zero partial credit.
    const picks: PieceType[] = []
    for (const e of selection) for (let i = 0; i < e.freeCount; i++) picks.push(e.pieceType)
    const orderedGaps = [...gaps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const totalCells = orderedGaps.reduce((sum, g) => sum + g.cells.length, 0)

    const matches =
      picks.length === orderedGaps.length &&
      orderedGaps.every((g, k) => g.pieceType === picks[k])

    if (matches) {
      const placements: Placement[] = orderedGaps.map(g => ({
        pieceType: g.pieceType,
        rotation: g.rotation,
        anchorRow: g.anchorRow,
        anchorCol: g.anchorCol,
        cells: g.cells,
      }))
      return { solvable: true, placements, coverage: 1, filledCells: totalCells, totalCells }
    }
    return { solvable: false, placements: [], coverage: 0, filledCells: 0, totalCells }
  }

  if (!colorMatters) {
    const pieceCount = tally(selection)
    const total = emptyCount(grid)
    const res = solve(pieceCount, grid, gaps)
    if (res.solvable) {
      return { solvable: true, placements: res.placements ?? [], coverage: 1, filledCells: total, totalCells: total }
    }
    const fit = bestFit(pieceCount, grid)
    return {
      solvable: false,
      placements: fit.placements,
      coverage: fit.totalCells === 0 ? 0 : fit.filledCells / fit.totalCells,
      filledCells: fit.filledCells,
      totalCells: fit.totalCells,
    }
  }

  // Color-coded: solve each color group independently against its subgrid.
  const colors = [...new Set([
    ...gaps.map(g => g.color),
    ...selection.map(s => s.color),
  ])].filter((c): c is string => c !== undefined)

  const placements: Placement[] = []
  let allSolvable = true
  let filled = 0
  let total = 0

  for (const color of colors) {
    const colorGaps = gaps.filter(g => g.color === color)
    const colorGrid = subgridForColor(grid, gaps, color)
    const colorTally = tally(selection.filter(s => s.color === color))
    const colorEmpty = emptyCount(colorGrid)
    total += colorEmpty

    // If there are no empty cells for this color, skip (nothing to fill).
    // This handles the case where a selection color has no matching gaps.
    if (colorEmpty === 0) {
      // No gaps to fill for this color — the stray piece means we have an
      // extra piece with nothing to match. That's a failure for this group.
      if (Object.values(colorTally).some(n => (n ?? 0) > 0)) {
        allSolvable = false
      }
      continue
    }

    const res = solve(colorTally, colorGrid, colorGaps)
    if (res.solvable) {
      filled += colorEmpty
      placements.push(...(res.placements ?? []).map(p => ({ ...p, color })))
    } else {
      allSolvable = false
      const fit = bestFit(colorTally, colorGrid)
      filled += fit.filledCells
      placements.push(...fit.placements.map(p => ({ ...p, color })))
    }
  }

  return {
    solvable: allSolvable,
    placements,
    coverage: total === 0 ? 0 : filled / total,
    filledCells: filled,
    totalCells: total,
  }
}
