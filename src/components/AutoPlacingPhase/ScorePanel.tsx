import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useCountUp } from '../../hooks/useCountUp'
import type { RoundScore } from '../../types'

interface Props {
  roundScore: RoundScore
  /** When true, rows reveal + counts animate; when false, panel is hidden. */
  show: boolean
}

const ROW_STAGGER = 0.3   // seconds between row reveals
const COUNT_DURATION = 400

export function ScorePanel({ roundScore, show }: Props) {
  if (!show) return null

  return (
    <motion.div
      className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <Row icon="✓" label="Correctness"        value={roundScore.correctness}     delay={0}                color="text-green-400"  />
      <Row icon="⚡" label="Speed Bonus"        value={roundScore.speedBonus}      delay={ROW_STAGGER}      color="text-yellow-400" />
      <Row icon="◆" label="Efficiency Bonus"   value={roundScore.efficiencyBonus} delay={ROW_STAGGER * 2}  color="text-cyan-400"   />

      <motion.div
        className="mt-2 pt-2 border-t border-gray-800 flex justify-between items-baseline"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: [0.92, 1.08, 1] }}
        transition={{ delay: ROW_STAGGER * 3, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <span className="text-[11px] tracking-widest text-gray-400 uppercase">Round Total</span>
        <span className="text-2xl font-extrabold text-yellow-400 tabular-nums">
          +<TotalNumber value={roundScore.total} delay={ROW_STAGGER * 3} />
        </span>
      </motion.div>
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
  const [active, setActive] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setActive(true), delay * 1000)
    return () => clearTimeout(t)
  }, [delay])
  const animated = useCountUp(active ? value : 0, COUNT_DURATION)
  return <>{animated.toLocaleString()}</>
}

function TotalNumber({ value, delay }: { value: number; delay: number }) {
  return <DelayedCountUp value={value} delay={delay} />
}
