import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from './Grid'
import { GapBorder } from './GapBorder'
import { GapNumbers } from './GapNumbers'
import { GapShimmer } from './GapShimmer'
import { NeonButton } from './ui'

export function ViewingPhase() {
  const { endViewing, phaseStartTime, phaseDuration, gaps } = useGameStore(useShallow(s => ({
    endViewing: s.endViewing,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
    gaps: s.gaps,
  })))

  const gridWrapRef = useRef<HTMLDivElement>(null)
  const cellRects = useRef<Map<string, DOMRect>>(new Map())

  useEffect(() => {
    const remaining = Math.max(0, phaseStartTime + phaseDuration - Date.now())
    const timer = setTimeout(endViewing, remaining)
    return () => clearTimeout(timer)
  }, [phaseStartTime, phaseDuration, endViewing])

  return (
    <div className="inline-flex flex-col gap-2 items-stretch">
      <div ref={gridWrapRef} className="relative">
        <Grid
          cellRef={(row, col, el) => {
            if (el) cellRects.current.set(`${row},${col}`, el.getBoundingClientRect())
          }}
        />
        <GapBorder gaps={gaps} />
        <GapNumbers gaps={gaps} />
        <GapShimmer containerRef={gridWrapRef} cellRects={cellRects} gaps={gaps} />
      </div>
      <p className="font-pixel text-[10px] tracking-[0.15em] uppercase text-neon-cyan text-center">Memorize the gaps</p>
      <NeonButton fullWidth variant="primary" onClick={endViewing}>
        Ready →
      </NeonButton>
    </div>
  )
}
