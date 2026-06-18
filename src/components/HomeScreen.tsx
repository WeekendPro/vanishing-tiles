import { signOut } from '../lib/auth'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { useStaggerStore } from '../store/staggerStore'
import { useSettingsStore, type MapStyle } from '../store/settingsStore'
import { useShallow } from 'zustand/shallow'
import { NeonButton, Wordmark, ScanlineOverlay } from './ui'

/**
 * The primary landing page shown right after sign-in. PLAY drops straight into
 * the Infinite Stagger experience; the remaining buttons fan out to the other
 * modes (Training, plus the three Journey map styles). Logout sits at the bottom.
 */
export function HomeScreen() {
  const { goStagger, goJourney, goPractice, reset: resetNav } = useNavStore(useShallow(s => ({
    goStagger: s.goStagger,
    goJourney: s.goJourney,
    goPractice: s.goPractice,
    reset: s.reset,
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
  const logout = async () => { await signOut(); resetNav() }

  return (
    <div className="relative min-h-dvh bg-arcade-bg text-white flex flex-col items-center px-6 pt-10 pb-8 arcade-scanlines">
      <ScanlineOverlay />

      {/* Title — leaves the upper-right corner clear for the global menu. */}
      <div className="w-full max-w-sm">
        <Wordmark size="lg" />
        <p className="mt-2 font-pixel text-[9px] uppercase tracking-[0.25em] text-gray-500">
          Memory · Speed · Gaps
        </p>
      </div>

      {/* Mode menu */}
      <div className="mt-12 w-full max-w-sm flex flex-col gap-3">
        <NeonButton variant="go" size="lg" fullWidth onClick={play}>▶ Play</NeonButton>
        <NeonButton variant="primary" fullWidth onClick={training}>Training Mode</NeonButton>
        <NeonButton variant="primary" fullWidth onClick={() => openMap('transit')}>Subway Mode</NeonButton>
        <NeonButton variant="primary" fullWidth onClick={() => openMap('mentalBrain')}>Brain Mode</NeonButton>
        <NeonButton variant="primary" fullWidth onClick={() => openMap('git')}>Git Mode</NeonButton>
      </div>

      {/* Logout pinned to the bottom. */}
      <div className="mt-auto w-full max-w-sm pt-10">
        <NeonButton variant="danger" fullWidth onClick={logout}>Logout</NeonButton>
      </div>
    </div>
  )
}
