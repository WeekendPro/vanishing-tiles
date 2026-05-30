import { describe, it, expect } from 'vitest'
import { LEVEL_CONFIGS, themeForLevel } from '@shared/core/levelConfig'

describe('level configs', () => {
  it('has 15 seed level configs', () => {
    expect(LEVEL_CONFIGS).toHaveLength(15)
  })
  it('maps display numbers 1..15', () => {
    expect(LEVEL_CONFIGS.map(l => l.displayNumber)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1))
  })
  it('groups levels 1-7 into beginner, 8-15 into intermediate', () => {
    expect(themeForLevel(1)).toBe('beginner')
    expect(themeForLevel(7)).toBe('beginner')
    expect(themeForLevel(8)).toBe('intermediate')
    expect(themeForLevel(15)).toBe('intermediate')
  })
  it('every config carries an adjacency lever', () => {
    expect(LEVEL_CONFIGS.every(l => typeof l.adjacency === 'number')).toBe(true)
  })
})
