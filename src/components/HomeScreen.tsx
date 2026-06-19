import { useState } from 'react'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { useStaggerStore } from '../store/staggerStore'
import { useSettingsStore, type MapStyle } from '../store/settingsStore'
import { useShallow } from 'zustand/shallow'
import { Wordmark, ScanlineOverlay } from './ui'

/**
 * The primary landing page shown right after sign-in. Two panes slide
 * horizontally: the Home pane leads with PLAY (straight into Infinite Stagger,
 * the heart of the game) plus a single "Experimental Modes" entry; tapping it
 * slides across to the Experimental pane (Training + the three Journey map
 * styles). Logout is intentionally absent here — it lives in the global menu.
 */
export function HomeScreen() {
  const [pane, setPane] = useState<'home' | 'experimental'>('home')

  const { goStagger, goJourney, goPractice } = useNavStore(useShallow(s => ({
    goStagger: s.goStagger,
    goJourney: s.goJourney,
    goPractice: s.goPractice,
  })))
  const startStagger = useStaggerStore(s => s.startRun)
  const { startPractice, resetGame } = useGameStore(useShallow(s => ({
    startPractice: s.startPractice,
    resetGame: s.resetGame,
  })))
  const setMapStyle = useSettingsStore(s => s.setMapStyle)

  const play = () => { startStagger(); goStagger() }
  const training = () => { startPractice(); goPractice() }
  const openMap = (style: MapStyle) => { setMapStyle(style); resetGame(); goJourney() }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-arcade-glow text-white arcade-scanlines">
      <ScanlineOverlay />

      <div
        className="flex w-[200%] min-h-dvh transition-transform duration-[340ms] ease-[cubic-bezier(.4,0,.2,1)]"
        style={{ transform: pane === 'experimental' ? 'translateX(-50%)' : 'translateX(0)' }}
      >
        {/* ── Home pane ── */}
        <section
          aria-hidden={pane !== 'home'}
          className="w-1/2 flex flex-col items-center px-6 pt-10 pb-8"
        >
          <div className="w-full max-w-sm">
            {/* GAP / CITY stacked, glowing */}
            <Wordmark size="lg" stacked className="text-3xl" />
            <p className="mt-3 font-display text-[10px] font-medium uppercase tracking-[0.18em] text-neon-magenta text-glow-magenta">
              A memory game
            </p>
          </div>

          <div className="mt-14 w-full max-w-sm flex flex-col gap-3.5">
            {/* PLAY → Infinite Stagger — same neon-outline recipe as NeonButton. */}
            <button
              onClick={play}
              className="font-pixel uppercase tracking-[0.08em] rounded-md border-2 bg-arcade-panel
                transition active:translate-y-px py-4 text-base flex items-center justify-center
                border-neon-green text-neon-green hover:bg-neon-green/10 hover:shadow-neon-green"
            >
              Play
            </button>

            {/* Experimental Modes → slide to second pane */}
            <button
              onClick={() => setPane('experimental')}
              aria-label="Experimental Modes"
              className="font-pixel uppercase tracking-[0.08em] rounded-md border-2 bg-arcade-panel
                transition active:translate-y-px py-4 px-5 text-sm flex items-center justify-between
                border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 hover:shadow-neon-cyan"
            >
              <span>Experimental Modes</span>
              <span className="text-lg leading-none">›</span>
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-gray-600 font-display">
            4 more ways to play, behind one tap
          </p>
        </section>

        {/* ── Experimental pane ── */}
        <section
          aria-hidden={pane !== 'experimental'}
          className="w-1/2 flex flex-col items-center px-6 pt-10 pb-8 bg-arcade-glow-magenta"
        >
          <div className="w-full max-w-sm">
            <button
              onClick={() => setPane('home')}
              className="flex items-center gap-1.5 text-neon-magenta font-display font-semibold text-sm mb-8
                transition-transform active:translate-y-px"
            >
              <span className="text-lg leading-none">‹</span> Back
            </button>
            <h2 className="font-pixel font-bold text-sm leading-none uppercase tracking-[0.08em] text-white text-glow-magenta">
              Experimental
            </h2>
            <p className="mt-3 font-display text-[10px] font-medium uppercase tracking-[0.28em] text-gray-500">
              Roads not yet taken
            </p>
          </div>

          <div className="mt-10 w-full max-w-sm flex flex-col gap-3">
            <ModeButton label="Training" hint="The classic gauntlet" onClick={training} />
            <ModeButton label="Subway Map" hint="Ride the transit lines" onClick={() => openMap('transit')} />
            <ModeButton label="Mind Map" hint="Light up the neurons" onClick={() => openMap('mentalBrain')} />
            <ModeButton label="Git Map" hint="Branch through the graph" onClick={() => openMap('git')} />
          </div>
        </section>
      </div>
    </div>
  )
}

/** A magenta neon-outline button (matching NeonButton) for each Experimental mode. */
function ModeButton({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-pixel uppercase tracking-[0.08em] rounded-md border-2 bg-arcade-panel
        transition active:translate-y-px py-3.5 px-5 text-sm text-left flex items-center justify-between
        border-neon-magenta text-neon-magenta hover:bg-neon-magenta/10 hover:shadow-neon-magenta"
    >
      <span>
        <span className="block">{label}</span>
        <span className="block normal-case tracking-normal text-[10px] text-neon-magenta/60 mt-0.5">{hint}</span>
      </span>
      <span className="text-lg leading-none">›</span>
    </button>
  )
}
