import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NeonButton, ScanlineOverlay } from '../ui'
import { RunHistoryGraph } from '../RunHistoryGraph'
import { type RunRecord } from '../../store/runHistoryStore'
import { type ShareResult } from '../../lib/shareCard'

// ── Guest sign-up call to action ──────────────────────────────────────────────
// A guest has no saved history, so the run-history chart is meaningless to them —
// nothing is being banked. That slot becomes a gentle nudge instead: this score
// only counts on the leaderboard with an account. Deliberately succinct — one
// line of copy, one email field, Google as a quiet fallback — so the summary
// never feels like a wall (Concept A from the design review).
function GuestSignupCta({
  onEmail, onGoogle,
}: {
  onEmail: (email: string) => void
  onGoogle: () => void
}) {
  const [email, setEmail] = useState('')
  const submit = () => onEmail(email.trim())
  return (
    <div className="rounded-2xl p-4 bg-gradient-to-b from-vt-magenta/[0.08] to-vt-magenta/[0.01]
      shadow-[inset_0_0_0_1px_rgba(255,45,155,0.28),0_0_22px_rgba(255,45,155,0.08)]">
      <div className="text-center font-grotesk text-[8.5px] font-bold tracking-[0.2em] uppercase text-vt-magenta text-glow-vt-magenta">
        Playing as guest
      </div>
      <div className="text-center font-silk text-[15px] font-bold text-vt-text mt-2 leading-snug text-balance">
        Save this score to the leaderboard
      </div>

      <form
        className="relative mt-3.5"
        onSubmit={e => { e.preventDefault(); submit() }}
      >
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          aria-label="Email"
          placeholder="you@email.com"
          autoComplete="email"
          className="w-full h-[46px] pl-3.5 pr-[46px] rounded-[11px] bg-[#0a0a12] text-vt-text
            font-grotesk text-[13px] border border-white/10 placeholder-vt-faint
            shadow-[inset_0_1px_2px_#000] focus:outline-none focus:border-vt-cyan
            focus:shadow-[inset_0_1px_2px_#000,0_0_0_1px_rgba(40,240,255,0.33),0_0_14px_rgba(40,240,255,0.2)]"
        />
        <button
          type="submit"
          aria-label="Sign up with email"
          className="absolute right-1.5 top-1.5 w-[34px] h-[34px] rounded-lg border-none cursor-pointer
            bg-vt-cyan text-vt-void grid place-items-center shadow-[0_0_14px_rgba(40,240,255,0.4)]
            active:translate-y-px"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[17px] h-[17px]" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>

      <div className="mt-3 text-center font-grotesk text-[10px] text-vt-faint">
        or{' '}
        <button
          onClick={onGoogle}
          className="text-vt-cyan border-b border-vt-cyan/40 hover:text-vt-text transition-colors"
        >
          continue with Google
        </button>
      </div>
    </div>
  )
}

// One secondary door in the game-over three-across row: an icon stacked over a
// small label, in the app's button chrome. Ghost (cyan-on-hover) for the
// navigation doors; "share" tone wears the memory/brag magenta as the standout.
function IconAction({
  label, onClick, tone = 'ghost', disabled = false, children,
}: {
  label: string
  onClick: () => void
  tone?: 'ghost' | 'share'
  disabled?: boolean
  children: ReactNode
}) {
  const toneClass = tone === 'share'
    ? 'border-neon-magenta text-neon-magenta hover:bg-neon-magenta/10 hover:shadow-neon-magenta'
    : 'border-arcade-edge text-gray-300 hover:border-neon-cyan hover:text-neon-cyan'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex flex-col items-center gap-1.5 rounded-md border-2 bg-arcade-panel py-2.5 px-1
        font-pixel text-[8.5px] uppercase tracking-[0.08em] transition active:translate-y-px
        disabled:opacity-50 disabled:pointer-events-none ${toneClass}`}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

// ── Game over ─────────────────────────────────────────────────────────────────
// Portaled to <body> so it escapes ScaleToFit's transform (a transformed
// ancestor would become this fixed overlay's containing block and shrink it to
// the scaled stage instead of covering the viewport).
export function GameOverSummary({
  score, shapesRecalled, bestStreak, totalPicks, correctPicks, currentRunId, records, isGuest,
  onPlayAgain, onShare, onLeaderboard, onHome, onSignUpEmail, onSignUpGoogle,
}: {
  score: number
  shapesRecalled: number
  bestStreak: number
  totalPicks: number
  correctPicks: number
  currentRunId: string | null
  records: RunRecord[]
  isGuest: boolean
  onPlayAgain: () => void
  onShare: () => Promise<ShareResult>
  onLeaderboard: () => void
  onHome: () => void
  onSignUpEmail: (email: string) => void
  onSignUpGoogle: () => void
}) {
  // Share button state: 'sharing' while the card renders, then a brief
  // confirmation on the desktop fallback (the native sheet gives its own).
  const [shareState, setShareState] = useState<'idle' | 'sharing'>('idle')
  const [shareNote, setShareNote] = useState<string | null>(null)
  const handleShare = async () => {
    if (shareState === 'sharing') return
    setShareState('sharing')
    try {
      const method = await onShare()
      if (method === 'download') {
        setShareNote('Image saved · caption copied')
        window.setTimeout(() => setShareNote(null), 2800)
      }
    } catch { /* render/share failed silently — nothing shared, nothing lost */ }
    finally { setShareState('idle') }
  }
  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col items-center bg-vt-void overflow-y-auto px-6 py-10">
      <ScanlineOverlay />
      <div className="font-silk text-base text-vt-text uppercase tracking-[0.15em] mb-1.5">Game Over</div>
      <div className="font-grotesk text-[11px] tracking-[0.18em] uppercase text-vt-magenta text-glow-vt-magenta mb-5 vt-fade-away">Memory Fades</div>
      <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Final score</div>
      <div className="font-silk font-bold text-4xl text-vt-amber text-glow-vt-amber mb-6 tabular-nums">{score}</div>

      {/* Run-stats trio — items recalled / best combo / accuracy. */}
      <div className="flex w-full max-w-[300px] border-y border-white/10 mb-6">
        <div className="flex-1 text-center py-3.5">
          <div className="font-silk font-bold text-base text-vt-magenta text-glow-vt-magenta tabular-nums">{shapesRecalled}</div>
          <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-vt-faint mt-1.5">Items recalled</div>
        </div>
        <div className="flex-1 text-center py-3.5 border-x border-white/10">
          <div className="font-silk font-bold text-base text-vt-lime text-glow-vt-lime tabular-nums">{bestStreak > 0 ? `×${bestStreak}` : 'N/A'}</div>
          <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-vt-faint mt-1.5">Best streak</div>
        </div>
        <div className="flex-1 text-center py-3.5">
          <div className="font-silk font-bold text-base text-vt-cyan text-glow-vt-cyan tabular-nums">
            {totalPicks === 0 ? 0 : Math.round((correctPicks / totalPicks) * 100)}%
          </div>
          <div className="font-grotesk text-[9px] tracking-[0.1em] uppercase text-vt-faint mt-1.5">Accuracy</div>
        </div>
      </div>

      {/* Guests see the sign-up nudge in place of the run-history chart — with no
          saved history there's no "best run" to plot, and this is the moment the
          leaderboard means the most. Signed-in players still get their chart. */}
      {isGuest ? (
        <div className="w-full max-w-[300px] mb-6 pointer-events-auto">
          <GuestSignupCta onEmail={onSignUpEmail} onGoogle={onSignUpGoogle} />
        </div>
      ) : currentRunId && (
        <div className="w-full max-w-[300px] mb-6 pointer-events-auto">
          <RunHistoryGraph records={records} currentId={currentRunId} />
        </div>
      )}

      {/* Play again is THE next action — full width, one tier up in size.
          Home · Share · Ranks are one three-across row of secondary doors
          beneath it, Share in the memory/brag magenta as the standout (the
          growth lever) between the two navigation doors. "Ranks" (not
          "Leaderboard") to fit a third-width; the summary lands on this run's
          mode tab either way. The column matches the stats/graph width above. */}
      <div className="flex flex-col gap-3 w-full max-w-[300px] pointer-events-auto">
        <NeonButton variant="primary" size="lg" fullWidth onClick={onPlayAgain}>Play again</NeonButton>
        <div className="flex gap-2.5">
          <IconAction label="Home" onClick={onHome}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden="true">
              <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />
            </svg>
          </IconAction>
          <IconAction label="Share" tone="share" onClick={handleShare} disabled={shareState === 'sharing'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
            </svg>
          </IconAction>
          <IconAction label="Ranks" onClick={onLeaderboard}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden="true">
              <path d="M8 21h8M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" />
              <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
            </svg>
          </IconAction>
        </div>
        {/* Desktop fallback confirmation — the native share sheet is its own
            feedback, so this only speaks when the card was saved + copied. */}
        <div className="h-4 -mt-1 text-center font-grotesk text-[10px] tracking-[0.08em] uppercase text-vt-lime text-glow-vt-lime">
          {shareNote}
        </div>
      </div>
    </div>,
    document.body,
  )
}
