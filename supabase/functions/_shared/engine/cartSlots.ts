import type { PieceType, SelectionEntry } from '../types.ts'
import type { Placement } from '../types.ts'

export interface ChipSlot {
  pieceType: PieceType
  color?: string      // palette id in color-coded rounds; undefined otherwise
  slotIndex: number   // 0-based index into the expanded chip list
}

/**
 * Expand a SelectionEntry array into a flat list of individual chip slots.
 * Slot order preserves the selection array order; each entry contributes
 * freeCount chips in sequence.
 */
export function expandCartSlots(selection: SelectionEntry[]): ChipSlot[] {
  const slots: ChipSlot[] = []
  for (const entry of selection) {
    const total = entry.freeCount
    for (let i = 0; i < total; i++) {
      slots.push({ pieceType: entry.pieceType, color: entry.color, slotIndex: slots.length })
    }
  }
  return slots
}

/**
 * Map each placement to the index of the chip it should originate from.
 * Iterates placements in order; for each placement, claims the first
 * not-yet-claimed slot whose pieceType AND color match. Matching on color
 * keeps color-coded rounds coherent — a green-O placement claims the green-O
 * chip, not just any unclaimed O chip. (In monochrome rounds both colors are
 * undefined, so this reduces to pieceType matching.) Returns -1 for any
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
      if (slot.pieceType === placement.pieceType && slot.color === placement.color && !claimed.has(slot.slotIndex)) {
        claimed.add(slot.slotIndex)
        return slot.slotIndex
      }
    }
    return -1
  })
}
