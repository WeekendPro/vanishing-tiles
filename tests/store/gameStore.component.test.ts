// tests/store/gameStore.component.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../../src/store/gameStore'
import { useProgressStore } from '../../src/store/progressStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import type { DifficultyConfig } from '@shared/types'

const DIFF: DifficultyConfig = {
  viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 3, complexity: 'simple',
}

function solveCurrent() {
  // Fill the cart with exactly the pieces the current gaps need (shape-only, basic).
  const { gaps, incrementSelection } = useGameStore.getState()
  for (const g of gaps) incrementSelection(g.pieceType)
}

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ byLevel: {} })
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy' } })
  useGameStore.getState().resetGame()
})

describe('startComponent', () => {
  it('starts a single main play in journey mode with 3 lives and the mapped theme', () => {
    useGameStore.getState().startComponent('L1', 'main', DIFF, 1, 'Test Level')
    const s = useGameStore.getState()
    expect(s.mode).toBe('journey')
    expect(s.activeComponent).toBe('main')
    expect(s.roundTheme).toBe('basic')
    expect(s.livesRemaining).toBe(3)
    expect(s.livesLost).toBe(0)
    expect(s.phase).toBe('briefing')
  })

  it('skips the briefing (opens on the countdown) when the user opted out of this puzzle', () => {
    useSettingsStore.getState().setBriefingHidden('main', true)
    useGameStore.getState().startComponent('L1', 'main', DIFF, 1, 'Test Level')
    expect(useGameStore.getState().phase).toBe('countdown')
  })
})

describe('solving a component records the score', () => {
  it('records a main play and unlocks badges', () => {
    const g = useGameStore.getState()
    g.startComponent('L1', 'main', DIFF, 1, 'Test')
    g.beginViewing(); g.endViewing()
    solveCurrent()
    g.submitSelection()
    expect(useGameStore.getState().phase).toBe('resolving')
    expect(useGameStore.getState().roundScore!.total).toBeGreaterThanOrEqual(65)
    const p = useProgressStore.getState().getLevel('L1')
    expect(p.best.main).toBeGreaterThanOrEqual(65)
  })
})

describe('failing a submission costs a life and lowers the eventual base', () => {
  it('a wrong submit decrements lives and bumps livesLost; retry replays same puzzle', () => {
    const g = useGameStore.getState()
    g.startComponent('L1', 'main', DIFF, 1, 'Test')
    g.beginViewing(); g.endViewing()
    g.incrementSelection('I') // deliberately wrong / insufficient
    g.submitSelection()
    expect(useGameStore.getState().livesRemaining).toBe(2)
    expect(useGameStore.getState().livesLost).toBe(1)
    g.retryComponent()
    expect(useGameStore.getState().phase).toBe('countdown')
    expect(useGameStore.getState().livesRemaining).toBe(2) // retry does NOT restore lives
  })
})

describe('running out of lives scores 0 and records the play', () => {
  it('marks the play failed at 0 lives', () => {
    const g = useGameStore.getState()
    g.startComponent('L1', 'main', DIFF, 1, 'Test')
    g.beginViewing(); g.endViewing()
    for (let i = 0; i < 3; i++) {
      g.incrementSelection('I'); g.submitSelection()
      if (useGameStore.getState().livesRemaining > 0) { g.retryComponent(); g.beginViewing(); g.endViewing() }
    }
    const s = useGameStore.getState()
    expect(s.livesRemaining).toBe(0)
    expect(s.roundScore!.total).toBe(0)
    expect(useProgressStore.getState().getLevel('L1').best.main).toBe(0)
  })
})
