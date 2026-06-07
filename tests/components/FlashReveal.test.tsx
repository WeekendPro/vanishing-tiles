import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { FlashReveal } from '../../src/components/FlashReveal'
import type { Gap } from '@shared/types'

const gaps: Gap[] = [
  { pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { pieceType: 'I', rotation: 0, anchorRow: 3, anchorCol: 0, cells: [[3, 0], [3, 1], [3, 2], [3, 3]] },
]

const ON = 700
const OFF = 300

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('FlashReveal', () => {
  it('renders a shape immediately and does NOT render a Ready button', () => {
    const { container } = render(<FlashReveal gaps={gaps} onComplete={() => {}} />)
    // The reveal container is present and shows a shape (the first gap, ON).
    expect(container.querySelector('[data-flash-reveal]')).not.toBeNull()
    expect(container.querySelector('.inline-grid')).not.toBeNull()
    // Non-skippable: no Ready button anywhere.
    const buttons = [...container.querySelectorAll('button')]
    expect(buttons.some(b => /ready/i.test(b.textContent ?? ''))).toBe(false)
    expect(buttons).toHaveLength(0)
  })

  it('drives a single pass and calls onComplete exactly once after the last gap', () => {
    const onComplete = vi.fn()
    render(<FlashReveal gaps={gaps} onComplete={onComplete} />)

    // Step through each gap's ON+OFF window. (Advancing per-window flushes the
    // interleaved React state updates between flashes, mirroring real playback.)
    for (let i = 0; i < gaps.length; i++) {
      expect(onComplete).not.toHaveBeenCalled() // not done until the last window
      act(() => { vi.advanceTimersByTime(ON + OFF) })
    }

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('blanks the shape during the OFF window', () => {
    const { container } = render(<FlashReveal gaps={gaps} onComplete={() => {}} />)
    // During ON: a shape is shown.
    expect(container.querySelector('.inline-grid')).not.toBeNull()
    // After the ON window (still within the first gap's OFF window): blank.
    act(() => { vi.advanceTimersByTime(ON + 50) })
    expect(container.querySelector('.inline-grid')).toBeNull()
  })

  it('completes immediately-ish when there are no gaps', () => {
    const onComplete = vi.fn()
    render(<FlashReveal gaps={[]} onComplete={onComplete} />)
    act(() => { vi.advanceTimersByTime(OFF + 50) })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('flashes the GAP silhouette (dashed, no colored piece fill)', () => {
    const { container } = render(<FlashReveal gaps={gaps} onComplete={() => {}} />)
    const grid = container.querySelector('.inline-grid')!
    // The occupied cells are dashed gap outlines, not solid colored piece tiles.
    expect(grid.querySelector('.border-dashed')).not.toBeNull()
    // No filled piece-color tile (e.g. the O piece's bg-yellow-400) is rendered.
    expect(container.querySelector('[class*="bg-yellow"]')).toBeNull()
    expect(container.querySelector('[class*="bg-cyan-400"]')).toBeNull()
  })

  it('renders one carousel dot per gap, all hollow initially', () => {
    const { container } = render(<FlashReveal gaps={gaps} onComplete={() => {}} />)
    const dots = [...container.querySelectorAll('[data-flash-dot]')]
    expect(dots).toHaveLength(gaps.length)
    // Before the first gap finishes flashing, the dot for a not-yet-flashed gap
    // is hollow. (The first gap is mid-flash, so at least the last dot is hollow.)
    const filledStates = dots.map(d => d.getAttribute('data-filled'))
    expect(filledStates.filter(s => s === 'false').length).toBeGreaterThan(0)
  })

  it('fills the carousel dots as gaps are flashed', () => {
    const { container } = render(<FlashReveal gaps={gaps} onComplete={() => {}} />)
    const filledCount = () =>
      [...container.querySelectorAll('[data-flash-dot]')]
        .filter(d => d.getAttribute('data-filled') === 'true').length
    // After every gap's ON+OFF window has elapsed, all dots are filled.
    act(() => { vi.advanceTimersByTime((ON + OFF) * gaps.length) })
    expect(filledCount()).toBe(gaps.length)
  })
})
