import { useEffect, useState } from 'react'
import { signOut } from '../lib/auth'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { useTrainingStore } from '../store/trainingStore'
import { useSettingsStore } from '../store/settingsStore'
import { useProfileStore } from '../store/profileStore'
import { useShallow } from 'zustand/shallow'
import { sfx } from '../lib/sfx'
import { analytics } from '../lib/analytics'
import { eraseStaggerRecords } from '../lib/api'
import { isAdminEnv } from '../lib/config'
import { ScanlineOverlay, ChannelControl } from './ui'
import { DisplayNameForm } from './DisplayNameForm'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Avatar({ name, avatarUrl, isGuest }: { name: string; avatarUrl: string | null; isGuest: boolean }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/15" />
  }
  if (isGuest) {
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
      {initials(name)}
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
  const { goHome, goLeaderboard, goTraining, goSoundDesign, reset: resetNav } = useNavStore(useShallow(s => ({
    goHome: s.goHome,
    goLeaderboard: s.goLeaderboard,
    goTraining: s.goTraining,
    goSoundDesign: s.goSoundDesign,
    reset: s.reset,
  })))
  const startTraining = useTrainingStore(s => s.start)
  const { pauseGame, resumeGame, resetGame } = useGameStore(useShallow(s => ({
    pauseGame: s.pauseGame,
    resumeGame: s.resumeGame,
    resetGame: s.resetGame,
  })))
  const { soundEnabled, setSoundEnabled, sfxVolume, setSfxVolume } = useSettingsStore(useShallow(s => ({
    soundEnabled: s.settings.soundEnabled,
    setSoundEnabled: s.setSoundEnabled,
    sfxVolume: s.settings.sfxVolume,
    setSfxVolume: s.setSfxVolume,
  })))

  // Identity comes from profileStore — public.profiles is the same source
  // the leaderboard reads, so the menu and the board can never disagree.
  const { loaded, displayName, isGuest, email, avatarUrl, loadProfile, clearProfile } =
    useProfileStore(useShallow(s => ({
      loaded: s.loaded, displayName: s.displayName, isGuest: s.isGuest,
      email: s.email, avatarUrl: s.avatarUrl,
      loadProfile: s.loadProfile, clearProfile: s.clear,
    })))

  // Stagger runs its own pause/exit, so the only in-game hosts here are the
  // Journey/Practice round shells.
  const inGame = appView === 'playing' || appView === 'practice'
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  // Admin-only tools (Sound Design + Erase My Records) show only in the local
  // dev session — never on the deployed build. `erase` walks a tiny confirm →
  // working → done state machine so a destructive tap can't fire by accident.
  const admin = isAdminEnv()
  const [erase, setErase] = useState<'idle' | 'confirm' | 'working' | 'done'>('idle')

  useEffect(() => {
    if (!loaded) void loadProfile()
  }, [loaded, loadProfile])

  // Guests show as Guest; the email prefix only bridges the (unreachable
  // post-gate) unnamed non-guest case.
  const name = displayName ?? (isGuest ? 'Guest' : email?.split('@')[0] ?? '')

  const openMenu = () => { if (inGame) pauseGame(); setOpen(true) }
  const close = () => { if (inGame) resumeGame(); setOpen(false); setEditOpen(false); setErase('idle') }

  // Wipe the caller's own leaderboard records (all modes) via the 0017 RPC.
  // On success the boards re-fetch fresh the next time they open.
  const handleErase = async () => {
    setErase('working')
    try {
      await eraseStaggerRecords()
      setErase('done')
    } catch {
      setErase('confirm')
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const quitToHome = () => { setOpen(false); resetGame(); goHome() }
  // Leaving a paused Journey/Practice round for the leaderboard is a quit —
  // same teardown as quitToHome, different destination.
  const openLeaderboard = () => { setOpen(false); if (inGame) resetGame(); analytics.leaderboardOpened(); goLeaderboard() }
  // The menu tap is a user gesture, so it doubles as the audio unlock —
  // Training's first bloom fires from a timer, and the context must already
  // be running by then (same reason HomeScreen's PLAY unlocks).
  const openTraining = () => {
    setOpen(false)
    if (inGame) resetGame()
    sfx.unlock()
    analytics.trainingStarted()
    startTraining()
    goTraining()
  }
  const openSoundDesign = () => { setOpen(false); if (inGame) resetGame(); goSoundDesign() }
  const handleSignOut = async () => { setOpen(false); clearProfile(); await signOut(); resetNav() }

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
          {/* Profile header — for players it's a button: tap to edit your
              display name (the only profile field there is). Guests have
              nothing to edit, so theirs stays inert. */}
          {loaded && (
            isGuest ? (
              <div className="flex items-center gap-3 mb-8">
                <Avatar name={name} avatarUrl={avatarUrl} isGuest />
                <div className="min-w-0">
                  <div className="font-pixel text-sm leading-tight truncate">{name}</div>
                  <div className="text-xs text-gray-400 truncate">Guest session</div>
                </div>
              </div>
            ) : (
              <button
                aria-label="Edit profile"
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-3 mb-8 text-left group"
              >
                <Avatar name={name} avatarUrl={avatarUrl} isGuest={false} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-pixel text-sm leading-tight group-hover:text-neon-cyan transition-colors">
                    <span className="truncate">{name}</span>
                    {/* Pencil = "this is editable"; the whole header stays the tap target. */}
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                      className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-neon-cyan transition-colors"
                    >
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" />
                    </svg>
                  </div>
                  <div className="text-xs text-gray-400 truncate">{email ?? ''}</div>
                </div>
              </button>
            )
          )}

          {editOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70">
              <div className="relative w-full max-w-sm rounded-[28px] bg-vt-panel border border-white/5 shadow-[0_40px_90px_rgba(0,0,0,0.6)] px-7 py-8">
                <h2 className="font-silk text-sm text-vt-text uppercase tracking-[0.15em] mb-6 text-center">
                  Edit profile
                </h2>
                <DisplayNameForm
                  initialName={displayName ?? ''}
                  submitLabel="Save"
                  onDone={() => setEditOpen(false)}
                  onCancel={() => setEditOpen(false)}
                />
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

          {/* The consequence-free naming drill — this menu entry is its only
              way in since it left the Home mode switch. */}
          <Action label="Training" onClick={openTraining} />

          {/* Sound: toggle + volume. Re-enabling (or releasing the slider)
              plays the tiny UI tick as instant confirmation — those taps also
              satisfy the browser's audio-unlock gesture. (Music left with the
              synth bed; its channel returns with the produced audio bed.) */}
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

          {/* Admin-only tools — the local dev session only, never the deployed
              build (isAdminEnv). The Sound Design calibration lab is a
              developer instrument; Erase My Records wipes the signed-in user's
              own leaderboard records so the boards can be reset during testing. */}
          {admin && (
            <>
              <Action label="Sound Design" onClick={openSoundDesign} />
              {erase === 'done' ? (
                <div className="flex items-center gap-2.5 font-pixel uppercase tracking-[0.08em] text-base py-3 text-neon-green">
                  Records erased
                </div>
              ) : erase === 'idle' ? (
                <Action label="Erase My Records" tone="danger" onClick={() => setErase('confirm')} />
              ) : (
                <div className="flex flex-col gap-2 py-3">
                  <span className="font-pixel uppercase tracking-[0.08em] text-sm text-neon-red">
                    Erase all your leaderboard records?
                  </span>
                  <div className="flex items-center gap-5">
                    <button
                      onClick={handleErase}
                      disabled={erase === 'working'}
                      className="font-pixel uppercase tracking-[0.08em] text-base text-neon-red hover:text-glow-red disabled:opacity-50"
                    >
                      {erase === 'working' ? 'Erasing…' : 'Yes, erase'}
                    </button>
                    <button
                      onClick={() => setErase('idle')}
                      disabled={erase === 'working'}
                      className="font-pixel uppercase tracking-[0.08em] text-base text-arcade-edge hover:text-gray-300 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* A full Settings screen is deliberately absent — the lone sound
              toggle above rides inline until there's more to expose.

              Guests never logged in, so "Logout" is the wrong ask — their exit
              ramp is SIGN UP: terminate the anonymous session and land on
              AuthScreen, where they can create the account (or sign in). Same
              teardown either way; only the framing differs. */}
          <div className="mt-auto">
            {isGuest
              ? <Action label="Sign up" onClick={handleSignOut} />
              : <Action label="Logout" tone="danger" onClick={handleSignOut} />}
          </div>
        </div>
      )}
    </>
  )
}
