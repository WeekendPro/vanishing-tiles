import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from './Grid'
import { GapShimmer } from './GapShimmer'

export function ViewingPhase() {
  const { endViewing, phaseDuration, gaps } = useGameStore(useShallow(s => ({
    endViewing: s.endViewing,
    phaseDuration: s.phaseDuration,
    gaps: s.gaps,
  })))

  const gridWrapRef = useRef<HTMLDivElement>(null)
  const cellRects = useRef<Map<string, DOMRect>>(new Map())

  useEffect(() => {
    const timer = setTimeout(endViewing, phaseDuration)
    return () => clearTimeout(timer)
  }, [phaseDuration, endViewing])

  return (
    <div className="inline-flex flex-col gap-2 items-stretch">
      <div ref={gridWrapRef} className="relative">
        <Grid
          cellRef={(row, col, el) => {
            if (el) cellRects.current.set(`${row},${col}`, el.getBoundingClientRect())
          }}
        />
        <GapShimmer containerRef={gridWrapRef} cellRects={cellRects} gaps={gaps} />
      </div>
      <p className="text-sm text-slate-400 tracking-widest uppercase text-center">Memorize the gaps</p>
      <button
        onClick={endViewing}
        className="w-full py-3 bg-cyan-900 border-2 border-cyan-600 text-cyan-300 rounded-xl font-bold hover:bg-cyan-800"
      >
        Ready →
      </button>
    </div>
  )
}
