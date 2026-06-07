import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { makeRng } from '@shared/core/prng'

describe('generatePuzzle — sequential mode', () => {
  it('stamps order 1..N across the gaps (a permutation, no gaps/dupes)', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 3, complexity: 'simple', sequential: true },
      makeRng('seq-123'),
    )
    expect(gaps).toHaveLength(3)
    const orders = gaps.map(g => g.order).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(orders).toEqual([1, 2, 3])
  })

  it('does not assign colors in sequential mode (monochrome)', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 3, complexity: 'simple', sequential: true },
      makeRng('seq-123'),
    )
    expect(gaps.every(g => g.color === undefined)).toBe(true)
  })

  it('leaves order undefined for non-sequential puzzles', () => {
    const { gaps } = generatePuzzle({ gapCount: 3, complexity: 'simple' }, makeRng('seq-7'))
    expect(gaps.every(g => g.order === undefined)).toBe(true)
  })

  it('never generates all-identical gap types (≥2 distinct types across many seeds)', () => {
    for (let i = 0; i < 200; i++) {
      const gapCount = 2 + (i % 4) // 2..5 gaps
      const { gaps } = generatePuzzle(
        { gapCount, complexity: 'medium', sequential: true },
        makeRng(`variety-${i}`),
      )
      expect(gaps.length).toBe(gapCount)
      const distinct = new Set(gaps.map(g => g.pieceType)).size
      expect(distinct).toBeGreaterThanOrEqual(2)
    }
  })

  it('allows a single-gap sequential puzzle (variety rule is vacuous)', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 1, complexity: 'simple', sequential: true },
      makeRng('seq-single'),
    )
    expect(gaps).toHaveLength(1)
    expect(gaps[0].order).toBe(1)
  })
})
