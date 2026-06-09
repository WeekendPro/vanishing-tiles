/**
 * RibbonBadge — the double-ring emblem + overlapping swallowtail ribbon badge.
 * Ported from mockups/level-screen.html (v5 design).
 */
import type { ReactNode } from 'react'

export interface RibbonBadgeProps {
  /** Center content (a glyph component or node) */
  glyph: ReactNode
  /** CSS background string for the center disc */
  centerBg: string
  /** Ribbon label — rendered uppercase */
  title: string
  state: 'locked' | 'incomplete' | 'complete' | 'soon'
  /** Score shown inside the gold star when complete */
  score?: number
  /** Ribbon main color (default crimson #c81e3a) */
  ribbonColor?: string
  /** Ribbon fold/tab color (default dark crimson #7f1226) */
  foldColor?: string
  /** Card border/glow accent: green = neon-green glow; default = cyan glow when vibrant */
  cardAccent?: 'cyan' | 'green'
  /** Force vibrant state regardless of completion (e.g. PLAY badge) */
  vibrant?: boolean
  disabled?: boolean
  onClick?: () => void
  'data-testid'?: string
}

/** Star clip-path (matches mockup .star-fill) */
const STAR_CLIP =
  'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)'

/** Ring border color (light cyan per spec) */
const RING_COLOR = '#a5f3fc'

function FooterContent({ state, score }: { state: RibbonBadgeProps['state']; score?: number }) {
  if (state === 'locked') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    )
  }
  if (state === 'incomplete') {
    return (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#a1a1aa"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        <path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.8 5.5 21 7.5 13.5 2 9h7z" />
      </svg>
    )
  }
  if (state === 'complete') {
    return (
      <div className="relative w-9 h-9">
        <div
          className="absolute inset-0"
          style={{
            clipPath: STAR_CLIP,
            background: 'linear-gradient(160deg,#fde047,#f59e0b)',
            filter: 'drop-shadow(0 0 6px rgba(250,204,21,.8))',
          }}
        />
        <span className="absolute inset-0 grid place-items-center text-[11px] font-black text-amber-950">
          {score}
        </span>
      </div>
    )
  }
  // soon
  return <span className="text-[8px] font-pixel tracking-wider text-zinc-500">SOON</span>
}

export function RibbonBadge({
  glyph,
  centerBg,
  title,
  state,
  score,
  ribbonColor = '#c81e3a',
  foldColor = '#7f1226',
  cardAccent = 'cyan',
  vibrant: vibrantProp,
  disabled,
  onClick,
  'data-testid': testId,
}: RibbonBadgeProps) {
  const vibrant = vibrantProp || state === 'complete'
  const dull = vibrant ? '' : 'opacity-50 grayscale-[.5]'

  let cardBorderClass: string
  if (cardAccent === 'green') {
    cardBorderClass = 'border-neon-green shadow-[0_0_14px_rgba(57,217,138,.4)]'
  } else if (vibrant) {
    cardBorderClass = 'border-[#a5f3fc] shadow-[0_0_12px_rgba(34,211,238,.35)]'
  } else {
    cardBorderClass = 'border-arcade-edge'
  }

  return (
    <button
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`relative rounded-xl border-2 ${cardBorderClass} bg-arcade-panel shadow-panel-inset px-3 pt-4 pb-3 flex flex-col items-center w-full transition`}
    >
      {/* Emblem + ribbon wrapper */}
      <div className={`relative ${dull}`} style={{ paddingBottom: '40px' }}>
        {/* Double-ring SVG — light cyan rings with soft glow */}
        <div className="relative shrink-0" style={{ width: '104px', height: '104px' }}>
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 120 120"
            style={{ filter: `drop-shadow(0 0 4px ${RING_COLOR}66)` }}
          >
            <circle cx="60" cy="60" r="57" fill="none" stroke={RING_COLOR} strokeWidth="2.5" />
            <circle cx="60" cy="60" r="49" fill="none" stroke={RING_COLOR} strokeWidth="6" />
          </svg>
          {/* Center disc */}
          <div
            className="absolute rounded-full overflow-hidden grid place-items-center"
            style={{ inset: '13px', background: centerBg }}
          >
            {glyph}
          </div>
        </div>

        {/* Swallowtail ribbon — overlaps the lower portion of the circle */}
        {/* width:150%, left:-25% so the swallowtail tails extend past the circle edges */}
        <svg
          viewBox="0 0 200 78"
          className="absolute"
          style={{ width: '150%', left: '-25%', top: '42%' }}
        >
          {/* Left fold tab */}
          <path d="M46 6 L78 6 L70 30 L42 25 Z" fill={foldColor} />
          {/* Right fold tab */}
          <path d="M154 6 L122 6 L130 30 L158 25 Z" fill={foldColor} />
          {/* Main ribbon body with swallowtail cutouts */}
          <path
            d="M6 18 Q100 28 194 18 L176 34 L194 50 Q100 60 6 50 L24 34 Z"
            fill={ribbonColor}
            stroke="rgba(255,255,255,.30)"
            strokeWidth="1.5"
          />
          {/* Title in normal bold sans — not pixel font */}
          <text
            x="100"
            y="40"
            textAnchor="middle"
            fill="white"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="800"
            fontSize="15"
            letterSpacing=".5"
          >
            {title.toUpperCase()}
          </text>
        </svg>
      </div>

      {/* Footer: lock / hollow star / gold star with score / SOON */}
      <div className="h-9 grid place-items-center mt-1">
        <FooterContent state={state} score={score} />
      </div>
    </button>
  )
}
