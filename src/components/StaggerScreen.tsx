import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useShallow } from 'zustand/shallow'
import { type PieceType } from '@shared/types'
import { useStaggerStore, type StaggerGap, type StaggerPhase } from '../store/staggerStore'
import { useNavStore } from '../store/navStore'
import { useSettingsStore } from '../store/settingsStore'
import { useRunHistoryStore } from '../store/runHistoryStore'
import { STAGGER, CLOCK_URGENT, gapCountForBatch, urgentHeat, urgentTickIntervalMs } from '../lib/staggerCurve'
import { submitStaggerRun } from '../lib/api'
import { analytics } from '../lib/analytics'
import { sfx } from '../lib/sfx'
import { NeonButton, ScanlineOverlay, LivesCounter, PauseOverlay, ScaleToFit } from './ui'
import { RunHistoryGraph } from './RunHistoryGraph'
import { useCountUp } from '../hooks/useCountUp'
import { CELL, CELL_PITCH, BOARD_PAD, STREAK_HOLD_MS, STREAK_FADE_MS, LIFT_BEAT_MS, LIFT_MS, ORDER_HINT_MS, FLOAT_TEXT_SHADOW } from './stagger/constants'
import { PIECE_BLOOM_HEX, REVEAL_MAGENTA } from './stagger/palette'
import { type Bloom, bloomForGap } from './stagger/bloom'
import { StaggerBoard } from './stagger/StaggerBoard'
import { StaggerCountdown } from './stagger/StaggerCountdown'
import { PieceTray } from './stagger/PieceTray'

// ── HUD ─────────────────────────────────────────────────────────────────────

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

  // Reveal/decay timing for this run — the STAGGER constants. Held in a ref so
  // the reveal driver reads the LATEST values as each beat fires without
  // re-arming the whole effect and flickering.
  const timing = {
    stepMs: STAGGER.REVEAL_STEP_MS,
    bloomMs: STAGGER.REVEAL_BLOOM_MS,
    decayMs: STAGGER.REVEAL_DECAY_MS,
    waveMs: STAGGER.REVEAL_WAVE_MS,
  }
  const timingRef = useRef(timing)
  timingRef.current = timing

  const { records, recordRun } = useRunHistoryStore(useShallow(s => ({ records: s.records, recordRun: s.recordRun })))

  // Once-per-game-over run recording (guard ref prevents double-fire under StrictMode).
  const recordedRef = useRef(false)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)

  useEffect(() => {
    if (phase === 'gameOver' && !recordedRef.current) {
      recordedRef.current = true
      // The run's farewell (rides the same once-per-game-over guard as the
      // recording, so StrictMode never plays it twice).
      sfx.gameOver()
      const accuracy = totalPicks ? Math.round((correctPicks / totalPicks) * 100) : 0
      const run = recordRun({ mode, score, recalled: shapesRecalled, combo: bestStreak, accuracy })
      setCurrentRunId(run.id)
      // Analytics: the run's engagement payload — mode, how far (level =
      // batchIndex reached, 1-based), and how well. `level` here is the LAST
      // batch played (the run ends mid-batch on the fatal miss).
      analytics.runEnded({ mode, level: batchIndex + 1, score, bestStreak, accuracy })
      // Server-side per-(user, mode) stats — fire-and-forget so a network
      // failure never blocks the game-over screen (localStorage above is the
      // source of truth for the graph).
      submitStaggerRun({ mode, score, bestStreak, accuracy, gapsRecalled: shapesRecalled })
        .catch((err) => console.warn('Failed to record stagger run server-side', err))
    } else if (phase !== 'gameOver') {
      recordedRef.current = false
      setCurrentRunId(null)
    }
  }, [phase, mode, batchIndex, score, shapesRecalled, bestStreak, totalPicks, correctPicks, recordRun])

  // Analytics: fire `run_started` once when a REAL run begins. Every real run
  // (PLAY, Play again, and the demo→real handoff) enters through `countdown`;
  // the guided demo enters through `demoIntro`, so this never counts demos.
  // Keyed on the transition INTO countdown (prev phase differs) so it fires once
  // per run, not on every render, and survives StrictMode's double-invoke. The
  // null seed (not `phase`) is deliberate: PLAY with the demo disabled mounts
  // this screen already in `countdown`, and null != countdown lets that first
  // real run register.
  const prevPhaseRef = useRef<StaggerPhase | null>(null)
  useEffect(() => {
    if (phase === 'countdown' && prevPhaseRef.current !== 'countdown') {
      analytics.runStarted(mode)
    }
    prevPhaseRef.current = phase
  }, [phase, mode])

  const [blooms, setBlooms] = useState<Bloom[]>([])
  const [barPct, setBarPct] = useState(0)
  const [barColor, setBarColor] = useState<'magenta' | 'amber' | 'lime'>('magenta')
  const [barTransition, setBarTransition] = useState('width 180ms ease-out')
  const [clockMs, setClockMs] = useState(0)
  const [xMark, setXMark] = useState(false)
  const [cleared, setCleared] = useState(false)
  // Out-of-order hint (hard mode): a counter so back-to-back hints restart the
  // label's animation (the counter keys the label element → remount → replay).
  const [orderHint, setOrderHint] = useState(0)
  const orderHintTimer = useRef<number | undefined>(undefined)
  const boardRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const scoreRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

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

  // Streak chip lifecycle: a fresh streak step pops the chip in and holds it for
  // STREAK_HOLD_MS, then it fades out in our signature fade style (vt-fade-away:
  // hold → opacity/blur to nothing) and unmounts. Each new step re-arms the hold,
  // so the chip lingers a beat after the last correct pick. A broken streak
  // (currentStreak < 3) clears it immediately — the streak shattered.
  const [streakChip, setStreakChip] = useState<{ value: number; fading: boolean } | null>(null)
  const streakTimers = useRef<number[]>([])
  useEffect(() => {
    streakTimers.current.forEach(clearTimeout)
    streakTimers.current = []
    if (currentStreak >= 3) {
      setStreakChip({ value: currentStreak, fading: false })
      streakTimers.current.push(window.setTimeout(
        () => setStreakChip(c => (c ? { ...c, fading: true } : c)), STREAK_HOLD_MS))
      streakTimers.current.push(window.setTimeout(
        () => setStreakChip(null), STREAK_HOLD_MS + STREAK_FADE_MS))
    } else {
      setStreakChip(null)
    }
    return () => { streakTimers.current.forEach(clearTimeout); streakTimers.current = [] }
  }, [currentStreak])

  // Earn-a-life: when the shared life pool grows mid-run (every 5000 pts), pop a
  // celebratory heart burst over the board.
  const [lifeBursts, setLifeBursts] = useState<{ id: number; n: number }[]>([])
  const lifeBurstId = useRef(0)
  const prevLives = useRef(lives)
  useEffect(() => {
    const delta = lives - prevLives.current
    if (phase === 'selecting' && delta > 0) {
      sfx.lifeGained()
      const id = (lifeBurstId.current += 1)
      setLifeBursts(prev => [...prev, { id, n: delta }])
      window.setTimeout(() => setLifeBursts(prev => prev.filter(b => b.id !== id)), 1500)
    }
    prevLives.current = lives
  }, [lives, phase])

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
  }, [phase])

  // Reveal driver (shape-bloom): bloom each gap in turn — the gap's cells all get
  // .vt-bloom at the same tick, flood the piece color (EASY) or magenta
  // (MEDIUM/HARD), then decay along a ghost tail back to the void (fading away in a
  // per-cell wave).
  // Decays cascade (the next gap blooms before the last finishes dying), draining
  // the bar one step per gap as a COUNT, then hand off to selecting. Because the
  // reveals forwards-fill back to the void, past gaps leave no readable hole.
  // Where a paused reveal picks back up: the index of the gap that was blooming
  // (or queued) when the pause hit. Any FRESH reveal — next batch, timeout
  // replay, paid replay — resets it to 0 (this effect's deps change on all of
  // those but NOT on a pause/resume toggle, which only flips `paused`). It must
  // run before the driver below so the driver reads the reset value.
  const revealIdxRef = useRef(0)
  useEffect(() => {
    if (phase === 'reveal') revealIdxRef.current = 0
  }, [phase, batchIndex, gaps, revealPlan])

  useEffect(() => {
    if (phase !== 'reveal' || gaps.length === 0 || paused) return
    let cancelled = false
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    // The reveal plays as a sequence of gaps, in revealPlan's shuffled order; fall
    // back to index order if a batch somehow arrived without a plan (e.g. legacy state).
    const order = revealPlan.length ? revealPlan : gaps.map((_, i) => i)
    const n = order.length
    // Difficulty shapes the reveal: EASY floods each gap in its own piece
    // colour; MEDIUM floods the uniform branded pink; HARD paints the self-
    // colored graphite "impasto" (StaggerBoard renders .vt-paint for HARD, so
    // this color is unused there). All tiers play at the same reveal speed.
    const colorFor = (gap: StaggerGap) =>
      mode === 'easy' ? PIECE_BLOOM_HEX[gap.pieceType] : REVEAL_MAGENTA
    // Reveal/decay timing is read LIVE from timingRef per gap. `step` (gap-to-gap
    // spacing) outruns one bloom's lifetime, so the next gap flashes while the
    // previous is still decaying.
    // Memorize bar DRAINS: starts full and empties one step per gap as the
    // sequence plays out (a visual count of memorize time spent). A reveal
    // resumed from pause starts at the interrupted gap (re-blooming it in
    // full), with the bar re-wound to just before that step. The demo's bar
    // stays inert/empty — its whole point is that no clock exists yet.
    const startIdx = revealIdxRef.current
    if (demo) { setBarPct(0) } else { setBarColor('magenta'); setBarTransition('width 180ms ease-out'); setBarPct((1 - startIdx / n) * 100) }
    setBlooms([])
    let id = 0

    const show = (idx: number) => {
      if (cancelled) return
      revealIdxRef.current = idx
      if (idx >= n) {
        // Let the final gap finish its decay before recall lights-out.
        const { stepMs, bloomMs, decayMs } = timingRef.current
        at(Math.max(0, bloomMs + decayMs - stepMs), beginSelecting)
        return
      }
      if (!demo) setBarPct((1 - (idx + 1) / n) * 100)
      const gi = order[idx]
      const { stepMs, bloomMs, decayMs, waveMs } = timingRef.current
      const lifetime = bloomMs + decayMs + 3 * waveMs + 80
      const myId = ++id
      if (!cancelled) {
        setBlooms(prev => [...prev, bloomForGap(myId, gaps[gi], colorFor(gaps[gi]), bloomMs, decayMs, waveMs)])
        // Each bloom climbs one pentatonic step — the reveal sequence plays as
        // a rising melody, so pitch order doubles as a memory hook for order.
        sfx.bloom(idx)
      }
      // Clear this gap's bloom once it has fully decayed.
      at(lifetime, () => {
        if (!cancelled) setBlooms(prev => prev.filter(b => b.id !== myId))
      })
      at(stepMs, () => show(idx + 1))
    }
    // A short breath before the first gap (also paces continuous next batches
    // and re-entry from a mid-reveal pause).
    at(350, () => show(startIdx))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [phase, batchIndex, gaps, revealPlan, beginSelecting, mode, demo, paused])

  // Selecting expiry: end the batch when the select clock runs out (lives are the
  // only fail condition). Paused → freeze: the effect tears down and re-arms when
  // `resume` re-dates selectStartTime.
  useEffect(() => {
    if (phase !== 'selecting' || paused || demo) return
    let cancelled = false
    setCleared(false)
    const remaining = Math.max(0, selectStartTime + selectDuration - Date.now())
    const expiry = window.setTimeout(() => {
      if (cancelled) return
      // A cleared batch is handled by the clear beat; only a genuinely-unfinished
      // batch reaches here, and running out of time costs a life.
      if (!useStaggerStore.getState().gaps.every(g => g.filled)) {
        sfx.timeout()
        timeoutBatch()
      }
    }, remaining)
    return () => { cancelled = true; clearTimeout(expiry) }
  }, [phase, paused, demo, batchIndex, selectStartTime, selectDuration, timeoutBatch])

  // Recall clock + bar drain: tick the remaining time every 100ms, draining the
  // amber bar and feeding the in-bar seconds off the SAME live clock (so the bar
  // and the temperature arc track real time, not a fragile CSS-only transition).
  // Bails while cleared so onPick's lime payoff drain isn't overwritten.
  useEffect(() => {
    if (phase !== 'selecting' || paused || cleared || demo) return
    setBarColor('amber'); setBarTransition('width 120ms linear')
    const tick = () => {
      const rem = Math.max(0, selectStartTime + selectDuration - Date.now())
      setClockMs(rem)
      setBarPct(selectDuration > 0 ? (rem / selectDuration) * 100 : 0)
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => clearInterval(id)
  }, [phase, paused, cleared, demo, selectStartTime, selectDuration])

  // Urgency ticker: the moment the recall clock enters its red zone (the same
  // CLOCK_URGENT.FRACTION that flips the bar red), a clock tick starts and
  // accelerates + pitches up as expiry nears (sfx.urgentTick(heat)). A
  // self-scheduling timeout chain: before the threshold it sleeps until the
  // crossing; inside it, each tick books the next at the shrinking interval.
  // Pause / clear / timeout / game over all tear the chain down via the deps
  // (paused freezes the clock — resume re-dates selectStartTime and re-arms).
  useEffect(() => {
    if (phase !== 'selecting' || paused || cleared || demo || selectDuration <= 0) return
    let timer: number
    const schedule = () => {
      const rem = selectStartTime + selectDuration - Date.now()
      if (rem <= 0) return
      const threshold = selectDuration * CLOCK_URGENT.FRACTION
      if (rem > threshold) {
        timer = window.setTimeout(schedule, rem - threshold)
        return
      }
      const heat = urgentHeat(rem / selectDuration)
      sfx.urgentTick(heat)
      timer = window.setTimeout(schedule, urgentTickIntervalMs(heat))
    }
    schedule()
    return () => clearTimeout(timer)
  }, [phase, paused, cleared, demo, selectStartTime, selectDuration])

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
      const el = barRef.current, parent = el?.parentElement
      const frozenPct = el && parent
        ? (el.getBoundingClientRect().width / parent.getBoundingClientRect().width) * 100
        : barPct
      setBarColor('lime'); setBarTransition('none'); setBarPct(frozenPct)
      // Release: the bar rushes to empty while the leftover time LIFTS off it as a
      // single big "+bonus" that floats up and dissolves into the score, and the
      // score counts up by exactly that bonus — all over the same LIFT_MS window,
      // so remaining time is read as turning into points.
      window.setTimeout(() => {
        const barRect = barRef.current?.getBoundingClientRect() ?? null
        setBarTransition(`width ${LIFT_MS}ms cubic-bezier(0.33,1,0.68,1)`)
        setBarPct(0)
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
  const barLow = barColor === 'amber' && !cleared && selectDuration > 0 && clockMs / selectDuration < CLOCK_URGENT.FRACTION
  const barClass =
    barColor === 'magenta' ? 'bg-vt-magenta shadow-vt-magenta' :
    barColor === 'lime' ? 'bg-vt-lime shadow-vt-lime' :
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
        <>
          {/* Flat metadata bar (the Training-header grammar): the unlabeled
              score spans the bar's full height on the left; items and lives
              are label-above / value-below columns, bottoms on the score's
              baseline. A [1fr_auto_1fr] grid (not flex justify-between) so the
              items column stays pinned to the bar's true center — equal side
              tracks absorb the score growing wider, instead of it shoving the
              middle to the right. */}
          <div className="w-full max-w-sm grid grid-cols-[1fr_auto_1fr] items-stretch mb-2 pointer-events-none">
            <div className="flex items-end justify-self-start">
              {/* During the demo the most prominent readout says DEMO, not a
                  score — a constant reminder this isn't a scored run. */}
              <div ref={scoreRef} className="font-silk font-bold text-3xl text-vt-cyan text-glow-vt-cyan leading-none tabular-nums">{demo ? 'DEMO' : displayScore}</div>
            </div>
            <div className="flex flex-col items-center justify-between">
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Items</div>
              <div className="font-grotesk font-semibold text-[15px] leading-none text-vt-text tabular-nums">
                {gaps.filter(g => g.filled).length} <span className="font-medium text-vt-dim">/ {gaps.length || gapCountForBatch(batchIndex)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between justify-self-end">
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Lives</div>
              <LivesCounter lives={lives} cap={STAGGER.START_LIVES} />
            </div>
          </div>

          {/* Timer / count bar — phase-colored (magenta → amber → red → lime). */}
          <div className="w-full max-w-sm h-2 rounded-full bg-black overflow-hidden mb-2 shadow-[inset_0_1px_2px_#000]">
            <div
              ref={barRef}
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${barPct}%`, transition: barTransition }}
            />
          </div>

          {/* The central line above the grid. Usually the phase label; while a
              streak is live in recall, the STREAK ×N takeover owns it instead —
              the multiplier is the value (big), "streak" just the label (small).
              It pops on each streak step, holds, then fades in the signature
              style (see streakChip lifecycle above); the phase word returns
              when it's gone. Priority: IN ORDER (hard-mode corrective) and
              CLEAR! (the payoff beat) both outrank the streak, and the takeover
              never plays outside recall, so MEMORIZE is never masked.
              ("Streak" is player-facing copy only — the underlying store field
              is still `currentCombo`.) */}
          <div className="relative w-full max-w-sm h-4 mt-1 mb-2 pointer-events-none">
            {streakTakeover && streakChip ? (
              /* Centered by flex, NOT a translate: the pop/fade keyframes own
                 `transform`, so translate-based centering on the animated
                 element would drop for the animation's duration and snap back
                 after (a visible jump). */
              <div
                key={streakChip.fading ? `fade-${streakChip.value}` : streakChip.value}
                className={`absolute inset-0 flex items-center justify-center gap-1.5 text-vt-lime text-glow-vt-lime whitespace-nowrap ${streakChip.fading ? 'vt-fade-away' : 'streak-pop'}`}
                style={streakChip.fading ? { animationDuration: `${STREAK_FADE_MS}ms` } : undefined}
              >
                <span className="font-grotesk font-semibold text-[10px] tracking-[0.2em] uppercase">Streak</span>
                <span className="font-silk font-bold text-xl leading-none tabular-nums">×{streakChip.value}</span>
              </div>
            ) : (
              <div
                key={orderHintActive ? `order-${orderHint}` : 'phase'}
                className={`text-center font-grotesk text-[11px] tracking-[0.22em] uppercase transition-colors ${phaseLabelClass}${orderHintActive ? ' vt-order-flash' : ''}`}
              >
                {phaseLabel}
              </div>
            )}
          </div>
        </>
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

        {/* Demo intro — the countdown's overlay grammar (board visible under a
            veil), plain type: the two-step how-to + the opt-out, tap anywhere to
            begin. This is the ONE text screen the demo shows; a cleared demo
            batch flows straight into the real run (no end screen). Tapping the
            checkbox stops there — it must not also fire the tap-anywhere
            continue. */}
        {phase === 'demoIntro' && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => beginReveal()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); beginReveal() } }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl bg-black/70 backdrop-blur-[2px] cursor-pointer text-left"
          >
            <div className="font-grotesk text-[10px] uppercase tracking-[0.22em] text-vt-cyan text-glow-vt-cyan mb-5">How it works</div>
            <div className="flex flex-col gap-3.5 mb-5">
              <div className="flex items-baseline gap-2.5">
                <span className="font-grotesk font-bold text-[13px] text-vt-cyan text-glow-vt-cyan tabular-nums">1</span>
                <span className="font-grotesk text-sm font-medium text-vt-text">Memorize the pieces.</span>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="font-grotesk font-bold text-[13px] text-vt-cyan text-glow-vt-cyan tabular-nums">2</span>
                <span className="font-grotesk text-sm font-medium text-vt-text">Tap to recall what you saw.</span>
              </div>
            </div>
            {/* Sits right under step 2; the opt-out is NOT here — it's paired
                with the skip link down in the bottom row (see below). */}
            <div className="vt-demo-continue font-grotesk text-[10px] uppercase tracking-[0.2em] text-vt-dim">Tap to continue</div>
          </div>
        )}

        {/* Demo end beat — the intro's bookend: a short "you're ready"
            acknowledgment before the real run. OPAQUE background (bg-vt-void,
            no veil) — the board tiles behind must not show through. No timer/
            lives explainer. The opt-out is pinned to the bottom, under the
            start affordance: the LAST chance to turn the demo off before the
            countdown. Tapping anywhere (except the checkbox) starts the run. */}
        {demoDone && (
          <div
            role="button"
            tabIndex={0}
            onClick={leaveDemo}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); leaveDemo() } }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl bg-vt-void cursor-pointer px-6 text-center"
          >
            <div className="font-grotesk text-[10px] uppercase tracking-[0.22em] text-vt-lime text-glow-vt-lime mb-2">Nice work</div>
            <div className="font-grotesk font-bold text-xl text-vt-lime text-glow-vt-lime mb-6">You're ready to play</div>
            <div className="vt-demo-continue font-grotesk text-[10px] uppercase tracking-[0.2em] text-vt-dim">Tap to start</div>
            <label
              onClick={e => e.stopPropagation()}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 cursor-pointer font-grotesk text-[11px] text-vt-dim whitespace-nowrap"
            >
              <input
                type="checkbox"
                checked={hideDemo}
                onChange={e => setHideDemo(e.target.checked)}
                className="accent-[#28F0FF]"
              />
              Don't show this again
            </label>
          </div>
        )}

        {/* Streak bursts — a "+points" flourish floats up from each filled gap. */}
        <AnimatePresence>
          {streakBursts.map(cb => (
            <motion.div
              key={cb.id}
              initial={{ opacity: 0, scale: 0.4, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: -22 }}
              exit={{ opacity: 0, scale: 1.5, y: -46 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2
                font-silk font-bold text-sm whitespace-nowrap text-white"
              style={{
                left: cb.x,
                top: cb.y,
                // White lifted off any piece color by a soft drop shadow (not a
                // stroke) so it stays legible without an outline.
                textShadow: FLOAT_TEXT_SHADOW,
              }}
            >
              +{cb.pts}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Earn-a-life celebration — a heart blooms and rises off the board. */}
        <AnimatePresence>
          {lifeBursts.map(lb => (
            <motion.div
              key={lb.id}
              initial={{ opacity: 0, scale: 0.3, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: -6 }}
              exit={{ opacity: 0, scale: 1.7, y: -52 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
            >
              <span className="relative flex items-center justify-center">
                <span className="text-7xl leading-none text-vt-red text-glow-vt-red">♥</span>
                <span
                  className="absolute -translate-y-[3px] font-silk font-bold text-lg text-white"
                  style={{ textShadow: FLOAT_TEXT_SHADOW }}
                >
                  +{lb.n}
                </span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Run-intro countdown — anchored OVER the board (not a full-screen
            void): the board/grid is visible underneath, the mode label sits
            above the 3·2·1. Fires at run start. */}
        {phase === 'countdown' && (
          <StaggerCountdown modeLabel={modeLabel} modeColor={modeColor} onDone={beginReveal} />
        )}

        {/* Wrong pick: a red border flashes around the board (with the shake). */}
        <AnimatePresence>
          {xMark && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-0 rounded-xl pointer-events-none shadow-[inset_0_0_0_2px_#FF3B47,0_0_24px_rgba(255,59,71,0.28)]"
            />
          )}
        </AnimatePresence>

        {/* Portaled to <body> so it escapes ScaleToFit's transform (a transformed
            ancestor would become this fixed overlay's containing block and shrink
            it to the scaled stage instead of covering the viewport). */}
        {phase === 'gameOver' && createPortal(
          <div className="fixed inset-0 z-40 flex flex-col items-center bg-vt-void overflow-y-auto px-6 py-10">
            <ScanlineOverlay />
            <div className="font-silk text-base text-vt-text uppercase tracking-[0.15em] mb-1.5">Game Over</div>
            <div className="font-grotesk text-[11px] tracking-[0.18em] uppercase text-vt-magenta text-glow-vt-magenta mb-5 vt-fade-away">Memory Fades</div>
            <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Final score</div>
            <div className="font-silk font-bold text-4xl text-vt-amber text-glow-vt-amber mb-6 tabular-nums">{score}</div>

            {/* Run-stats trio — items recalled / best combo / accuracy. */}
            <div className="flex w-full max-w-[300px] border-y border-white/10 mb-6">
              <div className="flex-1 text-center py-3.5">
                <div className="font-silk font-bold text-base text-vt-magenta text-glow-vt-magenta tabular-nums">{shapesRecalled}</div>
                <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-vt-faint mt-1.5">Items recalled</div>
              </div>
              <div className="flex-1 text-center py-3.5 border-x border-white/10">
                <div className="font-silk font-bold text-base text-vt-lime text-glow-vt-lime tabular-nums">{bestStreak > 0 ? `×${bestStreak}` : 'N/A'}</div>
                <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-vt-faint mt-1.5">Best streak</div>
              </div>
              <div className="flex-1 text-center py-3.5">
                <div className="font-silk font-bold text-base text-vt-cyan text-glow-vt-cyan tabular-nums">
                  {totalPicks === 0 ? 0 : Math.round((correctPicks / totalPicks) * 100)}%
                </div>
                <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-vt-faint mt-1.5">Accuracy</div>
              </div>
            </div>

            {currentRunId && (
              <div className="w-full max-w-[300px] mb-6 pointer-events-auto">
                <RunHistoryGraph records={records} currentId={currentRunId} />
              </div>
            )}

            {/* Play again is THE next action — full width, one tier up in size;
                Leaderboard and Home are half-width secondary doors below it.
                The column matches the stats/graph width above. */}
            <div className="flex flex-col gap-3 w-full max-w-[300px] pointer-events-auto">
              <NeonButton variant="primary" size="lg" fullWidth onClick={() => startRun(mode)}>Play again</NeonButton>
              <div className="flex gap-3">
                {/* The itch the summary creates — "where did that rank?" — gets
                    its own door. Lands on this run's mode tab: the board opens
                    on the persisted difficulty, which is what the run started
                    with. */}
                <NeonButton variant="ghost" fullWidth onClick={() => { exit(); analytics.leaderboardOpened(); goLeaderboard() }}>Leaderboard</NeonButton>
                <NeonButton variant="ghost" fullWidth onClick={() => { exit(); goHome() }}>Home</NeonButton>
              </div>
            </div>
          </div>,
          document.body,
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

      {/* Demo bottom row — the opt-out and the skip link, thematic siblings on
          one line (bottom third): "Don't show this again" centered, "skip demo"
          flush right (rides where the pause button lives in the real run). Shown
          the whole demo — intro, memorize, recall — up until the countdown;
          hidden once the end beat is up (that screen carries its own opt-out).
          The equal 1fr side tracks center the opt-out across the full row. */}
      {demo && !demoDone && (
        <div className="mt-3 w-full max-w-sm grid grid-cols-[1fr_auto_1fr] items-center">
          <span aria-hidden />
          <label className="flex items-center gap-2 cursor-pointer font-grotesk text-[11px] text-vt-dim whitespace-nowrap">
            <input
              type="checkbox"
              checked={hideDemo}
              onChange={e => setHideDemo(e.target.checked)}
              className="accent-[#28F0FF]"
            />
            Don't show this again
          </label>
          <button
            onClick={leaveDemo}
            className="justify-self-end font-grotesk text-[10px] uppercase tracking-[0.18em] text-vt-faint hover:text-vt-dim transition-colors"
          >
            skip demo ›
          </button>
        </div>
      )}

      {/* Pause — freeze the run (full width), available during memorize too:
          the overlay hides the board, the reveal driver freezes and re-blooms
          the interrupted gap on resume. Not in the demo (no clock to freeze —
          the skip link rides this spot instead). */}
      {(phase === 'selecting' || phase === 'reveal') && !demo && (
        <div className="mt-3 w-full max-w-sm">
          <button
            aria-label="Pause"
            disabled={cleared}
            onClick={() => pause()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border bg-vt-raised py-3 px-4
              border-vt-cyan/25 text-vt-cyan shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-vt-cyan hover:bg-vt-cyan/10 hover:shadow-vt-cyan
              transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
          >
            {/* Icon-only: the two-bar glyph is universal — the word was noise. */}
            <span className="flex gap-[4px]">
              <span className="block w-[5px] h-4 rounded-sm bg-current" />
              <span className="block w-[5px] h-4 rounded-sm bg-current" />
            </span>
          </button>
        </div>
      )}

      {/* Countdown pause skeleton: a non-interactive solid-black box with the
          EXACT dimensions of the real pause button (same wrapper, py-3 px-4,
          rounded-xl, grid-styled fill; an invisible two-bar glyph holds the
          height) so the play column height — and the ScaleToFit scale — matches
          reveal/selecting and the countdown → reveal transition doesn't jump. */}
      {phase === 'countdown' && (
        <div className="mt-3 w-full max-w-sm">
          <div
            aria-hidden
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#04040a] py-3 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_2px_6px_#000] pointer-events-none"
          >
            <span className="flex gap-[4px] invisible">
              <span className="block w-[5px] h-4 rounded-sm bg-current" />
              <span className="block w-[5px] h-4 rounded-sm bg-current" />
            </span>
          </div>
        </div>
      )}
        </div>
      </ScaleToFit>

      {/* Hard pause — covers the whole screen so no memorizing happens while
          frozen; resume picks the clock back up, exit bails to the landing page.
          The run's live stats ride along: a pause doubles as a scoreboard check. */}
      {paused && (
        <PauseOverlay onResume={() => resume()} onExit={() => { exit(); goHome() }}>
          <div className="flex items-end gap-10 pointer-events-none">
            <div>
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Score</div>
              <div className="mt-1 font-silk font-bold text-lg text-vt-cyan text-glow-vt-cyan leading-none tabular-nums">
                {score}
              </div>
            </div>
            <div>
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Lives</div>
              {/* Hearts sit in the same 18px line box as the neighboring text-lg
                  values — a bare div's default line-height would pad below the
                  hearts and push this column out of line. */}
              <div className="mt-1 flex h-[18px] items-center"><LivesCounter lives={lives} cap={STAGGER.START_LIVES} /></div>
            </div>
            <div>
              <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Streak</div>
              <div className="mt-1 font-silk font-bold text-lg text-vt-lime text-glow-vt-lime leading-none tabular-nums">
                {currentStreak}
              </div>
            </div>
          </div>
        </PauseOverlay>
      )}

      {/* Time → score "Lift": the leftover-time "+bonus" rises off the right end of
          the timer bar and dissolves into the score readout as the bar drains and
          the number climbs (fired from onPick on a cleared batch). */}
      {liftFlyer && (
        <motion.div
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
          animate={{
            x: liftFlyer.x1 - liftFlyer.x0,
            y: liftFlyer.y1 - liftFlyer.y0,
            opacity: [0, 1, 1, 0],
            scale: [0.6, 1.1, 1, 0.7],
          }}
          transition={{ duration: LIFT_MS / 1000, ease: [0.33, 1, 0.68, 1], times: [0, 0.18, 0.72, 1] }}
          onAnimationComplete={() => setLiftFlyer(null)}
          transformTemplate={(_, generated) => `translate(-50%, -50%) ${generated}`}
          className="fixed z-[60] pointer-events-none font-silk font-bold text-2xl whitespace-nowrap text-vt-lime text-glow-vt-lime tabular-nums"
          style={{ left: liftFlyer.x0, top: liftFlyer.y0, textShadow: FLOAT_TEXT_SHADOW }}
        >
          +{liftFlyer.value}
        </motion.div>
      )}
    </div>
  )
}

