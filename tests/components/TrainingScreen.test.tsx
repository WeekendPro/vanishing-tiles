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
    // 3681ms (a beat of test overhead may nudge the digits): the floating
    // burst keeps its coarse one-decimal label ("3.7s"), while the HUD average
    // shows millisecond precision ("3.681s").
    expect(screen.getAllByText(/^3\.\ds$/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/^3\.\d{3}s$/)).toBeInTheDocument()
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

  it('shows the flat streak / best / miss / avg-speed bar, with no score, lives, or timer', async () => {
    const user = userEvent.setup()
    render(<TrainingScreen />)
    expect(screen.getByText('Streak')).toBeInTheDocument()
    expect(screen.getByText('Best')).toBeInTheDocument()
    expect(screen.getByText('Miss')).toBeInTheDocument()
    expect(screen.getByText('Avg speed')).toBeInTheDocument()
    await user.click(document.querySelector(`[data-letter-option="${useTrainingStore.getState().piece!.type}"]`)!)
    expect(useTrainingStore.getState().bestStreak).toBe(1)
    expect(screen.queryByText(/score/i)).toBeNull()
  })

  it('counts misses in the HUD (totalPicks − correctPicks)', async () => {
    const user = userEvent.setup()
    render(<TrainingScreen />)
    const missValue = screen.getByText('Miss').nextElementSibling!
    expect(missValue).toHaveTextContent('0')
    await user.click(document.querySelector(`[data-letter-option="${wrongType()}"]`)!)
    expect(missValue).toHaveTextContent('1')
    // A correct pick doesn't move the miss count.
    await user.click(document.querySelector(`[data-letter-option="${useTrainingStore.getState().piece!.type}"]`)!)
    expect(missValue).toHaveTextContent('1')
  })

  it('Pause freezes the session and surfaces the full stat bar on the overlay', async () => {
    const user = userEvent.setup()
    render(<TrainingScreen />)
    expect(screen.queryByRole('button', { name: /Exit Training/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Pause/i }))
    expect(useTrainingStore.getState().paused).toBe(true)
    expect(screen.getByText('Paused')).toBeInTheDocument()
    // The overlay carries the session's metadata — every HUD stat appears
    // twice (once on the board HUD, once on the pause screen).
    for (const label of ['Streak', 'Best', 'Miss', 'Avg speed']) {
      expect(screen.getAllByText(label)).toHaveLength(2)
    }
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exit to Home/i })).toBeInTheDocument()
  })

  it('Resume unfreezes and returns to the session', async () => {
    const user = userEvent.setup()
    render(<TrainingScreen />)
    await user.click(screen.getByRole('button', { name: /Pause/i }))
    await user.click(screen.getByRole('button', { name: /Resume/i }))
    expect(useTrainingStore.getState().paused).toBe(false)
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
    expect(useTrainingStore.getState().active).toBe(true)
  })

  it('Exit to Home (via pause) tears the session down and returns home', async () => {
    const user = userEvent.setup()
    render(<TrainingScreen />)
    await user.click(screen.getByRole('button', { name: /Pause/i }))
    await user.click(screen.getByRole('button', { name: /Exit to Home/i }))
    expect(useNavStore.getState().appView).toBe('home')
    expect(useTrainingStore.getState().active).toBe(false)
  })
})
