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

const piece = (t: string) => document.querySelector(`[data-piece-option="${t}"]`) as HTMLButtonElement
const color = (c: string) => document.querySelector(`[data-color-option="${c}"]`) as HTMLButtonElement

describe('SelectingPhase — Chromatic two-panel selection', () => {
  it('renders 7 monochrome piece buttons and one swatch per palette color', () => {
    render(<SelectingPhase />)
    expect(document.querySelectorAll('[data-piece-option]')).toHaveLength(7)
    expect(document.querySelectorAll('[data-color-option]')).toHaveLength(GAP_COLOR_IDS.length)
  })

  it('piece-first: activating a piece then tapping a color adds that colored piece', () => {
    render(<SelectingPhase />)
    fireEvent.click(piece('O'))
    fireEvent.click(color('green'))
    const sel = useGameStore.getState().selection
    expect(sel).toHaveLength(1)
    expect(sel[0]).toMatchObject({ pieceType: 'O', color: 'green', freeCount: 1 })
  })

  it('color-first: activating a color then tapping pieces adds them in that color (rapid-fire)', () => {
    render(<SelectingPhase />)
    fireEvent.click(color('cyan'))
    fireEvent.click(piece('T'))
    fireEvent.click(piece('T'))
    const sel = useGameStore.getState().selection
    expect(sel).toHaveLength(1)
    expect(sel[0]).toMatchObject({ pieceType: 'T', color: 'cyan', freeCount: 2 })
  })

  it('tapping the active piece again clears it — a later color tap just activates, no add', () => {
    render(<SelectingPhase />)
    fireEvent.click(piece('O'))   // active = O
    fireEvent.click(piece('O'))   // active = undefined (toggle off)
    fireEvent.click(color('green')) // now just activates the color; nothing added
    expect(useGameStore.getState().selection).toHaveLength(0)
  })
})
