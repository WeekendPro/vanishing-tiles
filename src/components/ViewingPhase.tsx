import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from './Grid'
import { GapBorder } from './GapBorder'
import { GapNumbers } from './GapNumbers'
import { GapShimmer } from './GapShimmer'
import { FlashReveal } from './FlashReveal'
import { NeonButton } from './ui'

export function ViewingPhase() {
  const { endViewing, phaseStartTime, phaseDuration, gaps, roundTheme } = useGameStore(useShallow(s => ({
    endViewing: s.endViewing,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
    gaps: s.gaps,
    roundTheme: s.roundTheme,
  })))

  const isFlashMob = roundTheme === 'flashMob'
  const gridWrapRef = useRef<HTMLDivElement>(null)
  const cellRects = useRef<Map<string, DOMRect>>(new Map())

  useEffect(() => {
    // Flash Mob drives its own end-of-viewing transition (FlashReveal calls
    // endViewing after the single pass), so skip the duration timer here to
    // avoid a double-fire.
    if (isFlashMob) return
    const remaining = Math.max(0, phaseStartTime + phaseDuration - Date.now())
    const timer = setTimeout(endViewing, remaining)
    return () => clearTimeout(timer)
  }, [phaseStartTime, phaseDuration, endViewing, isFlashMob])

  if (isFlashMob) {
    return (
      <div className="inline-flex flex-col gap-2 items-stretch">
        <FlashReveal gaps={gaps} onComplete={endViewing} />
      </div>
    )
  }

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
      <NeonButton fullWidth variant="primary" onClick={endViewing}>
        Ready →
      </NeonButton>
    </div>
  )
}
