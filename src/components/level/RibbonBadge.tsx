/**
 * RibbonBadge — hexagon emblem + glyph + pixel title (the "hex tile" design).
 * Ported from mockups/badge-concepts.html (concept 2).
 */
import type { ReactNode } from 'react'

export interface RibbonBadgeProps {
  /** Center content (a glyph component or node) */
  glyph: ReactNode
  /** CSS background string for the hex interior */
  centerBg: string
  /** Badge label — rendered uppercase */
  title: string
  state: 'locked' | 'incomplete' | 'complete' | 'soon'
  /** Score shown inside the gold star when complete */
  score?: number
  /** Accent: green = The Classic; cyan = the badges (hex border + title + card glow) */
  cardAccent?: 'cyan' | 'green'
  /** Force vibrant state regardless of completion (e.g. PLAY badge) */
  vibrant?: boolean
  /** Optional caption rendered below the footer (e.g. the level name on the PLAY badge) */
  caption?: string
  disabled?: boolean
  onClick?: () => void
  'data-testid'?: string
}

/** Star clip-path (matches mockup .star-fill) */
const STAR_CLIP =
  'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)'

/** Star outline polygon (same proportions as STAR_CLIP, in a 0..100 box) */
const STAR_POINTS = '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35'

/** A gold star that fills from the bottom in proportion to the score (0–100). */
function ScoreStar({ score = 0 }: { score?: number }) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div className="relative w-[46px] h-[46px]">
      {/* Fill area, clipped to the star shape: faint track + gold fill rising from the bottom */}
      <div className="absolute inset-0" style={{ clipPath: STAR_CLIP }}>
        <div className="absolute inset-0" style={{ background: 'rgba(250,204,21,0.18)' }} />
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${pct}%`, background: 'linear-gradient(0deg,#f59e0b,#fde047)' }}
        />
      </div>
      {/* Crisp star outline (overflow visible so the stroke isn't clipped) */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        style={{ overflow: 'visible', filter: 'drop-shadow(0 0 5px rgba(250,204,21,.55))' }}
      >
        <polygon points={STAR_POINTS} fill="none" stroke="#fbbf24" strokeWidth="5" strokeLinejoin="round" />
      </svg>
      {/* Score, readable over both the gold fill and the faint track */}
      <span
        className="absolute inset-0 grid place-items-center text-[11px] font-black text-white"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,.85), 0 0 2px rgba(0,0,0,.7)' }}
      >
        {score}
      </span>
    </div>
  )
}

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
    return <ScoreStar score={score} />
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
  cardAccent = 'cyan',
  vibrant: vibrantProp,
  caption,
  disabled,
  onClick,
  'data-testid': testId,
}: RibbonBadgeProps) {
  // Hex/title accent: green marks The Classic, cyan marks the badges.
  const accent = cardAccent === 'green' ? '#39d98a' : '#22d3ee'
  const vibrant = vibrantProp || state === 'complete'
  // Dim ONLY when the puzzle isn't available yet (locked, or "coming soon").
  // Unlocked puzzles — incomplete or complete — render at full color.
  const dull = state === 'locked' || state === 'soon' ? 'opacity-50 grayscale-[.5]' : ''

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
      {/* Hexagon emblem + pixel title */}
      <div className={`relative flex flex-col items-center ${dull}`}>
        <div className="relative shrink-0" style={{ width: '110px', height: '120px' }}>
          {/* Hex interior (glyph background), clipped to the hexagon */}
          <div
            className="absolute inset-0"
            style={{
              clipPath: 'polygon(50% 3%, 95.8% 26.6%, 95.8% 73.4%, 50% 96.9%, 4.2% 73.4%, 4.2% 26.6%)',
              background: centerBg,
            }}
          />
          {/* Hex border (+ faint inner outline) */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 118 128"
            preserveAspectRatio="none"
            style={{ filter: `drop-shadow(0 0 6px ${accent}55)` }}
          >
            <polygon points="59,4 113,34 113,94 59,124 5,94 5,34" fill="none" stroke={accent} strokeWidth="3.5" />
            <polygon points="59,15 103,40 103,88 59,113 15,88 15,40" fill="none" stroke={accent} strokeWidth="1" opacity="0.4" />
          </svg>
          {/* Glyph centered in the hex */}
          <div className="absolute inset-0 grid place-items-center">{glyph}</div>
        </div>

        {/* Pixel title + underline accent */}
        <div className="mt-3 flex flex-col items-center">
          <span
            className="font-pixel text-[10px] tracking-[0.06em] whitespace-nowrap"
            style={{ color: accent, textShadow: `0 0 8px ${accent}80` }}
          >
            {title.toUpperCase()}
          </span>
          <span className="mt-1.5 h-[2px] w-10" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
        </div>
      </div>

      {/* Footer: lock / hollow star / gold star with score / SOON */}
      <div className="h-12 grid place-items-center mt-1">
        <FooterContent state={state} score={score} />
      </div>

      {/* Optional caption (e.g. the level name on the PLAY badge) — never wraps */}
      {caption && (
        <div className="text-[13px] font-bold tracking-wide text-neon-cyan whitespace-nowrap leading-tight">
          {caption}
        </div>
      )}
    </button>
  )
}
