import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { CountdownPhase } from './CountdownPhase'
import { ViewingPhase } from './ViewingPhase'
import { SelectingPhase } from './SelectingPhase'
import { ResolutionPhase } from './ResolutionPhase'
import { ProgressBar } from './ProgressBar'

function Hearts({ count, total }: { count: number; total: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }, (_, i) => i + 1).map(i => (
        <span key={i} className={i <= count ? 'text-red-500' : 'text-gray-700'}>♥</span>
      ))}
    </div>
  )
}

export function GameShell() {
  const { phase, round, score, triesUsed, maxTries, phaseStartTime, phaseDuration, mode, levelDisplayNumber } =
    useGameStore(useShallow(s => ({
      phase: s.phase,
      round: s.round,
      score: s.score,
      triesUsed: s.triesUsed,
      maxTries: s.maxTries,
      phaseStartTime: s.phaseStartTime,
      phaseDuration: s.phaseDuration,
      mode: s.mode,
      levelDisplayNumber: s.levelDisplayNumber,
    })))

  const showTimer = phase === 'viewing' || phase === 'selecting'
  // Countdown is a full-screen flourish (keep it centered). Every gameplay phase
  // anchors its content to the top so the grid sits high and — crucially — holds
  // the SAME vertical position across reveal → viewing → resolving (no shift when
  // the resolution UI appears).
  const centerContent = phase === 'countdown'

  return (
    <div className="min-h-dvh bg-gray-950 text-white flex flex-col">
      <div className="sticky top-0 z-30 bg-gray-950 flex justify-between items-center px-4 py-3 border-b border-gray-800">
        <span className="text-sm text-gray-400">
          {mode === 'journey'
            ? <>Level <strong className="text-white">{levelDisplayNumber}</strong></>
            : <>Round <strong className="text-white">{round}</strong></>}
        </span>
        <span className="text-sm text-yellow-400 font-bold">{score.toLocaleString()}</span>
        <Hearts count={maxTries - triesUsed + 1} total={maxTries} />
      </div>

      {/* Timer bar docked directly beneath the metadata bar. The 6px slot is
          reserved in EVERY phase so the grid below never shifts when the timer
          appears (viewing/selecting) or disappears (reveal/resolve). */}
      <div className="h-1.5">
        {showTimer && (
          <ProgressBar
            startTime={phaseStartTime}
            duration={phaseDuration}
            color={phase === 'viewing' ? 'bg-cyan-400' : 'bg-green-400'}
            rounded="rounded-none"
          />
        )}
      </div>

      <div className={`flex-1 flex justify-center px-4 pb-4 ${centerContent ? 'items-center pt-4' : 'items-start pt-8'}`}>
        {phase === 'countdown'      && <CountdownPhase />}
        {phase === 'viewing'        && <ViewingPhase />}
        {phase === 'selecting'      && <SelectingPhase />}
        {phase === 'resolving'      && <ResolutionPhase />}
      </div>
    </div>
  )
}
