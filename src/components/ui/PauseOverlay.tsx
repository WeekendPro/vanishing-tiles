import type { ReactNode } from 'react'
import { NeonButton } from './NeonButton'
import { ScanlineOverlay } from './ScanlineOverlay'

/**
 * The hard-pause screen shared by Infinite Stagger and Training: covers
 * everything (no memorizing while frozen), shows the run's live stats so a
 * pause doubles as a scoreboard check, then Resume / Exit to Home.
 *
 * `children` is the mode's stat readout — each mode surfaces its own metadata
 * (Stagger: score / lives / streak; Training: streak / best / miss / avg speed).
 */
export function PauseOverlay({
  onResume, onExit, children,
}: { onResume: () => void; onExit: () => void; children?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8
      bg-vt-void text-vt-text px-6">
      <ScanlineOverlay />
      <div className="font-silk text-lg text-vt-cyan text-glow-vt-cyan uppercase tracking-[0.2em]">Paused</div>
      {children}
      <div className="flex flex-col gap-3 w-52">
        <NeonButton variant="primary" fullWidth onClick={onResume}>Resume</NeonButton>
        <NeonButton variant="danger" fullWidth onClick={onExit}>Exit to Home</NeonButton>
      </div>
    </div>
  )
}
