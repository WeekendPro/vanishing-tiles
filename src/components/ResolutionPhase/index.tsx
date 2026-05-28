import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from '../Grid'
import { SelectionCart, type SelectionCartHandle } from './SelectionCart'
import { FlyerOverlay, type FlyerSpec } from './FlyerOverlay'
import { CelebrationBadge } from './CelebrationBadge'
import { PartialBadge } from './PartialBadge'
import { ScorePanel } from './ScorePanel'
import { NextRoundButton } from './NextRoundButton'
import { expandCartSlots, mapPlacementsToSlots } from '../../engine/cartSlots'

type Stage = 'measuring' | 'flying' | 'badge' | 'scoring' | 'cta'

// Time budgets (ms) from the spec:
const BEAT_AFTER_FLIGHT = 200
const BADGE_DURATION    = 400
const SCORING_DURATION  = 1800   // 3 rows × 300ms + round total at 0.9s + grand total at 1.2s + 0.4s count + buffer

export function ResolutionPhase() {
  const { selection, resolution, applyPlacement, roundScore, commitRoundScore, nextRound, lives, endGame } =
    useGameStore(useShallow(s => ({
      selection: s.selection,
      resolution: s._resolution,
      applyPlacement: s.applyPlacement,
      roundScore: s.roundScore,
      commitRoundScore: s.commitRoundScore,
      nextRound: s.nextRound,
      lives: s.lives,
      endGame: s.endGame,
    })))
  const solution = resolution?.placements ?? null

  const slots = useMemo(() => expandCartSlots(selection), [selection])
  const placementToSlot = useMemo(
    () => mapPlacementsToSlots(solution ?? [], slots),
    [solution, slots],
  )

  const badSlots = useMemo(() => {
    const claimed = new Set(placementToSlot.filter(i => i >= 0))
    return new Set(slots.map(s => s.slotIndex).filter(i => !claimed.has(i)))
  }, [placementToSlot, slots])

  const rootRef = useRef<HTMLDivElement>(null)
  const cartRef = useRef<SelectionCartHandle>(null)
  const cellRects = useRef<Map<string, DOMRect>>(new Map())

  const [stage, setStage] = useState<Stage>('measuring')
  const [flyers, setFlyers] = useState<FlyerSpec[] | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const [consumed, setConsumed] = useState<ReadonlySet<number>>(new Set())
  const landedCount = useRef(0)

  // Snapshot the pre-commit running score once, so the GRAND TOTAL count-up
  // target is stable even after commitRoundScore mutates the store later.
  const [scoreBeforeRound] = useState(() => useGameStore.getState().score)
  const grandTotal = scoreBeforeRound + (roundScore?.total ?? 0)

  const reduceMotion = useReducedMotion()

  // Reduced motion: skip the flight. Apply all placements immediately,
  // then jump straight to the CTA (with the badge + score visible).
  useEffect(() => {
    if (!reduceMotion) return
    if (stage !== 'measuring') return
    if (!solution) return
    for (const p of solution) applyPlacement(p)
    commitRoundScore()
    setStage('cta')
  }, [reduceMotion, stage, solution, applyPlacement, commitRoundScore])

  // Measure and build flyer specs after first render.
  useLayoutEffect(() => {
    if (stage !== 'measuring') return
    if (reduceMotion) return                     // ← reduced motion handled by useEffect above
    if (!solution || solution.length === 0) {
      // Defensive: no pieces to fly. Skip directly to badge.
      setStage('badge')
      return
    }
    if (!rootRef.current || !cartRef.current) return

    const N = solution.length
    const perPiece = Math.min(500, 3000 / N) / 1000
    const built: FlyerSpec[] = []

    for (let i = 0; i < N; i++) {
      const placement = solution[i]
      const slotIdx = placementToSlot[i]
      const chipRect = slotIdx >= 0 ? cartRef.current.getChipRect(slotIdx) : null
      const cellRect = cellRects.current.get(`${placement.anchorRow},${placement.anchorCol}`)
      if (!chipRect || !cellRect) continue
      built.push({
        placement,
        sourceX: chipRect.left,
        sourceY: chipRect.top,
        targetX: cellRect.left,
        targetY: cellRect.top,
        duration: perPiece,
        delay: i * perPiece,
      })
    }

    if (built.length === 0) {
      // No measurable flyers (defensive); skip the flight so the phase can't hang.
      setStage('badge')
      return
    }

    const rootRect = rootRef.current.getBoundingClientRect()
    setContainerRect(rootRect)
    setFlyers(built)

    setStage('flying')
  }, [stage, solution, placementToSlot, reduceMotion])

  // Dim chips at the moment their flyer launches.
  useEffect(() => {
    if (stage !== 'flying' || !flyers) return
    const timers = flyers.map((f, i) =>
      window.setTimeout(() => {
        setConsumed(prev => {
          const slotIdx = placementToSlot[i]
          if (slotIdx < 0) return prev
          const next = new Set(prev)
          next.add(slotIdx)
          return next
        })
      }, f.delay * 1000),
    )
    return () => { timers.forEach(clearTimeout) }
  }, [stage, flyers, placementToSlot])

  // Stage transitions after flying.
  useEffect(() => {
    if (stage !== 'badge') return
    const t = window.setTimeout(() => setStage('scoring'), BADGE_DURATION)
    return () => clearTimeout(t)
  }, [stage])

  useEffect(() => {
    if (stage !== 'scoring') return
    // Per the spec data flow, commitRoundScore fires AFTER the panel
    // finishes counting up — that way the GameShell header's running
    // total updates at the same moment the panel total settles.
    const t = window.setTimeout(() => {
      commitRoundScore()
      setStage('cta')
    }, SCORING_DURATION)
    return () => clearTimeout(t)
  }, [stage, commitRoundScore])

  const handleLanded = (flyerIndex: number) => {
    if (!flyers) return
    applyPlacement(flyers[flyerIndex].placement)
    landedCount.current += 1
    if (landedCount.current === flyers.length) {
      window.setTimeout(() => setStage('badge'), BEAT_AFTER_FLIGHT)
    }
  }

  const badgeShown = stage === 'badge' || stage === 'scoring' || stage === 'cta'

  const isFinalLife = resolution?.kind === 'partial' && lives === 0
  const handleCta = () => { if (isFinalLife) endGame(); else nextRound() }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-4 w-full max-w-sm items-center">
      {/* Grid + centered badge overlay. Grid dims when the badge appears so
          the green checkmark pops visually. */}
      <div className="relative">
        <div className={`transition-opacity duration-300 ${badgeShown ? 'opacity-40' : 'opacity-100'}`}>
          <Grid
            cellRef={(row, col, el) => {
              if (el) cellRects.current.set(`${row},${col}`, el.getBoundingClientRect())
            }}
          />
        </div>
        {resolution?.kind === 'partial'
          ? <PartialBadge show={badgeShown} coverage={resolution.coverage} reason={resolution.reason} />
          : <CelebrationBadge show={badgeShown} />}
      </div>

      <SelectionCart ref={cartRef} slots={slots} consumed={consumed} badSlots={badSlots} />

      {flyers && containerRect && stage === 'flying' && (
        <FlyerOverlay
          containerRect={containerRect}
          flyers={flyers}
          onFlyerLanded={handleLanded}
        />
      )}

      {roundScore && (
        <ScorePanel
          roundScore={roundScore}
          grandTotal={grandTotal}
          show={stage === 'scoring' || stage === 'cta'}
        />
      )}

      <NextRoundButton show={stage === 'cta'} onClick={handleCta} label={isFinalLife ? 'Game Over →' : 'Next Round →'} danger={isFinalLife} />
    </div>
  )
}
