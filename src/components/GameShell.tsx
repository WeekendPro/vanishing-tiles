import { useGameStore } from '../store/gameStore'
import { useNavStore } from '../store/navStore'
import { useShallow } from 'zustand/shallow'
import { MAX_LIVES } from '@shared/core/scoring'
import { COMPONENT_LABEL } from '../lib/components'
import { BriefingPhase } from './BriefingPhase'
import { CountdownPhase } from './CountdownPhase'
import { ViewingPhase } from './ViewingPhase'
import { SelectingPhase } from './SelectingPhase'
import { ResolutionPhase } from './ResolutionPhase'
import { ProgressBar } from './ProgressBar'
import { ArcadeLoader } from './ArcadeLoader'

export function GameShell() {
  const { phase, paused, phaseStartTime, phaseDuration, mode, levelDisplayNumber, levelName, submitting, roundIndex, livesRemaining, activeComponent } =
    useGameStore(useShallow(s => ({
      phase: s.phase,
      paused: s.paused,
      phaseStartTime: s.phaseStartTime,
      phaseDuration: s.phaseDuration,
      mode: s.mode,
      levelDisplayNumber: s.levelDisplayNumber,
      levelName: s.levelName,
      submitting: s.submitting,
      roundIndex: s.roundIndex,
      livesRemaining: s.livesRemaining,
      activeComponent: s.activeComponent,
    })))
  const levelId = useGameStore(s => s.levelId)
  const openLevel = useNavStore(s => s.openLevel)

  // The briefing (instruction) page is a pre-game screen: it gets a back button
  // to the level hub instead of the in-game metadata bar + timer.
  const isBriefing = phase === 'briefing'

  const showTimer = (phase === 'viewing' || phase === 'selecting') && !paused
  // The lives row appears and disappears together with the timer bar.
  const showLives = showTimer
  // Countdown is a full-screen flourish (keep it centered). Every gameplay phase
  // anchors its content to the top so the grid sits high and — crucially — holds
  // the SAME vertical position across reveal → viewing → resolving (no shift when
  // the resolution UI appears).
  const centerContent = phase === 'countdown' || phase === 'briefing'

  return (
    <div className="min-h-dvh bg-arcade-bg text-white flex flex-col">
      {isBriefing ? (
        // Instruction page: a back button to the level hub (← level name).
        <div className="px-5 pt-5 pb-1">
          <button
            onClick={() => { if (levelId) openLevel(levelId) }}
            className="text-neon-cyan text-glow-cyan text-sm font-semibold hover:opacity-80"
          >
            ← {levelName ?? 'Back'}
          </button>
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-30 bg-arcade-bg flex items-center gap-4 px-4 h-[52px] border-b-2 border-arcade-edge">
            <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-neon-cyan">
              {mode === 'journey' ? (
                <>
                  <strong className="text-white">
                    {levelDisplayNumber != null && (
                      <span className="font-sans text-[12px] normal-case tracking-normal">{String(levelDisplayNumber).padStart(2, '0')}: </span>
                    )}
                    {levelName ?? `Level ${levelDisplayNumber ?? ''}`}
                  </strong>
                  {activeComponent && activeComponent !== 'main' && (
                    <>
                      <span className="text-arcade-edge px-2" aria-hidden>|</span>
                      <span>{COMPONENT_LABEL[activeComponent]}</span>
                    </>
                  )}
                </>
              ) : (
                <>ROUND <strong className="text-white">{roundIndex + 1} / 4</strong></>
              )}
            </span>
            <span className="flex-1" />
          </div>

          {/* Timer bar docked directly beneath the metadata bar. The 6px slot is
              reserved in EVERY non-briefing phase so the grid below never shifts when
              the timer appears (viewing/selecting) or disappears (reveal/resolve). */}
          <div className="h-1.5 mt-1.5">
            {showTimer ? (
              <ProgressBar
                startTime={phaseStartTime}
                duration={phaseDuration}
                color={phase === 'viewing' ? 'bg-cyan-400' : 'bg-green-400'}
                rounded="rounded-none"
              />
            ) : null}
          </div>
        </>
      )}

      {showLives && (
        <div data-testid="lives-row" className="flex justify-center gap-1 pt-2 text-sm">
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span key={i} className={i < livesRemaining ? 'text-neon-red text-glow-red' : 'text-arcade-edge'}>♥</span>
          ))}
        </div>
      )}

      <div className={`flex-1 flex justify-center px-4 pb-4 ${centerContent ? 'items-center pt-4' : 'items-start pt-8'}`}>
        {!paused && phase === 'briefing'   && <BriefingPhase />}
        {!paused && phase === 'countdown'  && <CountdownPhase />}
        {!paused && phase === 'viewing'    && <ViewingPhase />}
        {!paused && phase === 'selecting'  && <SelectingPhase />}
        {!paused && phase === 'resolving'  && <ResolutionPhase />}
      </div>
      <ArcadeLoader active={submitting} />
    </div>
  )
}
