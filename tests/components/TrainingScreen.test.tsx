import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrainingScreen } from '../../src/components/TrainingScreen'
import { useTrainingStore, TRAINING_TYPES } from '../../src/store/trainingStore'
import { useNavStore } from '../../src/store/navStore'
import type { PieceType } from '@shared/types'

function wrongType(): PieceType {
  const answer = useTrainingStore.getState().piece!.type
  return TRAINING_TYPES.find(t => t !== answer)!
}

beforeEach(() => {
  useNavStore.getState().reset()
  useTrainingStore.getState().exit()
})

describe('TrainingScreen', () => {
  it('starts a session on mount and offers all seven letter names', () => {
    render(<TrainingScreen />)
    expect(useTrainingStore.getState().active).toBe(true)
    for (const t of TRAINING_TYPES) {
      expect(document.querySelector(`[data-letter-option="${t}"]`)).toBeInTheDocument()
    }
    expect(screen.getByText('NAME THE PIECE')).toBeInTheDocument()
  })

  it('a correct letter shows CORRECT and fades the piece out (tray disabled meanwhile)', async () => {
    const user = userEvent.setup()
    render(<TrainingScreen />)
    const answer = useTrainingStore.getState().piece!.type
    await user.click(document.querySelector(`[data-letter-option="${answer}"]`)!)
    expect(useTrainingStore.getState().currentStreak).toBe(1)
    expect(screen.getByText('CORRECT')).toBeInTheDocument()
    // While the named piece decays, the letters can't be mashed.
    expect(document.querySelector(`[data-letter-option="${answer}"]`)).toBeDisabled()
  })

  it('floats the selection time off the piece and tracks the running average', async () => {
    const user = userEvent.setup()
    render(<TrainingScreen />)
    // Fresh session: no correct picks yet → the avg stat shows a placeholder.
    expect(screen.getByText('Avg speed')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    // Backdate the piece's appearance so the measured speed is deterministic.
    useTrainingStore.setState({ shownAt: Date.now() - 3681 })
    const answer = useTrainingStore.getState().piece!.type
    await user.click(document.querySelector(`[data-letter-option="${answer}"]`)!)
    // 3681ms → "3.7s" (a beat of test overhead may nudge the decimal), shown
    // both as the floating burst and as the HUD average.
    expect(screen.getAllByText(/^3\.\ds$/).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('—')).not.toBeInTheDocument()
    expect(useTrainingStore.getState().totalCorrectMs).toBeGreaterThanOrEqual(3681)
  })

  it('a wrong letter breaks the streak and does not advance the piece', async () => {
    const user = userEvent.setup()
    render(<TrainingScreen />)
    const before = useTrainingStore.getState().piece
    await user.click(document.querySelector(`[data-letter-option="${wrongType()}"]`)!)
    const s = useTrainingStore.getState()
    expect(s.currentStreak).toBe(0)
    expect(s.totalPicks).toBe(1)
    expect(s.piece).toBe(before)
    expect(s.round).toBe(1)
    // Tray stays live — try again immediately.
    expect(document.querySelector(`[data-letter-option="${before!.type}"]`)).toBeEnabled()
  })

  it('shows the streak, best, and avg speed in the HUD, with no score, lives, or timer', async () => {
    const user = userEvent.setup()
    render(<TrainingScreen />)
    expect(screen.getByText('Streak')).toBeInTheDocument()
    expect(screen.getByText('Best')).toBeInTheDocument()
    await user.click(document.querySelector(`[data-letter-option="${useTrainingStore.getState().piece!.type}"]`)!)
    expect(useTrainingStore.getState().bestStreak).toBe(1)
    expect(screen.queryByText(/score/i)).toBeNull()
  })

  it('Exit tears the session down and returns home at any moment', async () => {
    const user = userEvent.setup()
    render(<TrainingScreen />)
    await user.click(screen.getByRole('button', { name: /Exit Training/i }))
    expect(useNavStore.getState().appView).toBe('home')
    expect(useTrainingStore.getState().active).toBe(false)
  })
})
