import { useState } from 'react'
import { signInAsGuest, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../lib/auth'
import { useNavStore } from '../store/navStore'

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
      const { error } = await fn()
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
          className="w-full py-3 mb-3 rounded-xl font-bold bg-gray-100 text-black hover:bg-gray-300 disabled:opacity-50">
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
