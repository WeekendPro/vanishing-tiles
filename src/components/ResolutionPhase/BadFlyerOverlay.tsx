import { motion } from 'framer-motion'
import { PieceShape } from '../PieceShape'
import type { PieceType } from '../../types'

export interface BadFlyer {
  pieceType: PieceType
  sourceX: number
  sourceY: number
  /** A point toward the grid the chip lunges at before being rejected. */
  towardX: number
  towardY: number
}

interface Props {
  containerRect: DOMRect
  flyers: BadFlyer[]
}

// Cart chips render at cellSize=11; lunge toward the grid, then bounce back + X.
export function BadFlyerOverlay({ containerRect, flyers }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
      {flyers.map((f, i) => {
        const sx = f.sourceX - containerRect.left
        const sy = f.sourceY - containerRect.top
        const mx = (f.towardX - containerRect.left) * 0.5 + sx * 0.5
        const my = (f.towardY - containerRect.top) * 0.5 + sy * 0.5
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: 0, top: 0, transformOrigin: 'top left' }}
            initial={{ x: sx, y: sy, scale: 1, opacity: 1 }}
            animate={{ x: [sx, mx, sx], y: [sy, my, sy], opacity: [1, 1, 0] }}
            transition={{ duration: 0.6, times: [0, 0.5, 1], ease: 'easeInOut', delay: i * 0.1 }}
          >
            <div className="relative">
              <PieceShape pieceType={f.pieceType} cellSize={11} />
              <motion.span
                aria-label="rejected piece"
                className="absolute inset-0 flex items-center justify-center text-red-500 font-black text-2xl"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0, 1], scale: [0.5, 1.2] }}
                transition={{ delay: i * 0.1 + 0.3, duration: 0.25 }}
              >
                ✕
              </motion.span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
