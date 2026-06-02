import { useCallback, useEffect, useState } from 'react'
import { getLevel } from '../lib/api'
import { relativeTime } from '../lib/relativeTime'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { track } from '../store/asyncStatus'

interface LevelDetail {
  level_id: string; display_number: number; theme_name: string
  view_duration_ms: number; select_duration_ms: number
  gap_count: number; shape_complexity: string; adjacency: string
  my_pr: number | null; my_stars: number; global_high: number | null; last_played: string | null
}

export function LevelDetailScreen() {
  const selectedLevelId = useNavStore(s => s.selectedLevelId)
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
      await track(startJourneySession(level.level_id, level.my_pr ?? 0, level.display_number))
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
      className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/90 text-white flex items-center justify-center px-4 py-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-5"
      >
        <button onClick={goJourney} aria-label="Close"
          className="absolute top-5 right-5 text-gray-500 hover:text-gray-300 text-xl leading-none p-1 -m-1">✕</button>

        {error && (
          <div className="text-center py-6">
            <p className="text-gray-400 mb-4">Couldn’t load this level.</p>
            <button onClick={load} className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 font-bold">Retry</button>
          </div>
        )}

        {/* While loading, the card stays empty; the global arcade overlay covers it. */}
        {!error && !level && <div className="py-6" />}

        {level && (
          <>
            <div className="text-xs font-bold tracking-widest uppercase text-cyan-300 mb-1 pr-8">{level.theme_name}</div>
            <h2 className="text-2xl font-bold mb-4 pr-8">Level {level.display_number}</h2>
            <dl className="text-sm text-gray-300 space-y-1 mb-6">
              <div className="flex justify-between"><dt className="text-gray-500">Your Best</dt><dd>{level.my_pr ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Global Best</dt><dd>{level.global_high ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Last played</dt><dd>{relativeTime(level.last_played)}</dd></div>
            </dl>
            <button disabled={busy} onClick={play}
              className="w-full py-3 rounded-xl font-bold bg-green-700 hover:bg-green-600 disabled:opacity-50">
              PLAY
            </button>
          </>
        )}
      </div>
    </div>
  )
}
