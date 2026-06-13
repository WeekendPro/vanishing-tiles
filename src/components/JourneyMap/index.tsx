import { useEffect, useRef } from 'react'
import { STATIONS, LINES, LINE_COLOR, CONNECTOR_COLOR, VIEWBOX, type DistrictSlug } from './layout'
import { LockIcon } from '../ui'
import type { JourneyLevel, JourneyTheme } from './types'

export type { JourneyLevel, JourneyTheme } from './types'

interface FlatStation extends JourneyLevel {
  slug: DistrictSlug
  x: number
  y: number
  interchange: boolean
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-[10px] tracking-tight" aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={i < n ? 'text-yellow-400' : 'text-gray-700'}>★</span>
      ))}
    </span>
  )
}

export function TransitMap({
  themes,
  onSelect,
}: {
  themes: JourneyTheme[]
  onSelect: (levelId: string, locked: boolean) => void
}) {
  const nextRef = useRef<HTMLButtonElement | null>(null)

  const stations: FlatStation[] = themes.flatMap(theme =>
    theme.levels.map(lvl => {
      const coord = STATIONS[lvl.display_number]
      return {
        ...lvl,
        slug: theme.slug as DistrictSlug,
        x: coord.x,
        y: coord.y,
        interchange: coord.interchange ?? false,
      }
    }),
  )

  // RPC guarantees at most one current station (the lowest uncleared display_number);
  // it's undefined in the all-clear state (every level cleared).
  const next = stations.find(s => s.current)

  useEffect(() => {
    nextRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [next?.level_id])

  return (
    <div className="relative w-full max-w-md mx-auto">
      <svg
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        className="w-full block"
        aria-hidden="true"
      >
        {LINES.map(line => {
          const lineCleared = stations
            .filter(s => s.slug === line.slug)
            .every(s => s.cleared)
          return (
            <g key={line.slug}>
              {line.connector && (
                <path
                  d={line.connector}
                  fill="none"
                  stroke={CONNECTOR_COLOR}
                  strokeWidth={3}
                  strokeDasharray="2 6"
                />
              )}
              <path
                d={line.path}
                fill="none"
                stroke={line.color}
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={lineCleared ? 1 : 0.85}
              />
            </g>
          )
        })}
      </svg>

      {stations.map(s => {
        const isNext = next?.level_id === s.level_id
        // Visual state trusts the RPC: a non-cleared, non-current level is always locked.
        const state: 'locked' | 'cleared' | 'next' = s.cleared
          ? 'cleared'
          : isNext
          ? 'next'
          : 'locked'
        const color = LINE_COLOR[s.slug]
        const dotSize = s.interchange ? 18 : 16
        // Locked stations show a lock inside a slightly larger circle so the glyph
        // stays legible while still reading as a station marker on the line.
        const markerSize = state === 'locked' ? dotSize + 8 : dotSize
        // Stations on the right half of the map put their label to the LEFT, so
        // labels grow toward the empty centre instead of off the right edge.
        const labelLeft = s.x > VIEWBOX.w / 2

        return (
          <button
            key={s.level_id}
            ref={isNext ? nextRef : undefined}
            type="button"
            // Locked stations stay tappable: the click opens the level detail,
            // which surfaces the locked state (display-only gating, no skipping).
            aria-current={isNext ? 'step' : undefined}
            aria-disabled={s.locked || undefined}
            onClick={() => onSelect(s.level_id, s.locked)}
            // The button is a dot-sized square centred on the line coordinate, so the
            // marker always sits exactly on the line. The label is absolutely
            // positioned to one side and doesn't shift the dot.
            className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{
              left: `${(s.x / VIEWBOX.w) * 100}%`,
              top: `${(s.y / VIEWBOX.h) * 100}%`,
              width: `${markerSize}px`,
              height: `${markerSize}px`,
            }}
          >
            {state === 'locked' ? (
              <span
                className="flex h-full w-full items-center justify-center rounded-full border-2"
                style={{ borderColor: color, background: '#0b0f1c', opacity: 0.85 }}
              >
                <LockIcon size={dotSize - 2} color="#cbd5e1" />
              </span>
            ) : (
              <span
                className={`block h-full w-full rounded-full border-[3px]${state === 'next' ? ' map-next bg-white' : ''}`}
                style={{
                  borderColor: color,
                  background: state === 'cleared' ? color : state === 'next' ? '#ffffff' : undefined,
                }}
              />
            )}
            <span
              className={`absolute top-1/2 -translate-y-1/2 flex flex-col leading-tight whitespace-nowrap ${
                labelLeft ? 'right-full mr-1.5 items-end' : 'left-full ml-1.5 items-start'
              }`}
            >
              <span
                className={`text-[11px] ${
                  state === 'next'
                    ? 'text-white font-bold'
                    : state === 'locked'
                    ? 'text-gray-500'
                    : 'text-gray-200'
                }`}
              >
                {s.name}
                {s.interchange ? <span aria-hidden="true"> ⇄</span> : ''}
                {isNext ? <span aria-hidden="true"> ▶</span> : ''}
              </span>
              {s.cleared && <Stars n={s.completedCount} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
