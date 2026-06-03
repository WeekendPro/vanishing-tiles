import { useCallback, useEffect, useState } from 'react'
import { getLevel } from '../lib/api'
import { relativeTime } from '../lib/relativeTime'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { track } from '../store/asyncStatus'
import { NeonButton, ScanlineOverlay } from './ui'

interface LevelDetail {
  level_id: string; display_number: number; name: string; theme_name: string
  view_duration_ms: number; select_duration_ms: number
  gap_count: number; shape_complexity: string; adjacency: string
  my_pr: number | null; my_stars: number; global_high: number | null; last_played: string | null
}

export function LevelDetailScreen() {
  const selectedLevelId = useNavStore(s => s.selectedLevelId)
  const locked = useNavStore(s => s.selectedLevelLocked)
  const goJourney = useNavStore(s => s.goJourney)
  const enterPlaying = useNavStore(s => s.enterPlaying)
  const startJourneySession = useGameStore(s => s.startJourneySession)
  const [level, setLevel] = useState<LevelDetail | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!selectedLevelId) return
    setError(false); setLevel(null)
    try {
      setLevel((await track(getLevel(selectedLevelId))) as LevelDetail)
    } catch {
      setError(true)
    }
  }, [selectedLevelId])

  useEffect(() => { load() }, [load])

  const play = async () => {
    if (!level) return
    setBusy(true)
    try {
      await track(startJourneySession(level.level_id, level.my_pr ?? 0, level.display_number, level.name))
      enterPlaying()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={goJourney}
      className="fixed inset-0 z-50 overflow-y-auto bg-arcade-bg/90 text-white flex items-center justify-center px-4 py-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-sm bg-arcade-panel border-2 border-arcade-edge shadow-panel-inset rounded-md p-5"
      >
        <ScanlineOverlay />
        <button onClick={goJourney} aria-label="Close"
          className="absolute top-5 right-5 text-arcade-edge hover:text-neon-cyan text-xl leading-none p-1 -m-1">✕</button>

        {error && (
          <div className="text-center py-6">
            <p className="text-gray-400 mb-4">Couldn’t load this level.</p>
            <NeonButton variant="primary" size="sm" onClick={load}>Retry</NeonButton>
          </div>
        )}

        {/* While loading, the card stays empty; the global arcade overlay covers it. */}
        {!error && !level && <div className="py-6" />}

        {level && (
          <>
            <div className="font-pixel text-[9px] uppercase tracking-[0.15em] text-neon-magenta text-glow-magenta mb-1 pr-8">{level.theme_name}</div>
            <h2 className="font-pixel text-lg uppercase tracking-[0.08em] text-neon-cyan text-glow-cyan mb-4 pr-8">{level.name}</h2>
            <dl className="text-sm text-gray-300 space-y-1 mb-6">
              <div className="flex justify-between"><dt className="text-gray-500">Level</dt><dd>{level.display_number}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Your Best</dt><dd>{level.my_pr ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Global Best</dt><dd>{level.global_high ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Last played</dt><dd>{relativeTime(level.last_played)}</dd></div>
            </dl>
            {locked ? (
              <div className="text-center">
                <p className="font-pixel text-[9px] uppercase tracking-[0.12em] text-neon-magenta text-glow-magenta mb-2">
                  🔒 Locked
                </p>
                <p className="text-xs text-gray-400 mb-4">
                  Clear the current station to unlock this level.
                </p>
                <NeonButton fullWidth variant="ghost" disabled>Locked</NeonButton>
              </div>
            ) : (
              <NeonButton fullWidth variant="go" disabled={busy} onClick={play}>PLAY</NeonButton>
            )}
          </>
        )}
      </div>
    </div>
  )
}
