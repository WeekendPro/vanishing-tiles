/**
 * PuzzleEmblem — the bare shield crest (no card box, no footer star). Intrinsic
 * 124×132; the deck scales/positions it. The active puzzle shows a corner score
 * pill (notification-badge style): "78%" when played, "NEW" when not.
 */
import type { ComponentKey } from '../../lib/components'
import { PUZZLE_THEME } from './puzzleTheme'
import './level.css'

const SHIELD_PATH = 'M62 4 L116 23 V66 C116 99 95 120 62 130 C29 120 8 99 8 66 V23 Z'
const SHIELD_INNER = 'M62 13 L108 29 V66 C108 95 89 113 62 122 C35 113 16 95 16 66 V29 Z'

export interface PuzzleEmblemProps {
  component: ComponentKey
  label: string
  score: number
  /** Show the corner score pill (only the focused puzzle does). */
  showPill?: boolean
  /** "Coming soon" — dimmed, no pill. */
  soon?: boolean
}

export function PuzzleEmblem({ component, label, score, showPill, soon }: PuzzleEmblemProps) {
  const t = PUZZLE_THEME[component]
  const pill = showPill && !soon ? (score > 0 ? `${score}%` : 'NEW') : null

  return (
    <div
      className="relative"
      style={{ width: 124, height: 132, opacity: soon ? 0.5 : 1, filter: soon ? 'grayscale(.6)' : undefined }}
    >
      {/* Shield interior */}
      <div className="absolute inset-0" style={{ clipPath: `path('${SHIELD_PATH}')`, background: t.shieldBg }} />
      {/* Shield border + faint inner outline */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 124 132"
        preserveAspectRatio="none"
        style={{ filter: `drop-shadow(0 3px 5px rgba(0,0,0,0.5)) drop-shadow(0 0 6px ${t.accent}66)` }}
      >
        <path d={SHIELD_PATH} fill="none" stroke={t.accent} strokeWidth="3" />
        <path d={SHIELD_INNER} fill="none" stroke={t.accent} strokeWidth="1" opacity="0.45" />
      </svg>
      {/* Center glyph (raised for optical balance against the banner) */}
      <div className="absolute left-0 right-0 grid place-items-center" style={{ top: 27, height: 72 }}>
        {t.glyph}
      </div>
      {/* Banner with the puzzle title */}
      <svg
        viewBox="0 0 160 40"
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: 4, width: 142, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}
      >
        <path d="M4 7 L156 7 L147 22 L156 37 L4 37 L13 22 Z" fill={t.banner} stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" />
        <text
          x="80" y="23" textAnchor="middle" dominantBaseline="central" fill="#fff"
          fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight="900" fontSize="12.5" letterSpacing=".3"
        >
          {label.toUpperCase()}
        </text>
      </svg>
      {/* Corner score pill (active puzzle only) */}
      {pill && (
        <div
          className="emblem-pill absolute z-10 rounded-full"
          style={{
            top: 4, right: -4, padding: '2px 9px',
            background: score > 0 ? t.accent : '#0b1622',
            border: `2px solid ${score > 0 ? '#030712' : `${t.accent}88`}`,
            boxShadow: score > 0 ? `0 0 10px ${t.accent}cc` : undefined,
          }}
        >
          <span style={{ fontWeight: 900, fontSize: score > 0 ? 13 : 11, color: score > 0 ? '#04121a' : t.accent }}>
            {pill}
          </span>
        </div>
      )}
    </div>
  )
}
