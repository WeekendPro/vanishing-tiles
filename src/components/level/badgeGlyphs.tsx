/**
 * Center glyphs for RibbonBadge, ported from mockups/level-screen.html.
 * Note: BADGE_CENTER_BG is exported separately so that fast-refresh isn't affected —
 * keep all non-component exports in this file intentionally (they're tightly coupled).
 */
/* eslint-disable react-refresh/only-export-components */
import type { CSSProperties } from 'react'

/** Currently unused — kept for reference (the main badge now uses ClassicTetrominoGlyph). */
export function PlayGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

/** Upright-T tetromino drawn as filled neon-cyan blocks — The Classic. */
export function ClassicTetrominoGlyph() {
  const cell: CSSProperties = {
    width: 15,
    height: 15,
    borderRadius: 3,
    background: 'linear-gradient(180deg,#67e8f9,#22d3ee)',
    boxShadow:
      '0 0 8px rgba(34,211,238,0.6), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.22)',
  }
  const empty: CSSProperties = { width: 15, height: 15 }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 15px)', gap: '3px' }}>
      <span style={cell} /><span style={cell} /><span style={cell} />
      <span style={empty} /><span style={cell} /><span style={empty} />
    </div>
  )
}

export function ColorWheelGlyph() {
  return (
    <div
      className="w-full h-full rounded-full"
      style={{
        background:
          'conic-gradient(#ef4444,#f59e0b,#facc15,#22c55e,#06b6d4,#6366f1,#a855f7,#ef4444)',
      }}
    />
  )
}

export function SequenceBlocksGlyph() {
  return (
    <div className="flex items-center" style={{ transform: 'translateY(-4px)' }}>
      <div
        style={{ transform: 'rotate(-9deg)' }}
        className="w-[23px] h-[23px] rounded-[6px] bg-red-500 grid place-items-center shadow-[inset_0_2px_0_rgba(255,255,255,.55),inset_0_-3px_0_rgba(0,0,0,.22)]"
      >
        <span className="font-black text-[14px] text-white">1</span>
      </div>
      <div
        style={{ transform: 'rotate(5deg)', marginLeft: '-3px' }}
        className="w-[23px] h-[23px] rounded-[6px] bg-sky-500 grid place-items-center shadow-[inset_0_2px_0_rgba(255,255,255,.55),inset_0_-3px_0_rgba(0,0,0,.22)]"
      >
        <span className="font-black text-[14px] text-white">2</span>
      </div>
      <div
        style={{ transform: 'rotate(-4deg)', marginLeft: '-3px' }}
        className="w-[23px] h-[23px] rounded-[6px] bg-amber-400 grid place-items-center shadow-[inset_0_2px_0_rgba(255,255,255,.55),inset_0_-3px_0_rgba(0,0,0,.22)]"
      >
        <span className="font-black text-[14px] text-white">3</span>
      </div>
    </div>
  )
}

export function EyesGlyph() {
  return <span style={{ fontSize: '44px', lineHeight: 1 }}>👀</span>
}

export function RiddleGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4-4" strokeLinecap="round" />
    </svg>
  )
}

/** CSS background string for each badge center disc. */
export const BADGE_CENTER_BG: Record<string, string> = {
  play: 'linear-gradient(135deg,#34d399,#16a34a)',
  classic: 'linear-gradient(135deg,#0a1622,#05080f)',
  wheel: '#0a1226',
  seq: 'linear-gradient(135deg,#334155,#0f172a)',
  eyes: 'radial-gradient(circle at 50% 38%,#16233f,#070b18)',
  riddle: 'linear-gradient(135deg,#2dd4bf,#0f766e)',
}
