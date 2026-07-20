import { AnimatePresence, motion } from 'framer-motion'
import { FLOAT_TEXT_SHADOW } from './constants'

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

// Clear-payoff bonus receipt: every earned bonus itemizes in the board's
// UPPER-LEFT — a colored label + white value per line (SPEED amber / ACCURACY
// cyan / SEQUENCE lime) — each holding a beat then drifting up to evaporate
// (`vt-bonus-rise`), staggered by its own delay. Speed rides the timer-bar
// drain (nearly every clear); accuracy/sequence stagger in after. No travel
// toward the score; the score counts up on its own underneath. Rendered inside
// the board's relative wrapper so it scales with the board.
export type LiftVariant = 'flawless' | 'inOrder' | 'speed'
export interface BonusItem {
  id: number
  value: number
  tag: string
  variant: LiftVariant
  delayMs: number
}

const BONUS_TAG_CLASS: Record<LiftVariant, string> = {
  flawless: 'text-vt-cyan',
  inOrder: 'text-vt-lime',
  speed: 'text-vt-amber',
}

export function BonusPayoff({ items }: { items: BonusItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="absolute left-3 top-3 z-20 flex flex-col gap-1 pointer-events-none">
      {items.map(it => (
        <div
          key={it.id}
          className="vt-bonus-rise flex items-baseline gap-1.5 whitespace-nowrap"
          style={{ animationDelay: `${it.delayMs}ms`, textShadow: FLOAT_TEXT_SHADOW }}
        >
          <span className={`font-grotesk font-bold text-[11px] tracking-[0.13em] uppercase ${BONUS_TAG_CLASS[it.variant]}`}>{it.tag}</span>
          <span className="font-silk font-bold text-lg leading-none tabular-nums text-white">+{it.value}</span>
        </div>
      ))}
    </div>
  )
}
