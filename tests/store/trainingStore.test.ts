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
    expect(res.elapsedMs).toBeGreaterThanOrEqual(0)
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

  it('measures selection speed from appearance to the correct pick, summed for the average', () => {
    useTrainingStore.getState().start()
    // Backdate the appearance timestamps for deterministic elapsed times.
    useTrainingStore.setState({ shownAt: Date.now() - 3681 })
    const res1 = useTrainingStore.getState().guess(useTrainingStore.getState().piece!.type)
    expect(res1.elapsedMs).toBeGreaterThanOrEqual(3681)
    expect(res1.elapsedMs).toBeLessThan(3681 + 250)

    useTrainingStore.getState().nextPiece()
    useTrainingStore.setState({ shownAt: Date.now() - 1200 })
    const res2 = useTrainingStore.getState().guess(useTrainingStore.getState().piece!.type)
    expect(res2.elapsedMs).toBeGreaterThanOrEqual(1200)

    const s = useTrainingStore.getState()
    expect(s.totalCorrectMs).toBe(res1.elapsedMs + res2.elapsedMs)
    // The running average is derivable: totalCorrectMs / correctPicks.
    expect(s.correctPicks).toBe(2)
  })

  it('a wrong guess does not stop or credit the speed clock', () => {
    useTrainingStore.getState().start()
    useTrainingStore.setState({ shownAt: Date.now() - 500 })
    const res = useTrainingStore.getState().guess(wrongType())
    expect(res.elapsedMs).toBe(0)
    const s = useTrainingStore.getState()
    expect(s.totalCorrectMs).toBe(0)
    // The clock keeps running from the piece's appearance — the eventual
    // correct pick pays for the fumble.
    expect(s.shownAt).toBeLessThanOrEqual(Date.now() - 500)
  })

  it('nextPiece restamps the speed clock', () => {
    useTrainingStore.getState().start()
    useTrainingStore.setState({ shownAt: Date.now() - 9999 })
    useTrainingStore.getState().nextPiece()
    expect(Date.now() - useTrainingStore.getState().shownAt).toBeLessThan(250)
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
