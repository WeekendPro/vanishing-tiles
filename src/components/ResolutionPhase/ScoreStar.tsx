import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { MAX_LIVES } from '@shared/core/scoring'

const STAR_CLIP =
  'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)'
const STAR_POINTS = '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35'
const LIFE_VALUE = 20

// Fixed sparkle slots — horizontal offset + stagger delay. Rendered as a
// continuous loop during the leftover-time phase, rising from the Speed line
// up into the star to visualise the time points evaporating.
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

function perfWord(s: number) {
  if (s >= 90) return 'Excellent!'
  if (s >= 75) return 'Great!'
  if (s >= 60) return 'Good Job!'
  return 'Pretty Good'
}

interface Props {
  show: boolean
  score: number
  livesRemaining: number
}

/**
 * Gold "shooting star" scoring visual for Journey mode.
 *
 * Layout: vertical stack — star (128×128) → accounting panel (Lives + Speed
 * key/value rows) → performance text (gold gradient, bold italic).
 *
 * Choreography:
 *   1. Star drops in (spring).
 *   2. Accounting panel fades in.
 *   3. Each remaining life token flies up from the Lives row into the star,
 *      incrementing the score by LIFE_VALUE (+20) with a gold spark.
 *   4. The Speed value evaporates to 0 (cyan sparkles rise from the Speed row
 *      up into the star) as the score counts up to the final value.
 *   5. Performance text springs in.
 *
 * Plays regardless of `prefers-reduced-motion` — this is the core score reveal,
 * not decoration.
 */
export function ScoreStar({ show, score, livesRemaining }: Props) {
  const [display, setDisplay] = useState(0)
  const [fill, setFill] = useState(0)
  const [landed, setLanded] = useState(0)
  const [speedLeft, setSpeedLeft] = useState(0)
  const [raining, setRaining] = useState(false)
  const [acctIn, setAcctIn] = useState(false)
  const [perfIn, setPerfIn] = useState(false)
  const [livesGone, setLivesGone] = useState(false)
  const [speedGone, setSpeedGone] = useState(false)
  const started = useRef(false)

  // speed = points attributed to leftover time (score minus lives contribution)
  const speed = Math.max(0, score - LIFE_VALUE * livesRemaining)

  useEffect(() => {
    if (!show) { started.current = false; return }
    if (started.current) return // props frozen at resolution time; mid-animation prop changes not supported
    started.current = true
    const token = { cancelled: false }
    const run = async () => {
      // Show the speed value immediately so the Speed line is already populated
      // when the accounting panel fades in.
      setSpeedLeft(speed)

      await wait(450) // star drop-in
      setAcctIn(true)
      await wait(350)

      // Lives phase: each remaining life flies up and sparks (+20 each)
      let running = 0
      for (let i = 0; i < livesRemaining; i++) {
        if (token.cancelled) return
        await wait(380)
        setLanded(i + 1)
        const from = running
        running = Math.min(score, running + LIFE_VALUE)
        await tween(from, running, 260, v => { setDisplay(Math.round(v)); setFill(v) }, token)
        await wait(120)
      }

      // Hearts have all flown into the star — poof the Lives row away before the
      // Speed score starts evaporating.
      if (token.cancelled) return
      await wait(160)
      setLivesGone(true)
      await wait(440)

      // Time phase: speed evaporates into the star (cyan sparkles rise up)
      if (token.cancelled) return
      setRaining(true)
      await Promise.all([
        tween(running, score, 1300, v => { setDisplay(Math.round(v)); setFill(v) }, token),
        tween(speed, 0, 1300, v => setSpeedLeft(Math.round(v)), token),
      ])
      if (token.cancelled) return
      setRaining(false)

      // Speed has hit 0 — poof the Speed row away too.
      await wait(160)
      setSpeedGone(true)
      await wait(440)

      // Performance text springs in
      if (token.cancelled) return
      setPerfIn(true)
    }
    run()
    return () => { token.cancelled = true }
  }, [show, score, livesRemaining, speed])

  if (!show) return null

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-20 gap-3">
      {/* ── Star ── */}
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
        {/* score value */}
        <span
          data-testid="score-star-value"
          className="absolute inset-0 grid place-items-center font-pixel font-bold tabular-nums text-[20px] text-white"
          style={{ textShadow: '0 2px 4px rgba(0,0,0,.85)' }}
        >
          {display}
        </span>

        {/* cyan sparkles flying from the Speed VALUE (right side of the Speed row,
            ~x:92 / y:108 from the star centre) up into the star during the time phase */}
        {raining && SPARKLES.map((s, i) => (
          <motion.span
            key={`rain-${i}`}
            data-testid="score-star-sparkle"
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{ width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5, background: '#fff', boxShadow: '0 0 10px 4px rgba(34,211,238,.9)' }}
            initial={{ x: 92 + s.x * 0.15, y: 108, opacity: 0, scale: 0.3 }}
            animate={{ x: s.x * 0.4, y: -6, opacity: [0, 1, 0], scale: [0.3, 1.4, 0.5] }}
            transition={{ duration: 0.8, ease: 'easeIn', repeat: Infinity, repeatDelay: 0.3, delay: s.delay }}
          />
        ))}

        {/* gold spark on each life landing */}
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

      </motion.div>

      {/* ── Accounting panel ── */}
      <motion.div
        data-testid="score-acct"
        className="w-[210px]"
        initial={false}
        animate={{ opacity: acctIn ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Lives row — collapses with a soft "poof" once its hearts have flown */}
        <motion.div
          className="overflow-hidden"
          initial={false}
          animate={livesGone
            ? { opacity: 0, height: 0, scale: 0.9, filter: 'blur(3px)' }
            : { opacity: 1, height: 'auto', scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
        >
          <div className="flex justify-between items-center pb-1.5">
            <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-gray-400">Lives</span>
            <span data-testid="acct-lives" className="text-sm leading-none flex gap-0.5">
              {Array.from({ length: MAX_LIVES }, (_, i) => (
                i >= livesRemaining
                  ? <span key={i} className="text-arcade-edge">♥</span>
                  : (
                    <span key={i} className="relative inline-block">
                      <span className="text-neon-red opacity-20">♥</span>
                      <motion.span
                        className="absolute left-0 top-0 text-neon-red text-glow-red"
                        initial={false}
                        animate={landed > i
                          ? { y: -130, x: -70, opacity: 0, scale: 0.5 }
                          : { y: 0, x: 0, opacity: 1, scale: 1 }}
                        transition={{ duration: 0.45, ease: 'easeIn' }}
                      >♥</motion.span>
                    </span>
                  )
              ))}
            </span>
          </div>
        </motion.div>
        {/* Speed row — collapses once the value has evaporated to 0 */}
        <motion.div
          className="overflow-hidden"
          initial={false}
          animate={speedGone
            ? { opacity: 0, height: 0, scale: 0.9, filter: 'blur(3px)' }
            : { opacity: 1, height: 'auto', scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
        >
          <div className="flex justify-between items-center">
            <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-gray-400">Speed</span>
            <span data-testid="acct-speed" className="font-pixel text-[11px] tabular-nums text-neon-cyan text-glow-cyan">{speedLeft}</span>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Performance text ── */}
      <motion.div
        data-testid="score-perf"
        className="font-sans font-black italic text-2xl"
        style={{
          letterSpacing: '.5px',
          background: 'linear-gradient(180deg,#fffbe6,#fde047 55%,#f59e0b)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter: 'drop-shadow(0 0 10px rgba(250,204,21,.7)) drop-shadow(0 1px 0 rgba(0,0,0,.5))',
        }}
        initial={false}
        animate={perfIn ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 6 }}
        transition={{ type: 'spring', stiffness: 300, damping: 14 }}
      >
        {perfWord(score)}
      </motion.div>
    </div>
  )
}
