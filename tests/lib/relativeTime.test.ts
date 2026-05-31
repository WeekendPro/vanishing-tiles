import { describe, it, expect } from 'vitest'
import { relativeTime } from '../../src/lib/relativeTime'

const NOW = new Date('2026-05-31T12:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
const SEC = 1000, MIN = 60 * SEC, HR = 60 * MIN, DAY = 24 * HR

describe('relativeTime', () => {
  it('returns an em dash for missing/invalid input', () => {
    expect(relativeTime(null, NOW)).toBe('—')
    expect(relativeTime(undefined, NOW)).toBe('—')
    expect(relativeTime('not-a-date', NOW)).toBe('—')
  })

  it('shows "just now" for very recent times and future skew', () => {
    expect(relativeTime(ago(5 * SEC), NOW)).toBe('just now')
    expect(relativeTime(ago(-10 * SEC), NOW)).toBe('just now') // future → no negatives
  })

  it('formats minutes', () => {
    expect(relativeTime(ago(1 * MIN), NOW)).toBe('1 min ago')
    expect(relativeTime(ago(18 * MIN), NOW)).toBe('18 mins ago')
  })

  it('formats hours', () => {
    expect(relativeTime(ago(1 * HR), NOW)).toBe('1 hour ago')
    expect(relativeTime(ago(2 * HR), NOW)).toBe('2 hours ago')
  })

  it('formats days and yesterday', () => {
    expect(relativeTime(ago(1 * DAY), NOW)).toBe('yesterday')
    expect(relativeTime(ago(3 * DAY), NOW)).toBe('3 days ago')
  })

  it('formats weeks', () => {
    expect(relativeTime(ago(7 * DAY), NOW)).toBe('last week')
    expect(relativeTime(ago(14 * DAY), NOW)).toBe('2 weeks ago')
  })

  it('formats months and years', () => {
    expect(relativeTime(ago(30 * DAY), NOW)).toBe('last month')
    expect(relativeTime(ago(90 * DAY), NOW)).toBe('3 months ago')
    expect(relativeTime(ago(365 * DAY), NOW)).toBe('last year')
    expect(relativeTime(ago(2 * 365 * DAY), NOW)).toBe('2 years ago')
  })
})
