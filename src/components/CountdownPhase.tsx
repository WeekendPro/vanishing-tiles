import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { THEME_LABEL } from '@shared/types'

const STEP_MS = 800   // how long each digit holds before the next flashes in
const EXIT_MS = 350   // let the final "1" finish fading before the grid appears

export function CountdownPhase() {
  const { round, roundIndex, roundTheme, mode, beginViewing } = useGameStore(useShallow(s => ({
    round: s.round,
    roundIndex: s.roundIndex,
    roundTheme: s.roundTheme,
    mode: s.mode,
    beginViewing: s.beginViewing,
  })))
  const reduce = useReducedMotion()
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (count <= 0) {
      const t = window.setTimeout(beginViewing, EXIT_MS)
      return () => clearTimeout(t)
    }
    const t = window.setTimeout(() => setCount(c => c - 1), STEP_MS)
    return () => clearTimeout(t)
  }, [count, beginViewing])

  return (
    <div className="flex flex-col items-center justify-center gap-6 select-none">
      <motion.h2
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="font-pixel font-bold uppercase tracking-[0.08em] text-2xl text-neon-cyan text-glow-cyan"
      >
        {mode === 'journey' ? `Round ${round}` : `Round ${roundIndex + 1} · ${THEME_LABEL[roundTheme]}`}
      </motion.h2>

      <div className="relative flex h-44 w-44 items-center justify-center">
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key={count}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.9 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="absolute font-pixel font-bold tabular-nums leading-none text-neon-cyan text-[6rem] drop-shadow-[0_0_30px_rgba(34,211,238,0.55)]"
            >
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
