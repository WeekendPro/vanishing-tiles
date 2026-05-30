import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { makeRng } from '@shared/core/prng'

function emptyCount(grid: { status: string }[][]): number {
  return grid.flat().filter(c => c.status === 'empty').length
}

describe('generatePuzzle adjacency', () => {
  it('accepts an adjacency parameter and still fills the requested gaps', () => {
    const { grid, gaps } = generatePuzzle({ gapCount: 6, complexity: 'medium', adjacency: 2 }, makeRng('s'))
    expect(gaps.length).toBeGreaterThan(0)
    expect(emptyCount(grid)).toBe(gaps.flatMap(g => g.cells).length)
  })

  it('defaults rng to Math.random when omitted (free-play back-compat)', () => {
    const { gaps } = generatePuzzle({ gapCount: 4, complexity: 'simple' })
    expect(gaps.length).toBeGreaterThan(0)
  })
})
