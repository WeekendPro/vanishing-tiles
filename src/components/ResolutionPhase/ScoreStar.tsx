import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const STAR_CLIP =
  'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)'
const STAR_POINTS = '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35'
const LIFE_VALUE = 20

// Fixed sparkle "rain" slots — horizontal offset + stagger delay. Rendered as a
// continuous loop during the leftover-time phase (no per-frame spawning), so the
// nodes provably exist while it rains regardless of frame timing.
const SPARKLES = [
  { x: -24, delay: 0.00 }, { x: 18, delay: 0.10 }, { x: -8, delay: 0.20 },
  { x: 26, delay: 0.32 }, { x: -18, delay: 0.44 }, { x: 6, delay: 0.08 },
  { x: -28, delay: 0.55 }, { x: 14, delay: 0.66 }, { x: -2, delay: 0.50 },
  { x: 22, delay: 0.28 },
]

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
function tween(
  from: number, to: number, ms: number,
  onUpdate: (v: number) => void,
  signal?: { cancelled: boolean },
) {
  return new Promise<void>(res => {
    const t0 = performance.now()
    const step = (now: number) => {
      if (signal?.cancelled) { res(); return }
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
 * then leftover time tweens fill + score to the final value while cyan sparkles
 * rain into the star. The star fill % is the score.
 *
 * This is the celebratory score reveal — core feedback, not decoration — so it
 * plays regardless of `prefers-reduced-motion` (notably iOS Low Power Mode,
 * which forces that media query on even with the accessibility toggle off).
 */
export function ScoreStar({ show, score, livesRemaining }: Props) {
  const [display, setDisplay] = useState(0)
  const [fill, setFill] = useState(0)
  const [landed, setLanded] = useState(0)
  const [raining, setRaining] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (!show) { started.current = false; return }
    if (started.current) return // props are frozen at resolution time; mid-animation prop changes are not supported
    started.current = true
    const token = { cancelled: false }
    const run = async () => {
      await wait(700) // drop-in spring settles
      let running = 0
      for (let i = 0; i < livesRemaining; i++) {
        if (token.cancelled) return
        await wait(420)                 // life travels up
        setLanded(i + 1)                // spark + token consumed
        const from = running
        running = Math.min(score, running + LIFE_VALUE)
        await tween(from, running, 280, v => { setDisplay(Math.round(v)); setFill(v) }, token)
        await wait(120)
      }
      if (token.cancelled) return
      // Leftover time: count up to the final score while cyan sparkles rain in.
      setRaining(true)
      await tween(running, score, 1300, v => { setDisplay(Math.round(v)); setFill(v) }, token)
      if (token.cancelled) return
      await wait(450)                   // let the last sparkles fall
      setRaining(false)
    }
    run()
    return () => { token.cancelled = true }
  }, [show, score, livesRemaining])

  if (!show) return null

  const spread = 26
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
      <motion.div
        className="relative"
        style={{ width: 128, height: 128 }}
        initial={{ y: -220, scale: 0.7, opacity: 0 }}
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

        {/* cyan sparkles raining into the star during the leftover-time phase */}
        {raining && SPARKLES.map((s, i) => (
          <motion.span
            key={`rain-${i}`}
            data-testid="score-star-sparkle"
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{ width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5, background: '#fff', boxShadow: '0 0 10px 4px rgba(34,211,238,.9)' }}
            initial={{ x: s.x, y: -36, opacity: 0, scale: 0.3 }}
            animate={{ x: s.x * 0.45, y: 12, opacity: [0, 1, 0], scale: [0.3, 1.6, 0.5] }}
            transition={{ duration: 0.7, ease: 'easeIn', repeat: Infinity, repeatDelay: 0.3, delay: s.delay }}
          />
        ))}

        {/* spark on each life landing */}
        {landed > 0 && (
          <motion.span
            key={`life-${landed}`}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{ width: 10, height: 10, margin: -5, background: '#fff', boxShadow: '0 0 12px 5px rgba(250,204,21,.9)' }}
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}

        {/* life tokens float up from below and disappear into the star as they land */}
        {Array.from({ length: livesRemaining }, (_, i) => (
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
