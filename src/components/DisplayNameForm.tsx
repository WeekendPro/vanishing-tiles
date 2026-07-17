// The one display-name form, shared by the claim gate and the menu's edit
// overlay. Validation is live (specific rule, not a generic error); server
// verdicts (taken/invalid) render inline under the field. Styling matches
// AuthScreen's lit-hardware inputs.
import { useState } from 'react'
import { useProfileStore } from '../store/profileStore'
import { validateDisplayName, NAME_RULE_MESSAGES } from '../lib/displayName'
import { track } from '../store/asyncStatus'

function initialsOf(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) return '?'
  return trimmed.slice(0, 2).toUpperCase()
}

const inputClass =
  'w-full h-12 px-3.5 rounded-[11px] bg-[#0a0a12] text-vt-text font-grotesk text-sm ' +
  'border border-white/10 placeholder-vt-faint shadow-[inset_0_1px_2px_#000] ' +
  'focus:outline-none focus:border-vt-cyan ' +
  'focus:shadow-[inset_0_1px_2px_#000,0_0_0_1px_rgba(40,240,255,0.33),0_0_14px_rgba(40,240,255,0.2)] ' +
  'disabled:opacity-50'

export function DisplayNameForm({ initialName, submitLabel, onDone, onCancel }: {
  initialName: string
  submitLabel: string
  onDone: () => void
  onCancel?: () => void
}) {
  const claimDisplayName = useProfileStore(s => s.claimDisplayName)
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const validation = validateDisplayName(name)
  // 'empty' before first keystroke reads as nagging — hold the message until
  // there's input (the disabled submit still guards it).
  const liveError = !validation.ok && name.trim().length > 0 ? NAME_RULE_MESSAGES[validation.reason] : null
  const canSubmit = validation.ok && !busy

  const submit = async () => {
    if (!validation.ok) return
    setServerError(null)
    setBusy(true)
    try {
      const res = await track(claimDisplayName(name))
      if (res.ok) { onDone(); return }
      setServerError(
        res.reason === 'taken' ? 'That name is taken.'
        : res.reason === 'guest' ? 'Guests can’t set a name — create an account first.'
        : NAME_RULE_MESSAGES.badChars,
      )
    } catch {
      setServerError('Something glitched — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Live initials-avatar preview — same gradient badge as the menu. */}
        <div className="w-12 h-12 shrink-0 rounded-full grid place-items-center font-black text-lg text-white
          bg-gradient-to-br from-neon-cyan to-neon-magenta ring-1 ring-white/15">
          {initialsOf(name)}
        </div>
        <div className="relative flex-1">
          <span className="absolute -top-[7px] left-3 z-10 px-1.5 bg-vt-panel font-grotesk text-[9px] tracking-[0.12em] uppercase text-vt-faint">
            Display name
          </span>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setServerError(null) }}
            disabled={busy}
            aria-label="Display name"
            placeholder="NeonRider"
            maxLength={24}
            autoFocus
            className={inputClass}
          />
        </div>
      </div>

      <p className="font-grotesk text-[10px] tracking-[0.06em] text-vt-faint">
        Your name in lights — it's how you'll appear on the global leaderboards.
      </p>

      {(liveError || serverError) && (
        <p className="font-grotesk text-vt-red text-glow-vt-red text-sm">{serverError ?? liveError}</p>
      )}

      <button
        disabled={!canSubmit}
        onClick={submit}
        className="mt-1 h-12 rounded-[11px] inline-flex items-center justify-center gap-2
          border-2 border-vt-cyan bg-vt-raised text-vt-cyan
          font-grotesk text-[13px] tracking-[0.1em] uppercase
          shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_16px_rgba(40,240,255,0.27)]
          hover:bg-vt-cyan/10 transition-colors active:translate-y-px
          disabled:opacity-50 disabled:pointer-events-none"
      >
        {submitLabel}
      </button>

      {onCancel && (
        <button
          disabled={busy}
          onClick={onCancel}
          className="h-11 rounded-[11px] inline-flex items-center justify-center
            border border-white/10 bg-vt-raised text-vt-dim
            font-grotesk text-[12px] tracking-[0.06em]
            hover:text-vt-text hover:border-white/20 transition-colors active:translate-y-px
            disabled:opacity-50 disabled:pointer-events-none"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
