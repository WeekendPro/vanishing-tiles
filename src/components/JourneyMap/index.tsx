import { useEffect, useRef } from 'react'
import { STATIONS, LINES, LINE_COLOR, CONNECTOR_COLOR, VIEWBOX, type DistrictSlug } from './layout'

export interface JourneyLevel {
  level_id: string
  display_number: number
  name: string
  my_pr: number | null
  my_stars: number
  cleared: boolean
  last_played: string | null
  global_best: number | null
}

export interface JourneyTheme {
  theme_id: string
  slug: string
  name: string
  mechanic: string
  sort_order: number
  locked: boolean
  levels: JourneyLevel[]
}

interface FlatStation extends JourneyLevel {
  slug: DistrictSlug
  locked: boolean
  x: number
  y: number
  interchange: boolean
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-[10px] tracking-tight" aria-hidden="true">
      {[0, 1, 2].map(i => (
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
  onSelect: (levelId: string) => void
}) {
  const nextRef = useRef<HTMLButtonElement | null>(null)

  const stations: FlatStation[] = themes.flatMap(theme =>
    theme.levels.map(lvl => {
      const coord = STATIONS[lvl.display_number]
      return {
        ...lvl,
        slug: theme.slug as DistrictSlug,
        locked: theme.locked,
        x: coord.x,
        y: coord.y,
        interchange: coord.interchange ?? false,
      }
    }),
  )

  // Next stop = lowest display_number uncleared station on an unlocked line.
  const next = stations
    .filter(s => !s.locked && !s.cleared)
    .sort((a, b) => a.display_number - b.display_number)[0]

  useEffect(() => {
    nextRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [next?.level_id])

  const slugToName = Object.fromEntries(themes.map(t => [t.slug, t.name]))

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
              <text
                x={line.label.x}
                y={line.label.y}
                fill={line.color}
                fontSize={9}
                fontWeight={700}
              >
                {slugToName[line.slug] ?? line.slug}
              </text>
            </g>
          )
        })}
      </svg>

      {stations.map(s => {
        const isNext = next?.level_id === s.level_id
        const state: 'locked' | 'cleared' | 'next' | 'ahead' = s.locked
          ? 'locked'
          : s.cleared
          ? 'cleared'
          : isNext
          ? 'next'
          : 'ahead'
        const color = LINE_COLOR[s.slug]
        const dotSize = s.interchange ? 18 : 16

        return (
          <button
            key={s.level_id}
            ref={isNext ? nextRef : undefined}
            type="button"
            disabled={s.locked}
            aria-current={isNext ? 'step' : undefined}
            onClick={() => onSelect(s.level_id)}
            className="absolute flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{
              left: `${(s.x / VIEWBOX.w) * 100}%`,
              top: `${(s.y / VIEWBOX.h) * 100}%`,
            }}
          >
            <span
              className={`block rounded-full border-[3px]${state === 'next' ? ' map-next bg-white' : ''}`}
              style={{
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                borderColor: color,
                opacity: state === 'locked' || state === 'ahead' ? 0.5 : 1,
                background: state === 'cleared' ? color : state === 'next' ? '#ffffff' : undefined,
              }}
            />
            <span className="flex flex-col items-start leading-tight whitespace-nowrap">
              <span
                className={`text-[11px] ${
                  state === 'next'
                    ? 'text-white font-bold'
                    : state === 'locked' || state === 'ahead'
                    ? 'text-gray-500'
                    : 'text-gray-200'
                }`}
              >
                {s.name}
                {s.interchange ? <span aria-hidden="true"> ⇄</span> : ''}
                {isNext ? <span aria-hidden="true"> ▶</span> : ''}
              </span>
              {s.cleared && <Stars n={s.my_stars} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
