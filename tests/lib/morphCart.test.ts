import { describe, it, expect } from 'vitest'
import { computeMorph, type MorphPiece } from '../../src/lib/morphCart'

const O: MorphPiece = { pieceType: 'O' }
const I: MorphPiece = { pieceType: 'I' }
const T: MorphPiece = { pieceType: 'T' }
const S: MorphPiece = { pieceType: 'S' }
const L: MorphPiece = { pieceType: 'L' }
const Z: MorphPiece = { pieceType: 'Z' }

describe('computeMorph', () => {
  it('all correct → all keep, in answer order', () => {
    expect(computeMorph([O, I, T], [O, I, T]).map(o => o.kind)).toEqual(['keep', 'keep', 'keep'])
  })

  it('some wrong (equal count) → keep + flips onto the missing answers', () => {
    const ops = computeMorph([O, S, L], [O, I, T])
    expect(ops.filter(o => o.kind === 'keep')).toHaveLength(1)
    const flips = ops.filter(o => o.kind === 'flip')
    expect(flips).toHaveLength(2)
    expect(flips.map(o => (o as { to: MorphPiece }).to.pieceType).sort()).toEqual(['I', 'T'])
  })

  it('too few picks → keep/flip + add the leftover answer', () => {
    const kinds = computeMorph([O, S], [O, I, T]).map(o => o.kind)
    expect(kinds.filter(k => k === 'keep')).toHaveLength(1) // O
    expect(kinds.filter(k => k === 'flip')).toHaveLength(1) // S → I
    expect(kinds.filter(k => k === 'add')).toHaveLength(1)  // T flies in
  })

  it('too many picks → keep/flip + remove the extra', () => {
    const kinds = computeMorph([O, S, L, Z], [O, I, T]).map(o => o.kind)
    expect(kinds.filter(k => k === 'keep')).toHaveLength(1)   // O
    expect(kinds.filter(k => k === 'flip')).toHaveLength(2)   // S→I, L→T
    expect(kinds.filter(k => k === 'remove')).toHaveLength(1) // Z dissolves
  })

  it('matches on color, not just shape', () => {
    const ops = computeMorph([{ pieceType: 'O', color: 'red' }], [{ pieceType: 'O', color: 'blue' }])
    expect(ops[0].kind).toBe('flip') // same shape, different color → not a keep
  })

  it('empty selection → all answers add in', () => {
    expect(computeMorph([], [O, I]).map(o => o.kind)).toEqual(['add', 'add'])
  })
})
