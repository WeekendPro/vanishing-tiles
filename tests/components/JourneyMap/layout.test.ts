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

  // Guards hand-authored drift: each line's path must trace its 5 stations' coords,
  // and each connector must join the prior interchange to the line's first station.
  const pointsOf = (d: string): [number, number][] =>
    d.trim().split(/\s+/).map(seg => {
      const [x, y] = seg.replace(/^[ML]/, '').split(',').map(Number)
      return [x, y] as [number, number]
    })

  it('each line path traces its 5 stations in display order', () => {
    LINES.forEach((line, i) => {
      const first = i * 5 + 1
      const expected = [0, 1, 2, 3, 4].map(k => [STATIONS[first + k].x, STATIONS[first + k].y])
      expect(pointsOf(line.path), `${line.slug} path`).toEqual(expected)
    })
  })

  it('each connector joins the previous interchange to its line first station', () => {
    LINES.forEach((line, i) => {
      if (i === 0) {
        expect(line.connector).toBeUndefined()
        return
      }
      const prevInterchange = STATIONS[i * 5] // station 5 before stacks, 10 before grid
      const firstStation = STATIONS[i * 5 + 1]
      expect(pointsOf(line.connector!), `${line.slug} connector`).toEqual([
        [prevInterchange.x, prevInterchange.y],
        [firstStation.x, firstStation.y],
      ])
    })
  })
})
