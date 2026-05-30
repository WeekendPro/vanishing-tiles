import { useCallback, useEffect, useState } from 'react'
import { getLevel } from '../lib/api'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'

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
      setLevel((await getLevel(selectedLevelId)) as LevelDetail)
    } catch {
      setError(true)
    }
  }, [selectedLevelId])

  useEffect(() => { load() }, [load])

  const play = async () => {
    if (!level) return
    setBusy(true)
    await startJourneySession(level.level_id, level.my_pr ?? 0, level.display_number)
    enterPlaying()
  }

  return (
    <div className="min-h-dvh bg-gray-950/90 text-white flex items-end sm:items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-5">
        <div className="flex justify-between items-start mb-4">
          <button onClick={goJourney} className="text-gray-500 hover:text-gray-300 text-sm">← Back</button>
        </div>

        {error && (
          <div className="text-center py-6">
            <p className="text-gray-400 mb-4">Couldn’t load this level.</p>
            <button onClick={load} className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 font-bold">Retry</button>
          </div>
        )}

        {!error && !level && <p className="text-gray-500 text-center py-6">Loading…</p>}

        {level && (
          <>
            <div className="text-xs font-bold tracking-widest uppercase text-cyan-300 mb-1">{level.theme_name}</div>
            <h2 className="text-2xl font-bold mb-4">Level {level.display_number}</h2>
            <dl className="text-sm text-gray-300 space-y-1 mb-6">
              <div className="flex justify-between"><dt className="text-gray-500">My PR</dt><dd>{level.my_pr ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Global high</dt><dd>{level.global_high ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Last played</dt><dd>{level.last_played ?? 'never'}</dd></div>
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
