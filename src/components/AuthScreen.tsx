import { useState } from 'react'
import { signInAsGuest, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../lib/auth'
import { useNavStore } from '../store/navStore'
import { track } from '../store/asyncStatus'
import { Wordmark } from './ui/Wordmark'

// The blooming-gap motif above the wordmark: a 4×2 grid where three magenta
// cells flicker. Each lit cell carries its OWN (incommensurate) duration + delay
// so the trio never pulses in lockstep — a soft, organic, non-mechanical glow.
const MOTIF_CELLS: ({ dur: number; delay: number } | null)[] = [
  null,             { dur: 4.2, delay: 0 },   { dur: 5.6, delay: 1.9 }, null,
  { dur: 3.4, delay: 1.1 }, null,             null,                     null,
]

// Floating field label that notches the panel edge (mockup: small caps, faint).
// Hoisted to module scope so the inputs aren't remounted on every keystroke.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute -top-[7px] left-3 z-10 px-1.5 bg-phos-panel font-grotesk text-[9px] tracking-[0.12em] uppercase text-phos-faint">
        {label}
      </span>
      {children}
    </div>
  )
}

export function AuthScreen() {
  const goHome = useNavStore(s => s.goHome)
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
      if (navigate) goHome()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy

  // Lit-hardware input: dark fill, faint edge, cyan focus glow.
  const inputClass =
    'w-full h-12 px-3.5 rounded-[11px] bg-[#0a0a12] text-phos-text font-grotesk text-sm ' +
    'border border-white/10 placeholder-phos-faint shadow-[inset_0_1px_2px_#000] ' +
    'focus:outline-none focus:border-phos-cyan ' +
    'focus:shadow-[inset_0_1px_2px_#000,0_0_0_1px_rgba(40,240,255,0.33),0_0_14px_rgba(40,240,255,0.2)] ' +
    'disabled:opacity-50'

  return (
    <div className="relative min-h-dvh phos-vignette flex items-center justify-center px-6 overflow-hidden">
      <div className="relative w-full max-w-sm rounded-[28px] bg-phos-panel border border-white/5 shadow-[0_40px_90px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] px-7 py-9 flex flex-col items-center">

        {/* Faint blooming-gap motif above the wordmark. */}
        <div className="grid grid-cols-4 gap-[3px] mb-7 opacity-60" aria-hidden="true">
          {MOTIF_CELLS.map((cell, i) => (
            <span
              key={i}
              className={`w-4 h-4 rounded-[3px] ${
                cell
                  ? 'bg-phos-magenta shadow-[0_0_8px_#FF2D9B,0_0_18px_rgba(255,45,155,0.53)] phos-flicker'
                  : 'bg-phos-raised'
              }`}
              style={cell ? { animationDuration: `${cell.dur}s`, animationDelay: `${cell.delay}s` } : undefined}
            />
          ))}
        </div>

        {/* Brand. */}
        <div className="text-center mb-8">
          <Wordmark size="lg" />
          <p className="mt-2.5 font-grotesk text-[10px] tracking-[0.22em] uppercase text-phos-magenta text-glow-phos-magenta">
            A memory game
          </p>
        </div>

        {/* Form. */}
        <div className="w-full flex flex-col gap-3">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={busy}
              autoComplete="email"
              aria-label="Email"
              placeholder="you@email.com"
              className={inputClass}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={busy}
              autoComplete="current-password"
              aria-label="Password"
              placeholder="••••••••"
              className={inputClass}
            />
          </Field>

          <button
            disabled={!canSubmit}
            onClick={() => run(() => signInWithEmail(email, password), true)}
            className="mt-1 h-12 rounded-[11px] inline-flex items-center justify-center gap-2
              border-2 border-phos-cyan bg-phos-raised text-phos-cyan
              font-grotesk text-[13px] tracking-[0.1em] uppercase
              shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_16px_rgba(40,240,255,0.27)]
              hover:bg-phos-cyan/10 transition-colors active:translate-y-px
              disabled:opacity-50 disabled:pointer-events-none"
          >
            Enter →
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => run(() => signUpWithEmail(email, password), true)}
            className="h-11 rounded-[11px] inline-flex items-center justify-center
              border border-white/10 bg-phos-raised text-phos-dim
              font-grotesk text-[12px] tracking-[0.06em]
              hover:text-phos-text hover:border-white/20 transition-colors active:translate-y-px
              disabled:opacity-50 disabled:pointer-events-none"
          >
            Create account
          </button>

          {/* Divider. */}
          <div className="flex items-center gap-3 my-2 font-grotesk text-[10px] tracking-[0.14em] uppercase text-phos-faint">
            <span className="h-px flex-1 bg-white/10" />
            <span>or</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* Google OAuth — outlined. */}
          <button
            disabled={busy}
            onClick={() => run(signInWithGoogle, false)}
            className="h-12 rounded-[11px] inline-flex items-center justify-center gap-2
              border-2 border-white/15 bg-phos-raised text-phos-text
              font-grotesk text-[12px] tracking-[0.04em]
              shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]
              hover:border-white/30 transition-colors active:translate-y-px
              disabled:opacity-50 disabled:pointer-events-none"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
              <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
            </svg>
            Continue with Google
          </button>

          {/* Guest path — kept friendly. */}
          <button
            disabled={busy}
            onClick={() => run(signInAsGuest, true)}
            className="mt-3 text-center font-grotesk text-[12px] tracking-[0.04em] text-phos-dim
              hover:text-phos-text transition-colors disabled:opacity-50"
          >
            Just visiting?{' '}
            <span className="text-phos-cyan border-b border-phos-cyan/40">Continue as guest</span>
          </button>

          {error && <p className="font-grotesk text-phos-red text-glow-phos-red text-sm text-center mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
