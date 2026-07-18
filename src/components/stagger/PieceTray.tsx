import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PIECE_DEFINITIONS } from '@shared/engine/pieces'
import { type PieceType } from '@shared/types'
import { DISPLAY_ROTATION } from '../../lib/staggerCurve'
import { type Difficulty } from '../../store/settingsStore'
import { PieceShape } from '../PieceShape'
import { PIECE_FADE_MS, FLOAT_TEXT_SHADOW } from './constants'
import { monoSurfaceClass, monoBloomVar } from './palette'

// ── Piece tray ────────────────────────────────────────────────────────────────
// The recall tray wears the mode's own palette, matching the reveal — EASY each
// piece's own color, MEDIUM uniform pink, HARD the graphite sludge. On MEDIUM/
// HARD the shape is the only cue; there's no colour crutch in the tray either.
// `concealed` (the memorize phase): the same panel at the same size, but the
// seven sockets are EMPTY, dormant divs — no piece shapes to stare at instead
// of the board, nothing clickable — so the pause button below keeps exactly
// its recall-phase position when the phases swap.
export function PieceTray({
  onPick, disabled, concealed = false, skeleton = false, mode, demoTarget, demoWrong,
}: {
  onPick: (t: PieceType) => void
  disabled: boolean
  /** Memorize phase: same panel, seven EMPTY dormant sockets (see above). */
  concealed?: boolean
  /** Countdown phase: same panel DIMENSIONS, but a solid seamless black box (grid
   *  styling, invisible header, borderless black sockets) so the play column's
   *  natural height is identical to the gameplay tray — the ScaleToFit scale
   *  therefore doesn't jump when countdown → reveal. Non-interactive. */
  skeleton?: boolean
  /** Drives the tray palette: EASY per-piece color, MEDIUM pink, HARD sludge. */
  mode: Difficulty
  /** Demo guidance (T3): while set, the target button wears the spotlight ring +
   *  TAP cue and every other button drops behind the "veil" (dimmed, still
   *  tappable — a wrong tap gets the gentle correction, not a disable). */
  demoTarget?: PieceType | null
  demoWrong?: PieceType | null
}) {
  // The recall → memorize handoff mirrors the bloom-in: for one beat after
  // `concealed` flips on, the sockets keep GHOST pieces (inert, inside the
  // already-dormant socket divs) that play the game's ghost-tail decay,
  // instead of vanishing on the spot. A tray that first mounts already
  // concealed (fresh reveal after a non-tray phase, the demo) starts empty —
  // nothing was showing to decay.
  const [leaving, setLeaving] = useState(false)
  const prevConcealed = useRef(concealed)
  useEffect(() => {
    const was = prevConcealed.current
    prevConcealed.current = concealed
    if (concealed && !was) {
      setLeaving(true)
      const t = window.setTimeout(() => setLeaving(false), PIECE_FADE_MS)
      return () => clearTimeout(t)
    }
    if (!concealed) setLeaving(false)
  }, [concealed])
  const ghosts = concealed && leaving

  // Countdown skeleton: the SAME outer/header/socket dimensions as the concealed
  // tray (so the column height — and thus the ScaleToFit scale — is identical),
  // but recolored to the grid's black fill with no socket borders, so it reads as
  // one seamless solid box. Non-interactive, no piece shapes.
  if (skeleton) {
    return (
      <div
        aria-hidden
        className="w-full max-w-sm rounded-xl p-3 bg-[#04040a] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_2px_6px_#000] pointer-events-none"
      >
        <div className="flex justify-between items-center mb-2 select-none invisible">
          <span className="font-silk text-[10px] tracking-[0.15em] uppercase">Pieces</span>
          <span className="text-[10px] tracking-[0.04em]">tap to place from memory</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {PIECE_DEFINITIONS.map(def => (
            <div key={def.type} className="h-12 rounded-md bg-[#04040a]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm rounded-xl p-3 bg-vt-panel border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className={`flex justify-between items-center mb-2 pointer-events-none select-none${demoTarget ? ' opacity-40' : ''}`}>
        <span className="font-silk text-[10px] tracking-[0.15em] uppercase text-vt-cyan text-glow-vt-cyan">Pieces</span>
        {(!concealed || ghosts) && (
          <span className={`${concealed ? 'vt-piece-out' : 'vt-piece-in'} text-[10px] text-vt-dim tracking-[0.04em]`}>tap to place from memory</span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {/* The armed branch mounts fresh exactly at the memorize → recall
            handoff (concealed flips), so the mount-time bloom-in plays
            precisely then — and NOT on mid-recall re-renders (pause/resume,
            picks, demo guidance), which reconcile in place. */}
        {PIECE_DEFINITIONS.map(def => {
          if (concealed) {
            return (
              <div
                key={def.type}
                className="flex items-center justify-center h-12 p-1 rounded-md border bg-vt-raised border-vt-cyan/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              >
                {ghosts && (
                  /* The decay floods the same color the piece rested in: pink on
                     MEDIUM, a graphite lift on HARD, the piece's own color on EASY. */
                  <span className="flex" style={{ ['--bloom-color']: monoBloomVar(mode, def.type as PieceType) } as CSSProperties}>
                    <PieceShape pieceType={def.type as PieceType} rotation={DISPLAY_ROTATION[def.type]} cellSize={8} colorClass={monoSurfaceClass(mode)} cellClassName="vt-tray-decay" />
                  </span>
                )}
              </div>
            )
          }
          const isTarget = demoTarget === def.type
          const demoClass = !demoTarget ? ''
            : isTarget ? ' vt-demo-spot border-vt-cyan relative z-30'
            : demoWrong === def.type ? ' vt-demo-shake'
            : ' opacity-25 saturate-50'
          return (
            <button
              key={def.type}
              data-piece-option={def.type}
              disabled={disabled}
              onClick={e => {
                // Restart the lift+glow tap animation even on repeat taps of the
                // same button: remove the class, force a reflow, re-add it.
                const el = e.currentTarget
                el.classList.remove('vt-piece-tap')
                void el.offsetWidth
                el.classList.add('vt-piece-tap')
                onPick(def.type as PieceType)
              }}
              // Only the button's OWN tap animation clears the class — the inner
              // piece cells' bloom animations also bubble an animationend here.
              onAnimationEnd={e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('vt-piece-tap') }}
              className={`relative flex items-center justify-center h-12 p-1 rounded-md border bg-vt-raised
                border-vt-cyan/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
                hover:border-vt-cyan hover:shadow-vt-cyan cursor-pointer transition
                disabled:opacity-40 disabled:pointer-events-none${demoClass}`}
            >
              {isTarget && (
                <span className="vt-demo-tapcue absolute left-1/2 bottom-[calc(100%-10px)] z-40 flex flex-col items-center pointer-events-none">
                  <span className="font-silk text-[8px] tracking-[0.1em] text-white" style={{ textShadow: FLOAT_TEXT_SHADOW }}>TAP</span>
                  <span className="mt-px w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]" />
                </span>
              )}
              {/* flex, not inline: an inline span would seat the piece on the
                  text baseline and sink it below the button's center. */}
              <span className="flex" style={{ ['--bloom-color']: monoBloomVar(mode, def.type as PieceType) } as CSSProperties}>
                <PieceShape pieceType={def.type as PieceType} rotation={DISPLAY_ROTATION[def.type]} cellSize={8} colorClass={monoSurfaceClass(mode)} cellClassName="vt-tray-bloom-in" />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
