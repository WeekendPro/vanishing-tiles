import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useGameStore, MAX_SPEED_BONUS } from '../../store/gameStore'
import { useShallow } from 'zustand/shallow'
import type { Placement } from '../../types'
import { Grid } from '../Grid'
import { SelectionCart, type SelectionCartHandle } from './SelectionCart'
import { FlyerOverlay, type FlyerSpec } from './FlyerOverlay'
import { CelebrationBadge } from './CelebrationBadge'
import { PartialBadge } from './PartialBadge'
import { ScorePanel } from './ScorePanel'
import { NextRoundButton } from './NextRoundButton'
import { expandCartSlots, mapPlacementsToSlots } from '../../engine/cartSlots'

type Stage = 'measuring' | 'flying' | 'badge' | 'scoring' | 'cta'

const FLY_DURATION      = 0.55   // s, per good-piece flight
const LAND_BEAT         = 120    // ms, pause after a good piece lands
const REJECT_DURATION   = 600    // ms, shake + gray/✕ reveal per bad piece
const BEAT_AFTER_FLIGHT = 250    // ms, after the last item before the badge
const BADGE_DURATION    = 400
const SCORING_DURATION  = 1800

export function ResolutionPhase() {
  const { selection, resolution, applyPlacement, roundScore, commitRoundScore, nextRound, retryRound, triesUsed, maxTries, newGame } =
    useGameStore(useShallow(s => ({
      selection: s.selection,
      resolution: s._resolution,
      applyPlacement: s.applyPlacement,
      roundScore: s.roundScore,
      commitRoundScore: s.commitRoundScore,
      nextRound: s.nextRound,
      retryRound: s.retryRound,
      triesUsed: s.triesUsed,
      maxTries: s.maxTries,
      newGame: s.newGame,
    })))
  const solution = resolution?.placements ?? null

  const slots = useMemo(() => expandCartSlots(selection), [selection])
  const placementToSlot = useMemo(
    () => mapPlacementsToSlots(solution ?? [], slots),
    [solution, slots],
  )

  const slotToPlacement = useMemo(() => {
    const m = new Map<number, Placement>()
    ;(solution ?? []).forEach((p, i) => {
      const s = placementToSlot[i]
      if (s >= 0) m.set(s, p)
    })
    return m
  }, [solution, placementToSlot])

  const rootRef = useRef<HTMLDivElement>(null)
  const cartRef = useRef<SelectionCartHandle>(null)
  const cellRects = useRef<Map<string, DOMRect>>(new Map())

  const [stage, setStage] = useState<Stage>('measuring')
  const [step, setStep] = useState(0)
  const [currentFlyer, setCurrentFlyer] = useState<FlyerSpec | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const [consumed, setConsumed] = useState<ReadonlySet<number>>(new Set())
  const [rejected, setRejected] = useState<ReadonlySet<number>>(new Set())

  // Snapshot the pre-commit running score once, so the GRAND TOTAL count-up
  // target is stable even after commitRoundScore mutates the store later.
  const [scoreBeforeRound] = useState(() => useGameStore.getState().score)
  const grandTotal = Math.max(0, scoreBeforeRound + (roundScore?.total ?? 0))

  const reduceMotion = useReducedMotion()

  // Reduced motion: skip the flight. Apply all placements immediately,
  // fill consumed/rejected, then jump straight to the CTA (with the badge + score visible).
  useEffect(() => {
    if (!reduceMotion || stage !== 'measuring' || !solution) return
    for (const p of solution) applyPlacement(p)
    const good = new Set<number>()
    const bad = new Set<number>()
    for (const s of slots) (slotToPlacement.has(s.slotIndex) ? good : bad).add(s.slotIndex)
    setConsumed(good)
    setRejected(bad)
    commitRoundScore()
    setStage('cta')
  }, [reduceMotion, stage, solution, applyPlacement, commitRoundScore, slots, slotToPlacement])

  // Measure the container rect, then kick off the walk.
  useLayoutEffect(() => {
    if (stage !== 'measuring' || reduceMotion) return
    if (!rootRef.current) return
    if (!solution || slots.length === 0) { setStage('badge'); return }
    setContainerRect(rootRef.current.getBoundingClientRect())
    setStep(0)
    setStage('flying')
  }, [stage, reduceMotion, solution, slots])

  // The walk: process one cart slot per step.
  useEffect(() => {
    if (stage !== 'flying') return
    if (step >= slots.length) {
      const t = window.setTimeout(() => setStage('badge'), BEAT_AFTER_FLIGHT)
      return () => clearTimeout(t)
    }
    const slot = slots[step]
    const placement = slotToPlacement.get(slot.slotIndex)
    if (placement) {
      const chipRect = cartRef.current?.getChipRect(slot.slotIndex) ?? null
      const cellRect = cellRects.current.get(`${placement.anchorRow},${placement.anchorCol}`)
      setConsumed(prev => new Set(prev).add(slot.slotIndex))
      if (!chipRect || !cellRect) {
        // Can't measure (defensive): apply immediately and advance.
        applyPlacement(placement)
        const t = window.setTimeout(() => setStep(s => s + 1), LAND_BEAT)
        return () => clearTimeout(t)
      }
      setCurrentFlyer({
        placement,
        sourceX: chipRect.left, sourceY: chipRect.top,
        targetX: cellRect.left, targetY: cellRect.top,
        duration: FLY_DURATION, delay: 0,
      })
      // advancement happens in handleFlyerLanded
    } else {
      setRejected(prev => new Set(prev).add(slot.slotIndex))
      const t = window.setTimeout(() => setStep(s => s + 1), REJECT_DURATION)
      return () => clearTimeout(t)
    }
  }, [stage, step, slots, slotToPlacement, applyPlacement])

  const handleFlyerLanded = () => {
    const p = currentFlyer?.placement
    setCurrentFlyer(null)
    if (p) applyPlacement(p)
    window.setTimeout(() => setStep(s => s + 1), LAND_BEAT)
  }

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

  const badgeShown = stage === 'badge' || stage === 'scoring' || stage === 'cta'

  const accuracyTier: 'perfect' | 'close' | 'far' =
    resolution?.kind === 'perfect' ? 'perfect'
      : (resolution && resolution.coverage >= 0.66 ? 'close' : 'far')

  const isFailure = resolution?.kind === 'partial'
  const speedSlow = !isFailure && !!roundScore && roundScore.speedBonus <= MAX_SPEED_BONUS * 0.2

  const ctaVariant: 'next' | 'retry' | 'newgame' =
    !isFailure ? 'next' : triesUsed >= maxTries ? 'newgame' : 'retry'
  const ctaLabel =
    ctaVariant === 'next' ? 'Next Round →'
      : ctaVariant === 'newgame' ? 'Start New Game'
      : 'Try Again ↺'
  const handleCta = () => {
    if (ctaVariant === 'next') nextRound()
    else if (ctaVariant === 'newgame') newGame()
    else retryRound()
  }

  return (
    <>
      {/* pb-24 reserves clearance so the score panel never hides behind the
          bottom-pinned action button. */}
      <div ref={rootRef} className="relative flex flex-col gap-4 w-full max-w-sm items-center pb-24">
        {/* Board with the badge centered over it. The grid dims at the end of the
            round (~40%) so the badge pops against it. */}
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

        {/* The cart is the launch pad for the fly-in AND the record of the
            attempt — consumed pieces dim, rejected pieces keep a red ✕. */}
        <SelectionCart ref={cartRef} slots={slots} consumed={consumed} rejected={rejected} />

        {currentFlyer && containerRect && stage === 'flying' && (
          <FlyerOverlay
            containerRect={containerRect}
            flyers={[currentFlyer]}
            onFlyerLanded={handleFlyerLanded}
          />
        )}

        {/* Score breakdown flows in normal document flow beneath the board. */}
        {roundScore && (
          <ScorePanel
            roundScore={roundScore}
            grandTotal={grandTotal}
            show={stage === 'scoring' || stage === 'cta'}
            accuracyTier={accuracyTier}
            isFailure={isFailure}
            speedSlow={speedSlow}
          />
        )}
      </div>

      {/* Action button pinned to the bottom of the screen — always tappable
          without scrolling, with a gradient scrim so content scrolls under it. */}
      {stage === 'cta' && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pt-10 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent pointer-events-none">
          <div className="w-full max-w-sm pointer-events-auto">
            <NextRoundButton show onClick={handleCta} label={ctaLabel} variant={ctaVariant} />
          </div>
        </div>
      )}
    </>
  )
}
