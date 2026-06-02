import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { signOut } from '../lib/auth'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'

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

function Avatar({ user, size }: { user: MenuUser; size: number }) {
  const dim = { width: size, height: size }
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        style={dim}
        className="rounded-full object-cover ring-1 ring-white/15"
      />
    )
  }
  return (
    <div
      style={dim}
      className="rounded-full grid place-items-center font-bold text-white
        bg-gradient-to-br from-cyan-400 to-indigo-600 ring-1 ring-white/15"
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(user.name)}</span>
    </div>
  )
}

function MenuItem({
  icon, label, onClick, danger,
}: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left
        transition-colors ${danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-gray-200 hover:bg-white/5'}`}
    >
      <span className="w-5 text-center text-base leading-none">{icon}</span>
      {label}
    </button>
  )
}

export function UserMenu() {
  const goPractice = useNavStore(s => s.goPractice)
  const reset = useNavStore(s => s.reset)
  const startPractice = useGameStore(s => s.startPractice)

  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<MenuUser | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
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

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const enterPractice = () => { setOpen(false); startPractice(); goPractice() }
  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    reset()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="grid place-items-center w-10 h-10 rounded-xl border border-gray-700
          bg-gray-900 text-gray-200 hover:border-gray-500 hover:bg-gray-800 transition-colors"
      >
        <span className="flex flex-col gap-[5px]">
          <span className="block w-5 h-0.5 rounded-full bg-current" />
          <span className="block w-5 h-0.5 rounded-full bg-current" />
          <span className="block w-5 h-0.5 rounded-full bg-current" />
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-64 z-50 rounded-2xl overflow-hidden
            border border-gray-700 bg-gray-900/95 backdrop-blur shadow-2xl shadow-black/50"
        >
          {user && (
            <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800">
              <Avatar user={user} size={40} />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{user.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {user.email ?? (user.isGuest ? 'Guest session' : '')}
                </div>
              </div>
            </div>
          )}

          <div className="py-1">
            <MenuItem icon="🎯" label="Training Mode" onClick={enterPractice} />
            <MenuItem icon="⚙️" label="Settings" onClick={() => setOpen(false)} />
          </div>

          <div className="border-t border-gray-800 py-1">
            <MenuItem icon="↩" label="Sign Out" onClick={handleSignOut} danger />
          </div>
        </div>
      )}
    </div>
  )
}
