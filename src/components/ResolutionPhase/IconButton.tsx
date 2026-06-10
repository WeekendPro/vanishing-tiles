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
      <span className="font-pixel text-[10px] uppercase tracking-wide leading-tight whitespace-nowrap">{label}</span>
    </button>
  )
}

export const BackIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)
export const RepeatIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
  </svg>
)
export const ForwardIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18l6-6-6-6" />
  </svg>
)
