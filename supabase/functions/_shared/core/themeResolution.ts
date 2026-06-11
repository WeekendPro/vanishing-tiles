import type { Gap, Grid, PieceType, Placement, SelectionEntry, RoundTheme } from '../types.ts'
import { THEME_CONFIG } from './themeConfig.ts'

export interface ResolveResult {
  solvable: boolean
  placements: Placement[]
  coverage: number      // 1 on a clear; filledCells/totalCells otherwise
  filledCells: number
  totalCells: number
}

interface Pick {
  pieceType: PieceType
  color?: string
}

// Flatten the selection cart into an ordered list of individual picks. Each
// SelectionEntry contributes `freeCount` picks, preserving cart/queue order.
function expandPicks(selection: SelectionEntry[]): Pick[] {
  const picks: Pick[] = []
  for (const e of selection) {
    for (let i = 0; i < e.freeCount; i++) picks.push({ pieceType: e.pieceType, color: e.color })
  }
  return picks
}

// A placement that exactly fills `gap` — pieces only ever land on a gap's own
// cells, never spanning. Color is carried through for color-coded coherence
// (undefined for monochrome themes).
function placementForGap(gap: Gap): Placement {
  return {
    pieceType: gap.pieceType,
    rotation: gap.rotation,
    anchorRow: gap.anchorRow,
    anchorCol: gap.anchorCol,
    cells: gap.cells,
    color: gap.color,
  }
}

/**
 * Resolve a selection against the gaps as a strict ASSIGNMENT problem: every
 * gap is a discrete tetromino, and a selected piece may only fill a gap of the
 * exact same shape (and color, when the theme is color-coded). A piece with no
 * available matching gap is rejected; a gap with no matching piece stays
 * unfilled. Pieces NEVER land on mismatched cells or span multiple gaps.
 *
 * Sequential rounds match positionally instead: the k-th pick is judged against
 * the gap labelled `order = k`. Each position succeeds or fails independently —
 * a wrong or missing pick never poisons the others.
 */
export function resolveSelection(args: {
  selection: SelectionEntry[]
  grid: Grid
  gaps: Gap[]
  theme: RoundTheme
}): ResolveResult {
  const { selection, gaps, theme } = args
  const { colorMatters, orderMatters } = THEME_CONFIG[theme]

  if (orderMatters) return resolveSequential(selection, gaps)
  return resolveByShape(selection, gaps, colorMatters)
}

// Sequential: match pick k (1-based) against the gap whose `order == k`.
function resolveSequential(selection: SelectionEntry[], gaps: Gap[]): ResolveResult {
  const picks = expandPicks(selection)
  const orderedGaps = [...gaps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const totalCells = orderedGaps.reduce((sum, g) => sum + g.cells.length, 0)

  const placements: Placement[] = []
  let filledCells = 0
  let matched = 0

  orderedGaps.forEach((gap, k) => {
    // A pick exists at this position AND its shape matches the gap → it lands.
    // Otherwise (wrong shape, or no pick supplied) the gap stays unfilled.
    if (k < picks.length && picks[k].pieceType === gap.pieceType) {
      placements.push(placementForGap(gap))
      filledCells += gap.cells.length
      matched++
    }
  })

  // Perfect only when every gap is filled in order AND there are no extra picks
  // (extras beyond N are rejected, making the round a partial).
  const solvable = matched === orderedGaps.length && picks.length === orderedGaps.length
  return {
    solvable,
    placements,
    coverage: totalCells === 0 ? 0 : filledCells / totalCells,
    filledCells,
    totalCells,
  }
}

// Basic / color-coded: greedily assign each gap the first unclaimed pick of the
// matching shape (and color, when colorMatters).
function resolveByShape(selection: SelectionEntry[], gaps: Gap[], colorMatters: boolean): ResolveResult {
  const picks = expandPicks(selection)
  const claimed = new Array<boolean>(picks.length).fill(false)
  const totalCells = gaps.reduce((sum, g) => sum + g.cells.length, 0)

  const placements: Placement[] = []
  let filledCells = 0
  let matchedGaps = 0

  for (const gap of gaps) {
    const idx = picks.findIndex((p, i) =>
      !claimed[i] && p.pieceType === gap.pieceType && (!colorMatters || p.color === gap.color))
    if (idx >= 0) {
      claimed[idx] = true
      matchedGaps++
      filledCells += gap.cells.length
      placements.push(placementForGap(gap))
    }
  }

  const leftoverPicks = claimed.filter(c => !c).length
  const solvable = matchedGaps === gaps.length && leftoverPicks === 0
  return {
    solvable,
    placements,
    coverage: totalCells === 0 ? 0 : filledCells / totalCells,
    filledCells,
    totalCells,
  }
}
