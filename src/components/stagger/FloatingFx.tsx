import { AnimatePresence, motion } from 'framer-motion'
import { FLOAT_TEXT_SHADOW, LIFT_MS } from './constants'

// ── Floating FX ───────────────────────────────────────────────────────────────
// The floating animation overlays. They sit at different tree positions (the
// streak/life/wrong-pick layers over the board; the lift flyer at the root), so
// they're separate named exports rendered in their original spots.

// Streak bursts — a "+points" flourish floats up from each filled gap.
export function StreakBursts({
  streakBursts,
}: { streakBursts: { id: number; pts: number; x: number; y: number }[] }) {
  return (
    <AnimatePresence>
      {streakBursts.map(cb => (
        <motion.div
          key={cb.id}
          initial={{ opacity: 0, scale: 0.4, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: -22 }}
          exit={{ opacity: 0, scale: 1.5, y: -46 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2
            font-silk font-bold text-sm whitespace-nowrap text-white"
          style={{
            left: cb.x,
            top: cb.y,
            // White lifted off any piece color by a soft drop shadow (not a
            // stroke) so it stays legible without an outline.
            textShadow: FLOAT_TEXT_SHADOW,
          }}
        >
          +{cb.pts}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

// Earn-a-life celebration — a heart blooms and rises off the board.
export function LifeBursts({
  lifeBursts,
}: { lifeBursts: { id: number; n: number }[] }) {
  return (
    <AnimatePresence>
      {lifeBursts.map(lb => (
        <motion.div
          key={lb.id}
          initial={{ opacity: 0, scale: 0.3, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: -6 }}
          exit={{ opacity: 0, scale: 1.7, y: -52 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
        >
          <span className="relative flex items-center justify-center">
            <span className="text-7xl leading-none text-vt-red text-glow-vt-red">♥</span>
            <span
              className="absolute -translate-y-[3px] font-silk font-bold text-lg text-white"
              style={{ textShadow: FLOAT_TEXT_SHADOW }}
            >
              +{lb.n}
            </span>
          </span>
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

// Wrong pick: a red border flashes around the board (with the shake).
export function WrongPickFlash({ xMark }: { xMark: boolean }) {
  return (
    <AnimatePresence>
      {xMark && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="absolute inset-0 rounded-xl pointer-events-none shadow-[inset_0_0_0_2px_#FF3B47,0_0_24px_rgba(255,59,71,0.28)]"
        />
      )}
    </AnimatePresence>
  )
}

// Clear-payoff "Lift": a labeled "+bonus" rises off the timer bar and dissolves
// into the score readout as the number climbs. Fired one-per-earned-bonus from
// onPick on a cleared batch — FLAWLESS (cyan) → IN ORDER (lime) → SPEED (amber).
export type LiftVariant = 'flawless' | 'inOrder' | 'speed'
export interface LiftFlyerData {
  id: number
  value: number
  tag: string
  variant: LiftVariant
  x0: number; y0: number; x1: number; y1: number
}

const LIFT_VARIANT_CLASS: Record<LiftVariant, string> = {
  flawless: 'text-vt-cyan text-glow-vt-cyan',
  inOrder: 'text-vt-lime text-glow-vt-lime',
  speed: 'text-vt-amber text-glow-vt-amber',
}

export function LiftFlyer({
  liftFlyer, onDone,
}: {
  liftFlyer: LiftFlyerData
  onDone: () => void
}) {
  return (
    <motion.div
      initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
      animate={{
        x: liftFlyer.x1 - liftFlyer.x0,
        y: liftFlyer.y1 - liftFlyer.y0,
        opacity: [0, 1, 1, 0],
        scale: [0.6, 1.1, 1, 0.7],
      }}
      transition={{ duration: LIFT_MS / 1000, ease: [0.33, 1, 0.68, 1], times: [0, 0.18, 0.72, 1] }}
      onAnimationComplete={onDone}
      transformTemplate={(_, generated) => `translate(-50%, -50%) ${generated}`}
      className={`fixed z-[60] pointer-events-none flex flex-col items-center whitespace-nowrap ${LIFT_VARIANT_CLASS[liftFlyer.variant]}`}
      style={{ left: liftFlyer.x0, top: liftFlyer.y0, textShadow: FLOAT_TEXT_SHADOW }}
    >
      <span className="font-grotesk font-bold text-[10px] tracking-[0.16em] uppercase leading-none mb-0.5">{liftFlyer.tag}</span>
      <span className="font-silk font-bold text-2xl leading-none tabular-nums">+{liftFlyer.value}</span>
    </motion.div>
  )
}
