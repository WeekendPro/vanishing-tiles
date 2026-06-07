import { useEffect } from 'react'
import { useShallow } from 'zustand/shallow'
import { useGameStore } from '../store/gameStore'
import { useNavStore } from '../store/navStore'
import { livesBonus, levelStars } from '@shared/core/scoring'
import { NeonButton, ArcadePanel } from './ui'

/** Shared multi-round level summary: per-round totals, lives bonus, level total,
 *  and the star rating. Used by both the Practice and Journey results branches. */
function LevelSummary({
  title, stars, roundResults, livesRemaining, score, prBreak,
}: {
  title: string
  stars: number
  roundResults: number[]
  livesRemaining: number
  score: number
  prBreak?: boolean
}) {
  return (
    <>
      <div className="text-center mb-6">
        <div className="font-pixel text-xl uppercase tracking-[0.08em] text-neon-cyan text-glow-cyan mb-1">
          {title}
        </div>
        <div className="text-2xl">
          {[0, 1, 2].map(i => (
            <span key={i} className={i < stars ? 'text-neon-yellow text-glow-yellow' : 'text-arcade-edge'}>★</span>
          ))}
        </div>
        {prBreak && (
          <div className="font-pixel text-[10px] uppercase tracking-[0.08em] text-neon-yellow text-glow-yellow mt-2">
            🎉 New PR — {score.toLocaleString()}!
          </div>
        )}
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
          <span className="font-pixel text-neon-yellow text-glow-yellow tabular-nums">{score.toLocaleString()}</span>
        </div>
      </ArcadePanel>
    </>
  )
}

export function ResultsScreen() {
  const {
    mode, score, livesRemaining, roundResults, levelComplete,
    priorPr, journeyError, submitting, submitJourneyLevel,
    startPractice, startLevel, resetGame,
  } = useGameStore(useShallow(s => ({
    mode: s.mode,
    score: s.score,
    livesRemaining: s.livesRemaining,
    roundResults: s.roundResults,
    levelComplete: s.levelComplete,
    priorPr: s.priorPr,
    journeyError: s.journeyError,
    submitting: s.submitting,
    submitJourneyLevel: s.submitJourneyLevel,
    startPractice: s.startPractice,
    startLevel: s.startLevel,
    resetGame: s.resetGame,
  })))
  const { enterPlaying, backToMap, goPractice, goJourney } = useNavStore(useShallow(s => ({
    enterPlaying: s.enterPlaying,
    backToMap: s.backToMap,
    goPractice: s.goPractice,
    goJourney: s.goJourney,
  })))

  const stars = levelComplete ? levelStars(score) : 0

  // Journey: submit the ONE aggregate level result when the screen mounts.
  // Practice has nothing to submit.
  useEffect(() => {
    if (mode === 'journey') submitJourneyLevel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (mode === 'practice') {
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

  // ── Journey ──────────────────────────────────────────────────────────────
  const prBreak = levelComplete && score > priorPr
  const replayLevel = () => { startLevel(); enterPlaying() }
  const toMap = () => { backToMap() }

  return (
    <div className="min-h-dvh bg-arcade-bg text-white flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <LevelSummary
          title={levelComplete ? 'Level Complete!' : 'Game Over'}
          stars={stars} roundResults={roundResults}
          livesRemaining={livesRemaining} score={score} prBreak={prBreak}
        />

        {journeyError && (
          <div className="bg-arcade-panel border-2 border-neon-red rounded-md p-3 mb-4 text-xs text-neon-red flex items-center justify-between gap-3">
            <span>Couldn’t save: {journeyError}</span>
            <NeonButton variant="danger" size="sm" disabled={submitting} onClick={submitJourneyLevel} className="shrink-0">
              Retry
            </NeonButton>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <NeonButton fullWidth variant="primary" onClick={replayLevel}>Play Again ↺</NeonButton>
          <NeonButton fullWidth variant="ghost" onClick={toMap}>Back to Map</NeonButton>
        </div>
      </div>
    </div>
  )
}
