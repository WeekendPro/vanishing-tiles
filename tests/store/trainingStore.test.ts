import { describe, it, expect, beforeEach } from 'vitest'
import { useTrainingStore, randomTrainingPiece, TRAINING_TYPES } from '../../src/store/trainingStore'
import { DISPLAY_ROTATION } from '../../src/lib/staggerCurve'
import { ROWS, COLS, type PieceType } from '@shared/types'

/** A type guaranteed NOT to match the current piece → a guaranteed miss. */
function wrongType(): PieceType {
  const answer = useTrainingStore.getState().piece!.type
  return TRAINING_TYPES.find(t => t !== answer)!
}

beforeEach(() => {
  useTrainingStore.getState().exit()
})

describe('randomTrainingPiece', () => {
  it('rolls a 4-cell piece fully on the board, one cell off every edge', () => {
    for (let i = 0; i < 200; i++) {
      const p = randomTrainingPiece()
      expect(p.cells).toHaveLength(4)
      for (const [r, c] of p.cells) {
        expect(r).toBeGreaterThanOrEqual(1)
        expect(r).toBeLessThanOrEqual(ROWS - 2)
        expect(c).toBeGreaterThanOrEqual(1)
        expect(c).toBeLessThanOrEqual(COLS - 2)
      }
    }
  })

  it('draws every piece at its canonical tray rotation', () => {
    for (let i = 0; i < 50; i++) {
      const p = randomTrainingPiece()
      expect(p.rotation).toBe(DISPLAY_ROTATION[p.type])
    }
  })

  it('never repeats the excluded type', () => {
    for (const excluded of TRAINING_TYPES) {
      for (let i = 0; i < 30; i++) {
        expect(randomTrainingPiece(excluded).type).not.toBe(excluded)
      }
    }
  })
})

describe('trainingStore', () => {
  it('start activates a session with a piece up and a clean slate', () => {
    useTrainingStore.getState().start()
    const s = useTrainingStore.getState()
    expect(s.active).toBe(true)
    expect(s.piece).not.toBeNull()
    expect(s.round).toBe(1)
    expect(s.currentStreak).toBe(0)
    expect(s.bestStreak).toBe(0)
    expect(s.totalPicks).toBe(0)
  })

  it('a correct guess extends the streak and tracks the best', () => {
    useTrainingStore.getState().start()
    const answer = useTrainingStore.getState().piece!.type
    const res = useTrainingStore.getState().guess(answer)
    expect(res.ok).toBe(true)
    expect(res.streak).toBe(1)
    const s = useTrainingStore.getState()
    expect(s.currentStreak).toBe(1)
    expect(s.bestStreak).toBe(1)
    expect(s.correctPicks).toBe(1)
    expect(s.totalPicks).toBe(1)
    // The piece does NOT advance on a guess — the screen owns the fade-out.
    expect(s.piece!.type).toBe(answer)
    expect(s.round).toBe(1)
  })

  it('a wrong guess breaks the streak but keeps the best (no lives at stake)', () => {
    useTrainingStore.getState().start()
    useTrainingStore.getState().guess(useTrainingStore.getState().piece!.type)
    const res = useTrainingStore.getState().guess(wrongType())
    expect(res.ok).toBe(false)
    expect(res.streak).toBe(0)
    const s = useTrainingStore.getState()
    expect(s.currentStreak).toBe(0)
    expect(s.bestStreak).toBe(1)
    expect(s.correctPicks).toBe(1)
    expect(s.totalPicks).toBe(2)
  })

  it('nextPiece rolls a fresh piece of a different type and bumps the round', () => {
    useTrainingStore.getState().start()
    for (let i = 0; i < 30; i++) {
      const before = useTrainingStore.getState().piece!.type
      useTrainingStore.getState().nextPiece()
      const s = useTrainingStore.getState()
      expect(s.piece!.type).not.toBe(before)
      expect(s.round).toBe(i + 2)
    }
  })

  it('guess is a no-op while idle', () => {
    const res = useTrainingStore.getState().guess('O')
    expect(res.ok).toBe(false)
    expect(useTrainingStore.getState().totalPicks).toBe(0)
  })

  it('exit tears the session down completely', () => {
    useTrainingStore.getState().start()
    useTrainingStore.getState().guess(useTrainingStore.getState().piece!.type)
    useTrainingStore.getState().exit()
    const s = useTrainingStore.getState()
    expect(s.active).toBe(false)
    expect(s.piece).toBeNull()
    expect(s.currentStreak).toBe(0)
    expect(s.bestStreak).toBe(0)
  })
})
