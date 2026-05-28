import type { PieceType, SelectionEntry } from '../types'
import type { Placement } from '../types'

export interface ChipSlot {
  pieceType: PieceType
  slotIndex: number   // 0-based index into the expanded chip list
}

/**
 * Expand a SelectionEntry array into a flat list of individual chip slots.
 * Slot order preserves the selection array order; each entry contributes
 * (lockedCount + freeCount) chips in sequence.
 */
export function expandCartSlots(selection: SelectionEntry[]): ChipSlot[] {
  const slots: ChipSlot[] = []
  for (const entry of selection) {
    const total = entry.lockedCount + entry.freeCount
    for (let i = 0; i < total; i++) {
      slots.push({ pieceType: entry.pieceType, slotIndex: slots.length })
    }
  }
  return slots
}

/**
 * Map each placement to the index of the chip it should originate from.
 * Iterates placements in order; for each placement, claims the first
 * not-yet-claimed slot whose pieceType matches. Returns -1 for any
 * placement with no matching slot (shouldn't happen in practice, since
 * the solver was given exactly these pieces; the -1 is defensive).
 */
export function mapPlacementsToSlots(
  placements: Placement[],
  slots: ChipSlot[],
): number[] {
  const claimed = new Set<number>()
  return placements.map(placement => {
    for (const slot of slots) {
      if (slot.pieceType === placement.pieceType && !claimed.has(slot.slotIndex)) {
        claimed.add(slot.slotIndex)
        return slot.slotIndex
      }
    }
    return -1
  })
}
