import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../../src/store/gameStore'
import { THEME_SEQUENCE } from '@shared/types'

const store = () => useGameStore.getState()

describe('level/round state machine', () => {
  beforeEach(() => store().resetGame())

  it('startLevel initialises round 0, full lives, empty results', () => {
    store().startLevel()
    const s = store()
    expect(s.phase).toBe('countdown')
    expect(s.roundIndex).toBe(0)
    expect(s.roundTheme).toBe(THEME_SEQUENCE[0])
    expect(s.livesRemaining).toBe(3)
    expect(s.roundResults).toEqual([])
    expect(s.levelComplete).toBe(false)
    expect(s.grid.length).toBeGreaterThan(0)
  })

  it('advanceRound after a clear moves to the next round and keeps lives', () => {
    store().startLevel()
    useGameStore.setState({ roundScore: { accuracy: 0, speedBonus: 600, efficiencyBonus: 800, attemptsBonus: 0, stars: 0, total: 1400 } })
    store().advanceRound()
    const s = store()
    expect(s.roundIndex).toBe(1)
    expect(s.roundResults).toEqual([1400])
    expect(s.livesRemaining).toBe(3)
    expect(s.phase).toBe('countdown')
    expect(s.levelComplete).toBe(false)
  })

  it('advanceRound on the final round completes the level and adds the lives bonus', () => {
    store().startLevel()
    useGameStore.setState({ roundIndex: 3, roundResults: [1400, 1400, 1400], livesRemaining: 3,
      roundScore: { accuracy: 0, speedBonus: 600, efficiencyBonus: 800, attemptsBonus: 0, stars: 0, total: 1400 } })
    store().advanceRound()
    const s = store()
    expect(s.levelComplete).toBe(true)
    expect(s.roundResults).toEqual([1400, 1400, 1400, 1400])
    expect(s.score).toBe(6600)
    expect(s.levelComplete).toBe(true)
    expect(s.phase).toBe('countdown') // level-complete path does not start a new round
  })

  it('loseLife decrements and reports game over at zero', () => {
    store().startLevel()
    store().loseLife(); expect(store().livesRemaining).toBe(2)
    store().loseLife(); expect(store().livesRemaining).toBe(1)
    store().loseLife()
    expect(store().livesRemaining).toBe(0)
    store().loseLife()
    expect(store().livesRemaining).toBe(0) // floors at 0, never negative
  })

  it('a perfect clear scores Speed+Efficiency only (no accuracy/attempts)', () => {
    store().startLevel()
    store().beginViewing()
    store().endViewing()
    // Pick exactly the pieces the generated gaps need by reading them off the board.
    const gaps = store().gaps
    for (const g of gaps) store().incrementSelection(g.pieceType)
    store().submitSelection()
    const rs = store().roundScore!
    expect(rs.accuracy).toBe(0)
    expect(rs.attemptsBonus).toBe(0)
    expect(rs.total).toBe(rs.speedBonus + rs.efficiencyBonus)
    expect(store()._resolution!.kind).toBe('perfect')
  })

  it('a failed selection spends a life and yields a partial resolution', () => {
    store().startLevel()
    store().beginViewing()
    store().endViewing()
    // Deliberately under-select: pick nothing, submit.
    store().submitSelection()
    expect(store().livesRemaining).toBe(2)
    expect(store()._resolution!.kind).toBe('partial')
  })

  it('failing with the last life leaves zero lives (game over)', () => {
    store().startLevel()
    useGameStore.setState({ livesRemaining: 1 })
    store().beginViewing(); store().endViewing()
    store().submitSelection()
    expect(store().livesRemaining).toBe(0)
  })
})
