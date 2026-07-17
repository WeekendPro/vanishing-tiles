import { useEffect, useState } from 'react'
import { getUser, signOut } from '../lib/auth'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { useShallow } from 'zustand/shallow'
import { sfx } from '../lib/sfx'
import { ScanlineOverlay } from './ui'

interface MenuUser {
  name: string
  email: string | null
  avatarUrl: string | null
  isGuest: boolean
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Avatar({ user }: { user: MenuUser }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/15" />
  }
  if (user.isGuest) {
    // Guests get a generic person icon — "GU" initials read as a weird
    // pseudo-name, and the familiar silhouette says "anonymous" at a glance.
    return (
      <div
        role="img"
        aria-label="Guest avatar"
        className="w-12 h-12 rounded-full grid place-items-center text-white
          bg-gradient-to-br from-neon-cyan to-neon-magenta ring-1 ring-white/15"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
          <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.04 0-7.25 2.4-7.25 5.35V21h14.5v-1.4c0-2.95-3.21-5.35-7.25-5.35Z" />
        </svg>
      </div>
    )
  }
  return (
    <div className="w-12 h-12 rounded-full grid place-items-center font-black text-lg text-white
      bg-gradient-to-br from-neon-cyan to-neon-magenta ring-1 ring-white/15">
      {initials(user.name)}
    </div>
  )
}

/** One audio channel's row: a toggle (styled like the menu's Actions) plus a
 *  volume slider that dims/disables while the channel is off. Shared with the
 *  Sound Design lab, which shows the same two channels above its knobs. */
export function ChannelControl({ label, enabled, volume, onToggle, onVolume, onVolumeCommit }: {
  label: string
  enabled: boolean
  volume: number
  onToggle: () => void
  onVolume: (v: number) => void
  /** Fired when the user releases the slider — a chance to preview the level. */
  onVolumeCommit?: () => void
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <button
        onClick={onToggle}
        className="w-44 shrink-0 text-left font-pixel uppercase tracking-[0.08em] text-base text-gray-200 hover:text-neon-cyan"
      >
        {label}: {enabled ? 'On' : 'Off'}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        disabled={!enabled}
        aria-label={`${label} volume`}
        onChange={e => onVolume(Number(e.target.value) / 100)}
        onPointerUp={onVolumeCommit}
        className="flex-1 min-w-0 accent-cyan-400 disabled:opacity-30"
      />
    </div>
  )
}

function Action({ label, onClick, tone = 'default' }:
  { label: string; onClick: () => void; tone?: 'default' | 'muted' | 'danger' }) {
  const color = tone === 'danger' ? 'text-neon-red hover:text-glow-red'
    : tone === 'muted' ? 'text-arcade-edge hover:text-gray-300'
    : 'text-gray-200 hover:text-neon-cyan'
  return (
    <button onClick={onClick} className={`flex items-center gap-2.5 text-left font-pixel uppercase tracking-[0.08em] text-base py-3 ${color}`}>
      {label}
    </button>
  )
}

export function GlobalMenu() {
  const appView = useNavStore(s => s.appView)
  const { goHome, goLeaderboard, goSoundDesign, reset: resetNav } = useNavStore(useShallow(s => ({
    goHome: s.goHome,
    goLeaderboard: s.goLeaderboard,
    goSoundDesign: s.goSoundDesign,
    reset: s.reset,
  })))
  const { pauseGame, resumeGame, resetGame } = useGameStore(useShallow(s => ({
    pauseGame: s.pauseGame,
    resumeGame: s.resumeGame,
    resetGame: s.resetGame,
  })))
  const {
    soundEnabled, setSoundEnabled, sfxVolume, setSfxVolume,
    musicEnabled, setMusicEnabled, musicVolume, setMusicVolume,
  } = useSettingsStore(useShallow(s => ({
    soundEnabled: s.settings.soundEnabled,
    setSoundEnabled: s.setSoundEnabled,
    sfxVolume: s.settings.sfxVolume,
    setSfxVolume: s.setSfxVolume,
    musicEnabled: s.settings.musicEnabled,
    setMusicEnabled: s.setMusicEnabled,
    musicVolume: s.settings.musicVolume,
    setMusicVolume: s.setMusicVolume,
  })))

  // Stagger runs its own pause/exit, so the only in-game hosts here are the
  // Journey/Practice round shells.
  const inGame = appView === 'playing' || appView === 'practice'
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<MenuUser | null>(null)

  useEffect(() => {
    let cancelled = false
    getUser().then(({ data }) => {
      if (cancelled || !data.user) return
      const m = data.user.user_metadata ?? {}
      const isGuest = data.user.is_anonymous ?? false
      const name = (m.full_name || m.name || data.user.email?.split('@')[0] || (isGuest ? 'Guest' : 'Player')) as string
      setUser({
        name,
        email: data.user.email ?? null,
        avatarUrl: (m.avatar_url || m.picture || null) as string | null,
        isGuest,
      })
    })
    return () => { cancelled = true }
  }, [])

  const openMenu = () => { if (inGame) pauseGame(); setOpen(true) }
  const close = () => { if (inGame) resumeGame(); setOpen(false) }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const quitToHome = () => { setOpen(false); resetGame(); goHome() }
  // Leaving a paused Journey/Practice round for the leaderboard is a quit —
  // same teardown as quitToHome, different destination.
  const openLeaderboard = () => { setOpen(false); if (inGame) resetGame(); goLeaderboard() }
  const openSoundDesign = () => { setOpen(false); if (inGame) resetGame(); goSoundDesign() }
  const handleSignOut = async () => { setOpen(false); await signOut(); resetNav() }

  return (
    <>
      <button
        onClick={open ? close : openMenu}
        aria-label="Menu"
        aria-expanded={open}
        className="fixed top-3 right-3 z-50 grid place-items-center w-10 h-10 rounded-xl
          border border-arcade-edge bg-arcade-panel/60 text-gray-200 hover:border-neon-cyan hover:text-neon-cyan
          transition-colors"
      >
        {open ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <span className="flex flex-col gap-[5px]">
            <span className="block w-5 h-0.5 rounded-full bg-current" />
            <span className="block w-5 h-0.5 rounded-full bg-current" />
            <span className="block w-5 h-0.5 rounded-full bg-current" />
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col px-7 pt-20 pb-8 text-white
          bg-gradient-to-b from-arcade-bg via-arcade-panel to-black">
          <ScanlineOverlay />
          {inGame && (
            <div className="font-pixel text-[9px] uppercase tracking-[0.2em] text-neon-cyan text-glow-cyan mb-1">Paused</div>
          )}
          {user && (
            <div className="flex items-center gap-3 mb-8">
              <Avatar user={user} />
              <div className="min-w-0">
                <div className="font-pixel text-sm leading-tight truncate">{user.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {user.email ?? (user.isGuest ? 'Guest session' : '')}
                </div>
              </div>
            </div>
          )}

          {inGame && (
            <>
              <Action label="Resume" onClick={close} />
              <Action
                label={appView === 'practice' ? 'Exit Practice' : 'Exit to Home'}
                onClick={quitToHome}
              />
            </>
          )}

          {/* Global rankings — visible to guests too (the board is public;
              only RANKING needs a named account). */}
          <Action label="Leaderboard" onClick={openLeaderboard} />

          {/* Audio channels — SFX and the ambient music bed are independent:
              each gets its own toggle + volume slider. Re-enabling SFX (or
              releasing its slider) plays the tiny UI tick as instant
              confirmation — those taps also satisfy the browser's
              audio-unlock gesture. */}
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
          <ChannelControl
            label="Music"
            enabled={musicEnabled}
            volume={musicVolume}
            onToggle={() => {
              setMusicEnabled(!musicEnabled)
              if (!musicEnabled) sfx.unlock()
            }}
            onVolume={setMusicVolume}
          />

          {/* The calibration lab: every game sound as knobs + replay + saved
              presets. Deliberately visible pre-launch — tuning on the live
              build IS the current workflow. */}
          <Action label="Sound Design" onClick={openSoundDesign} />

          {/* A full Settings screen is deliberately absent — the lone sound
              toggle above rides inline until there's more to expose. Training left
              the menu when it became "mode zero" on the Home switch — one home,
              not two paths to the same door.

              Guests never logged in, so "Logout" is the wrong ask — their exit
              ramp is SIGN UP: terminate the anonymous session and land on
              AuthScreen, where they can create the account (or sign in). Same
              teardown either way; only the framing differs. */}
          <div className="mt-auto">
            {user?.isGuest
              ? <Action label="Sign up" onClick={handleSignOut} />
              : <Action label="Logout" tone="danger" onClick={handleSignOut} />}
          </div>
        </div>
      )}
    </>
  )
}
