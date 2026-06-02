import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { CountdownPhase } from './CountdownPhase'
import { ViewingPhase } from './ViewingPhase'
import { SelectingPhase } from './SelectingPhase'
import { ResolutionPhase } from './ResolutionPhase'
import { ProgressBar } from './ProgressBar'
import { TrickleBar } from './TrickleBar'

function Hearts({ count, total }: { count: number; total: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }, (_, i) => i + 1).map(i =>
        i <= count ? (
          <span key={i} className="text-neon-red text-glow-red">♥</span>
        ) : (
          <span key={i} className="text-arcade-edge">♥</span>
        )
      )}
    </div>
  )
}

export function GameShell() {
  const { phase, paused, round, score, triesUsed, maxTries, phaseStartTime, phaseDuration, mode, levelDisplayNumber, submitting } =
    useGameStore(useShallow(s => ({
      phase: s.phase,
      paused: s.paused,
      round: s.round,
      score: s.score,
      triesUsed: s.triesUsed,
      maxTries: s.maxTries,
      phaseStartTime: s.phaseStartTime,
      phaseDuration: s.phaseDuration,
      mode: s.mode,
      levelDisplayNumber: s.levelDisplayNumber,
      submitting: s.submitting,
    })))

  const showTimer = (phase === 'viewing' || phase === 'selecting') && !paused
  // Countdown is a full-screen flourish (keep it centered). Every gameplay phase
  // anchors its content to the top so the grid sits high and — crucially — holds
  // the SAME vertical position across reveal → viewing → resolving (no shift when
  // the resolution UI appears).
  const centerContent = phase === 'countdown'

  return (
    <div className="min-h-dvh bg-arcade-bg text-white flex flex-col">
      <div className="sticky top-0 z-30 bg-arcade-bg flex items-center gap-4 px-4 py-3 border-b-2 border-arcade-edge">
        <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-neon-cyan">
          {mode === 'journey'
            ? <>LEVEL <strong className="text-white">{levelDisplayNumber}</strong></>
            : <>ROUND <strong className="text-white">{round}</strong></>}
        </span>
        <span className="font-pixel text-[10px] text-neon-yellow text-glow-yellow">{score.toLocaleString()}</span>
        <Hearts count={maxTries - triesUsed + 1} total={maxTries} />
        <span className="flex-1" />
        <span className="w-10" aria-hidden />
      </div>

      {/* Timer bar docked directly beneath the metadata bar. The 6px slot is
          reserved in EVERY phase so the grid below never shifts when the timer
          appears (viewing/selecting) or disappears (reveal/resolve). */}
      <div className="h-1.5">
        {submitting ? (
          <TrickleBar active height="h-1.5" className="rounded-none" />
        ) : showTimer ? (
          <ProgressBar
            startTime={phaseStartTime}
            duration={phaseDuration}
            color={phase === 'viewing' ? 'bg-cyan-400' : 'bg-green-400'}
            rounded="rounded-none"
          />
        ) : null}
      </div>

      <div className={`flex-1 flex justify-center px-4 pb-4 ${centerContent ? 'items-center pt-4' : 'items-start pt-8'}`}>
        {!paused && phase === 'countdown'  && <CountdownPhase />}
        {!paused && phase === 'viewing'    && <ViewingPhase />}
        {!paused && phase === 'selecting'  && <SelectingPhase />}
        {!paused && phase === 'resolving'  && <ResolutionPhase />}
      </div>
    </div>
  )
}
