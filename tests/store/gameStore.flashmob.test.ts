import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore, effectiveViewDuration } from '../../src/store/gameStore'
import { THEME_SEQUENCE } from '@shared/types'
import type { DifficultyConfig } from '@shared/types'

beforeEach(() => {
  useGameStore.getState().resetGame()
})

const clearedScore = { accuracy: 0, speedBonus: 0, efficiencyBonus: 0, attemptsBonus: 0, stars: 0, total: 0 }

describe('THEME_SEQUENCE', () => {
  it('round 4 (index 3) is flashMob', () => {
    expect(THEME_SEQUENCE[3]).toBe('flashMob')
  })
})

describe('effectiveViewDuration', () => {
  const difficulty: DifficultyConfig = {
    viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 3, complexity: 'simple',
  }

  it('derives gapCount × 1000ms for flashMob (3 gaps → 3000)', () => {
    expect(effectiveViewDuration('flashMob', difficulty)).toBe(3000)
  })

  it('uses the difficulty table viewDuration for non-flashMob themes', () => {
    expect(effectiveViewDuration('basic', difficulty)).toBe(4000)
    expect(effectiveViewDuration('colorCoded', difficulty)).toBe(4000)
    expect(effectiveViewDuration('sequential', difficulty)).toBe(4000)
  })
})

describe('round 4 is flashMob', () => {
  it('startPractice→advance to round 4 generates a flashMob round', () => {
    const s = useGameStore.getState()
    s.startPractice()
    useGameStore.setState({ roundScore: clearedScore })
    s.advanceRound() // → index 1 (color-coded)
    useGameStore.setState({ roundScore: clearedScore })
    s.advanceRound() // → index 2 (sequential)
    useGameStore.setState({ roundScore: clearedScore })
    s.advanceRound() // → index 3 (flash mob)
    const st = useGameStore.getState()
    expect(st.roundIndex).toBe(3)
    expect(st.roundTheme).toBe('flashMob')
    expect(st.gaps.length).toBeGreaterThan(0)
    // Basic generation: monochrome, no order badges.
    expect(st.gaps.every(g => g.color === undefined && g.order === undefined)).toBe(true)
  })

  it('beginViewing sets the derived (gapCount × 1000) view duration for flashMob', () => {
    const difficulty: DifficultyConfig = {
      viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 5, complexity: 'simple',
    }
    useGameStore.setState({ roundTheme: 'flashMob', difficulty })
    useGameStore.getState().beginViewing()
    expect(useGameStore.getState().phaseDuration).toBe(5000)
  })
})
