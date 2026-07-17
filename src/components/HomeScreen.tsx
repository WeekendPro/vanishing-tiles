import { useState } from 'react'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { useStaggerStore } from '../store/staggerStore'
import { useSettingsStore, type MapStyle, type Difficulty } from '../store/settingsStore'
import { useShallow } from 'zustand/shallow'
import { sfx } from '../lib/sfx'
import { Wordmark, ScanlineOverlay, VanishingMotif } from './ui'

/**
 * The primary landing page shown right after sign-in. One decision, one
 * action: the difficulty switch (Easy | Medium | Hard), then PLAY — pinned
 * to the bottom thumb arc under the centered wordmark. Logout is
 * intentionally absent here — it lives in the global menu, and Training
 * (the consequence-free naming drill) lives there too, so PLAY always means
 * an Infinite Stagger run.
 *
 * The "Experimental Modes" entry (Practice, the legacy gauntlet + the three
 * Journey map styles) is HIDDEN for now via `SHOW_EXPERIMENTAL`. The pane and
 * its machinery are kept intact behind the flag — not deleted — so we can
 * bring them back in one line.
 */
const SHOW_EXPERIMENTAL: boolean = false

/** The three difficulties on the segmented neon switch, along the heat arc
 *  (green → amber → red). Each carries a one-line description of its reveal
 *  visuals + recall ordering (shown under the switch for whichever segment is
 *  selected). The recall tray is always piece-colored, in every mode. */
const MODES: { value: Difficulty; label: string; hint: string; active: string }[] = [
  {
    value: 'easy',
    label: 'Easy',
    hint: 'Full color. Recall in any order.',
    active: 'bg-neon-green text-arcade-bg shadow-[inset_0_0_14px_rgba(57,217,138,0.5),0_0_12px_rgba(57,217,138,0.35)]',
  },
  {
    value: 'medium',
    label: 'Medium',
    hint: 'Monochrome reveal. Recall in any order.',
    active: 'bg-neon-yellow text-arcade-bg shadow-[inset_0_0_14px_rgba(250,204,21,0.5),0_0_12px_rgba(250,204,21,0.35)]',
  },
  {
    value: 'hard',
    label: 'Hard',
    hint: 'Monochrome reveal. Recall in the order shown.',
    active: 'bg-neon-red text-arcade-bg shadow-[inset_0_0_14px_rgba(255,77,77,0.5),0_0_12px_rgba(255,77,77,0.35)]',
  },
]

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
  const { setMapStyle, difficulty, setDifficulty } = useSettingsStore(useShallow(s => ({
    setMapStyle: s.setMapStyle,
    difficulty: s.settings.difficulty,
    setDifficulty: s.setDifficulty,
  })))

  // The single CTA: PLAY starts an Infinite Stagger run at the persisted
  // difficulty. (Training launches from the global menu, not from here.)
  const play = () => {
    // The PLAY tap is the audio UNLOCK gesture: browsers won't start sound
    // without one, and the run's first sounds (countdown, blooms) fire from
    // timers — so the context must already be running by then.
    sfx.unlock()
    sfx.uiTap()
    startStagger(difficulty)
    goStagger()
  }
  const practice = () => { startPractice(); goPractice() }
  const openMap = (style: MapStyle) => { setMapStyle(style); resetGame(); goJourney() }

  const selectMode = (value: Difficulty) => {
    sfx.unlock()
    sfx.uiTap()
    setDifficulty(value)
  }
  const activeHint = MODES.find(m => m.value === difficulty)?.hint

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
          className="w-1/2 min-h-dvh flex flex-col items-center px-6 pt-10 pb-10"
        >
          {/* Wordmark grows to fill the gap, pushing PLAY into the thumb arc. */}
          <div className="flex-1 w-full max-w-sm flex flex-col justify-center">
            {/* Brand motif: gap shapes bloom, then vanish — the name in motion. */}
            <VanishingMotif className="mb-5" />
            {/* VANISHING / TILES stacked, glowing */}
            <Wordmark size="lg" stacked className="text-3xl" />
            <p className="mt-3 font-display text-[10px] font-medium uppercase tracking-[0.18em] text-neon-magenta text-glow-magenta">
              A memory game
            </p>
          </div>

          {/* Bottom-pinned cluster: mode switch + PLAY. */}
          <div className="w-full max-w-sm flex flex-col gap-4">
            {/* Mode — segmented neon switch (Easy / Medium / Hard). */}
            <div>
              <p className="text-center font-display text-[10px] font-medium uppercase tracking-[0.22em] text-gray-500 mb-2">
                Mode
              </p>
              <div className="flex rounded-md border-2 border-arcade-edge bg-arcade-panel overflow-hidden">
                {MODES.map(m => {
                  const active = m.value === difficulty
                  return (
                    <button
                      key={m.value}
                      onClick={() => selectMode(m.value)}
                      aria-pressed={active}
                      className={`flex-1 py-3 px-0.5 font-pixel uppercase text-xs tracking-[0.08em] whitespace-nowrap transition
                        border-r border-arcade-edge last:border-r-0
                        ${active ? m.active : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {m.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-center text-[11px] text-gray-500 font-display min-h-[16px]">
                {activeHint}
              </p>
            </div>

            {/* PLAY → an Infinite Stagger run at the selected difficulty. */}
            <button
              onClick={play}
              className="font-pixel uppercase tracking-[0.08em] rounded-md border-2 bg-arcade-panel
                transition active:translate-y-px py-4 text-base flex items-center justify-center
                border-neon-green text-neon-green hover:bg-neon-green/10 hover:shadow-neon-green"
            >
              Play
            </button>

            {/* Experimental Modes → slide to second pane (hidden for now). */}
            {SHOW_EXPERIMENTAL && (
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
            )}
          </div>
        </section>

        {/* ── Experimental pane (hidden behind SHOW_EXPERIMENTAL) ── */}
        {SHOW_EXPERIMENTAL && (
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
              <ModeButton label="Practice" hint="The classic gauntlet" onClick={practice} />
              <ModeButton label="Subway Map" hint="Ride the transit lines" onClick={() => openMap('transit')} />
              <ModeButton label="Mind Map" hint="Light up the neurons" onClick={() => openMap('mentalBrain')} />
              <ModeButton label="Git Map" hint="Branch through the graph" onClick={() => openMap('git')} />
            </div>
          </section>
        )}
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
