import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { type PieceType } from '@shared/types'
import { useStaggerStore } from '../store/staggerStore'
import { useNavStore } from '../store/navStore'
import { useSettingsStore } from '../store/settingsStore'
import { useProfileStore } from '../store/profileStore'
import { shareRun } from '../lib/shareCard'
import { CLOCK_URGENT } from '../lib/staggerCurve'
import { analytics } from '../lib/analytics'
import { sfx } from '../lib/sfx'
import { NeonButton, ScaleToFit } from './ui'
import { useCountUp } from '../hooks/useCountUp'
import { CELL, CELL_PITCH, BOARD_PAD, LIFT_MS, BONUS_RISE_MS, BONUS_BEAT_MS, BONUS_STAGGER_MS, ORDER_HINT_MS } from './stagger/constants'
import { StaggerBoard } from './stagger/StaggerBoard'
import { StaggerCountdown } from './stagger/StaggerCountdown'
import { PieceTray } from './stagger/PieceTray'
import { HudBar } from './stagger/HudBar'
import { GameOverSummary } from './stagger/GameOverSummary'
import { DemoIntroOverlay, DemoEndOverlay, DemoFooterRow } from './stagger/DemoOverlays'
import { StreakBursts, LifeBursts, WrongPickFlash, BonusPayoff, type BonusItem, type LiftVariant } from './stagger/FloatingFx'
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
  const goAuth = useNavStore(s => s.goAuth)
  const { displayName, isGuest } = useProfileStore(useShallow(s => ({ displayName: s.displayName, isGuest: s.isGuest })))
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

  // The §1 temperature-arc timer bar (barPct/barColor/barTransition + barRef),
  // driven through semantic gestures by the reveal driver, the recall clock, and
  // onPick's clear-payoff.
  const timerBar = useTimerBar()

  // The earned "+bonus" lines itemized in the board's upper-left on a cleared batch
  // (the payoff receipt): SPEED / ACCURACY / SEQUENCE, each drifting up to evaporate.
  // Empty when no payoff is in flight; cleared as a set when the batch advances.
  const [bonusItems, setBonusItems] = useState<BonusItem[]>([])
  const bonusItemId = useRef(0)

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
      setBonusItems([])
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
    // Hard mode validates the rule the moment it's broken: ANY miss (a flat wrong
    // shape OR a right-shape-wrong-order tap) flashes "IN ORDER" red in the central
    // line for ORDER_HINT_MS, on top of the standard miss feedback below. A correct
    // pick ends the hint. (Since a miss zeroes the streak, the flash never competes
    // with the streak takeover.)
    const hardMiss = mode === 'hard' && !res.ok
    window.clearTimeout(orderHintTimer.current)
    if (hardMiss) {
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
      // Every earned bonus is itemized as a labeled riser: SPEED (leftover clock
      // time — nearly every clear), ACCURACY (cleared with no misses), SEQUENCE
      // (also recalled in reveal order — Easy/Medium). Speed rides the timer-bar
      // drain on the first beat; the specials stagger in one beat apart after it.
      const specials = ([
        { amount: res.flawlessBonus, tag: 'ACCURACY', variant: 'flawless' as LiftVariant },
        { amount: res.inOrderBonus, tag: 'SEQUENCE', variant: 'inOrder' as LiftVariant },
      ]).filter(b => b.amount > 0)
      // Freeze the lime bar (the leftover time), then at the first beat drain it
      // into the score — that drain IS the speed bonus, so its "SPEED BONUS +N"
      // line lands on the same beat, banked here (not in the specials loop below).
      timerBar.freezeLime()
      window.setTimeout(() => {
        timerBar.rushToEmpty()
        if (res.speedBonus > 0) {
          sfx.bonusLift()
          setScoreCountMs(LIFT_MS)
          bankSpeedBonus(res.speedBonus)
        }
      }, BONUS_BEAT_MS)
      // Display list: SPEED on the drain beat, then each special one stagger later.
      const speedItems = res.speedBonus > 0
        ? [{ amount: res.speedBonus, tag: 'SPEED', variant: 'speed' as LiftVariant, delayMs: BONUS_BEAT_MS }]
        : []
      const specialItems = specials.map((b, j) => ({
        amount: b.amount, tag: b.tag, variant: b.variant,
        delayMs: BONUS_BEAT_MS + (j + 1) * BONUS_STAGGER_MS,
      }))
      const displayItems = [...speedItems, ...specialItems]
      // Each line fades in, holds, then drifts up to evaporate. CSS delay matches
      // the bank timing.
      setBonusItems(displayItems.map(b => ({
        id: (bonusItemId.current += 1),
        value: b.amount, tag: b.tag, variant: b.variant, delayMs: b.delayMs,
      })))
      // Bank the specials as each line lands (speed already banked on the drain beat).
      specials.forEach((b, j) => {
        window.setTimeout(() => {
          sfx.bonusLift()
          setScoreCountMs(LIFT_MS)
          bankSpeedBonus(b.amount)
        }, BONUS_BEAT_MS + (j + 1) * BONUS_STAGGER_MS)
      })
      // Advance once the last visible line evaporates (or, with no lines at all,
      // once the bar-drain payoff settles), clearing the receipt as the next
      // batch's reveal takes over.
      const lastDelay = displayItems.reduce((mx, b) => Math.max(mx, b.delayMs), 0)
      const receiptEnd = displayItems.length > 0 ? lastDelay + BONUS_RISE_MS : 0
      const payoffMs = Math.max(receiptEnd, BONUS_BEAT_MS + LIFT_MS + 240)
      window.setTimeout(() => {
        setScoreCountMs(600)
        setCleared(false)
        setBonusItems([])
        advanceBatch()
      }, payoffMs)
    }
  }

  if (phase === 'idle') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center select-none">
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

  // Out-of-order hint takes over the phase label mid-recall (only on a live miss,
  // which zeroes the streak — so it never competes with the streak takeover).
  const orderHintActive = orderHint > 0 && phase === 'selecting' && !cleared
  // Streak takeover of the central line. The streak is the headline the player
  // most needs — so it now ALSO owns the line through the clear payoff, in place
  // of the old "CLEAR!" (a batch only clears on a correct pick, so the streak is
  // always live there). The IN ORDER miss-flash still outranks it mid-recall.
  const streakTakeover = streakChip !== null && phase === 'selecting' && !orderHintActive
  const phaseLabel = demoCoach ?? (
    // "CLEAR!" survives only as the fallback when the streak is too short to have
    // a chip (< 3) — in practice the streak takeover covers the clear beat.
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
    <div className="min-h-dvh flex flex-col text-vt-text select-none">
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

        {/* Clear-payoff receipt: earned bonuses itemize in the board's upper-left,
            each line drifting up to evaporate. */}
        <BonusPayoff items={bonusItems} />

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
            onShare={async () => {
              const method = await shareRun({
                score, shapesRecalled, bestStreak, correctPicks, totalPicks, mode, displayName, isGuest,
              })
              analytics.resultShared({ mode, method })
              return method
            }}
            onLeaderboard={() => { exit(); analytics.leaderboardOpened(); goLeaderboard() }}
            onHome={() => { exit(); goHome() }}
          />
        )}

      </div>

      {/* Tray. Hard mode's "IN ORDER" reminder now lives in the central line above
          the grid (a red flash on any miss), not a chip beside the tray. */}
      <div className="mt-4 w-full flex flex-col items-center">
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
          mode={mode}
          batchIndex={batchIndex}
          score={score}
          lives={lives}
          currentStreak={currentStreak}
          onResume={resume}
          onRestart={() => startRun(mode)}
          onExit={() => { exit(); goHome() }}
          onSignUp={() => { exit(); goAuth() }}
        />
      )}
    </div>
  )
}
