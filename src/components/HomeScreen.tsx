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

          <div className="mt-14 w-full max-w-sm flex flex-col gap-3.5 font-display">
            {/* PLAY → Infinite Stagger */}
            <button
              onClick={play}
              className="relative flex items-center rounded-2xl py-5 pl-6 text-left text-lg font-bold frost-green
                transition-transform active:translate-y-px"
            >
              <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-neon-green" />
              <span className="text-glow-green">Play</span>
            </button>

            {/* Experimental Modes → slide to second pane */}
            <button
              onClick={() => setPane('experimental')}
              aria-label="Experimental Modes"
              className="relative rounded-2xl py-4 pl-6 pr-5 text-left font-semibold text-white/90 frost-cyan
                flex items-center justify-between transition-transform active:translate-y-px"
            >
              <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-neon-cyan" />
              <span>Experimental Modes</span>
              <span className="text-neon-cyan text-lg leading-none">›</span>
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

          <div className="mt-10 w-full max-w-sm flex flex-col gap-3 font-display">
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

/** A frosted, magenta-edged button used for each Experimental mode. */
function ModeButton({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-2xl py-4 pl-6 pr-5 text-left frost-magenta flex items-center justify-between
        transition-transform active:translate-y-px"
    >
      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-neon-magenta" />
      <span>
        <span className="block font-semibold text-white/90">{label}</span>
        <span className="block text-xs font-normal text-gray-500 mt-0.5">{hint}</span>
      </span>
      <span className="text-gray-600 text-lg leading-none">›</span>
    </button>
  )
}
