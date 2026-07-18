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
// frozen; resume picks the clock back up, exit bails to the landing page.
// The run's live stats ride along: a pause doubles as a scoreboard check.
export function PauseStatsOverlay({
  score, lives, currentStreak, onResume, onExit,
}: {
  score: number
  lives: number
  currentStreak: number
  onResume: () => void
  onExit: () => void
}) {
  return (
    <PauseOverlay onResume={onResume} onExit={onExit}>
      <div className="flex items-end gap-10 pointer-events-none">
        <div>
          <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Score</div>
          <div className="mt-1 font-silk font-bold text-lg text-vt-cyan text-glow-vt-cyan leading-none tabular-nums">
            {score}
          </div>
        </div>
        <div>
          <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Lives</div>
          {/* Hearts sit in the same 18px line box as the neighboring text-lg
              values — a bare div's default line-height would pad below the
              hearts and push this column out of line. */}
          <div className="mt-1 flex h-[18px] items-center"><LivesCounter lives={lives} cap={STAGGER.START_LIVES} /></div>
        </div>
        <div>
          <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Streak</div>
          <div className="mt-1 font-silk font-bold text-lg text-vt-lime text-glow-vt-lime leading-none tabular-nums">
            {currentStreak}
          </div>
        </div>
      </div>
    </PauseOverlay>
  )
}
