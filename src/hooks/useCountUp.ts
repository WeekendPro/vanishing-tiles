import { useEffect, useRef, useState } from 'react'

/** Smoothly tween a displayed number toward `value`. Increases ease up over
 *  `durationMs` (so every banked pick — and the end-of-batch speed bonus — counts
 *  up with a little joy); a decrease (e.g. a fresh run resetting to 0) snaps. */
export function useCountUp(value: number, durationMs = 600): number {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)
  const rafRef = useRef(0)
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    const from = displayRef.current
    if (value <= from) { displayRef.current = value; setDisplay(value); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = Math.round(from + (value - from) * eased)
      displayRef.current = v
      setDisplay(v)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, durationMs])
  return display
}
