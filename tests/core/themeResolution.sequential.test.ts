import { describe, it, expect } from 'vitest'
import { resolveSelection } from '@shared/core/themeResolution'
import type { Gap, Grid, SelectionEntry, Cell } from '@shared/types'
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

const ordered = (types: SelectionEntry['pieceType'][]): SelectionEntry[] =>
  types.map(pieceType => ({ pieceType, freeCount: 1 }))

describe('resolveSelection — sequential', () => {
  it('clears when the ordered shapes match the gaps ordered by `order`', () => {
    const res = resolveSelection({ selection: ordered(['O', 'I', 'T']), grid: gridWith(gaps), gaps, theme: 'sequential' })
    expect(res.solvable).toBe(true)
    expect(res.placements).toHaveLength(3)
    expect(res.coverage).toBe(1)
  })

  it('fails with no partial credit when shapes are right but order is wrong', () => {
    const res = resolveSelection({ selection: ordered(['I', 'O', 'T']), grid: gridWith(gaps), gaps, theme: 'sequential' })
    expect(res.solvable).toBe(false)
    expect(res.placements).toHaveLength(0)
    expect(res.coverage).toBe(0)
  })

  it('fails when the picked count does not equal the gap count', () => {
    const res = resolveSelection({ selection: ordered(['O', 'I']), grid: gridWith(gaps), gaps, theme: 'sequential' })
    expect(res.solvable).toBe(false)
    expect(res.placements).toHaveLength(0)
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
})
