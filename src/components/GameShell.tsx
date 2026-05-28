import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'
import { ViewingPhase } from './ViewingPhase'
import { SelectingPhase } from './SelectingPhase'
import { ResolutionPhase } from './ResolutionPhase'

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
  const { phase, round, score, lives, startGame } = useGameStore(useShallow(s => ({
    phase: s.phase,
    round: s.round,
    score: s.score,
    lives: s.lives,
    startGame: s.startGame,
  })))

  if (phase === 'idle') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
        <span className="text-sm text-gray-400">Round <strong className="text-white">{round}</strong></span>
        <span className="text-sm text-yellow-400 font-bold">{score.toLocaleString()}</span>
        <Hearts count={lives} />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {phase === 'viewing'        && <ViewingPhase />}
        {phase === 'selecting'      && <SelectingPhase />}
        {phase === 'resolving'      && <ResolutionPhase />}
      </div>
    </div>
  )
}
