import { describe, it, expect } from 'vitest'
import {
  accuracyPct, shareHandle, buildHookLine, buildBragText, PLAY_URL, type ShareData,
} from '../../src/lib/shareCard'

describe('accuracyPct', () => {
  it('rounds to a whole percent', () => {
    expect(accuracyPct(3, 4)).toBe(75)
    expect(accuracyPct(1, 3)).toBe(33)
    expect(accuracyPct(2, 3)).toBe(67)
  })
  it('is 0 with no picks (no divide-by-zero)', () => {
    expect(accuracyPct(0, 0)).toBe(0)
  })
  it('caps at 100 for a flawless run', () => {
    expect(accuracyPct(10, 10)).toBe(100)
  })
})

describe('shareHandle', () => {
  it('prefixes a signed-in name with @', () => {
    expect(shareHandle('lunarfox', false)).toBe('@lunarfox')
  })
  it('credits guests as "a challenger"', () => {
    expect(shareHandle(null, true)).toBe('a challenger')
    expect(shareHandle('leftover', true)).toBe('a challenger')
  })
  it('falls back to "a challenger" when a non-guest somehow has no name', () => {
    expect(shareHandle(null, false)).toBe('a challenger')
  })
})

describe('buildHookLine', () => {
  it('uses the plural for many tiles', () => {
    expect(buildHookLine(84)).toBe('84 tiles recalled before my memory faded.')
  })
  it('uses the singular for exactly one tile', () => {
    expect(buildHookLine(1)).toBe('1 tile recalled before my memory faded.')
  })
})

describe('buildBragText', () => {
  const base: ShareData = {
    score: 12480, shapesRecalled: 84, bestStreak: 14,
    correctPicks: 91, totalPicks: 100, mode: 'hard',
    displayName: 'lunarfox', isGuest: false,
  }

  it('includes the mode, thousands-formatted score, streak, accuracy, and play link', () => {
    const text = buildBragText(base)
    expect(text).toContain('Vanishing Tiles · Hard')
    expect(text).toContain('Score 12,480')
    expect(text).toContain('×14')
    expect(text).toContain('91%')
    expect(text).toContain(PLAY_URL)
  })

  it('carries the hook line', () => {
    expect(buildBragText(base)).toContain('84 tiles recalled before my memory faded.')
  })

  it('reflects the run mode label', () => {
    expect(buildBragText({ ...base, mode: 'easy' })).toContain('· Easy')
    expect(buildBragText({ ...base, mode: 'medium' })).toContain('· Medium')
  })
})
