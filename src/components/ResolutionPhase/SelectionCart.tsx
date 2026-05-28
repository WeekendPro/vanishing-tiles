import { forwardRef, useImperativeHandle, useRef } from 'react'
import { motion } from 'framer-motion'
import { PieceShape } from '../PieceShape'
import type { ChipSlot } from '../../engine/cartSlots'

export interface SelectionCartHandle {
  getChipRect: (slotIndex: number) => DOMRect | null
}

interface Props {
  slots: ChipSlot[]
  /** Chips whose flyer has launched; rendered dimmed. */
  consumed: ReadonlySet<number>
  /** Chips rejected so far; grayed out with a thick red ✕. */
  rejected?: ReadonlySet<number>
}

function RejectMark() {
  return (
    <span aria-label="rejected piece" className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="#ef4444"
           strokeWidth={4} strokeLinecap="round">
        <line x1="5" y1="5" x2="19" y2="19" />
        <line x1="19" y1="5" x2="5" y2="19" />
      </svg>
    </span>
  )
}

export const SelectionCart = forwardRef<SelectionCartHandle, Props>(
  function SelectionCart({ slots, consumed, rejected }, ref) {
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
          const rej = !!rejected?.has(slot.slotIndex)
          return (
            <motion.div
              key={slot.slotIndex}
              ref={el => { chipRefs.current[slot.slotIndex] = el }}
              className={`relative p-1 transition-opacity duration-150 ${dim ? 'opacity-25' : 'opacity-100'}`}
              animate={rej ? { x: [0, -3, 3, -2, 2, 0] } : undefined}
              transition={rej ? { duration: 0.35 } : undefined}
            >
              <div className={`relative${rej ? ' grayscale opacity-60 transition-all duration-200' : ''}`}>
                <PieceShape pieceType={slot.pieceType} cellSize={11} />
                {rej && <RejectMark />}
              </div>
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
