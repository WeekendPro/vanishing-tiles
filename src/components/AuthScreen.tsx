import { useState } from 'react'
import { signInAsGuest, signInWithApple, signInWithGoogle } from '../lib/auth'
import { useNavStore } from '../store/navStore'

export function AuthScreen() {
  const goJourney = useNavStore(s => s.goJourney)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center px-4">
      <div className="inline-flex flex-col items-stretch w-full max-w-sm text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Mind The Gap</h1>
        <p className="text-gray-400 mb-8">Sign in to start your journey.</p>

        <button disabled={busy} onClick={() => run(signInWithApple, false)}
          className="w-full py-3 mb-3 rounded-xl font-bold bg-white text-black hover:bg-gray-200 disabled:opacity-50">
          Sign in with Apple
        </button>
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
