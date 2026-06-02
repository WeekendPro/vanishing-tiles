import { describe, it, expect } from 'vitest'
import { STATIONS, LINES, LINE_COLOR, VIEWBOX } from '../../../src/components/JourneyMap/layout'

describe('JourneyMap layout', () => {
  it('has a coordinate for all 15 stations', () => {
    for (let n = 1; n <= 15; n++) {
      expect(STATIONS[n], `station ${n}`).toBeDefined()
      expect(typeof STATIONS[n].x).toBe('number')
      expect(typeof STATIONS[n].y).toBe('number')
    }
  })

  it('marks the two interchange stations (5 and 10)', () => {
    expect(STATIONS[5].interchange).toBe(true)
    expect(STATIONS[10].interchange).toBe(true)
    expect(STATIONS[1].interchange).toBeUndefined()
  })

  it('ascends: each station sits higher (smaller y) than the previous', () => {
    for (let n = 2; n <= 15; n++) {
      expect(STATIONS[n].y, `station ${n} above ${n - 1}`).toBeLessThan(STATIONS[n - 1].y)
    }
  })

  it('defines a colored line per district slug', () => {
    expect(LINE_COLOR.the_hollows).toBe('#22d3ee')
    expect(LINE_COLOR.the_stacks).toBe('#ff2d95')
    expect(LINE_COLOR.the_grid).toBe('#39d98a')
    expect(LINES.map(l => l.slug)).toEqual(['the_hollows', 'the_stacks', 'the_grid'])
  })

  it('exposes a viewbox', () => {
    expect(VIEWBOX.w).toBeGreaterThan(0)
    expect(VIEWBOX.h).toBeGreaterThan(0)
  })
})
