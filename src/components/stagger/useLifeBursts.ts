import { useEffect, useRef, useState } from 'react'
import { type StaggerPhase } from '../../store/staggerStore'
import { sfx } from '../../lib/sfx'

export type LifeBurst = { id: number; n: number }

/** Earn-a-life: when the shared life pool grows mid-run (every 5000 pts), pop a
 *  celebratory heart burst over the board. Returns the active bursts to render. */
export function useLifeBursts(lives: number, phase: StaggerPhase): LifeBurst[] {
  const [lifeBursts, setLifeBursts] = useState<LifeBurst[]>([])
  const lifeBurstId = useRef(0)
  const prevLives = useRef(lives)
  useEffect(() => {
    const delta = lives - prevLives.current
    if (phase === 'selecting' && delta > 0) {
      sfx.lifeGained()
      const id = (lifeBurstId.current += 1)
      setLifeBursts(prev => [...prev, { id, n: delta }])
      window.setTimeout(() => setLifeBursts(prev => prev.filter(b => b.id !== id)), 1500)
    }
    prevLives.current = lives
  }, [lives, phase])

  return lifeBursts
}
