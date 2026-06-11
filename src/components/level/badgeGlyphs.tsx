/**
 * Center glyphs for RibbonBadge, ported from mockups/level-screen.html.
 * Note: BADGE_CENTER_BG is exported separately so that fast-refresh isn't affected —
 * keep all non-component exports in this file intentionally (they're tightly coupled).
 */
/* eslint-disable react-refresh/only-export-components */
import type { CSSProperties } from 'react'

export function PlayGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

/** Upright-T tetromino drawn as empty/dashed "gap" cells — The Classic. */
export function GapTetrominoGlyph() {
  const gap: CSSProperties = {
    width: 15,
    height: 15,
    borderRadius: 3,
    border: '1.5px dashed rgba(34,211,238,0.85)',
    boxShadow: 'inset 0 0 8px rgba(34,211,238,0.25)',
  }
  const empty: CSSProperties = { width: 15, height: 15 }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 15px)', gap: 3 }}>
      <span style={gap} /><span style={gap} /><span style={gap} />
      <span style={empty} /><span style={gap} /><span style={empty} />
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
    <div className="flex items-center">
      <div
        style={{ transform: 'rotate(-9deg)' }}
        className="w-[19px] h-[19px] rounded-[5px] bg-red-500 grid place-items-center shadow-[inset_0_2px_0_rgba(255,255,255,.55),inset_0_-3px_0_rgba(0,0,0,.22)]"
      >
        <span className="font-black text-[12px] text-white">1</span>
      </div>
      <div
        style={{ transform: 'rotate(5deg)', marginLeft: '-2px' }}
        className="w-[19px] h-[19px] rounded-[5px] bg-sky-500 grid place-items-center shadow-[inset_0_2px_0_rgba(255,255,255,.55),inset_0_-3px_0_rgba(0,0,0,.22)]"
      >
        <span className="font-black text-[12px] text-white">2</span>
      </div>
      <div
        style={{ transform: 'rotate(-4deg)', marginLeft: '-2px' }}
        className="w-[19px] h-[19px] rounded-[5px] bg-amber-400 grid place-items-center shadow-[inset_0_2px_0_rgba(255,255,255,.55),inset_0_-3px_0_rgba(0,0,0,.22)]"
      >
        <span className="font-black text-[12px] text-white">3</span>
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
