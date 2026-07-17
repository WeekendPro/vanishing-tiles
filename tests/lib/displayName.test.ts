import { describe, it, expect } from 'vitest'
import { validateDisplayName, sanitizeSuggestion, NAME_RULE_MESSAGES } from '../../src/lib/displayName'

describe('validateDisplayName', () => {
  it('accepts a plain handle and returns the trimmed name', () => {
    expect(validateDisplayName('  NeonRider ')).toEqual({ ok: true, name: 'NeonRider' })
    expect(validateDisplayName('lou99')).toEqual({ ok: true, name: 'lou99' })
    expect(validateDisplayName('neon_rider_99')).toEqual({ ok: true, name: 'neon_rider_99' })
  })

  it('rejects empties and whitespace-only input as empty', () => {
    expect(validateDisplayName('')).toEqual({ ok: false, reason: 'empty' })
    expect(validateDisplayName('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('enforces 3–16 chars (after trim)', () => {
    expect(validateDisplayName('ab')).toEqual({ ok: false, reason: 'tooShort' })
    expect(validateDisplayName('a'.repeat(17))).toEqual({ ok: false, reason: 'tooLong' })
    expect(validateDisplayName('abc').ok).toBe(true)
    expect(validateDisplayName('a'.repeat(16)).ok).toBe(true)
  })

  it('must start with a letter', () => {
    expect(validateDisplayName('9lives')).toEqual({ ok: false, reason: 'badStart' })
    expect(validateDisplayName('_lou')).toEqual({ ok: false, reason: 'badStart' })
  })

  it('rejects spaces and special characters (no "A B C D E F" junk)', () => {
    expect(validateDisplayName('A B C D E F')).toEqual({ ok: false, reason: 'badChars' })
    expect(validateDisplayName('lou.alejo')).toEqual({ ok: false, reason: 'badChars' })
    expect(validateDisplayName('lou-alejo')).toEqual({ ok: false, reason: 'badChars' })
    expect(validateDisplayName('lou😀')).toEqual({ ok: false, reason: 'badChars' })
  })

  it('has user-facing copy for every reason', () => {
    for (const reason of ['empty', 'tooShort', 'tooLong', 'badStart', 'badChars'] as const) {
      expect(NAME_RULE_MESSAGES[reason].length).toBeGreaterThan(0)
    }
  })
})

describe('sanitizeSuggestion', () => {
  it('strips a dotted email prefix to a valid handle', () => {
    expect(sanitizeSuggestion('lou.m.alejo')).toBe('loumalejo')
  })
  it('strips spaces from a Google full name', () => {
    expect(sanitizeSuggestion('Luis Alejo')).toBe('LuisAlejo')
  })
  it('drops leading non-letters and clips to 16', () => {
    expect(sanitizeSuggestion('99problems')).toBe('problems')
    expect(sanitizeSuggestion('a'.repeat(20))).toBe('a'.repeat(16))
  })
  it('returns empty string when nothing usable survives', () => {
    expect(sanitizeSuggestion('日本語')).toBe('')
    expect(sanitizeSuggestion('12')).toBe('')
    expect(sanitizeSuggestion(null)).toBe('')
    expect(sanitizeSuggestion(undefined)).toBe('')
  })
  it('always produces a valid name or empty', () => {
    for (const raw of ['lou.m.alejo', 'Luis Alejo', '99problems', '日本語', 'x']) {
      const s = sanitizeSuggestion(raw)
      if (s !== '') expect(validateDisplayName(s).ok).toBe(true)
    }
  })
})
