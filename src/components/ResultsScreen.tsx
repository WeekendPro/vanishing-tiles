import { useShallow } from 'zustand/shallow'
import { useGameStore } from '../store/gameStore'
import { useNavStore } from '../store/navStore'
import { livesBonus, levelStars } from '@shared/core/scoring'
import { NeonButton, ArcadePanel } from './ui'

/** Shared multi-round level summary: per-round totals, lives bonus, level total,
 *  and the star rating. Used by the Practice results screen. */
function LevelSummary({
  title, stars, roundResults, livesRemaining, score,
}: {
  title: string
  stars: number
  roundResults: number[]
  livesRemaining: number
  score: number
}) {
  return (
    <>
      <div className="text-center mb-6">
        <div className="font-pixel font-bold text-xl uppercase tracking-[0.08em] text-neon-cyan text-glow-cyan mb-1">
          {title}
        </div>
        <div className="text-2xl">
          {[0, 1, 2].map(i => (
            <span key={i} className={i < stars ? 'text-neon-yellow text-glow-yellow' : 'text-arcade-edge'}>★</span>
          ))}
        </div>
      </div>

      <ArcadePanel className="p-4 mb-6">
        {roundResults.map((total, i) => (
          <div key={i} className="flex justify-between items-baseline mb-2 last:mb-0">
            <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-neon-cyan">Round {i + 1}</span>
            <span className="font-pixel text-[11px] tabular-nums text-white">{total.toLocaleString()}</span>
          </div>
        ))}
        <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-arcade-edge">
          <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-neon-red">♥ Lives Bonus</span>
          <span className="font-pixel text-[11px] tabular-nums text-neon-red">{livesBonus(livesRemaining).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm font-bold pt-2 border-t border-arcade-edge mt-2">
          <span className="font-pixel text-[10px] uppercase tracking-[0.1em]">Level Total</span>
          <span className="font-pixel font-bold text-neon-yellow text-glow-yellow tabular-nums">{score.toLocaleString()}</span>
        </div>
      </ArcadePanel>
    </>
  )
}

export function ResultsScreen() {
  const {
    score, livesRemaining, roundResults, levelComplete,
    startPractice, resetGame,
  } = useGameStore(useShallow(s => ({
    score: s.score,
    livesRemaining: s.livesRemaining,
    roundResults: s.roundResults,
    levelComplete: s.levelComplete,
    startPractice: s.startPractice,
    resetGame: s.resetGame,
  })))
  const { goPractice, goJourney } = useNavStore(useShallow(s => ({
    goPractice: s.goPractice,
    goJourney: s.goJourney,
  })))

  const stars = levelComplete ? levelStars(score) : 0
  const playAgain = () => { startPractice(); goPractice() }
  const backToMenu = () => { resetGame(); goJourney() }

  return (
    <div className="min-h-dvh bg-arcade-bg text-white flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <LevelSummary
          title={levelComplete ? 'Level Complete!' : 'Game Over'}
          stars={stars} roundResults={roundResults}
          livesRemaining={livesRemaining} score={score}
        />
        <div className="flex flex-col gap-3">
          <NeonButton fullWidth variant="primary" onClick={playAgain}>Play Again ↺</NeonButton>
          <NeonButton fullWidth variant="ghost" onClick={backToMenu}>Back to Menu</NeonButton>
        </div>
      </div>
    </div>
  )
}
