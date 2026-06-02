import { useState } from 'react'
import { signInAsGuest, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../lib/auth'
import { useNavStore } from '../store/navStore'
import { track } from '../store/asyncStatus'

export function AuthScreen() {
  const goJourney = useNavStore(s => s.goJourney)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, navigate: boolean) => {
    setError(null)
    setBusy(true)
    try {
      const { error } = await track(fn())
      if (error) { setError(error.message); return }
      if (navigate) goJourney()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy

  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center px-4">
      <div className="inline-flex flex-col items-stretch w-full max-w-sm text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Mind The Gap</h1>
        <p className="text-gray-400 mb-8">Sign in to start your journey.</p>

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={busy}
          autoComplete="email"
          placeholder="Email"
          className="w-full py-3 px-4 mb-3 rounded-xl bg-gray-900 text-white placeholder-gray-500 border border-gray-800 focus:outline-none focus:border-gray-600 disabled:opacity-50"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={busy}
          autoComplete="current-password"
          placeholder="Password"
          className="w-full py-3 px-4 mb-3 rounded-xl bg-gray-900 text-white placeholder-gray-500 border border-gray-800 focus:outline-none focus:border-gray-600 disabled:opacity-50"
        />
        <button disabled={!canSubmit} onClick={() => run(() => signInWithEmail(email, password), true)}
          className="w-full py-3 mb-3 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
          Sign in
        </button>
        <button disabled={!canSubmit} onClick={() => run(() => signUpWithEmail(email, password), true)}
          className="w-full py-3 rounded-xl font-bold bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50">
          Create account
        </button>

        <div className="flex items-center gap-3 my-5">
          <span className="h-px flex-1 bg-gray-800" />
          <span className="text-gray-500 text-xs uppercase tracking-wide">or</span>
          <span className="h-px flex-1 bg-gray-800" />
        </div>

        <button disabled={busy} onClick={() => run(signInWithGoogle, false)}
          className="w-full py-3 mb-3 rounded-xl font-bold bg-gray-100 text-black hover:bg-gray-300 disabled:opacity-50 inline-flex items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
            <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
          </svg>
          Sign in with Google
        </button>
        <button disabled={busy} onClick={() => run(signInAsGuest, true)}
          className="w-full py-3 rounded-xl font-bold bg-green-700 text-white hover:bg-green-600 disabled:opacity-50">
          Play as Guest
        </button>

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </div>
    </div>
  )
}
