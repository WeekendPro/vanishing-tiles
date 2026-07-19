import type { ReactNode } from 'react'
import { useShallow } from 'zustand/shallow'
import { useSettingsStore } from '../../store/settingsStore'
import { useProfileStore } from '../../store/profileStore'
import { sfx } from '../../lib/sfx'
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

// Who's playing, up top: an initials avatar + display name for signed-in
// players; a generic person icon + a quiet "get on the leaderboard" nudge for
// guests. Deliberately light — no "signed in" label, no edit affordance; the
// pause screen is for pausing, not account management.
function PauseIdentity({ onSignUp }: { onSignUp?: () => void }) {
  const { displayName, isGuest, avatarUrl } = useProfileStore(useShallow(s => ({
    displayName: s.displayName, isGuest: s.isGuest, avatarUrl: s.avatarUrl,
  })))

  if (isGuest) {
    return (
      <div className="flex flex-col items-center gap-2.5">
        <div
          role="img"
          aria-label="Guest avatar"
          className="w-11 h-11 rounded-xl grid place-items-center bg-vt-raised border border-vt-edge text-vt-faint"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-6 h-6" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </div>
        <div className="font-grotesk text-sm text-vt-dim">Guest</div>
        {onSignUp && (
          <div className="text-center font-grotesk text-[11px] leading-relaxed text-vt-dim">
            Playing without an account.<br />
            <button
              onClick={onSignUp}
              className="mt-0.5 font-semibold text-vt-lime text-glow-vt-lime border-b border-dashed border-vt-lime/50 pb-px"
            >
              Sign up to get on the leaderboard →
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2.5">
      {avatarUrl ? (
        <img src={avatarUrl} alt={displayName ?? 'Player'} className="w-11 h-11 rounded-xl object-cover ring-1 ring-vt-cyan/35" />
      ) : (
        <div className="w-11 h-11 rounded-xl grid place-items-center font-bold text-[17px] text-vt-cyan
          bg-gradient-to-br from-[#20303a] to-[#141420] border border-vt-cyan/35 shadow-[0_0_16px_rgba(40,240,255,0.2)]">
          {initials(displayName ?? '')}
        </div>
      )}
      <div className="font-grotesk font-semibold text-[15px] text-vt-text">{displayName}</div>
    </div>
  )
}

/**
 * The hard-pause screen shared by Infinite Stagger and Training: covers
 * everything (no memorizing while frozen), shows who's playing + the run's live
 * stats so a pause doubles as an identity/scoreboard check, a Sound row (a pause
 * is exactly when you discover the volume is wrong mid-run), then the action
 * buttons.
 *
 * Buttons follow the game-over hierarchy: Resume is the full-width hero; when
 * `onRestart` is supplied (Stagger — "this run's cooked, start fresh") it and
 * Exit share a half-width row beneath, so the small paired buttons can't be
 * fat-fingered in place of Resume. Without `onRestart` (Training) it's just
 * Resume + Exit.
 *
 * `children` is the mode's stat readout — each mode surfaces its own metadata
 * (Stagger: score / lives / streak; Training: streak / best / miss / avg speed).
 */
export function PauseOverlay({
  onResume, onExit, onRestart, onSignUp, children,
}: {
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7
      bg-vt-void text-vt-text px-6">
      <ScanlineOverlay />

      <PauseIdentity onSignUp={onSignUp} />

      <div className="w-full max-w-xs h-px bg-white/10" />

      <div className="font-silk text-lg text-vt-cyan text-glow-vt-cyan uppercase tracking-[0.2em]">Paused</div>
      {children}
      <div className="w-full max-w-xs border-y border-white/10">
        <ChannelControl
          label="Sound"
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

      <div className="flex flex-col gap-3 w-full max-w-[260px]">
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
  )
}
