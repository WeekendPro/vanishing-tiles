import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useStaggerStore, type StaggerPhase } from '../../store/staggerStore'
import { CLOCK_URGENT, urgentHeat, urgentTickIntervalMs } from '../../lib/staggerCurve'
import { sfx } from '../../lib/sfx'
import { type TimerBar } from './useTimerBar'

interface SelectClockArgs {
  phase: StaggerPhase
  paused: boolean
  cleared: boolean
  demo: boolean
  batchIndex: number
  selectStartTime: number
  selectDuration: number
  timeoutBatch: () => void
  setCleared: Dispatch<SetStateAction<boolean>>
  timerBar: TimerBar
}

/** The recall-phase select clock: the three effects that share the same
 *  phase/paused/cleared/demo/selectStartTime/selectDuration inputs — the expiry
 *  (out of time costs a life + replays the batch), the 100ms clock/bar tick, and
 *  the urgency ticker (accelerating red-zone clicks). Returns the live remaining
 *  ms and drives the timer bar's amber drain. */
export function useSelectClock({
  phase, paused, cleared, demo, batchIndex, selectStartTime, selectDuration,
  timeoutBatch, setCleared, timerBar,
}: SelectClockArgs): number {
  const [clockMs, setClockMs] = useState(0)

  // Selecting expiry: end the batch when the select clock runs out (lives are the
  // only fail condition). Paused → freeze: the effect tears down and re-arms when
  // `resume` re-dates selectStartTime.
  useEffect(() => {
    if (phase !== 'selecting' || paused || demo) return
    let cancelled = false
    setCleared(false)
    const remaining = Math.max(0, selectStartTime + selectDuration - Date.now())
    const expiry = window.setTimeout(() => {
      if (cancelled) return
      // A cleared batch is handled by the clear beat; only a genuinely-unfinished
      // batch reaches here, and running out of time costs a life.
      if (!useStaggerStore.getState().gaps.every(g => g.filled)) {
        sfx.timeout()
        timeoutBatch()
      }
    }, remaining)
    return () => { cancelled = true; clearTimeout(expiry) }
  }, [phase, paused, demo, batchIndex, selectStartTime, selectDuration, timeoutBatch])

  // Recall clock + bar drain: tick the remaining time every 100ms, draining the
  // amber bar and feeding the in-bar seconds off the SAME live clock (so the bar
  // and the temperature arc track real time, not a fragile CSS-only transition).
  // Bails while cleared so onPick's lime payoff drain isn't overwritten.
  useEffect(() => {
    if (phase !== 'selecting' || paused || cleared || demo) return
    timerBar.startDrain()
    const tick = () => {
      const rem = Math.max(0, selectStartTime + selectDuration - Date.now())
      setClockMs(rem)
      timerBar.drainTo(selectDuration > 0 ? (rem / selectDuration) * 100 : 0)
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => clearInterval(id)
  }, [phase, paused, cleared, demo, selectStartTime, selectDuration])

  // Urgency ticker: the moment the recall clock enters its red zone (the same
  // CLOCK_URGENT.FRACTION that flips the bar red), a clock tick starts and
  // accelerates + pitches up as expiry nears (sfx.urgentTick(heat)). A
  // self-scheduling timeout chain: before the threshold it sleeps until the
  // crossing; inside it, each tick books the next at the shrinking interval.
  // Pause / clear / timeout / game over all tear the chain down via the deps
  // (paused freezes the clock — resume re-dates selectStartTime and re-arms).
  useEffect(() => {
    if (phase !== 'selecting' || paused || cleared || demo || selectDuration <= 0) return
    let timer: number
    const schedule = () => {
      const rem = selectStartTime + selectDuration - Date.now()
      if (rem <= 0) return
      const threshold = selectDuration * CLOCK_URGENT.FRACTION
      if (rem > threshold) {
        timer = window.setTimeout(schedule, rem - threshold)
        return
      }
      const heat = urgentHeat(rem / selectDuration)
      sfx.urgentTick(heat)
      timer = window.setTimeout(schedule, urgentTickIntervalMs(heat))
    }
    schedule()
    return () => clearTimeout(timer)
  }, [phase, paused, cleared, demo, selectStartTime, selectDuration])

  return clockMs
}
