import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useCountUp } from '../../hooks/useCountUp'
import type { RoundScore } from '../../types'

interface Props {
  roundScore: RoundScore
  /** Cumulative running score INCLUDING this round (snapshot captured by caller
   * to avoid a moving target when commitRoundScore fires mid-reveal). */
  grandTotal: number
  /** When true, rows reveal + counts animate; when false, panel is hidden. */
  show: boolean
  accuracyTier: 'perfect' | 'close' | 'far'
  /** Failed round: hide Speed/Efficiency rows and render Accuracy as a penalty. */
  isFailure?: boolean
  /** Successful but slow: swap the Speed ⚡ for a 🐢. */
  speedSlow?: boolean
}

const ACCURACY_ICON: Record<'perfect' | 'close' | 'far', { icon: string; color: string }> = {
  perfect: { icon: '✓', color: 'text-green-400' },
  close:   { icon: '≈', color: 'text-amber-400' },
  far:     { icon: '✕', color: 'text-red-400' },
}

const ROW_STAGGER = 0.3   // seconds between row reveals
const COUNT_DURATION = 400
const ROUND_TOTAL_DELAY = ROW_STAGGER * 3
const GRAND_TOTAL_DELAY = ROW_STAGGER * 4

export function ScorePanel({ roundScore, grandTotal, show, accuracyTier }: Props) {
  if (!show) return null

  return (
    <motion.div
      className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <Row icon={ACCURACY_ICON[accuracyTier].icon} label="Accuracy" value={roundScore.correctness} delay={0} color={ACCURACY_ICON[accuracyTier].color} />
      <Row icon="⚡" label="Speed"      value={roundScore.speedBonus}      delay={ROW_STAGGER}      color="text-yellow-400" />
      <Row icon="◆" label="Efficiency" value={roundScore.efficiencyBonus} delay={ROW_STAGGER * 2}  color="text-cyan-400"   />

      <div className="mt-2 pt-2 border-t border-gray-800 flex flex-col gap-1">
        <motion.div
          className="flex justify-between items-baseline"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: [0.92, 1.08, 1] }}
          transition={{ delay: ROUND_TOTAL_DELAY, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <span className="text-[11px] tracking-widest text-gray-400 uppercase">Round Total</span>
          <span className="text-2xl font-extrabold text-yellow-400 tabular-nums">
            +<DelayedCountUp value={roundScore.total} delay={ROUND_TOTAL_DELAY} />
          </span>
        </motion.div>

        <motion.div
          className="flex justify-between items-baseline"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: GRAND_TOTAL_DELAY, duration: 0.3, ease: 'easeOut' }}
        >
          <span className="text-[11px] tracking-widest text-gray-500 uppercase">Grand Total</span>
          <span className="text-lg font-bold text-yellow-400 tabular-nums">
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
      <span className="font-semibold text-white tabular-nums">
        +<DelayedCountUp value={value} delay={delay} />
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

