import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { makeRng } from '@shared/core/prng'
import type { Gap } from '@shared/types'

/** Smallest orthogonal (Manhattan) distance between any two cells belonging to
 *  DIFFERENT gaps. Infinity when there are fewer than 2 gaps. */
function minCrossGapManhattan(gaps: Gap[]): number {
  let min = Infinity
  for (let i = 0; i < gaps.length; i++) {
    for (let j = i + 1; j < gaps.length; j++) {
      for (const [r1, c1] of gaps[i].cells) {
        for (const [r2, c2] of gaps[j].cells) {
          min = Math.min(min, Math.abs(r1 - r2) + Math.abs(c1 - c2))
        }
      }
    }
  }
  return min
}

describe('generatePuzzle minGapDistance (orthogonal spacing)', () => {
  it('minGapDistance=1 keeps gaps off each other’s edges (corners still allowed)', () => {
    // A modest board so the constraint is comfortably satisfiable (no fallback).
    const { gaps } = generatePuzzle(
      { gapCount: 5, complexity: 'medium', minGapDistance: 1 },
      makeRng('spacing-1'),
    )
    expect(gaps.length).toBe(5)
    // Distance 1 = edge-adjacent (forbidden); distance ≥ 2 allows diagonal corners.
    expect(minCrossGapManhattan(gaps)).toBeGreaterThanOrEqual(2)
  })

  it('minGapDistance=2 enforces a ≥2-cell orthogonal moat (no diagonal touching)', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 4, complexity: 'medium', minGapDistance: 2 },
      makeRng('spacing-2'),
    )
    expect(gaps.length).toBe(4)
    expect(minCrossGapManhattan(gaps)).toBeGreaterThanOrEqual(3)
  })

  it('default (omitted) is unchanged: still fills the requested gaps and may pack them', () => {
    const { grid, gaps } = generatePuzzle({ gapCount: 6, complexity: 'medium' }, makeRng('default'))
    expect(gaps.length).toBe(6)
    // Sanity: every empty cell belongs to a placed gap (no behavior regression).
    const emptyCount = grid.flat().filter(c => c.status === 'empty').length
    expect(emptyCount).toBe(gaps.flatMap(g => g.cells).length)
  })
})
