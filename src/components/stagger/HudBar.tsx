import { type RefObject } from 'react'
import { LivesCounter } from '../ui'
import { STAGGER, gapCountForBatch } from '../../lib/staggerCurve'
import { type StaggerGap } from '../../store/staggerStore'
import { STREAK_FADE_MS } from './constants'

// ── HUD ─────────────────────────────────────────────────────────────────────
// The score/items/lives metadata bar, the phase-colored timer/count bar, and
// the central phase/streak line above the grid. Hidden at game over (the
// summary covers score; lives/shapes are moot).
export function HudBar({
  demo, displayScore, gaps, batchIndex, lives,
  barRef, barPct, barClass, barTransition,
  scoreRef, streakTakeover, streakChip, orderHint, orderHintActive, phaseLabel, phaseLabelClass,
}: {
  demo: boolean
  displayScore: number
  gaps: StaggerGap[]
  batchIndex: number
  lives: number
  barRef: RefObject<HTMLDivElement>
  barPct: number
  barClass: string
  barTransition: string
  scoreRef: RefObject<HTMLDivElement>
  streakTakeover: boolean
  streakChip: { value: number; fading: boolean } | null
  orderHint: number
  orderHintActive: boolean
  phaseLabel: string
  phaseLabelClass: string
}) {
  return (
    <>
      {/* Flat metadata bar (the Training-header grammar): the unlabeled
          score spans the bar's full height on the left; items and lives
          are label-above / value-below columns, bottoms on the score's
          baseline. A [1fr_auto_1fr] grid (not flex justify-between) so the
          items column stays pinned to the bar's true center — equal side
          tracks absorb the score growing wider, instead of it shoving the
          middle to the right. */}
      <div className="w-full max-w-sm grid grid-cols-[1fr_auto_1fr] items-stretch mb-2 pointer-events-none">
        <div className="flex items-end justify-self-start">
          {/* During the demo the most prominent readout says DEMO, not a
              score — a constant reminder this isn't a scored run. */}
          <div ref={scoreRef} className="font-silk font-bold text-3xl text-vt-cyan text-glow-vt-cyan leading-none tabular-nums">{demo ? 'DEMO' : displayScore}</div>
        </div>
        <div className="flex flex-col items-center justify-between">
          <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Items</div>
          <div className="font-grotesk font-semibold text-[15px] leading-none text-vt-text tabular-nums">
            {gaps.filter(g => g.filled).length} <span className="font-medium text-vt-dim">/ {gaps.length || gapCountForBatch(batchIndex)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between justify-self-end">
          <div className="font-grotesk text-[9px] tracking-[0.2em] uppercase text-vt-dim">Lives</div>
          <LivesCounter lives={lives} cap={STAGGER.START_LIVES} />
        </div>
      </div>

      {/* Timer / count bar — phase-colored (magenta → amber → red → lime). */}
      <div className="w-full max-w-sm h-2 rounded-full bg-black overflow-hidden mb-2 shadow-[inset_0_1px_2px_#000]">
        <div
          ref={barRef}
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${barPct}%`, transition: barTransition }}
        />
      </div>

      {/* The central line above the grid. Usually the phase label; while a
          streak is live in recall, the STREAK ×N takeover owns it instead —
          the multiplier is the value (big), "streak" just the label (small).
          It pops on each streak step, holds, then fades in the signature
          style (see streakChip lifecycle above); the phase word returns
          when it's gone. Priority: IN ORDER (hard-mode corrective) and
          CLEAR! (the payoff beat) both outrank the streak, and the takeover
          never plays outside recall, so MEMORIZE is never masked.
          ("Streak" is player-facing copy only — the underlying store field
          is still `currentCombo`.) */}
      <div className="relative w-full max-w-sm h-4 mt-1 mb-2 pointer-events-none">
        {streakTakeover && streakChip ? (
          /* Centered by flex, NOT a translate: the pop/fade keyframes own
             `transform`, so translate-based centering on the animated
             element would drop for the animation's duration and snap back
             after (a visible jump). */
          <div
            key={streakChip.fading ? `fade-${streakChip.value}` : streakChip.value}
            className={`absolute inset-0 flex items-center justify-center gap-1.5 text-vt-lime text-glow-vt-lime whitespace-nowrap ${streakChip.fading ? 'vt-fade-away' : 'streak-pop'}`}
            style={streakChip.fading ? { animationDuration: `${STREAK_FADE_MS}ms` } : undefined}
          >
            <span className="font-grotesk font-semibold text-[10px] tracking-[0.2em] uppercase">Streak</span>
            <span className="font-silk font-bold text-xl leading-none tabular-nums">×{streakChip.value}</span>
          </div>
        ) : (
          <div
            key={orderHintActive ? `order-${orderHint}` : 'phase'}
            className={`text-center font-grotesk text-[11px] tracking-[0.22em] uppercase transition-colors ${phaseLabelClass}${orderHintActive ? ' vt-order-flash' : ''}`}
          >
            {phaseLabel}
          </div>
        )}
      </div>
    </>
  )
}
