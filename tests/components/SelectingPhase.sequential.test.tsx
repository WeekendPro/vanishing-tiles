import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SelectingPhase } from '../../src/components/SelectingPhase'
import { useGameStore } from '../../src/store/gameStore'
import type { Gap } from '@shared/types'

const gaps: Gap[] = [
  { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0], [0, 1], [1, 0], [1, 1]], order: 1 },
  { pieceType: 'I', rotation: 0, anchorRow: 3, anchorCol: 0, cells: [[3, 0], [3, 1], [3, 2], [3, 3]], order: 2 },
]

beforeEach(() => {
  useGameStore.getState().resetGame()
  useGameStore.setState({
    phase: 'selecting', roundTheme: 'sequential', gaps, selection: [],
    phaseStartTime: Date.now(), phaseDuration: 10000,
    difficulty: { viewDuration: 4000, selectDuration: 10000, placeDuration: 0, gapCount: 2, complexity: 'simple' },
  })
})

describe('SelectingPhase — sequential queue menu', () => {
  it('renders all 7 piece-type buttons', () => {
    render(<SelectingPhase />)
    expect(document.querySelectorAll('[data-queue-option]')).toHaveLength(7)
  })

  it('appends to the queue in tap order', () => {
    render(<SelectingPhase />)
    fireEvent.click(document.querySelector('[data-queue-option="O"]') as HTMLButtonElement)
    fireEvent.click(document.querySelector('[data-queue-option="I"]') as HTMLButtonElement)
    expect(useGameStore.getState().selection.map(e => e.pieceType)).toEqual(['O', 'I'])
  })

  it('Undo removes the last queued piece', () => {
    render(<SelectingPhase />)
    fireEvent.click(document.querySelector('[data-queue-option="O"]') as HTMLButtonElement)
    fireEvent.click(document.querySelector('[data-queue-option="I"]') as HTMLButtonElement)
    fireEvent.click(document.querySelector('[data-queue-undo]') as HTMLButtonElement)
    expect(useGameStore.getState().selection.map(e => e.pieceType)).toEqual(['O'])
  })
})
