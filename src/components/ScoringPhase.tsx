import { useGameStore } from '../store/gameStore'
import { useShallow } from 'zustand/shallow'

export function ScoringPhase() {
  const { roundScore, score, resetGame } = useGameStore(useShallow(s => ({
    roundScore: s.roundScore,
    score: s.score,
    resetGame: s.resetGame,
  })))

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-lg font-bold text-white text-center">
        Game Over
      </h2>

      {roundScore && (
        <div className="flex flex-col gap-2">
          <ScoreRow label="✓ Correct selection" value={roundScore.correctness} color="text-green-400 bg-green-950" />
          <ScoreRow label="⚡ Speed bonus" value={roundScore.speedBonus} color="text-yellow-400 bg-yellow-950" />
          <ScoreRow label="◆ Efficiency bonus" value={roundScore.efficiencyBonus} color="text-cyan-400 bg-cyan-950" />
          <div className="border-t border-gray-700 pt-2 flex justify-between px-3">
            <span className="font-bold text-white">Round total</span>
            <span className="font-bold text-white">+{roundScore.total.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">Total Score</p>
        <p className="text-3xl font-bold text-yellow-400">{score.toLocaleString()}</p>
      </div>

      <button
        onClick={resetGame}
        className="w-full py-3 bg-red-900 border-2 border-red-500 text-red-300 rounded-xl font-bold"
      >
        Play Again
      </button>
    </div>
  )
}

function ScoreRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex justify-between items-center rounded-lg px-3 py-2 ${color}`}>
      <span className="text-sm">{label}</span>
      <span className="font-bold">+{value.toLocaleString()}</span>
    </div>
  )
}
