import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { Grid } from './Grid'
import { ProgressBar } from './ProgressBar'

export function ViewingPhase() {
  const { endViewing, phaseStartTime, phaseDuration } = useGameStore(s => ({
    endViewing: s.endViewing,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
  }))

  useEffect(() => {
    const timer = setTimeout(endViewing, phaseDuration)
    return () => clearTimeout(timer)
  }, [phaseDuration, endViewing])

  return (
    <div className="flex flex-col items-center gap-4">
      <ProgressBar startTime={phaseStartTime} duration={phaseDuration} color="bg-cyan-400" />
      <Grid />
      <p className="text-sm text-slate-400 tracking-widest uppercase">Memorize the gaps</p>
    </div>
  )
}
