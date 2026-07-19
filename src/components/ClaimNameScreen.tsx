// The post-auth gate: a non-guest without a display name lands here before
// Home and can't proceed without claiming one (no skip — unnamed players
// can't rank, and "Player" placeholders are exactly what this feature
// retires). AuthScreen's panel language, minus the brand ceremony.
import { useShallow } from 'zustand/shallow'
import { useProfileStore } from '../store/profileStore'
import { useNavStore } from '../store/navStore'
import { sanitizeSuggestion } from '../lib/displayName'
import { DisplayNameForm } from './DisplayNameForm'

export function ClaimNameScreen() {
  const goHome = useNavStore(s => s.goHome)
  const { authName, email } = useProfileStore(useShallow(s => ({
    authName: s.authName,
    email: s.email,
  })))

  const suggestion = sanitizeSuggestion(authName) || sanitizeSuggestion(email?.split('@')[0])

  return (
    <div className="relative min-h-dvh flex items-center justify-center px-6 overflow-hidden">
      <div className="relative w-full max-w-sm rounded-[28px] bg-vt-panel border border-white/5 shadow-[0_40px_90px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] px-7 py-9 flex flex-col items-center">
        <div className="text-center mb-7">
          <h1 className="font-silk text-base text-vt-text uppercase tracking-[0.15em]">
            Choose your display name
          </h1>
          <p className="mt-2.5 font-grotesk text-[10px] tracking-[0.22em] uppercase text-vt-magenta text-glow-vt-magenta">
            This is you on the leaderboard
          </p>
        </div>

        <DisplayNameForm initialName={suggestion} submitLabel="Claim name" onDone={goHome} />
      </div>
    </div>
  )
}
