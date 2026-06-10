import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const STAR_CLIP =
  'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)'
const STAR_POINTS = '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35'
const LIFE_VALUE = 20

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
function tween(from: number, to: number, ms: number, onUpdate: (v: number) => void) {
  return new Promise<void>(res => {
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - k, 2) // easeOut
      onUpdate(from + (to - from) * e)
      if (k < 1) requestAnimationFrame(step)
      else res()
    }
    requestAnimationFrame(step)
  })
}

interface Props {
  show: boolean
  score: number
  livesRemaining: number
}

/**
 * Gold "shooting star" scoring visual. Drops in and springs to a stop (hollow,
 * 0 inside); each remaining life floats up and sparks (+20% fill / +20 score);
 * then leftover time tweens fill + score to the final value. The star fill % is
 * the score. Reduced motion renders the final state immediately.
 */
export function ScoreStar({ show, score, livesRemaining }: Props) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(0)
  const [fill, setFill] = useState(0)
  const [landed, setLanded] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!show) { started.current = false; return }
    if (reduce) { setDisplay(score); setFill(score); setLanded(livesRemaining); return }
    if (started.current) return
    started.current = true
    let cancelled = false
    const run = async () => {
      await wait(700) // drop-in spring settles
      let running = 0
      for (let i = 0; i < livesRemaining; i++) {
        if (cancelled) return
        await wait(420)                 // life travels up
        setLanded(i + 1)                // spark + token consumed
        const from = running
        running = Math.min(score, running + LIFE_VALUE)
        await tween(from, running, 280, v => { setDisplay(Math.round(v)); setFill(v) })
        await wait(120)
      }
      if (cancelled) return
      await tween(running, score, 900, v => { setDisplay(Math.round(v)); setFill(v) }) // leftover time
    }
    run()
    return () => { cancelled = true }
  }, [show, reduce, score, livesRemaining])

  if (!show) return null

  const spread = 26
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
      <motion.div
        className="relative"
        style={{ width: 128, height: 128 }}
        initial={reduce ? false : { y: -220, scale: 0.7, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 16 }}
      >
        {/* fill clipped to the star shape */}
        <div className="absolute inset-0" style={{ clipPath: STAR_CLIP }}>
          <div className="absolute inset-0" style={{ background: 'rgba(250,204,21,0.14)' }} />
          <div
            data-testid="score-star-fill"
            className="absolute inset-x-0 bottom-0"
            style={{ height: `${Math.max(0, Math.min(100, fill))}%`, background: 'linear-gradient(0deg,#f59e0b,#fde047)' }}
          />
        </div>
        {/* crisp outline */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          style={{ overflow: 'visible', filter: 'drop-shadow(0 0 8px rgba(250,204,21,.6))' }}
        >
          <polygon points={STAR_POINTS} fill="none" stroke="#fbbf24" strokeWidth="4.5" strokeLinejoin="round" />
        </svg>
        {/* score */}
        <span
          data-testid="score-star-value"
          className="absolute inset-0 grid place-items-center font-pixel text-[20px] text-white"
          style={{ textShadow: '0 2px 4px rgba(0,0,0,.85)' }}
        >
          {display}
        </span>

        {/* spark on each landing */}
        {landed > 0 && !reduce && (
          <motion.span
            key={landed}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{ width: 10, height: 10, margin: -5, background: '#fff', boxShadow: '0 0 12px 5px rgba(250,204,21,.9)' }}
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}

        {/* life tokens float up from below and disappear into the star as they land */}
        {!reduce && Array.from({ length: livesRemaining }, (_, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 text-neon-red text-glow-red text-sm"
            initial={{ x: (i - (livesRemaining - 1) / 2) * spread - 6, y: 86, opacity: 1, scale: 1 }}
            animate={i < landed
              ? { x: -6, y: -6, opacity: 0, scale: 0.4 }
              : { x: (i - (livesRemaining - 1) / 2) * spread - 6, y: 86, opacity: 1, scale: 1 }}
            transition={{ duration: 0.42, ease: 'easeIn' }}
          >♥</motion.span>
        ))}
      </motion.div>
    </div>
  )
}
