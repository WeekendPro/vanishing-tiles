import { useCallback, useEffect, useState } from 'react'
import { getJourney } from '../lib/api'
import { useNavStore } from '../store/navStore'
import { track } from '../store/asyncStatus'
import { Wordmark } from './ui/Wordmark'
import { TransitMap, type JourneyTheme } from './JourneyMap'

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
        <p className="text-gray-400">Couldn't load the journey.</p>
        <button onClick={load} className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 font-bold">Retry</button>
      </div>
    )
  }

  if (!themes) {
    return <div className="min-h-dvh bg-gray-950" />
  }

  return (
    <div className="min-h-dvh bg-arcade-bg text-white arcade-scanlines">
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
           style={{ background: 'linear-gradient(to bottom, #06080f, transparent)' }}>
        <Wordmark size="sm" />
      </div>
      <div className="px-4 pb-10">
        <TransitMap themes={themes} onSelect={openLevel} />
      </div>
    </div>
  )
}
