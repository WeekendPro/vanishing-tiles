import { useCallback, useEffect, useState } from 'react'
import { getJourney } from '../lib/api'
import { useNavStore } from '../store/navStore'
import { track } from '../store/asyncStatus'
import { Wordmark } from './ui/Wordmark'
import { LockIcon } from './ui'
import { TransitMap, type JourneyTheme } from './JourneyMap'

function LegendItem({ variant, label }: { variant: 'complete' | 'current' | 'locked'; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {variant === 'locked' ? (
        <LockIcon size={13} color="#cbd5e1" />
      ) : (
        <span
          aria-hidden="true"
          className={`block h-3 w-3 rounded-full border-2${variant === 'current' ? ' map-next' : ''}`}
          style={{
            borderColor: '#e5e7eb',
            background: variant === 'complete' ? '#e5e7eb' : '#ffffff',
          }}
        />
      )}
      <span className="text-[11px] text-gray-300">{label}</span>
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
      <div className="sticky top-0 z-20 flex h-[52px] items-center justify-between px-4"
           style={{ background: 'linear-gradient(to bottom, #06080f, transparent)' }}>
        <Wordmark size="sm" className="relative top-[2px]" />
        {themes.length > 0 && themes.every(t => t.levels.every(l => l.cleared)) && (
          <span className="text-[11px] font-bold tracking-wide text-emerald-400">
            Gap City cleared
          </span>
        )}
      </div>
      <div className="px-4 pb-10">
        <TransitMap themes={themes} onSelect={openLevel} />
      </div>
      <div
        className="sticky bottom-0 z-20 flex justify-center px-4 pb-3 pt-6"
        style={{ background: 'linear-gradient(to top, #06080f 70%, transparent)' }}
      >
        <div className="flex items-center justify-center gap-5 rounded-full border-2 border-arcade-edge bg-arcade-panel px-5 py-2 shadow-panel-inset">
          <LegendItem variant="complete" label="Complete" />
          <LegendItem variant="current" label="Current" />
          <LegendItem variant="locked" label="Locked" />
        </div>
      </div>
    </div>
  )
}
