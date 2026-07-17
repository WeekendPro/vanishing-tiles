// The ONE definition of what a valid display name is, mirrored verbatim by
// the set_display_name RPC (migration 0015). Handle-style on purpose: no
// spaces (blocks "A B C D E F"-style board junk), no specials beyond
// underscore, uniqueness normalization stays trivial (lower()).

export const DISPLAY_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{2,15}$/

export type NameRuleReason = 'empty' | 'tooShort' | 'tooLong' | 'badStart' | 'badChars'

export type NameValidation =
  | { ok: true; name: string }
  | { ok: false; reason: NameRuleReason }

export const NAME_RULE_MESSAGES: Record<NameRuleReason, string> = {
  empty: 'Pick a display name',
  tooShort: 'At least 3 characters',
  tooLong: 'At most 16 characters',
  badStart: 'Must start with a letter',
  badChars: 'Letters, numbers and underscores only',
}

/** Validates raw input (trimming first). The specific broken rule comes back
 *  as `reason` so forms can show targeted copy, not a generic error. */
export function validateDisplayName(raw: string): NameValidation {
  const name = raw.trim()
  if (name.length === 0) return { ok: false, reason: 'empty' }
  if (name.length < 3) return { ok: false, reason: 'tooShort' }
  if (name.length > 16) return { ok: false, reason: 'tooLong' }
  if (!/^[A-Za-z]/.test(name)) return { ok: false, reason: 'badStart' }
  if (!DISPLAY_NAME_REGEX.test(name)) return { ok: false, reason: 'badChars' }
  return { ok: true, name }
}

/** Turns a Google full name / email prefix into a prefill suggestion:
 *  strips everything outside the charset, drops leading non-letters, clips
 *  to 16. Empty string when fewer than 3 chars survive — the form starts
 *  blank rather than pre-broken. */
export function sanitizeSuggestion(raw: string | null | undefined): string {
  if (!raw) return ''
  const clipped = raw
    .replace(/[^A-Za-z0-9_]/g, '')
    .replace(/^[^A-Za-z]+/, '')
    .slice(0, 16)
  return clipped.length >= 3 ? clipped : ''
}
