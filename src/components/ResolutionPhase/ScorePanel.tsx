import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useCountUp } from '../../hooks/useCountUp'
import type { RoundScore } from '@shared/types'

interface Props {
  roundScore: RoundScore
  /** Cumulative running score INCLUDING this round (snapshot captured by caller
   * to avoid a moving target when commitRoundScore fires mid-reveal). */
  grandTotal: number
  /** When true, rows reveal + counts animate; when false, panel is hidden. */
  show: boolean
  /** Failed round: hide the Speed row (the round total is 0). */
  isFailure?: boolean
  /** Successful but slow: swap the Speed ⚡ for a 🐢. */
  speedSlow?: boolean
}

const ROW_STAGGER = 0.3   // seconds between row reveals
const COUNT_DURATION = 400
const ROUND_TOTAL_DELAY = ROW_STAGGER * 2
const GRAND_TOTAL_DELAY = ROW_STAGGER * 3

export function ScorePanel({ roundScore, grandTotal, show, isFailure = false, speedSlow = false }: Props) {
  if (!show) return null

  return (
    <motion.div
      className="w-full bg-arcade-panel border-2 border-arcade-edge shadow-panel-inset rounded-md p-3 flex flex-col gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      {!isFailure && (
        <Row icon={speedSlow ? '🐢' : '⚡'} label="Speed" value={roundScore.speedBonus} delay={0} color={speedSlow ? 'text-gray-400' : 'text-neon-yellow'} />
      )}

      <div className="mt-2 pt-2 border-t border-arcade-edge flex flex-col gap-1">
        <motion.div
          className="flex justify-between items-baseline"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: [0.92, 1.08, 1] }}
          transition={{ delay: ROUND_TOTAL_DELAY, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <span className="font-pixel text-[9px] tracking-[0.1em] text-gray-400 uppercase">Round Total</span>
          <span className={`font-pixel font-bold text-lg tabular-nums ${roundScore.total < 0 ? 'text-neon-red text-glow-red' : 'text-neon-yellow text-glow-yellow'}`}>
            {roundScore.total >= 0 ? '+' : ''}<DelayedCountUp value={roundScore.total} delay={ROUND_TOTAL_DELAY} />
          </span>
        </motion.div>

        <motion.div
          className="flex justify-between items-baseline"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: GRAND_TOTAL_DELAY, duration: 0.3, ease: 'easeOut' }}
        >
          <span className="font-pixel text-[9px] tracking-[0.1em] text-gray-500 uppercase">Grand Total</span>
          <span className="font-pixel font-bold text-sm text-neon-yellow text-glow-yellow tabular-nums">
            <DelayedCountUp value={grandTotal} delay={GRAND_TOTAL_DELAY} />
          </span>
        </motion.div>
      </div>
    </motion.div>
  )
}

function Row({ icon, label, value, delay, color }: {
  icon: string; label: string; value: number; delay: number; color: string
}) {
  return (
    <motion.div
      className="flex justify-between items-center text-[13px] py-1"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25, ease: 'easeOut' }}
    >
      <span>
        <span className={`inline-block w-5 text-center mr-1 ${color}`}>{icon}</span>
        <span className="text-gray-300">{label}</span>
      </span>
      <span className={`font-semibold tabular-nums ${value < 0 ? 'text-neon-red' : 'text-white'}`}>
        {value >= 0 ? '+' : ''}<DelayedCountUp value={value} delay={delay} />
      </span>
    </motion.div>
  )
}

/** Wraps useCountUp with an additional render-time delay before starting. */
function DelayedCountUp({ value, delay }: { value: number; delay: number }) {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (reduceMotion) { setActive(true); return }
    const t = window.setTimeout(() => setActive(true), delay * 1000)
    return () => clearTimeout(t)
  }, [delay, reduceMotion])
  const animated = useCountUp(active ? value : 0, reduceMotion ? 0 : COUNT_DURATION)
  return <>{animated.toLocaleString()}</>
}

