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
      <div className="inline-flex flex-col gap-2 items-stretch">
        <Grid />
        <p className="text-sm text-slate-400 tracking-widest uppercase text-center">Memorize the gaps</p>
        <button
          onClick={endViewing}
          className="w-full py-3 bg-cyan-900 border-2 border-cyan-600 text-cyan-300 rounded-xl font-bold hover:bg-cyan-800"
        >
          Ready →
        </button>
      </div>
    </div>
  )
}
