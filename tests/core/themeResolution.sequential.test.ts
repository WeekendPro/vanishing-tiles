import { describe, it, expect } from 'vitest'
import { resolveSelection } from '@shared/core/themeResolution'
import type { Gap, Grid, SelectionEntry, Cell, PieceType } from '@shared/types'
import { ROWS, COLS } from '@shared/types'

// Three single-cell gaps so we control shapes precisely. (SINGLE = 1 cell.)
// order is deliberately NOT in cells-reading order, to prove we sort by `order`.
const gaps: Gap[] = [
  { pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0]], order: 2 },
  { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 1, cells: [[0, 1]], order: 1 },
  { pieceType: 'T', rotation: 0, anchorRow: 0, anchorCol: 2, cells: [[0, 2]], order: 3 },
]
// Gap shapes ordered by `order`: 1→O, 2→I, 3→T.

function gridWith(gs: Gap[]): Grid {
  const g: Grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ status: 'filled' })))
  for (const gap of gs) for (const [r, c] of gap.cells) g[r][c] = { status: 'empty' }
  return g
}

const ordered = (types: PieceType[]): SelectionEntry[] =>
  types.map(pieceType => ({ pieceType, freeCount: 1 }))

// A 4-gap board of single cells matching the spec's worked examples: [T, L, O, L].
const tlol: Gap[] = [
  { pieceType: 'T', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0]], order: 1 },
  { pieceType: 'L', rotation: 0, anchorRow: 0, anchorCol: 1, cells: [[0, 1]], order: 2 },
  { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 2, cells: [[0, 2]], order: 3 },
  { pieceType: 'L', rotation: 0, anchorRow: 0, anchorCol: 3, cells: [[0, 3]], order: 4 },
]

describe('resolveSelection — sequential', () => {
  it('clears when the ordered shapes match the gaps ordered by `order`', () => {
    const res = resolveSelection({ selection: ordered(['O', 'I', 'T']), grid: gridWith(gaps), gaps, theme: 'sequential' })
    expect(res.solvable).toBe(true)
    expect(res.placements).toHaveLength(3)
    expect(res.coverage).toBe(1)
  })

  it('places the correct subset per position; a wrong pick fails only that position', () => {
    // Ordered gaps 1→O, 2→I, 3→T. Picks [I, O, T]: positions 1 and 2 mismatch,
    // position 3 (T) matches → only T lands. Wrong picks do NOT poison the rest.
    const res = resolveSelection({ selection: ordered(['I', 'O', 'T']), grid: gridWith(gaps), gaps, theme: 'sequential' })
    expect(res.solvable).toBe(false)
    expect(res.placements).toHaveLength(1)
    expect(res.placements[0].pieceType).toBe('T')
    expect(res.filledCells).toBe(1)
    expect(res.totalCells).toBe(3)
    expect(res.coverage).toBeCloseTo(1 / 3)
  })

  it('fewer picks than gaps: leading positions land, trailing gaps stay unfilled', () => {
    const res = resolveSelection({ selection: ordered(['O', 'I']), grid: gridWith(gaps), gaps, theme: 'sequential' })
    expect(res.solvable).toBe(false)
    expect(res.placements).toHaveLength(2)
    expect(res.placements.map(p => p.pieceType)).toEqual(['O', 'I'])
  })

  it('treats adjacent identical shapes as interchangeable', () => {
    const twoOsThenI: Gap[] = [
      { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0]], order: 1 },
      { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 1, cells: [[0, 1]], order: 2 },
      { pieceType: 'I', rotation: 0, anchorRow: 0, anchorCol: 2, cells: [[0, 2]], order: 3 },
    ]
    const res = resolveSelection({ selection: ordered(['O', 'O', 'I']), grid: gridWith(twoOsThenI), gaps: twoOsThenI, theme: 'sequential' })
    expect(res.solvable).toBe(true)
  })

  // ── Spec worked examples (puzzle = [T, L, O, L]) ──

  it('[T,L,I,L] → places T(1), L(2), rejects I(3), places L(4)', () => {
    const res = resolveSelection({ selection: ordered(['T', 'L', 'I', 'L']), grid: gridWith(tlol), gaps: tlol, theme: 'sequential' })
    expect(res.solvable).toBe(false)
    expect(res.placements.map(p => p.pieceType)).toEqual(['T', 'L', 'L'])
    expect(res.filledCells).toBe(3)
    expect(res.totalCells).toBe(4)
  })

  it('[T,L,L] → places T(1), L(2), rejects L(3, out of sequence); gap 4 unfilled', () => {
    const res = resolveSelection({ selection: ordered(['T', 'L', 'L']), grid: gridWith(tlol), gaps: tlol, theme: 'sequential' })
    expect(res.solvable).toBe(false)
    expect(res.placements.map(p => p.pieceType)).toEqual(['T', 'L'])
    expect(res.filledCells).toBe(2)
  })

  it('[T,L,O,L,I] → first four land, the extra I(5) is rejected', () => {
    const res = resolveSelection({ selection: ordered(['T', 'L', 'O', 'L', 'I']), grid: gridWith(tlol), gaps: tlol, theme: 'sequential' })
    expect(res.solvable).toBe(false)
    expect(res.placements.map(p => p.pieceType)).toEqual(['T', 'L', 'O', 'L'])
    expect(res.filledCells).toBe(4)
  })

  it('[T,L,O,L] → perfect clear', () => {
    const res = resolveSelection({ selection: ordered(['T', 'L', 'O', 'L']), grid: gridWith(tlol), gaps: tlol, theme: 'sequential' })
    expect(res.solvable).toBe(true)
    expect(res.placements).toHaveLength(4)
    expect(res.coverage).toBe(1)
  })
})
