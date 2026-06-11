import type { ReactNode } from 'react'

type Accent = 'edge' | 'cyan' | 'green'
const ACCENT: Record<Accent, string> = {
  edge: 'border-arcade-edge text-gray-300 hover:border-neon-cyan hover:text-neon-cyan',
  cyan: 'border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10',
  green: 'border-neon-green text-neon-green hover:bg-neon-green/10',
}

export function IconButton({
  label, accent, onClick, children,
}: { label: string; accent: Accent; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 bg-arcade-panel transition-colors active:translate-y-px ${ACCENT[accent]}`}
    >
      {children}
      <span className="font-sans text-[11px] font-semibold tracking-tight leading-tight whitespace-nowrap">{label}</span>
    </button>
  )
}

export const BackIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)
// Single counterclockwise circular arrow (RotateCcw) — the "replay/restart" glyph.
export const ReplayIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)
export const ForwardIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18l6-6-6-6" />
  </svg>
)
