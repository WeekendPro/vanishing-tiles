import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { STREAK_HOLD_MS, STREAK_FADE_MS } from './constants'

export type StreakChip = { value: number; fading: boolean } | null

/** Streak chip lifecycle: a fresh streak step pops the chip in and holds it for
 *  STREAK_HOLD_MS, then it fades out in our signature fade style (vt-fade-away:
 *  hold → opacity/blur to nothing) and unmounts. Each new step re-arms the hold,
 *  so the chip lingers a beat after the last correct pick. A broken streak
 *  (currentStreak < 3) clears it immediately — the streak shattered.
 *
 *  The raw setter is returned so the screen's phase-reset effect (countdown /
 *  gameOver / idle) can also clear the chip alongside the other lingering FX. */
export function useStreakChip(currentStreak: number): {
  streakChip: StreakChip
  setStreakChip: Dispatch<SetStateAction<StreakChip>>
} {
  const [streakChip, setStreakChip] = useState<StreakChip>(null)
  const streakTimers = useRef<number[]>([])
  useEffect(() => {
    streakTimers.current.forEach(clearTimeout)
    streakTimers.current = []
    if (currentStreak >= 3) {
      setStreakChip({ value: currentStreak, fading: false })
      streakTimers.current.push(window.setTimeout(
        () => setStreakChip(c => (c ? { ...c, fading: true } : c)), STREAK_HOLD_MS))
      streakTimers.current.push(window.setTimeout(
        () => setStreakChip(null), STREAK_HOLD_MS + STREAK_FADE_MS))
    } else {
      setStreakChip(null)
    }
    return () => { streakTimers.current.forEach(clearTimeout); streakTimers.current = [] }
  }, [currentStreak])

  return { streakChip, setStreakChip }
}
