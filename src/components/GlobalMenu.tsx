import { useEffect, useState, type ReactNode } from 'react'
import { signOut } from '../lib/auth'
import { useNavStore } from '../store/navStore'
import { useTrainingStore } from '../store/trainingStore'
import { useSettingsStore } from '../store/settingsStore'
import { useProfileStore } from '../store/profileStore'
import { useShallow } from 'zustand/shallow'
import { sfx } from '../lib/sfx'
import { analytics } from '../lib/analytics'
import { eraseStaggerRecords, deleteOwnAccount } from '../lib/api'
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
    <div className="w-12 h-12 rounded-full grid place-items-center font-bold text-base text-white
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

/** The menu's list glyphs — monochrome line icons that anchor each row and take
 *  the row's hover color via `currentColor`. */
const ICONS = {
  leaderboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0V4Z" />
      <path d="M18 5h2a2 2 0 0 1 0 4h-1.2M6 5H4a2 2 0 0 0 0 4h1.2" />
    </svg>
  ),
  training: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><circle cx="12" cy="12" r="0.4" fill="currentColor" />
    </svg>
  ),
  sound: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5ZM16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12" />
    </svg>
  ),
}

/** A navigation row: glyph + title + smaller/lighter subtitle, split from its
 *  neighbours by a hairline rule (no box). Hover lifts the whole row to cyan. */
function NavRow({ icon, title, subtitle, onClick }:
  { icon: ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 py-4 border-t border-white/[0.07] text-left
        text-gray-200 hover:text-neon-cyan transition-colors group"
    >
      <span className="w-5 h-5 shrink-0 text-vt-dim group-hover:text-neon-cyan transition-colors">{icon}</span>
      <span className="min-w-0">
        <span className="block font-pixel uppercase tracking-[0.06em] text-[15px]">{title}</span>
        <span className="block text-xs text-gray-400 mt-0.5 leading-snug">{subtitle}</span>
      </span>
    </button>
  )
}

export function GlobalMenu() {
  const { goLeaderboard, goTraining, goSoundDesign, reset: resetNav } = useNavStore(useShallow(s => ({
    goLeaderboard: s.goLeaderboard,
    goTraining: s.goTraining,
    goSoundDesign: s.goSoundDesign,
    reset: s.reset,
  })))
  const startTraining = useTrainingStore(s => s.start)
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

  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  // Sound Design is a developer instrument — the local dev session only, never
  // the deployed build (isAdminEnv). "Erase My Data" below is NOT gated: it's a
  // real, user-facing account/data control available to everyone.
  const admin = isAdminEnv()

  // "Erase My Data" confirmation modal. `scope` is the radio choice:
  //   'ingame'  → wipe only leaderboard/game history, keep the account (0017 RPC)
  //   'account' → delete the whole account, cascading all game data (0018 RPC)
  const [dataOpen, setDataOpen] = useState(false)
  const [scope, setScope] = useState<'ingame' | 'account'>('ingame')
  const [dataBusy, setDataBusy] = useState(false)
  const [dataDone, setDataDone] = useState(false)   // in-game success (account navigates away)
  const [dataError, setDataError] = useState(false)

  useEffect(() => {
    if (!loaded) void loadProfile()
  }, [loaded, loadProfile])

  // Guests show as Guest; the email prefix only bridges the (unreachable
  // post-gate) unnamed non-guest case.
  const name = displayName ?? (isGuest ? 'Guest' : email?.split('@')[0] ?? '')

  const openMenu = () => { setOpen(true) }
  const closeEraseData = () => { setDataOpen(false); setDataBusy(false); setDataDone(false); setDataError(false); setScope('ingame') }
  const close = () => { setOpen(false); setEditOpen(false); closeEraseData() }

  const openEraseData = () => { setDataDone(false); setDataError(false); setScope('ingame'); setDataOpen(true) }

  // Runs the chosen erase. In-game data wipes the leaderboard rows and shows an
  // in-modal confirmation; account deletion nukes the auth user (cascading all
  // data) and — since the session now points at a deleted user — immediately
  // tears down and lands on AuthScreen, same teardown as Logout.
  const handleEraseData = async () => {
    setDataBusy(true)
    setDataError(false)
    try {
      if (scope === 'account') {
        await deleteOwnAccount()
        setDataOpen(false)
        setOpen(false)
        clearProfile()
        await signOut()
        resetNav()
      } else {
        await eraseStaggerRecords()
        setDataDone(true)
      }
    } catch {
      setDataError(true)
    } finally {
      setDataBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const openLeaderboard = () => { setOpen(false); analytics.leaderboardOpened(); goLeaderboard() }
  // The menu tap is a user gesture, so it doubles as the audio unlock —
  // Training's first bloom fires from a timer, and the context must already
  // be running by then (same reason HomeScreen's PLAY unlocks).
  const openTraining = () => {
    setOpen(false)
    sfx.unlock()
    analytics.trainingStarted()
    startTraining()
    goTraining()
  }
  const openSoundDesign = () => { setOpen(false); goSoundDesign() }
  const handleSignOut = async () => { setOpen(false); clearProfile(); await signOut(); resetNav() }

  return (
    <>
      <button
        onClick={open ? close : openMenu}
        aria-label="Menu"
        aria-expanded={open}
        className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-50
          grid place-items-center w-10 h-10 rounded-xl
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
          {/* Profile header — for players it's a button: tap to edit your
              display name (the only profile field there is). Guests have
              nothing to edit, so theirs stays inert. */}
          {loaded && (
            isGuest ? (
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={name} avatarUrl={avatarUrl} isGuest />
                <div className="min-w-0">
                  <div className="font-pixel text-sm leading-tight truncate">Playing as Guest</div>
                  <div className="text-xs text-gray-400 truncate">Not ranked · scores aren’t saved</div>
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

          {/* Guest invite — a real call to action under the avatar: turn the
              anonymous session into a named account (same sign-up teardown as
              the old bottom "Sign up" link, which this replaces). Kept free of
              the word "free" — the game is, and saying so implies it might not
              be. */}
          {loaded && isGuest && (
            <button
              onClick={handleSignOut}
              className="mb-8 w-full rounded-2xl px-4 py-3 text-left flex items-center justify-between
                bg-gradient-to-r from-neon-cyan/15 to-neon-magenta/15 ring-1 ring-neon-cyan/40
                transition hover:ring-neon-cyan/70"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">Create an account</span>
                <span className="block text-xs text-gray-400">Save your runs &amp; climb the leaderboard</span>
              </span>
              <span className="text-neon-cyan text-lg leading-none shrink-0 ml-3">→</span>
            </button>
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

          <div className="flex flex-col">
            {/* Global rankings — visible to guests too (the board is public;
                only RANKING needs a named account). */}
            <NavRow
              icon={ICONS.leaderboard}
              title="Leaderboard"
              subtitle="See where you rank against players worldwide"
              onClick={openLeaderboard}
            />

            {/* The consequence-free naming drill — this menu entry is its only
                way in since it left the Home mode switch. */}
            <NavRow
              icon={ICONS.training}
              title="Training"
              subtitle="Learn the tile shapes and build your memory for longer sequences"
              onClick={openTraining}
            />

            {/* Sound: same row rhythm (glyph + hairline), but the "subtitle"
                slot is the volume slider itself — label + toggle up top, slider
                full-width beneath. Re-enabling (or releasing the slider) plays
                the tiny UI tick as instant confirmation — those taps also
                satisfy the browser's audio-unlock gesture. (Music left with the
                synth bed; its channel returns with the produced audio bed.) */}
            <div className="flex items-start gap-3.5 py-4 border-t border-b border-white/[0.07]">
              <span className="w-5 h-5 shrink-0 mt-1 text-vt-dim">{ICONS.sound}</span>
              <div className="flex-1 min-w-0">
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
            </div>

            {/* The calibration lab: every game sound as knobs + replay + saved
                presets. Admin-only — a developer instrument, never on the
                deployed build (isAdminEnv). */}
            {admin && <Action label="Sound Design" onClick={openSoundDesign} />}
          </div>

          {/* A full Settings screen is deliberately absent — the lone sound
              toggle above rides inline until there's more to expose.

              Erase My Data + the exit control are pinned to the bottom. Erase
              My Data opens a confirmation modal (in-game data vs whole account);
              it's a real user-facing control, shown to everyone including
              guests (guests have an anon account + game history too).

              Guests never logged in, so "Logout" is the wrong ask — and their
              SIGN UP ramp already lives in the invite banner up top, so the
              bottom row is just Erase My Data for them. Members get Logout. */}
          <div className="mt-auto flex flex-col">
            <Action label="Erase My Data" tone="danger" onClick={openEraseData} />
            {!isGuest && <Action label="Logout" tone="danger" onClick={handleSignOut} />}
          </div>

          {dataOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70">
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Erase my data"
                className="relative w-full max-w-sm rounded-[28px] bg-vt-panel border border-white/5 shadow-[0_40px_90px_rgba(0,0,0,0.6)] px-7 py-8"
              >
                {dataDone ? (
                  // In-game data erased — the whole account survives, so we stay
                  // put and just confirm.
                  <div className="text-center">
                    <h2 className="font-silk text-sm text-neon-green uppercase tracking-[0.15em] mb-2">Done</h2>
                    <p className="text-sm text-gray-300 mb-7">
                      Your in-game data has been erased. Your profile and account are untouched.
                    </p>
                    <button
                      onClick={closeEraseData}
                      className="w-full rounded-full bg-white/10 hover:bg-white/15 py-3 font-pixel uppercase tracking-[0.1em] text-sm text-white"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="font-silk text-sm text-neon-red uppercase tracking-[0.15em] mb-2 text-center">
                      Erase my data
                    </h2>
                    <p className="text-sm text-gray-300 mb-6 text-center">
                      This is permanent and can’t be undone. Choose what to erase:
                    </p>

                    <div className="flex flex-col gap-2.5 mb-6">
                      <EraseOption
                        checked={scope === 'ingame'}
                        onSelect={() => setScope('ingame')}
                        title="Erase my In-Game Data"
                        subtitle="Keeps your profile, but deletes your game history from the leaderboards."
                      />
                      <EraseOption
                        checked={scope === 'account'}
                        onSelect={() => setScope('account')}
                        title="Erase my Account"
                        subtitle="Your game history along with your profile and account will be deleted."
                      />
                    </div>

                    {dataError && (
                      <p className="text-xs text-neon-red mb-4 text-center">Something went wrong. Please try again.</p>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={closeEraseData}
                        disabled={dataBusy}
                        className="flex-1 rounded-full bg-white/10 hover:bg-white/15 py-3 font-pixel uppercase tracking-[0.1em] text-sm text-white disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleEraseData}
                        disabled={dataBusy}
                        className="flex-1 rounded-full bg-neon-red/90 hover:bg-neon-red py-3 font-pixel uppercase tracking-[0.1em] text-sm text-white disabled:opacity-50"
                      >
                        {dataBusy ? 'Erasing…' : 'Erase'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/** One radio row in the Erase-my-data modal: a real radio input (accessible +
 *  keyboard-selectable) with a custom dot, title, and explanatory subtitle. */
function EraseOption({ checked, onSelect, title, subtitle }:
  { checked: boolean; onSelect: () => void; title: string; subtitle: string }) {
  return (
    <label
      className={`flex gap-3 items-start cursor-pointer rounded-2xl border px-4 py-3 transition-colors ${
        checked ? 'border-neon-red/70 bg-neon-red/10' : 'border-white/10 hover:border-white/20'
      }`}
    >
      <input
        type="radio"
        name="erase-scope"
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 grid place-items-center w-4 h-4 rounded-full border flex-none ${
          checked ? 'border-neon-red' : 'border-white/40'
        }`}
      >
        {checked && <span className="w-2 h-2 rounded-full bg-neon-red" />}
      </span>
      <span className="min-w-0">
        <span className="block font-pixel uppercase tracking-[0.06em] text-sm text-white">{title}</span>
        <span className="block text-xs text-gray-400 mt-1 leading-snug">{subtitle}</span>
      </span>
    </label>
  )
}
