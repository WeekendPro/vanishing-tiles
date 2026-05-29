import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { CountdownPhase } from './CountdownPhase'
import { ViewingPhase } from './ViewingPhase'
import { SelectingPhase } from './SelectingPhase'
import { ResolutionPhase } from './ResolutionPhase'
import { ProgressBar } from './ProgressBar'

function Hearts({ count }: { count: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map(i => (
        <span key={i} className={i <= count ? 'text-red-500' : 'text-gray-700'}>♥</span>
      ))}
    </div>
  )
}

export function GameShell() {
  const { phase, round, score, lives, startGame, phaseStartTime, phaseDuration } = useGameStore(useShallow(s => ({
    phase: s.phase,
    round: s.round,
    score: s.score,
    lives: s.lives,
    startGame: s.startGame,
    phaseStartTime: s.phaseStartTime,
    phaseDuration: s.phaseDuration,
  })))

  if (phase === 'idle') {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Mind The Gap</h1>
          <p className="text-gray-400 mb-8">Memorize the gaps. Fill them fast.</p>
          <button
            onClick={startGame}
            className="px-8 py-4 bg-green-700 hover:bg-green-600 text-white rounded-2xl font-bold text-lg"
          >
            Start Game
          </button>
        </div>
      </div>
    )
  }

  const showTimer = phase === 'viewing' || phase === 'selecting'
  // Countdown is a full-screen flourish (keep it centered). Every gameplay phase
  // anchors its content to the top so the grid sits high and — crucially — holds
  // the SAME vertical position across reveal → viewing → resolving (no shift when
  // the resolution UI appears).
  const centerContent = phase === 'countdown'

  return (
    <div className="min-h-dvh bg-gray-950 text-white flex flex-col">
      <div className="sticky top-0 z-30 bg-gray-950 flex justify-between items-center px-4 py-3 border-b border-gray-800">
        <span className="text-sm text-gray-400">Round <strong className="text-white">{round}</strong></span>
        <span className="text-sm text-yellow-400 font-bold">{score.toLocaleString()}</span>
        <Hearts count={lives} />
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
