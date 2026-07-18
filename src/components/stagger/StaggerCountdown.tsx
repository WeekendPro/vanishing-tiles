import { useEffect, useState } from 'react'
import { sfx } from '../../lib/sfx'

// ── Countdown ───────────────────────────────────────────────────────────────
// Each number burns bright the instant it appears, holds at full strength for
// ~72% of its beat, then dissipates (Afterglow Smear: blurs + swells + fades
// to nothing) in the final stretch, just as the next number takes its place.
// The CSS animation length (.vt-num-decay, 850ms) is kept in lockstep with
// BEAT_MS.
//
// The countdown is anchored OVER the board/grid (not a full-screen void) so
// the player sees the mode's frame before the gaps reveal: the mode label
// sits just above the 3·2·1. Fires at run start.
const BEAT_MS = 850
export function StaggerCountdown({
  modeLabel, modeColor, onDone,
}: { modeLabel: string; modeColor: string; onDone: () => void }) {
  const [count, setCount] = useState(3)
  useEffect(() => {
    if (count <= 0) {
      // The fourth beat: 3 · 2 · 1 · GO — the decisive note the countdown
      // resolves into, right as the reveal takes over.
      sfx.go()
      const t = window.setTimeout(onDone, 350)
      return () => clearTimeout(t)
    }
    sfx.count()
    const t = window.setTimeout(() => setCount(c => c - 1), BEAT_MS)
    return () => clearTimeout(t)
  }, [count, onDone])
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border border-white/10 bg-black/70 backdrop-blur-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] pointer-events-none">
      <div className={`font-grotesk text-[11px] uppercase tracking-[0.22em] mb-2 ${modeColor}`}>{modeLabel}</div>
      <div className="relative flex h-44 w-44 items-center justify-center">
        {count > 0 && (
          <span
            key={count}
            className="absolute vt-num-decay font-silk font-black leading-none text-vt-cyan text-[6rem]"
          >
            {count}
          </span>
        )}
      </div>
    </div>
  )
}
