import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { ROWS, COLS } from '@shared/types'

describe('generatePuzzle', () => {
  it('returns a grid with correct dimensions', () => {
    const { grid } = generatePuzzle({ gapCount: 2, complexity: 'simple' })
    expect(grid).toHaveLength(ROWS)
    grid.forEach(row => expect(row).toHaveLength(COLS))
  })

  it('returns the correct number of gaps', () => {
    const { gaps } = generatePuzzle({ gapCount: 3, complexity: 'simple' })
    expect(gaps).toHaveLength(3)
  })

  it('each gap has cells matching the grid empty cells', () => {
    const { grid, gaps } = generatePuzzle({ gapCount: 2, complexity: 'simple' })
    const emptyCells = new Set<string>()
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c].status === 'empty') emptyCells.add(`${r},${c}`)

    for (const gap of gaps) {
      for (const [r, c] of gap.cells) {
        expect(emptyCells.has(`${r},${c}`)).toBe(true)
      }
    }
  })

  it('empty cell count equals sum of all gap cells', () => {
    const { grid, gaps } = generatePuzzle({ gapCount: 3, complexity: 'simple' })
    const emptyCount = grid.flat().filter(c => c.status === 'empty').length
    const gapCellCount = gaps.reduce((sum, g) => sum + g.cells.length, 0)
    expect(emptyCount).toBe(gapCellCount)
  })

  it('gaps do not overlap', () => {
    const { gaps } = generatePuzzle({ gapCount: 4, complexity: 'medium' })
    const seen = new Set<string>()
    for (const gap of gaps) {
      for (const [r, c] of gap.cells) {
        const key = `${r},${c}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })

  it('simple complexity only uses I and O pieces', () => {
    for (let i = 0; i < 10; i++) {
      const { gaps } = generatePuzzle({ gapCount: 2, complexity: 'simple' })
      gaps.forEach(g => expect(['I', 'O']).toContain(g.pieceType))
    }
  })

  it('never creates 1×1 gaps', () => {
    for (let i = 0; i < 10; i++) {
      const { gaps } = generatePuzzle({ gapCount: 3, complexity: 'simple' })
      gaps.forEach(g => expect(g.cells.length).toBeGreaterThan(1))
    }
  })

  it('places a high gap count on the larger board', () => {
    const { gaps } = generatePuzzle({ gapCount: 16, complexity: 'complex' })
    expect(gaps).toHaveLength(16)
  })
})
