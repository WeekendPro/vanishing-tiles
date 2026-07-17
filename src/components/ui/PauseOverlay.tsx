import type { ReactNode } from 'react'
import { useShallow } from 'zustand/shallow'
import { useSettingsStore } from '../../store/settingsStore'
import { sfx } from '../../lib/sfx'
import { NeonButton } from './NeonButton'
import { ScanlineOverlay } from './ScanlineOverlay'
import { ChannelControl } from './ChannelControl'

/**
 * The hard-pause screen shared by Infinite Stagger and Training: covers
 * everything (no memorizing while frozen), shows the run's live stats so a
 * pause doubles as a scoreboard check, a Sound FX row (a pause is exactly
 * when you discover the volume is wrong mid-run), then Resume / Exit to Home.
 *
 * `children` is the mode's stat readout — each mode surfaces its own metadata
 * (Stagger: score / lives / streak; Training: streak / best / miss / avg speed).
 */
export function PauseOverlay({
  onResume, onExit, children,
}: { onResume: () => void; onExit: () => void; children?: ReactNode }) {
  const { soundEnabled, setSoundEnabled, sfxVolume, setSfxVolume } = useSettingsStore(useShallow(s => ({
    soundEnabled: s.settings.soundEnabled,
    setSoundEnabled: s.setSoundEnabled,
    sfxVolume: s.settings.sfxVolume,
    setSfxVolume: s.setSfxVolume,
  })))

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8
      bg-vt-void text-vt-text px-6">
      <ScanlineOverlay />
      <div className="font-silk text-lg text-vt-cyan text-glow-vt-cyan uppercase tracking-[0.2em]">Paused</div>
      {children}
      <div className="w-full max-w-xs border-y border-white/10">
        <ChannelControl
          label="Sound FX"
          enabled={soundEnabled}
          volume={sfxVolume}
          onToggle={() => {
            const next = !soundEnabled
            setSoundEnabled(next)
            if (next) { sfx.unlock(); sfx.uiTap() }
          }}
          onVolume={setSfxVolume}
          onVolumeCommit={() => { sfx.unlock(); sfx.uiTap() }}
        />
      </div>
      <div className="flex flex-col gap-3 w-52">
        <NeonButton variant="primary" fullWidth onClick={onResume}>Resume</NeonButton>
        <NeonButton variant="danger" fullWidth onClick={onExit}>Exit to Home</NeonButton>
      </div>
    </div>
  )
}
