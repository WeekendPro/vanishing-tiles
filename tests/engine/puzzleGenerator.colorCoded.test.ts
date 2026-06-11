import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { GAP_COLOR_IDS } from '@shared/core/themeConfig'
import { makeRng } from '@shared/core/prng'

describe('generatePuzzle color-coded mode', () => {
  it('uses a single shape type across all gaps when shapeTypeCount is 1', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 3, complexity: 'simple', colorCoded: { shapeTypeCount: 1, palette: [...GAP_COLOR_IDS] } },
      makeRng('cc-seed'),
    )
    expect(gaps).toHaveLength(3)
    const shapes = new Set(gaps.map(g => g.pieceType))
    expect(shapes.size).toBe(1)
  })

  it('assigns a distinct palette color to each gap (Vacant Heights)', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 3, complexity: 'simple', colorCoded: { shapeTypeCount: 1, palette: [...GAP_COLOR_IDS] } },
      makeRng('cc-seed'),
    )
    const colors = gaps.map(g => g.color)
    expect(colors.every(c => c !== undefined)).toBe(true)
    expect(new Set(colors).size).toBe(gaps.length) // all distinct
    colors.forEach(c => expect([...GAP_COLOR_IDS]).toContain(c))
  })

  it('spans ≥2 distinct shapes when shapeTypeCount > 1', () => {
    const { gaps } = generatePuzzle(
      { gapCount: 6, complexity: 'medium', colorCoded: { shapeTypeCount: 3, palette: [...GAP_COLOR_IDS] } },
      makeRng('cc-multi'),
    )
    expect(gaps).toHaveLength(6)
    expect(new Set(gaps.map(g => g.pieceType)).size).toBeGreaterThanOrEqual(2)
  })

  it('leaves gaps uncolored when colorCoded is omitted (basic back-compat)', () => {
    const { gaps } = generatePuzzle({ gapCount: 3, complexity: 'simple' }, makeRng('cc-seed'))
    expect(gaps.every(g => g.color === undefined)).toBe(true)
  })
})
