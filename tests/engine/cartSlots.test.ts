import { describe, it, expect } from 'vitest'
import { expandCartSlots, mapPlacementsToSlots } from '@shared/engine/cartSlots'
import type { SelectionEntry } from '@shared/types'
import type { Placement } from '@shared/types'

describe('expandCartSlots', () => {
  it('expands a single-entry selection into N chips', () => {
    const selection: SelectionEntry[] = [{ pieceType: 'I', freeCount: 3 }]
    expect(expandCartSlots(selection)).toEqual([
      { pieceType: 'I', slotIndex: 0 },
      { pieceType: 'I', slotIndex: 1 },
      { pieceType: 'I', slotIndex: 2 },
    ])
  })

  it('counts all free pieces', () => {
    const selection: SelectionEntry[] = [{ pieceType: 'O', freeCount: 3 }]
    expect(expandCartSlots(selection)).toHaveLength(3)
  })

  it('preserves selection-array order across multiple entries', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'I', freeCount: 2 },
      { pieceType: 'O', freeCount: 1 },
      { pieceType: 'T', freeCount: 1 },
    ]
    expect(expandCartSlots(selection).map(s => s.pieceType)).toEqual(['I', 'I', 'O', 'T'])
  })

  it('skips empty entries', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'I', freeCount: 0 },
      { pieceType: 'O', freeCount: 2 },
    ]
    expect(expandCartSlots(selection)).toEqual([
      { pieceType: 'O', slotIndex: 0 },
      { pieceType: 'O', slotIndex: 1 },
    ])
  })

  it('carries the entry color onto each chip slot', () => {
    const selection: SelectionEntry[] = [
      { pieceType: 'O', color: 'green', freeCount: 1 },
      { pieceType: 'O', color: 'red', freeCount: 1 },
    ]
    expect(expandCartSlots(selection)).toEqual([
      { pieceType: 'O', color: 'green', slotIndex: 0 },
      { pieceType: 'O', color: 'red', slotIndex: 1 },
    ])
  })
})

describe('mapPlacementsToSlots', () => {
  const slots = [
    { pieceType: 'I' as const, slotIndex: 0 },
    { pieceType: 'I' as const, slotIndex: 1 },
    { pieceType: 'O' as const, slotIndex: 2 },
  ]

  const mk = (pieceType: Placement['pieceType']): Placement => ({
    pieceType,
    rotation: 0,
    anchorRow: 0,
    anchorCol: 0,
    cells: [[0, 0]],
  })

  it('claims the first matching unclaimed slot for each placement, in order', () => {
    const placements: Placement[] = [mk('I'), mk('O'), mk('I')]
    expect(mapPlacementsToSlots(placements, slots)).toEqual([0, 2, 1])
  })

  it('returns -1 when no slot of the placement piece type remains', () => {
    const placements: Placement[] = [mk('I'), mk('I'), mk('I')]  // only 2 I-slots
    expect(mapPlacementsToSlots(placements, slots)).toEqual([0, 1, -1])
  })

  it('handles an empty placements list', () => {
    expect(mapPlacementsToSlots([], slots)).toEqual([])
  })

  it('matches on color so a colored placement claims its own color chip', () => {
    const colorSlots = [
      { pieceType: 'O' as const, color: 'green', slotIndex: 0 },
      { pieceType: 'O' as const, color: 'red', slotIndex: 1 },
    ]
    const mkColor = (color: string): Placement => ({
      pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0]], color,
    })
    // Placements arrive red-first; each must claim the matching color slot,
    // not just the first unclaimed O slot.
    expect(mapPlacementsToSlots([mkColor('red'), mkColor('green')], colorSlots)).toEqual([1, 0])
  })
})
