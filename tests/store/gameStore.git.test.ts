import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore, gitDifficulty, DIFFICULTY_TABLE } from '../../src/store/gameStore'
import { GIT_TRACKS, nodeId } from '../../src/lib/gitMap'

beforeEach(() => { useGameStore.getState().resetGame() })

describe('gitDifficulty (stretched curve)', () => {
  it('maps level 1 to the easiest rung and the final level to the hardest', () => {
    expect(gitDifficulty('classic', 1)).toBe(DIFFICULTY_TABLE[0])
    expect(gitDifficulty('classic', GIT_TRACKS.classic.floors)).toBe(DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1])
    expect(gitDifficulty('glimpse', GIT_TRACKS.glimpse.floors)).toBe(DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1])
  })
})

describe('git actions', () => {
  it('startGitLevel sets git context, component, id, and opens briefing or countdown', () => {
    useGameStore.getState().startGitLevel('chromatic', 7)
    const s = useGameStore.getState()
    expect(s.mode).toBe('journey')
    expect(s.gitTrack).toBe('chromatic')
    expect(s.gitLevel).toBe(7)
    expect(s.activeComponent).toBe('colors')
    expect(s.levelId).toBe(nodeId('chromatic', 7))
    expect(s.levelDisplayNumber).toBe(7)
    expect(s.levelDifficulty).toBe(gitDifficulty('chromatic', 7))
    expect(['briefing', 'countdown']).toContain(s.phase)
  })

  it('nextGitLevel advances within the track and stops at the top', () => {
    useGameStore.getState().startGitLevel('classic', 2)
    useGameStore.getState().nextGitLevel()
    expect(useGameStore.getState().gitLevel).toBe(3)

    useGameStore.getState().startGitLevel('classic', GIT_TRACKS.classic.floors)
    useGameStore.getState().nextGitLevel()
    expect(useGameStore.getState().gitLevel).toBe(GIT_TRACKS.classic.floors) // unchanged at top
  })

  it('resetGame clears git context', () => {
    useGameStore.getState().startGitLevel('classic', 5)
    useGameStore.getState().resetGame()
    expect(useGameStore.getState().gitTrack).toBeNull()
    expect(useGameStore.getState().gitLevel).toBeNull()
  })
})
