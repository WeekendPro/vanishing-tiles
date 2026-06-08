import { describe, it, expect } from 'vitest'
import { LEVEL_COMPONENTS, COMPONENT_THEME, COMPONENT_LABEL, isPlayable } from '../../src/lib/components'

describe('level components', () => {
  it('lists all five components in display order, main first', () => {
    expect(LEVEL_COMPONENTS).toEqual(['main', 'colors', 'inSequence', 'flash', 'riddle'])
  })
  it('maps the four playable components onto engine themes', () => {
    expect(COMPONENT_THEME.main).toBe('basic')
    expect(COMPONENT_THEME.colors).toBe('colorCoded')
    expect(COMPONENT_THEME.inSequence).toBe('sequential')
    expect(COMPONENT_THEME.flash).toBe('flashMob')
  })
  it('marks riddle as not playable, the rest playable', () => {
    expect(isPlayable('main')).toBe(true)
    expect(isPlayable('flash')).toBe(true)
    expect(isPlayable('riddle')).toBe(false)
  })
  it('has a human label for every component', () => {
    for (const c of LEVEL_COMPONENTS) expect(COMPONENT_LABEL[c]).toBeTruthy()
  })
})
