import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { Grid } from '../Grid'
import { SelectionCart, type SelectionCartHandle } from './SelectionCart'
import { FlyerOverlay, type FlyerSpec } from './FlyerOverlay'
import { CelebrationBadge } from './CelebrationBadge'
import { ScorePanel } from './ScorePanel'
import { expandCartSlots, mapPlacementsToSlots } from '../../engine/cartSlots'

export function AutoPlacingPhase() {
  const { selection, solution, applyPlacement, roundScore } = useGameStore(useShallow(s => ({
    selection: s.selection,
    solution: s._autoPlaceSolution,
    applyPlacement: s.applyPlacement,
    roundScore: s.roundScore,
  })))

  const slots = useMemo(() => expandCartSlots(selection), [selection])
  const placementToSlot = useMemo(
    () => mapPlacementsToSlots(solution ?? [], slots),
    [solution, slots],
  )

  const rootRef = useRef<HTMLDivElement>(null)
  const cartRef = useRef<SelectionCartHandle>(null)
  const cellRects = useRef<Map<string, DOMRect>>(new Map())

  const [flyers, setFlyers] = useState<FlyerSpec[] | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const [consumed, setConsumed] = useState<ReadonlySet<number>>(new Set())

  // Measure positions and build flyer specs on mount.
  useLayoutEffect(() => {
    if (!solution || solution.length === 0) return
    if (!rootRef.current || !cartRef.current) return

    const N = solution.length
    const perPiece = Math.min(500, 3000 / N) / 1000  // seconds
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
  }, [solution, placementToSlot])

  const handleLanded = (flyerIndex: number) => {
    if (!flyers) return
    const flyer = flyers[flyerIndex]
    applyPlacement(flyer.placement)
  }

  // Mark the chip as consumed at the moment its flyer starts moving
  // (i.e. after its delay elapses).
  useLayoutEffect(() => {
    if (!flyers) return
    const timers = flyers.map((flyer, i) =>
      window.setTimeout(() => {
        setConsumed(prev => {
          const slotIdx = placementToSlot[i]
          if (slotIdx < 0) return prev
          const next = new Set(prev)
          next.add(slotIdx)
          return next
        })
      }, flyer.delay * 1000),
    )
    return () => { timers.forEach(clearTimeout) }
  }, [flyers, placementToSlot])

  return (
    <div ref={rootRef} className="relative flex flex-col gap-4 w-full max-w-sm items-center">
      <Grid
        cellRef={(row, col, el) => {
          if (el) cellRects.current.set(`${row},${col}`, el.getBoundingClientRect())
        }}
      />
      <SelectionCart ref={cartRef} slots={slots} consumed={consumed} />

      <CelebrationBadge show={false} />

      {roundScore && <ScorePanel roundScore={roundScore} show={false} />}

      {flyers && containerRect && (
        <FlyerOverlay
          containerRect={containerRect}
          flyers={flyers}
          onFlyerLanded={handleLanded}
        />
      )}
    </div>
  )
}
