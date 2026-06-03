import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SelectingPhase } from '../../src/components/SelectingPhase'
import { useGameStore } from '../../src/store/gameStore'
import { GAP_COLOR_IDS } from '@shared/core/themeConfig'
import type { Gap } from '@shared/types'

const greenO: Gap = {
  pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
  cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: 'green',
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  useGameStore.setState({
    phase: 'selecting',
    roundTheme: 'colorCoded',
    gaps: [greenO],
    selection: [],
    phaseStartTime: Date.now(),
    phaseDuration: 10000,
    difficulty: {
      viewDuration: 4000,
      selectDuration: 10000,
      placeDuration: 0,
      gapCount: 1,
      complexity: 'simple',
    },
  })
})

describe('SelectingPhase — color-coded menu', () => {
  it('renders the round shape once per palette color (one shape × 8 colors)', () => {
    render(<SelectingPhase />)
    const buttons = document.querySelectorAll('[data-color-option]')
    expect(buttons).toHaveLength(GAP_COLOR_IDS.length)
  })

  it('adds a colored token to the cart when a palette button is tapped', () => {
    render(<SelectingPhase />)
    const greenBtn = document.querySelector('[data-color-option="green"]') as HTMLButtonElement
    fireEvent.click(greenBtn)
    const sel = useGameStore.getState().selection
    expect(sel).toHaveLength(1)
    expect(sel[0]).toMatchObject({ pieceType: 'O', color: 'green', freeCount: 1 })
  })
})
