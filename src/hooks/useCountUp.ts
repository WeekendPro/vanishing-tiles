import { useEffect, useState } from 'react'

/**
 * Animates a number from 0 → `target` over `durationMs`.
 * Uses requestAnimationFrame; in test environments with fake timers
 * we fall back to a setInterval tick so the value still progresses.
 *
 * Restarts whenever `target` changes.
 */
export function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (durationMs <= 0) {
      setValue(target)
      return
    }

    setValue(0)
    const start = Date.now()
    let raf = 0
    let interval = 0

    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(1, elapsed / durationMs)
      // ease-out cubic for a nicer feel
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      }
    }

    // Drive the animation. In jsdom + fake timers, requestAnimationFrame
    // doesn't advance, so also schedule a setInterval that will fire
    // when vi.advanceTimersByTime() is called.
    raf = requestAnimationFrame(tick)
    interval = window.setInterval(tick, 16)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(interval)
    }
  }, [target, durationMs])

  return value
}
