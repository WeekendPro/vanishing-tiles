import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { useNavStore } from '../../store/navStore'
import { useShallow } from 'zustand/shallow'
import type { Placement } from '@shared/types'
import { Grid } from '../Grid'
import { GapBorder } from '../GapBorder'
import { SelectionCart, type SelectionCartHandle } from './SelectionCart'
import { FlyerOverlay, type FlyerSpec } from './FlyerOverlay'
import { CelebrationBadge } from './CelebrationBadge'
import { PartialBadge } from './PartialBadge'
import { ScorePanel } from './ScorePanel'
import { NextRoundButton } from './NextRoundButton'
import { expandCartSlots, mapPlacementsToSlots } from '@shared/engine/cartSlots'
import { ROUNDS_PER_LEVEL, ROUND_PILLAR_MAX, MAX_LIVES } from '@shared/core/scoring'
import { ScoreStar } from './ScoreStar'
import { GameOverReveal } from './GameOverReveal'
import { IconButton, BackIcon, ReplayIcon, ForwardIcon } from './IconButton'
import { GIT_TRACKS } from '../../lib/gitMap'

type Stage = 'measuring' | 'flying' | 'badge' | 'scoring' | 'cta'

const FLY_DURATION      = 0.55   // s, per good-piece flight
const LAND_BEAT         = 120    // ms, pause after a good piece lands
const REJECT_DURATION   = 600    // ms, shake + gray/✕ reveal per bad piece
const BEAT_AFTER_FLIGHT = 250    // ms, after the last item before the badge
const BADGE_DURATION    = 400
const SCORING_DURATION  = 1800

export function ResolutionPhase() {
  const { selection, gaps, grid, resolution, applyPlacement, roundScore, commitRoundScore, retryRound, roundIndex, livesRemaining, advanceRound, mode, levelId, livesLost, replayComponent, retryComponent, gitTrack, gitLevel, nextGitLevel, replayGitLevel } =
    useGameStore(useShallow(s => ({
      selection: s.selection,
      gaps: s.gaps,
      grid: s.grid,
      resolution: s._resolution,
      applyPlacement: s.applyPlacement,
      roundScore: s.roundScore,
      commitRoundScore: s.commitRoundScore,
      retryRound: s.retryRound,
      roundIndex: s.roundIndex,
      livesRemaining: s.livesRemaining,
      advanceRound: s.advanceRound,
      mode: s.mode,
      levelId: s.levelId,
      livesLost: s.livesLost,
      replayComponent: s.replayComponent,
      retryComponent: s.retryComponent,
      gitTrack: s.gitTrack,
      gitLevel: s.gitLevel,
      nextGitLevel: s.nextGitLevel,
      replayGitLevel: s.replayGitLevel,
    })))
  const { showResults, openLevel, goNextLevel, hasNextLevel, backToMap } = useNavStore(useShallow(s => ({
    showResults: s.showResults,
    openLevel: s.openLevel,
    goNextLevel: s.goNextLevel,
    hasNextLevel: s.hasNextLevel,
    backToMap: s.backToMap,
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

  const isJourney = mode === 'journey'
  // Journey, out of lives → the Game Over reveal takes over the board/cart and
  // shows the correct answer. Defined up here so the stage effects can skip the
  // best-fit fly-in for it.
  const isGameOver = isJourney && resolution?.kind === 'partial' && livesRemaining <= 0

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
    if (!isJourney) commitRoundScore()
    setStage('cta')
  }, [reduceMotion, stage, solution, applyPlacement, commitRoundScore, slots, slotToPlacement, isJourney])

  // Measure the container rect, then kick off the walk.
  useLayoutEffect(() => {
    if (stage !== 'measuring' || reduceMotion) return
    if (!rootRef.current) return
    // Game Over skips the best-fit fly-in; GameOverReveal renders the solution.
    if (isGameOver) { setStage('badge'); return }
    if (!solution || slots.length === 0) { setStage('badge'); return }
    setContainerRect(rootRef.current.getBoundingClientRect())
    setStep(0)
    setStage('flying')
  }, [stage, reduceMotion, solution, slots, isGameOver])

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
      if (!isJourney) commitRoundScore()
      setStage('cta')
    }, SCORING_DURATION)
    return () => clearTimeout(t)
  }, [stage, commitRoundScore, isJourney])

  const badgeShown = stage === 'badge' || stage === 'scoring' || stage === 'cta'

  const isFailure = resolution?.kind === 'partial'
  const speedSlow = !isFailure && !!roundScore && roundScore.speedBonus <= ROUND_PILLAR_MAX.speed * 0.2

  // Practice AND Journey both run the per-round CTA: Next Round / Try Again for
  // rounds 1-3, then hand off to the results screen on the final round or when
  // lives run out (Journey submits its aggregate result from the results screen).
  const isLastRound = roundIndex >= ROUNDS_PER_LEVEL - 1
  const outOfLives = livesRemaining <= 0

  const ctaVariant: 'next' | 'retry' | 'newgame' =
    !isFailure ? 'next' : outOfLives ? 'newgame' : 'retry'
  const ctaLabel =
    !isFailure ? (isLastRound ? 'Level Complete →' : 'Next Round →')
      : outOfLives ? 'Game Over →'
      : 'Try Again ↺'
  const handleCta = () => {
    if (!isFailure) {
      advanceRound()
      if (useGameStore.getState().levelComplete) showResults()
    } else if (outOfLives) {
      showResults()
    } else {
      retryRound()
    }
  }

  return (
    <>
      {/* pb-24 reserves clearance so content (Practice's score panel, the cart)
          never hides behind the bottom-pinned action buttons. */}
      <div ref={rootRef} className="relative flex flex-col gap-4 w-full max-w-sm items-center pb-24">
        {isGameOver ? (
          badgeShown && <GameOverReveal />
        ) : (
        <>
        {/* Board with the badge centered over it. The grid dims at the end of the
            round so the badge pops against it. On a retryable loss (failed, but
            lives remain) we fade the board the rest of the way out — quietly
            hiding it rather than dwelling on the wrong placement. */}
        <div className="relative">
          <div
            className={`relative transition-opacity duration-500 ${
              !badgeShown
                ? 'opacity-100'
                : isFailure && !outOfLives
                  ? 'opacity-0'
                  : 'opacity-25'
            }`}
          >
            <Grid
              cellRef={(row, col, el) => {
                if (el) cellRects.current.set(`${row},${col}`, el.getBoundingClientRect())
              }}
            />
            {/* Same dashed gap silhouettes as the viewing phase, so pieces are
                seen flying into their outlined slots during the auto-placement.
                Passing the live grid drops each outline as its piece lands, so
                placed pieces cover the border instead of it sitting on top. */}
            <GapBorder gaps={gaps} grid={grid} />
          </div>
          {resolution?.kind === 'partial' ? (
            <PartialBadge show={badgeShown} coverage={resolution.coverage} reason={resolution.reason} />
          ) : isJourney ? (
            <ScoreStar show={badgeShown} score={roundScore?.total ?? 0} livesRemaining={MAX_LIVES - livesLost} />
          ) : (
            <CelebrationBadge show={badgeShown} />
          )}
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

        {/* Practice shows its multi-pillar score panel; Journey's score lives in the star. */}
        {!isJourney && roundScore && (
          <ScorePanel
            roundScore={roundScore}
            grandTotal={grandTotal}
            show={stage === 'scoring' || stage === 'cta'}
            isFailure={isFailure}
            speedSlow={speedSlow}
          />
        )}
        </>
        )}
      </div>

      {/* Action button pinned to the bottom of the screen — always tappable
          without scrolling, with a gradient scrim so content scrolls under it. */}
      {stage === 'cta' && !isJourney && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pt-10 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent pointer-events-none">
          <div className="w-full max-w-sm pointer-events-auto">
            <NextRoundButton show onClick={handleCta} label={ctaLabel} variant={ctaVariant} />
          </div>
        </div>
      )}

      {stage === 'cta' && isJourney && gitTrack && (() => {
        const atTop = (gitLevel ?? 0) >= GIT_TRACKS[gitTrack].floors
        const showNext = (!isFailure || outOfLives) && !atTop
        const onRepeat = isFailure && !outOfLives ? retryComponent : replayGitLevel
        const buttons = [
          <IconButton key="home" label="Git Map" accent="edge" onClick={() => backToMap()}>{BackIcon}</IconButton>,
          <IconButton key="repeat" label="Replay" accent="cyan" onClick={() => onRepeat()}>{ReplayIcon}</IconButton>,
          ...(showNext ? [<IconButton key="next" label="Next Level" accent="green" onClick={() => nextGitLevel()}>{ForwardIcon}</IconButton>] : []),
        ]
        return (
          <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pt-10 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent pointer-events-none">
            <div
              className="w-full max-w-sm pointer-events-auto grid gap-3"
              style={{ gridTemplateColumns: `repeat(${buttons.length}, minmax(0, 1fr))` }}
            >
              {buttons}
            </div>
          </div>
        )
      })()}

      {stage === 'cta' && isJourney && !gitTrack && (() => {
        const showNext = (!isFailure || outOfLives) && hasNextLevel()
        const onRepeat = isFailure && !outOfLives ? retryComponent : replayComponent
        const buttons = [
          <IconButton key="back" label="More Puzzles" accent="edge" onClick={() => { if (levelId) openLevel(levelId) }}>{BackIcon}</IconButton>,
          <IconButton key="repeat" label="Replay" accent="cyan" onClick={() => onRepeat()}>{ReplayIcon}</IconButton>,
          ...(showNext ? [<IconButton key="next" label="Next Level" accent="green" onClick={() => goNextLevel()}>{ForwardIcon}</IconButton>] : []),
        ]
        return (
          <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pt-10 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent pointer-events-none">
            <div
              className="w-full max-w-sm pointer-events-auto grid gap-3"
              style={{ gridTemplateColumns: `repeat(${buttons.length}, minmax(0, 1fr))` }}
            >
              {buttons}
            </div>
          </div>
        )
      })()}
    </>
  )
}
