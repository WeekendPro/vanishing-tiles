import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { getRotatedCells } from '@shared/engine/pieces'

describe('generatePuzzle — Infinite Stagger options', () => {
  it('allowedTypes restricts gaps to exactly those piece types', () => {
    const { gaps } = generatePuzzle({ gapCount: 8, complexity: 'complex', allowedTypes: ['O', 'I'] })
    expect(gaps.length).toBe(8)
    gaps.forEach(g => expect(['O', 'I']).toContain(g.pieceType))
  })

  it('lockedRotations pins every gap to its fixed rotation', () => {
    const locked = { I: 1, J: 1, L: 1, O: 0, S: 0, Z: 0, T: 0 } as const
    const { gaps } = generatePuzzle({
      gapCount: 10, complexity: 'complex',
      allowedTypes: ['I', 'J', 'L', 'O'],
      lockedRotations: locked,
    })
    gaps.forEach(g => {
      expect(g.rotation).toBe(locked[g.pieceType])
      // the gap's absolute cells match the locked rotation's shape
      const shape = getRotatedCells(g.pieceType, locked[g.pieceType])
      const norm = (cs: [number, number][]) => {
        const minR = Math.min(...cs.map(([r]) => r)); const minC = Math.min(...cs.map(([, c]) => c))
        return cs.map(([r, c]) => `${r - minR},${c - minC}`).sort().join('|')
      }
      expect(norm(g.cells)).toBe(norm(shape as [number, number][]))
    })
  })

  it('without lockedRotations, rotations are free to vary (default behaviour intact)', () => {
    const { gaps } = generatePuzzle({ gapCount: 6, complexity: 'complex' })
    expect(gaps.length).toBe(6)  // existing callers unaffected
  })
})
