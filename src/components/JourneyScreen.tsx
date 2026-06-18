import { useCallback, useEffect, useMemo, useState } from 'react'
import { getJourney } from '../lib/api'
import { useNavStore } from '../store/navStore'
import { useProgressStore } from '../store/progressStore'
import { applyClientProgress } from '../lib/journeyProgress'
import { track } from '../store/asyncStatus'
import { Wordmark } from './ui/Wordmark'
import { LockIcon } from './ui'
import { TransitMap } from './JourneyMap'
import type { JourneyTheme } from './JourneyMap/types'
import { MentalMapBrain } from './JourneyMap/MentalMapBrain'
import { GitMap } from './JourneyMap/GitMap'
import { useSettingsStore } from '../store/settingsStore'

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
  const setLevelOrder = useNavStore(s => s.setLevelOrder)
  const mapStyle = useSettingsStore(s => s.settings.mapStyle)
  // Completion lives in client progress (localStorage), not the server, so we
  // re-derive the map's cleared/current/locked from it (see applyClientProgress).
  const progress = useProgressStore(s => s.byLevel)
  const [rawThemes, setRawThemes] = useState<JourneyTheme[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    setRawThemes(null)
    try {
      const data = (await track(getJourney())) as JourneyTheme[]
      setRawThemes(data)
      setLevelOrder(data.flatMap(t => (t.levels ?? []).map(l => l.level_id)))
    } catch {
      setError(true)
    }
  }, [setLevelOrder])

  useEffect(() => { load() }, [load])

  const themes = useMemo(
    () => (rawThemes ? applyClientProgress(rawThemes, progress) : null),
    [rawThemes, progress],
  )

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
            Journey cleared
          </span>
        )}
      </div>
      <div className="px-4 pb-10">
        {mapStyle === 'git' ? (
          <GitMap />
        ) : mapStyle === 'mentalBrain' ? (
          <MentalMapBrain themes={themes} onSelect={openLevel} />
        ) : (
          <TransitMap themes={themes} onSelect={openLevel} />
        )}
      </div>
      {mapStyle !== 'git' && (
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
      )}
    </div>
  )
}
