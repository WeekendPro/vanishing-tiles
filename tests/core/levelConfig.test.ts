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
  it('groups levels into the three Gap City districts (5/5/5)', () => {
    expect(themeForLevel(1)).toBe('the_hollows')
    expect(themeForLevel(5)).toBe('the_hollows')
    expect(themeForLevel(6)).toBe('the_stacks')
    expect(themeForLevel(10)).toBe('the_stacks')
    expect(themeForLevel(11)).toBe('the_grid')
    expect(themeForLevel(15)).toBe('the_grid')
  })
  it('every config carries an adjacency lever', () => {
    expect(LEVEL_CONFIGS.every(l => typeof l.adjacency === 'number')).toBe(true)
  })
})
