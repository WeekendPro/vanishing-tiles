import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '@shared/engine/puzzleGenerator'
import { makeRng } from '@shared/core/prng'

describe('generatePuzzle determinism', () => {
  it('same config + same seed → identical board', () => {
    const cfg = { gapCount: 6, complexity: 'medium' as const, adjacency: 1 }
    const a = generatePuzzle(cfg, makeRng('seed-A'))
    const b = generatePuzzle(cfg, makeRng('seed-A'))
    expect(JSON.stringify(a.gaps)).toBe(JSON.stringify(b.gaps))
    expect(JSON.stringify(a.grid)).toBe(JSON.stringify(b.grid))
  })
  it('different seeds → different board (very likely)', () => {
    const cfg = { gapCount: 6, complexity: 'medium' as const, adjacency: 1 }
    const a = generatePuzzle(cfg, makeRng('seed-A'))
    const b = generatePuzzle(cfg, makeRng('seed-B'))
    expect(JSON.stringify(a.gaps)).not.toBe(JSON.stringify(b.gaps))
  })
})
