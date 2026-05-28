import { forwardRef, useImperativeHandle, useRef } from 'react'
import { motion } from 'framer-motion'
import { PieceShape } from '../PieceShape'
import type { ChipSlot } from '../../engine/cartSlots'

export interface SelectionCartHandle {
  /** Get the bounding rect of the chip at `slotIndex`, or null if not yet mounted. */
  getChipRect: (slotIndex: number) => DOMRect | null
}

interface Props {
  slots: ChipSlot[]
  /** Indices of chips whose flyer has already launched; rendered dimmed. */
  consumed: ReadonlySet<number>
  /** Indices of chips that are "bad" (unused by the solver). */
  badSlots?: ReadonlySet<number>
}

export const SelectionCart = forwardRef<SelectionCartHandle, Props>(
  function SelectionCart({ slots, consumed, badSlots }, ref) {
    const chipRefs = useRef<(HTMLDivElement | null)[]>([])

    useImperativeHandle(ref, () => ({
      getChipRect: (slotIndex: number) => {
        const el = chipRefs.current[slotIndex]
        return el ? el.getBoundingClientRect() : null
      },
    }), [])

    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 inline-flex gap-2 flex-wrap justify-center max-w-sm">
        {slots.map((slot) => {
          const dim = consumed.has(slot.slotIndex)
          const bad = !!badSlots?.has(slot.slotIndex)
          return (
            <motion.div
              key={slot.slotIndex}
              ref={el => { chipRefs.current[slot.slotIndex] = el }}
              className={`relative p-1 transition-opacity duration-150 ${dim ? 'opacity-25' : 'opacity-100'}`}
              animate={bad ? { x: [0, -3, 3, -2, 2, 0] } : undefined}
              transition={bad ? { duration: 0.35 } : undefined}
            >
              <PieceShape pieceType={slot.pieceType} cellSize={11} />
              {bad && (
                <span
                  aria-label="rejected piece"
                  className="absolute inset-0 flex items-center justify-center text-red-500 font-black text-2xl pointer-events-none"
                >
                  ✕
                </span>
              )}
            </motion.div>
          )
        })}
        {slots.length === 0 && (
          <span className="text-xs text-gray-600 italic">No pieces</span>
        )}
      </div>
    )
  },
)
