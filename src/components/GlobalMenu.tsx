import { useEffect, useState } from 'react'
import { getUser, signOut } from '../lib/auth'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { useProgressStore } from '../store/progressStore'
import { useShallow } from 'zustand/shallow'
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
  return (
    <div className="w-12 h-12 rounded-full grid place-items-center font-black text-lg text-white
      bg-gradient-to-br from-neon-cyan to-neon-magenta ring-1 ring-white/15">
      {initials(user.name)}
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
  const { goHome, reset: resetNav } = useNavStore(useShallow(s => ({
    goHome: s.goHome,
    reset: s.reset,
  })))
  const { pauseGame, resumeGame, resetGame } = useGameStore(useShallow(s => ({
    pauseGame: s.pauseGame,
    resumeGame: s.resumeGame,
    resetGame: s.resetGame,
  })))
  const resetProgress = useProgressStore(s => s.resetProgress)

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
  const handleSignOut = async () => { setOpen(false); await signOut(); resetNav() }
  // Admin/dev: wipe all saved scores so the journey starts fresh at level 1.
  const resetJourney = () => {
    if (!window.confirm('Reset Journey? This permanently wipes all level progress and scores.')) return
    setOpen(false)
    resetProgress()
    resetGame()
    goHome()
  }

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
                label={appView === 'practice' ? 'Exit Training Mode' : 'Exit to Home'}
                onClick={quitToHome}
              />
            </>
          )}

          <div className="mt-auto">
            <Action label="Settings" tone="muted" onClick={() => setOpen(false)} />
            <Action label="Reset Journey" tone="danger" onClick={resetJourney} />
            <Action label="Logout" tone="danger" onClick={handleSignOut} />
          </div>
        </div>
      )}
    </>
  )
}
