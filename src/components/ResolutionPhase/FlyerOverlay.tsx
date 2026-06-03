import { motion } from 'framer-motion'
import { PieceShape } from '../PieceShape'
import type { Placement } from '@shared/types'
import { gapFillClass } from '../../lib/gapPalette'

export interface FlyerSpec {
  placement: Placement
  /** Source position (top-left in viewport coords). */
  sourceX: number
  sourceY: number
  /** Target position (top-left in viewport coords). */
  targetX: number
  targetY: number
  /** Per-piece flight duration in seconds. */
  duration: number
  /** Delay in seconds before this flyer begins (sequencing). */
  delay: number
}

interface Props {
  /** Bounding rect of the ResolutionPhase root so we can convert to relative coords. */
  containerRect: DOMRect
  flyers: FlyerSpec[]
  /** Called when a flyer's animation completes; receives the index into `flyers`. */
  onFlyerLanded: (flyerIndex: number) => void
}

// Cart chips render at PieceShape cellSize=11; grid cells at cellSize=28.
const CART_CELL = 11
const GRID_CELL = 28
const START_SCALE = CART_CELL / GRID_CELL  // ≈ 0.393

export function FlyerOverlay({ containerRect, flyers, onFlyerLanded }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      aria-hidden="true"
    >
      {flyers.map((flyer, i) => {
        // Convert viewport coords to coords relative to the overlay container.
        const sx = flyer.sourceX - containerRect.left
        const sy = flyer.sourceY - containerRect.top
        const tx = flyer.targetX - containerRect.left
        const ty = flyer.targetY - containerRect.top

        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: 0, top: 0, transformOrigin: 'top left' }}
            initial={{ x: sx, y: sy, scale: START_SCALE, opacity: 0 }}
            animate={{
              x: [sx, sx + (tx - sx) * 0.5, tx],
              y: [sy, (sy + ty) / 2 - 30, ty],
              scale: [START_SCALE, (START_SCALE + 1) / 2, 1],
              opacity: [1, 1, 1],
            }}
            transition={{
              duration: flyer.duration,
              delay: flyer.delay,
              ease: [0.65, 0, 0.35, 1],
              times: [0, 0.5, 1],
            }}
            onAnimationComplete={() => onFlyerLanded(i)}
          >
            <PieceShape
              pieceType={flyer.placement.pieceType}
              rotation={flyer.placement.rotation}
              cellSize={GRID_CELL}
              colorClass={flyer.placement.color ? gapFillClass(flyer.placement.color) : undefined}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
