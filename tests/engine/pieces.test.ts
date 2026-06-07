import { describe, it, expect } from 'vitest'
import {
  PIECE_DEFINITIONS,
  rotateCells,
  getRotatedCells,
  getAllRotations,
} from '@shared/engine/pieces'

describe('PIECE_DEFINITIONS', () => {
  it('defines all 7 tetromino types', () => {
    const types = PIECE_DEFINITIONS.map(p => p.type)
    expect(types).toEqual(['I', 'O', 'T', 'S', 'Z', 'J', 'L'])
  })

  it('I piece has 4 cells in a row', () => {
    const I = PIECE_DEFINITIONS.find(p => p.type === 'I')!
    expect(I.cells).toHaveLength(4)
    const rows = I.cells.map(([r]) => r)
    expect(new Set(rows).size).toBe(1)
  })

  it('O piece has 4 cells in 2×2 square', () => {
    const O = PIECE_DEFINITIONS.find(p => p.type === 'O')!
    expect(O.cells).toHaveLength(4)
  })

})

describe('rotateCells', () => {
  it('rotates I piece 90° to vertical', () => {
    const I = PIECE_DEFINITIONS.find(p => p.type === 'I')!
    const rotated = rotateCells(I.cells)
    const cols = rotated.map(([, c]) => c)
    expect(new Set(cols).size).toBe(1)
  })

  it('rotating 4 times returns to original (normalized)', () => {
    const original = getRotatedCells('T', 0)
    let cells = original
    for (let i = 0; i < 4; i++) cells = rotateCells(cells)
    expect(cells).toEqual(original)
  })
})

describe('getRotatedCells', () => {
  it('rotation 0 returns canonical cells', () => {
    const I = PIECE_DEFINITIONS.find(p => p.type === 'I')!
    expect(getRotatedCells('I', 0)).toEqual(I.cells)
  })

  it('rotation 1 returns 90° rotated cells', () => {
    const cells0 = getRotatedCells('I', 0)
    const cells1 = getRotatedCells('I', 1)
    expect(cells1).not.toEqual(cells0)
    const cols = cells1.map(([, c]) => c)
    expect(new Set(cols).size).toBe(1)
  })

  it('T rotated 90° has correct exact coordinates', () => {
    const cells = getRotatedCells('T', 1)
    expect(cells).toEqual([[0,1],[1,0],[1,1],[2,1]])
  })
})

describe('getAllRotations', () => {
  it('I piece has 2 unique rotations', () => {
    const rotations = getAllRotations('I')
    expect(rotations).toHaveLength(2)
  })

  it('O piece has 1 unique rotation', () => {
    const rotations = getAllRotations('O')
    expect(rotations).toHaveLength(1)
  })

  it('T piece has 4 unique rotations', () => {
    const rotations = getAllRotations('T')
    expect(rotations).toHaveLength(4)
  })

  it('S piece has 2 unique rotations', () => {
    const rotations = getAllRotations('S')
    expect(rotations).toHaveLength(2)
  })

  it('Z piece has 2 unique rotations', () => {
    const rotations = getAllRotations('Z')
    expect(rotations).toHaveLength(2)
  })

  it('J piece has 4 unique rotations', () => {
    const rotations = getAllRotations('J')
    expect(rotations).toHaveLength(4)
  })

  it('L piece has 4 unique rotations', () => {
    const rotations = getAllRotations('L')
    expect(rotations).toHaveLength(4)
  })
})
