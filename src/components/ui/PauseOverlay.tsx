import type { ReactNode } from 'react'
import { useShallow } from 'zustand/shallow'
import { useSettingsStore } from '../../store/settingsStore'
import { useProfileStore } from '../../store/profileStore'
import { sfx } from '../../lib/sfx'
import { haptics } from '../../lib/haptics'
import { NeonButton } from './NeonButton'
import { ScanlineOverlay } from './ScanlineOverlay'
import { ChannelControl } from './ChannelControl'

// Two-letter avatar initials from a display name (matches the menu's rule).
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * The hard-pause screen shared by Infinite Stagger and Training: covers
 * everything (no memorizing while frozen). One full-width column:
 *  - header: who's playing (avatar + name + `subline`) on the left, PAUSED on
 *    the right — same initials-avatar language as the menu and leaderboard;
 *  - a guest sign-up invite (P4), when `onSignUp` is supplied and you're a guest;
 *  - the mode's stat readout (`children`) as full-width metadata cards;
 *  - a full-width Sound control;
 *  - the actions: Resume (full-width hero); when `onRestart` is supplied
 *    (Stagger) it and Exit share the row beneath — small paired buttons can't be
 *    fat-fingered in place of Resume. Without it (Training) it's Resume + Exit.
 *
 * Every block spans the same `max-w-xs` column, so the cards, sound, and buttons
 * line up edge to edge.
 */
export function PauseOverlay({
  subline, onResume, onExit, onRestart, onSignUp, children,
}: {
  subline?: string
  onResume: () => void
  onExit: () => void
  onRestart?: () => void
  onSignUp?: () => void
  children?: ReactNode
}) {
  const { soundEnabled, setSoundEnabled, sfxVolume, setSfxVolume } = useSettingsStore(useShallow(s => ({
    soundEnabled: s.settings.soundEnabled,
    setSoundEnabled: s.setSoundEnabled,
    sfxVolume: s.settings.sfxVolume,
    setSfxVolume: s.setSfxVolume,
  })))
  const { displayName, isGuest } = useProfileStore(useShallow(s => ({
    displayName: s.displayName, isGuest: s.isGuest,
  })))
  const name = isGuest ? 'Guest' : (displayName ?? 'Player')

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-vt-void text-vt-text px-6
      pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <ScanlineOverlay />
      <div className="relative w-full max-w-xs flex-1 flex flex-col">

        {/* Content pinned to the top. */}
        <div className="flex flex-col gap-6">
          {/* Header — initials avatar + name upper-left, PAUSED upper-right. */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full grid place-items-center font-bold text-sm text-white
              bg-gradient-to-br from-neon-cyan to-neon-magenta ring-1 ring-white/15"
              role="img" aria-label={isGuest ? 'Guest avatar' : name}>
              {isGuest ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
                  <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.04 0-7.25 2.4-7.25 5.35V21h14.5v-1.4c0-2.95-3.21-5.35-7.25-5.35Z" />
                </svg>
              ) : initials(displayName ?? '')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-pixel text-sm font-semibold leading-tight truncate">{name}</div>
              {subline && (
                <div className="font-grotesk text-[10px] tracking-[0.18em] uppercase text-vt-dim mt-0.5 truncate">{subline}</div>
              )}
            </div>
            <div className="font-grotesk text-[11px] tracking-[0.18em] uppercase font-semibold text-vt-cyan text-glow-vt-cyan">
              Paused
            </div>
          </div>

          {/* Guest invite (P4) — save this run by making an account. */}
          {isGuest && onSignUp && (
            <button
              onClick={onSignUp}
              className="w-full rounded-2xl px-4 py-2.5 text-left flex items-center justify-between
                bg-vt-magenta/10 ring-1 ring-vt-magenta/40 transition hover:bg-vt-magenta/15"
            >
              <span className="text-xs text-vt-text">Sign up to save this run &amp; rank</span>
              <span className="text-vt-magenta text-glow-vt-magenta text-lg leading-none">→</span>
            </button>
          )}

          {/* Metadata cards — the mode's stat readout, full width. */}
          {children}

          {/* Sound — full width, matching the cards above and buttons below. */}
          <ChannelControl
            label="Sound"
            enabled={soundEnabled}
            volume={sfxVolume}
            onToggle={() => {
              const next = !soundEnabled
              setSoundEnabled(next)
              if (next) { sfx.unlock(); sfx.uiTap() }
              haptics.uiTap()
            }}
            onVolume={setSfxVolume}
            onVolumeCommit={() => { sfx.unlock(); sfx.uiTap() }}
          />
        </div>

        {/* Actions (P3) — pinned to the bottom. Resume full-width; Restart +
            Exit share the row beneath. */}
        <div className="mt-auto pt-8 flex flex-col gap-3">
          <NeonButton variant="primary" size="lg" fullWidth onClick={onResume}>Resume</NeonButton>
          {onRestart ? (
            <div className="flex gap-3">
              <NeonButton variant="amber" fullWidth onClick={onRestart}>Restart</NeonButton>
              <NeonButton variant="danger" fullWidth onClick={onExit}>Exit</NeonButton>
            </div>
          ) : (
            <NeonButton variant="danger" fullWidth onClick={onExit}>Exit to Home</NeonButton>
          )}
        </div>
      </div>
    </div>
  )
}
