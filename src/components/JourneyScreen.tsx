import { useCallback, useEffect, useState } from 'react'
import { getJourney } from '../lib/api'
import { useNavStore } from '../store/navStore'
import { track } from '../store/asyncStatus'

interface JourneyLevel {
  level_id: string; display_number: number
  my_pr: number | null; my_stars: number; cleared: boolean
  last_played: string | null; global_best: number | null
}
interface JourneyTheme {
  theme_id: string; slug: string; name: string; mechanic: string
  sort_order: number; locked: boolean; levels: JourneyLevel[]
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-xs tracking-tight">
      {[0, 1, 2].map(i => (
        <span key={i} className={i < n ? 'text-yellow-400' : 'text-gray-700'}>★</span>
      ))}
    </span>
  )
}

export function JourneyScreen() {
  const openLevel = useNavStore(s => s.openLevel)
  const [themes, setThemes] = useState<JourneyTheme[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    setThemes(null)
    try {
      setThemes((await track(getJourney())) as JourneyTheme[])
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (error) {
    return (
      <div className="min-h-dvh bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Couldn’t load the journey.</p>
        <button onClick={load} className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 font-bold">Retry</button>
      </div>
    )
  }

  if (!themes) {
    return <div className="min-h-dvh bg-gray-950 text-gray-500 flex items-center justify-center">Loading…</div>
  }

  return (
    <div className="min-h-dvh bg-gray-950 text-white px-4 py-4">
      <div className="flex items-center justify-between mb-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold">Mind The Gap</h1>
      </div>

      <div className="max-w-md mx-auto flex flex-col gap-6">
        {themes.map(theme => (
          <section key={theme.theme_id}>
            <div className="text-xs font-bold tracking-widest uppercase mb-2 flex items-center gap-2">
              {theme.locked && <span>🔒</span>}
              <span className={theme.locked ? 'text-gray-500' : 'text-cyan-300'}>{theme.name}</span>
            </div>
            <div className={`grid grid-cols-3 gap-2 ${theme.locked ? 'opacity-50' : ''}`}>
              {theme.levels.map(lvl => (
                <button
                  key={lvl.level_id}
                  disabled={theme.locked}
                  onClick={() => openLevel(lvl.level_id)}
                  className="rounded-xl p-2 text-center border border-gray-700 bg-gray-900
                    enabled:hover:border-gray-500 disabled:cursor-not-allowed"
                >
                  <div className="font-bold text-sm">Level {lvl.display_number}</div>
                  <Stars n={lvl.my_stars} />
                  <div className="text-[10px] text-gray-500 mt-1">
                    {lvl.cleared && lvl.my_pr != null ? `PR ${lvl.my_pr}` : theme.locked ? '🔒' : '—'}
                  </div>
                  {lvl.cleared && <div className="text-green-400 text-[10px]">✓ cleared</div>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
