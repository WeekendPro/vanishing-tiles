import type { ReactNode } from 'react'
import { LivesCounter, PauseOverlay } from '../ui'
import { STAGGER } from '../../lib/staggerCurve'

// ── Pause controls ──────────────────────────────────────────────────────────
// The three pause-related blocks: the pause button, the countdown-phase
// skeleton that reserves its footprint, and the full-screen pause overlay with
// the run's live stats. Separate named exports rendered in their original spots.

// Pause — freeze the run (full width), available during memorize too:
// the overlay hides the board, the reveal driver freezes and re-blooms
// the interrupted gap on resume. Not in the demo (no clock to freeze —
// the skip link rides this spot instead).
export function PauseButton({
  onPause, cleared,
}: { onPause: () => void; cleared: boolean }) {
  return (
    <div className="mt-3 w-full max-w-sm">
      <button
        aria-label="Pause"
        disabled={cleared}
        onClick={() => onPause()}
        className="w-full flex items-center justify-center gap-2 rounded-xl border bg-vt-raised py-3 px-4
          border-vt-cyan/25 text-vt-cyan shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-vt-cyan hover:bg-vt-cyan/10 hover:shadow-vt-cyan
          transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
      >
        {/* Icon-only: the two-bar glyph is universal — the word was noise. */}
        <span className="flex gap-[4px]">
          <span className="block w-[5px] h-4 rounded-sm bg-current" />
          <span className="block w-[5px] h-4 rounded-sm bg-current" />
        </span>
      </button>
    </div>
  )
}

// Countdown pause skeleton: a non-interactive solid-black box with the
// EXACT dimensions of the real pause button (same wrapper, py-3 px-4,
// rounded-xl, grid-styled fill; an invisible two-bar glyph holds the
// height) so the play column height — and the ScaleToFit scale — matches
// reveal/selecting and the countdown → reveal transition doesn't jump.
export function CountdownPauseSkeleton() {
  return (
    <div className="mt-3 w-full max-w-sm">
      <div
        aria-hidden
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#04040a] py-3 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_2px_6px_#000] pointer-events-none"
      >
        <span className="flex gap-[4px] invisible">
          <span className="block w-[5px] h-4 rounded-sm bg-current" />
          <span className="block w-[5px] h-4 rounded-sm bg-current" />
        </span>
      </div>
    </div>
  )
}

// Hard pause — covers the whole screen so no memorizing happens while
// frozen; resume picks the clock back up, restart abandons this run for a fresh
// one at the same difficulty, exit bails to the landing page. The run's live
// stats + who's playing ride along: a pause doubles as an identity/scoreboard
// check, and guests get a quiet sign-up nudge (onSignUp).
export function PauseStatsOverlay({
  score, lives, currentStreak, onResume, onRestart, onExit, onSignUp,
}: {
  score: number
  lives: number
  currentStreak: number
  onResume: () => void
  onRestart: () => void
  onExit: () => void
  onSignUp: () => void
}) {
  return (
    <PauseOverlay onResume={onResume} onRestart={onRestart} onExit={onExit} onSignUp={onSignUp}>
      {/* The metadata section: Score / Lives / Streak as three full-width tiles
          (echoing the leaderboard hero), spanning the same max-w-xs column as
          the identity header, sound row, and buttons. */}
      <div className="grid grid-cols-3 gap-2.5 w-full max-w-xs pointer-events-none">
        <StatTile label="Score">
          <span className="font-silk font-bold text-xl text-vt-cyan text-glow-vt-cyan tabular-nums">
            {score.toLocaleString('en-US')}
          </span>
        </StatTile>
        <StatTile label="Lives">
          {/* Hearts share the same 20px line box as the neighbouring text-xl values. */}
          <div className="flex h-[20px] items-center justify-center"><LivesCounter lives={lives} cap={STAGGER.START_LIVES} /></div>
        </StatTile>
        <StatTile label="Streak">
          <span className="font-silk font-bold text-xl text-vt-lime text-glow-vt-lime tabular-nums">×{currentStreak}</span>
        </StatTile>
      </div>
    </PauseOverlay>
  )
}

// One stat tile in the pause scoreboard — label over value, matching the
// leaderboard hero's tiles (inset hairline, centered).
function StatTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-vt-void px-2 py-3 text-center shadow-[inset_0_0_0_1px_#1C1C28]">
      <div className="font-grotesk text-[8px] tracking-[0.18em] uppercase text-vt-faint font-semibold">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  )
}
