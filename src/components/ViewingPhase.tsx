import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from './Grid'
import { ProgressBar } from './ProgressBar'

export function ViewingPhase() {
  const { endViewing, phaseStartTime, phaseDuration } = useGameStore(useShallow(s => ({
    endViewing: s.endViewing,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
  })))

  useEffect(() => {
    const timer = setTimeout(endViewing, phaseDuration)
    return () => clearTimeout(timer)
  }, [phaseDuration, endViewing])

  return (
    <div className="flex flex-col items-center gap-4">
      <ProgressBar startTime={phaseStartTime} duration={phaseDuration} color="bg-cyan-400" />
      <Grid />
      <div className="flex items-center gap-4">
        <p className="text-sm text-slate-400 tracking-widest uppercase">Memorize the gaps</p>
        <button
          onClick={endViewing}
          className="px-4 py-1.5 bg-cyan-900 border border-cyan-600 text-cyan-300 rounded-lg text-sm font-bold hover:bg-cyan-800"
        >
          Ready →
        </button>
      </div>
    </div>
  )
}
