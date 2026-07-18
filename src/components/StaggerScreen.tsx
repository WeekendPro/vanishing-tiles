import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useShallow } from 'zustand/shallow'
import { type PieceType } from '@shared/types'
import { useStaggerStore } from '../store/staggerStore'
import { useNavStore } from '../store/navStore'
import { useSettingsStore } from '../store/settingsStore'
import { CLOCK_URGENT } from '../lib/staggerCurve'
import { analytics } from '../lib/analytics'
import { sfx } from '../lib/sfx'
import { NeonButton, ScaleToFit } from './ui'
import { useCountUp } from '../hooks/useCountUp'
import { CELL, CELL_PITCH, BOARD_PAD, LIFT_BEAT_MS, LIFT_MS, ORDER_HINT_MS } from './stagger/constants'
import { StaggerBoard } from './stagger/StaggerBoard'
import { StaggerCountdown } from './stagger/StaggerCountdown'
import { PieceTray } from './stagger/PieceTray'
import { HudBar } from './stagger/HudBar'
import { GameOverSummary } from './stagger/GameOverSummary'
import { DemoIntroOverlay, DemoEndOverlay, DemoFooterRow } from './stagger/DemoOverlays'
import { StreakBursts, LifeBursts, WrongPickFlash, LiftFlyer } from './stagger/FloatingFx'
import { PauseButton, CountdownPauseSkeleton, PauseStatsOverlay } from './stagger/PauseControls'
import { useRunRecording } from './stagger/useRunRecording'
import { useStreakChip } from './stagger/useStreakChip'
import { useLifeBursts } from './stagger/useLifeBursts'
import { useTimerBar } from './stagger/useTimerBar'
import { useRevealDriver } from './stagger/useRevealDriver'
import { useSelectClock } from './stagger/useSelectClock'

// ── Screen ────────────────────────────────────────────────────────────────────
export function StaggerScreen() {
  const {
    phase, demo, mode, batchIndex, gaps, revealPlan, score, lives, selectDuration, selectStartTime, paused,
    shapesRecalled, currentStreak, bestStreak, totalPicks, correctPicks,
    startRun, beginRunFromDemo, beginReveal, beginSelecting, pickPiece, bankSpeedBonus, advanceBatch, timeoutBatch,
    pause, resume, exit,
  } = useStaggerStore(useShallow(s => ({
    phase: s.phase, demo: s.demo, mode: s.mode, batchIndex: s.batchIndex, gaps: s.gaps, revealPlan: s.revealPlan, score: s.score,
    lives: s.lives, selectDuration: s.selectDuration, selectStartTime: s.selectStartTime, paused: s.paused,
    // "Streak" is player-facing copy only — the underlying store fields are still `currentCombo`/`bestCombo`.
    shapesRecalled: s.shapesRecalled, currentStreak: s.currentCombo, bestStreak: s.bestCombo, totalPicks: s.totalPicks, correctPicks: s.correctPicks,
    startRun: s.startRun, beginRunFromDemo: s.beginRunFromDemo, beginReveal: s.beginReveal, beginSelecting: s.beginSelecting,
    pickPiece: s.pickPiece, bankSpeedBonus: s.bankSpeedBonus, advanceBatch: s.advanceBatch, timeoutBatch: s.timeoutBatch,
    pause: s.pause, resume: s.resume, exit: s.exit,
  })))
  const goHome = useNavStore(s => s.goHome)
  const goLeaderboard = useNavStore(s => s.goLeaderboard)
  const { hideDemo, setHideDemo } = useSettingsStore(useShallow(s => ({ hideDemo: s.settings.hideDemo, setHideDemo: s.setHideDemo })))

  // Demo-only UI state: the gentle-correction piece (soft headshake + coach
  // line, no red/shake/life) and the end beat — a short "you're ready"
  // acknowledgment shown after the demo batch clears, the last screen before
  // the real countdown (still carries the opt-out).
  const [demoWrong, setDemoWrong] = useState<PieceType | null>(null)
  const [demoDone, setDemoDone] = useState(false)
  const demoWrongTimer = useRef<number | undefined>(undefined)

  // Once-per-run bookkeeping: the game-over recording (sfx + localStorage +
  // analytics + server submit) and the run-started analytics ping.
  const { records, currentRunId } = useRunRecording({
    phase, mode, batchIndex, score, shapesRecalled, bestStreak, totalPicks, correctPicks,
  })

  const [xMark, setXMark] = useState(false)
  const [cleared, setCleared] = useState(false)
  // Out-of-order hint (hard mode): a counter so back-to-back hints restart the
  // label's animation (the counter keys the label element → remount → replay).
  const [orderHint, setOrderHint] = useState(0)
  const orderHintTimer = useRef<number | undefined>(undefined)
  const boardRef = useRef<HTMLDivElement>(null)
  const scoreRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  // The §1 temperature-arc timer bar (barPct/barColor/barTransition + barRef),
  // driven through semantic gestures by the reveal driver, the recall clock, and
  // onPick's clear-payoff.
  const timerBar = useTimerBar()

  // The leftover-time "+bonus" that lifts off the bar and dissolves into the score
  // on a cleared batch (the "Lift" payoff). Null when no payoff is in flight.
  const [liftFlyer, setLiftFlyer] = useState<{ value: number; x0: number; y0: number; x1: number; y1: number } | null>(null)

  // Score count-up duration: snappy (600ms) per pick, stretched to the drain
  // window (LIFT_MS) while the cleared-batch speed bonus pours in, so the number
  // climbs in lockstep with the bar emptying.
  const [scoreCountMs, setScoreCountMs] = useState(600)

  // Smoothly counted-up score: every banked pick (and the lifted speed bonus)
  // ticks the displayed number up rather than snapping.
  const displayScore = useCountUp(score, scoreCountMs)

  // Streak: a run of correct recalls (tracked in the store). Each correct pick
  // floats the "+points" it earned over the just-filled gap; the running ×N
  // multiplier shows as a chip above the board.
  const [streakBursts, setStreakBursts] = useState<{ id: number; pts: number; x: number; y: number }[]>([])
  const streakBurstId = useRef(0)

  // Streak chip lifecycle (pop → hold → signature fade). The setter is exposed so
  // the phase-reset effect below can also clear it alongside the other FX.
  const { streakChip, setStreakChip } = useStreakChip(currentStreak)

  // Earn-a-life heart bursts (the shared life pool growing mid-run).
  const lifeBursts = useLifeBursts(lives, phase)

  // A fresh run / game over / a broken board clears any lingering bursts.
  useEffect(() => {
    if (phase === 'countdown' || phase === 'gameOver' || phase === 'idle') {
      setStreakBursts([])
      setStreakChip(null)
      setLiftFlyer(null)
      setScoreCountMs(600)
      setDemoWrong(null)
      setDemoDone(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Reveal driver (shape-bloom cascade): blooms each gap in turn, drains the bar
  // one step per gap as a count, then hands off to selecting.
  const blooms = useRevealDriver({
    phase, batchIndex, gaps, revealPlan, mode, demo, paused, beginSelecting, timerBar,
  })

  // Recall select clock: expiry (out of time costs a life + replays), the 100ms
  // clock/bar tick, and the accelerating urgency ticker.
  const clockMs = useSelectClock({
    phase, paused, cleared, demo, batchIndex, selectStartTime, selectDuration,
    timeoutBatch, setCleared, timerBar,
  })

  // Fire the leftover-time "+bonus" flyer from the right end of the (frozen) timer
  // bar up to the score readout. Skipped under reduced motion — the score still
  // counts up, just without the traveling flyer.
  const spawnLiftFlyer = (value: number, barRect: DOMRect | null) => {
    if (reduceMotion) return
    const sc = scoreRef.current?.getBoundingClientRect()
    if (!barRect || !sc) return
    setLiftFlyer({
      value,
      x0: barRect.right,
      y0: barRect.top + barRect.height / 2,
      x1: sc.left + sc.width / 2,
      y1: sc.top + sc.height / 2,
    })
  }

  // Any exit from the demo (the skip link, or the end beat's tap-to-start)
  // resets the demo's score/stats in the store and fires the real countdown.
  const leaveDemo = () => {
    window.clearTimeout(demoWrongTimer.current)
    setDemoWrong(null)
    setDemoDone(false)
    setCleared(false)
    beginRunFromDemo()
  }

  const onPick = (type: PieceType) => {
    if (cleared || paused) return
    const res = pickPiece(type)

    if (demo) {
      window.clearTimeout(demoWrongTimer.current)
      if (!res.ok) {
        // Gentle correction: soft headshake on the tapped piece + coach line —
        // no red flash, no board shake, no sfx sting, nothing lost.
        setDemoWrong(type)
        demoWrongTimer.current = window.setTimeout(() => setDemoWrong(null), 1400)
        return
      }
      setDemoWrong(null)
      sfx.pickCorrect(res.combo)
      if (res.gap) {
        // Exactly the real game's feedback — the "+points" the piece earned
        // bubbles up off the filled gap. No demo-only praise flourish.
        const cells = res.gap.cells
        const avgR = cells.reduce((a, [r]) => a + r, 0) / cells.length
        const avgC = cells.reduce((a, [, c]) => a + c, 0) / cells.length
        const id = (streakBurstId.current += 1)
        setStreakBursts(prev => [...prev, {
          id, pts: res.gained,
          x: BOARD_PAD + avgC * CELL_PITCH + CELL / 2,
          y: BOARD_PAD + avgR * CELL_PITCH + CELL / 2,
        }])
        window.setTimeout(() => setStreakBursts(prev => prev.filter(p => p.id !== id)), 700)
      }
      if (res.batchCleared) {
        // Let the final snap-in and its "+points" read (the board shows CLEAR!),
        // then raise the short "you're ready" acknowledgment — the player taps
        // that to start the real countdown.
        setCleared(true)
        sfx.batchClear()
        window.setTimeout(() => setDemoDone(true), 1100)
      }
      return
    }
    // gameOver only ever rides a miss: give the final pick its miss buzz too
    // (the gameOver farewell itself fires from the phase effect above).
    if (res.gameOver) { sfx.pickWrong(); return }
    // Any resolved pick ends a live "IN ORDER" hint; a right-shape-wrong-order
    // miss (re)starts it — the phase label swaps to the hint for ORDER_HINT_MS
    // as a central cue for WHY the pick missed, on top of the standard miss
    // feedback below.
    window.clearTimeout(orderHintTimer.current)
    if (res.outOfOrder) {
      setOrderHint(n => n + 1)
      orderHintTimer.current = window.setTimeout(() => setOrderHint(0), ORDER_HINT_MS)
    } else {
      setOrderHint(0)
    }
    if (!res.ok) {
      sfx.pickWrong()
      setXMark(true)
      boardRef.current?.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
         { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 240 },
      )
      window.setTimeout(() => setXMark(false), 440)
      return
    }
    // Correct recall. Float the "+points" earned (base × streak) over the filled
    // gap; the running ×N multiplier lives in the chip by the score.
    sfx.pickCorrect(res.combo)
    if (res.gap) {
      const cells = res.gap.cells
      const avgR = cells.reduce((a, [r]) => a + r, 0) / cells.length
      const avgC = cells.reduce((a, [, c]) => a + c, 0) / cells.length
      const x = BOARD_PAD + avgC * CELL_PITCH + CELL / 2
      const y = BOARD_PAD + avgR * CELL_PITCH + CELL / 2
      const id = (streakBurstId.current += 1)
      setStreakBursts(prev => [...prev, { id, pts: res.gained, x, y }])
      window.setTimeout(() => setStreakBursts(prev => prev.filter(p => p.id !== id)), 700)
    }
    if (res.batchCleared) {
      setCleared(true)
      sfx.batchClear()
      const bonus = res.speedBonus
      // Freeze the lime bar where it currently sits (the leftover time), holding it
      // for a short anticipation beat before the payoff.
      timerBar.freezeLime()
      // Release: the bar rushes to empty while the leftover time LIFTS off it as a
      // single big "+bonus" that floats up and dissolves into the score, and the
      // score counts up by exactly that bonus — all over the same LIFT_MS window,
      // so remaining time is read as turning into points.
      window.setTimeout(() => {
        const barRect = timerBar.barRef.current?.getBoundingClientRect() ?? null
        timerBar.rushToEmpty()
        if (bonus > 0) {
          sfx.bonusLift()
          spawnLiftFlyer(bonus, barRect)
          setScoreCountMs(LIFT_MS)
          bankSpeedBonus(bonus)
        }
      }, LIFT_BEAT_MS)
      window.setTimeout(() => {
        setScoreCountMs(600)
        setCleared(false)
        advanceBatch()
      }, LIFT_BEAT_MS + LIFT_MS + 240)
    }
  }

  if (phase === 'idle') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center vt-vignette select-none">
        <NeonButton variant="primary" onClick={() => startRun(mode)}>Start Staggered Vanishing Tiles</NeonButton>
      </div>
    )
  }

  // All currently-animating bloom cells (every active instance, so past pieces
  // keep decaying while new ones flash). Empty outside reveal → board stays dark.
  const bloomByCell = new Map<string, { id: number; holdMs: number; decayMs: number; color: string }>()
  if (phase === 'reveal') {
    for (const b of blooms) for (const cell of b.cells) bloomByCell.set(cell.key, { id: b.id, holdMs: cell.holdMs, decayMs: cell.decayMs, color: b.color })
  }
  // Demo guidance: the next gap to recall, in reveal order (every mode — which
  // quietly pre-teaches Hard's IN ORDER rule before it's ever enforced).
  const demoTarget = demo && phase === 'selecting' && !cleared && !demoDone
    ? (() => { const next = revealPlan.find(i => !gaps[i].filled); return next !== undefined ? gaps[next].pieceType : null })()
    : null
  // Demo coach copy owns the central line (the transient-cue slot) while the
  // demo is in flight; the normal phase words return with the real run. The copy
  // only ever points them to the answer — no praise ("nice job") beats.
  const demoCoach =
    !demo ? null :
    phase === 'reveal' ? 'WATCH THE SHAPES' :
    phase === 'selecting' && !cleared
      ? (demoWrong ? 'NOT THAT ONE — TRY THE GLOWING PIECE'
        : gaps.some(g => g.filled) ? 'NOW THE NEXT SHAPE' : 'TAP THE FIRST SHAPE YOU SAW')
      : null

  // Out-of-order hint takes over the phase label mid-recall (never over CLEAR!).
  const orderHintActive = orderHint > 0 && phase === 'selecting' && !cleared
  // Streak takeover of the central line: only mid-recall, and outranked by both
  // the IN ORDER hint and the CLEAR! beat.
  const streakTakeover = streakChip !== null && phase === 'selecting' && !cleared && !orderHintActive
  const phaseLabel = demoCoach ?? (
    phase === 'reveal' ? 'MEMORIZE' :
    phase === 'selecting' ? (cleared ? 'CLEAR!' : orderHintActive ? 'IN ORDER' : 'RECALL') : '')

  // Timer-bar phase color (the §1 temperature arc): magenta filling on reveal,
  // amber draining on recall, red pulse under 25% as the clock heats up, lime on
  // the clear-payoff drain.
  // "Low" tracks real remaining time (not the bar's width state), so the bar +
  // label only heat to red in the final quarter of the recall clock — the same
  // CLOCK_URGENT.FRACTION the urgency ticker starts on.
  const barLow = timerBar.barColor === 'amber' && !cleared && selectDuration > 0 && clockMs / selectDuration < CLOCK_URGENT.FRACTION
  const barClass =
    timerBar.barColor === 'magenta' ? 'bg-vt-magenta shadow-vt-magenta' :
    timerBar.barColor === 'lime' ? 'bg-vt-lime shadow-vt-lime' :
    barLow ? 'bg-vt-red shadow-vt-red animate-[redpulse_0.5s_cubic-bezier(0.7,0,0.3,1)_infinite]' :
    'bg-vt-amber shadow-vt-amber'

  // Phase label color tracks the bar's temperature (magenta → amber → red → lime).
  // The out-of-order hint is magenta: the blink animation plays over it, then
  // this base color is what the label holds until the hint expires.
  const phaseLabelClass =
    demo && demoWrong && phase === 'selecting' && !cleared ? 'text-white' :
    phase === 'reveal' ? 'text-vt-magenta text-glow-vt-magenta' :
    cleared ? 'text-vt-lime text-glow-vt-lime' :
    orderHintActive ? 'text-vt-magenta text-glow-vt-magenta' :
    barLow ? 'text-vt-red text-glow-vt-red' :
    phase === 'selecting' ? 'text-vt-amber text-glow-vt-amber' :
    'text-vt-dim'

  // Countdown subtitle: the selected tier on the heat arc (green/amber/red).
  const modeLabel = `${mode.charAt(0).toUpperCase()}${mode.slice(1)} Mode`
  const modeColor =
    mode === 'easy' ? 'text-vt-lime text-glow-vt-lime' :
    mode === 'hard' ? 'text-vt-red text-glow-vt-red' :
    'text-vt-amber text-glow-vt-amber'

  return (
    <div className="min-h-dvh flex flex-col vt-vignette text-vt-text select-none">
      {/* The play surface is authored at a fixed ~384px width; ScaleToFit shrinks
          it uniformly to fit smaller viewports (phones) and stays 1:1 on desktop.
          The game-over overlay is portaled to <body> and the pause / lift-flyer
          overlays render below, all OUTSIDE this transform — otherwise the scale
          would become their containing block and shrink them with the stage. */}
      <ScaleToFit>
        <div className="flex flex-col items-center pt-12 pb-8">
      {/* HUD + timer — hidden at game over (the summary covers score; lives/shapes are moot) */}
      {phase !== 'gameOver' && (
        <HudBar
          demo={demo}
          displayScore={displayScore}
          gaps={gaps}
          batchIndex={batchIndex}
          lives={lives}
          barRef={timerBar.barRef}
          barPct={timerBar.barPct}
          barClass={barClass}
          barTransition={timerBar.barTransition}
          scoreRef={scoreRef}
          streakTakeover={streakTakeover}
          streakChip={streakChip}
          orderHint={orderHint}
          orderHintActive={orderHintActive}
          phaseLabel={phaseLabel}
          phaseLabelClass={phaseLabelClass}
        />
      )}

      {/* Board + overlays */}
      <div className="relative">
        <div ref={boardRef}>
          <StaggerBoard gaps={gaps} bloomByCell={bloomByCell} mode={mode} />
        </div>

        {/* Demo spotlight veil: during a guided pick the board goes quiet so the
            tray's lit target is the only bright thing on screen. */}
        {demoTarget && (
          <div className="absolute inset-0 z-10 rounded-xl bg-black/55 pointer-events-none" />
        )}

        {phase === 'demoIntro' && (
          <DemoIntroOverlay onBeginReveal={beginReveal} />
        )}

        {demoDone && (
          <DemoEndOverlay onLeave={leaveDemo} hideDemo={hideDemo} setHideDemo={setHideDemo} />
        )}

        <StreakBursts streakBursts={streakBursts} />

        <LifeBursts lifeBursts={lifeBursts} />

        {/* Run-intro countdown — anchored OVER the board (not a full-screen
            void): the board/grid is visible underneath, the mode label sits
            above the 3·2·1. Fires at run start. */}
        {phase === 'countdown' && (
          <StaggerCountdown modeLabel={modeLabel} modeColor={modeColor} onDone={beginReveal} />
        )}

        <WrongPickFlash xMark={xMark} />

        {phase === 'gameOver' && (
          <GameOverSummary
            score={score}
            shapesRecalled={shapesRecalled}
            bestStreak={bestStreak}
            totalPicks={totalPicks}
            correctPicks={correctPicks}
            currentRunId={currentRunId}
            records={records}
            onPlayAgain={() => startRun(mode)}
            onLeaderboard={() => { exit(); analytics.leaderboardOpened(); goLeaderboard() }}
            onHome={() => { exit(); goHome() }}
          />
        )}

      </div>

      {/* Tray — on HARD, an "IN ORDER" chip rides above it (matching the STREAK
          chip's styling) as a reminder that recall must follow the reveal
          sequence; no per-gap numbering — remembering the order IS the challenge. */}
      <div className="mt-4 w-full flex flex-col items-center">
        {/* On HARD the line is kept in the layout (invisible) through the
            reveal too, so the tray and pause button hold one position across
            the memorize ↔ recall swap. */}
        {(phase === 'selecting' || phase === 'reveal' || phase === 'countdown') && mode === 'hard' && (
          <div className={`w-full max-w-sm mb-1.5 text-right font-silk font-bold text-[11px] tracking-[0.1em] text-vt-magenta text-glow-vt-magenta${phase === 'reveal' || phase === 'countdown' ? ' invisible' : ''}`}>
            IN ORDER
          </div>
        )}
        <div className="min-h-[88px] w-full flex justify-center">
          {/* The tray stays mounted through the reveal too — as the concealed
              empty-socket shell — so the layout never jumps when recall
              begins. */}
          {(phase === 'countdown' || phase === 'reveal' || phase === 'selecting') && (
            <PieceTray
              onPick={onPick}
              disabled={phase !== 'selecting' || cleared || paused}
              skeleton={phase === 'countdown'}
              concealed={phase === 'reveal'}
              mode={mode}
              demoTarget={demoTarget}
              demoWrong={demoWrong}
            />
          )}
        </div>
      </div>

      {demo && !demoDone && (
        <DemoFooterRow onLeave={leaveDemo} hideDemo={hideDemo} setHideDemo={setHideDemo} />
      )}

      {(phase === 'selecting' || phase === 'reveal') && !demo && (
        <PauseButton onPause={pause} cleared={cleared} />
      )}

      {phase === 'countdown' && (
        <CountdownPauseSkeleton />
      )}
        </div>
      </ScaleToFit>

      {paused && (
        <PauseStatsOverlay
          score={score}
          lives={lives}
          currentStreak={currentStreak}
          onResume={resume}
          onExit={() => { exit(); goHome() }}
        />
      )}

      {liftFlyer && (
        <LiftFlyer liftFlyer={liftFlyer} onDone={() => setLiftFlyer(null)} />
      )}
    </div>
  )
}
