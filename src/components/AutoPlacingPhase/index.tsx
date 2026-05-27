import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from '../Grid'
import { SelectionCart, type SelectionCartHandle } from './SelectionCart'
import { FlyerOverlay, type FlyerSpec } from './FlyerOverlay'
import { CelebrationBadge } from './CelebrationBadge'
import { ScorePanel } from './ScorePanel'
import { NextRoundButton } from './NextRoundButton'
import { expandCartSlots, mapPlacementsToSlots } from '../../engine/cartSlots'

type Stage = 'measuring' | 'flying' | 'badge' | 'scoring' | 'cta'

// Time budgets (ms) from the spec:
const BEAT_AFTER_FLIGHT = 200
const BADGE_DURATION    = 400
const SCORING_DURATION  = 1500   // 3 rows × 300ms stagger + 400ms count + buffer

export function AutoPlacingPhase() {
  const { selection, solution, applyPlacement, roundScore, commitRoundScore, nextRound } =
    useGameStore(useShallow(s => ({
      selection: s.selection,
      solution: s._autoPlaceSolution,
      applyPlacement: s.applyPlacement,
      roundScore: s.roundScore,
      commitRoundScore: s.commitRoundScore,
      nextRound: s.nextRound,
    })))

  const slots = useMemo(() => expandCartSlots(selection), [selection])
  const placementToSlot = useMemo(
    () => mapPlacementsToSlots(solution ?? [], slots),
    [solution, slots],
  )

  const rootRef = useRef<HTMLDivElement>(null)
  const cartRef = useRef<SelectionCartHandle>(null)
  const cellRects = useRef<Map<string, DOMRect>>(new Map())

  const [stage, setStage] = useState<Stage>('measuring')
  const [flyers, setFlyers] = useState<FlyerSpec[] | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const [consumed, setConsumed] = useState<ReadonlySet<number>>(new Set())
  const landedCount = useRef(0)

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

    setContainerRect(rootRef.current.getBoundingClientRect())
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

  return (
    <div ref={rootRef} className="relative flex flex-col gap-4 w-full max-w-sm items-center">
      <Grid
        cellRef={(row, col, el) => {
          if (el) cellRects.current.set(`${row},${col}`, el.getBoundingClientRect())
        }}
      />
      <SelectionCart ref={cartRef} slots={slots} consumed={consumed} />

      {flyers && containerRect && stage === 'flying' && (
        <FlyerOverlay
          containerRect={containerRect}
          flyers={flyers}
          onFlyerLanded={handleLanded}
        />
      )}

      <CelebrationBadge show={stage === 'badge' || stage === 'scoring' || stage === 'cta'} />

      {roundScore && (
        <ScorePanel
          roundScore={roundScore}
          show={stage === 'scoring' || stage === 'cta'}
        />
      )}

      <NextRoundButton show={stage === 'cta'} onClick={nextRound} />
    </div>
  )
}
