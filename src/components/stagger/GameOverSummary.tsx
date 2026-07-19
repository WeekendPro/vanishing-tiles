import { useState } from 'react'
import { createPortal } from 'react-dom'
import { NeonButton, ScanlineOverlay } from '../ui'
import { RunHistoryGraph } from '../RunHistoryGraph'
import { type RunRecord } from '../../store/runHistoryStore'
import { type ShareResult } from '../../lib/shareCard'

// ── Game over ─────────────────────────────────────────────────────────────────
// Portaled to <body> so it escapes ScaleToFit's transform (a transformed
// ancestor would become this fixed overlay's containing block and shrink it to
// the scaled stage instead of covering the viewport).
export function GameOverSummary({
  score, shapesRecalled, bestStreak, totalPicks, correctPicks, currentRunId, records,
  onPlayAgain, onShare, onLeaderboard, onHome,
}: {
  score: number
  shapesRecalled: number
  bestStreak: number
  totalPicks: number
  correctPicks: number
  currentRunId: string | null
  records: RunRecord[]
  onPlayAgain: () => void
  onShare: () => Promise<ShareResult>
  onLeaderboard: () => void
  onHome: () => void
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

      {currentRunId && (
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
          <NeonButton variant="ghost" size="sm" fullWidth onClick={onHome}>Home</NeonButton>
          <NeonButton variant="accent" size="sm" fullWidth onClick={handleShare} disabled={shareState === 'sharing'}>
            {shareState === 'sharing' ? '…' : 'Share'}
          </NeonButton>
          <NeonButton variant="ghost" size="sm" fullWidth onClick={onLeaderboard}>Ranks</NeonButton>
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
