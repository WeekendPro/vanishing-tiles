import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransitMap, type JourneyTheme } from '../../src/components/JourneyMap'

function lvl(
  n: number,
  name: string,
  opts: { cleared?: boolean; current?: boolean; locked?: boolean } = {},
) {
  return {
    level_id: `l${n}`, display_number: n, name,
    my_pr: opts.cleared ? 900 : null, my_stars: opts.cleared ? 2 : 0,
    cleared: !!opts.cleared, current: !!opts.current, locked: !!opts.locked,
    last_played: null, global_best: null,
  }
}

// Frontier at dn2: dn1 cleared, dn2 current, dn3-5 + the whole next district locked.
const themes: JourneyTheme[] = [
  {
    theme_id: 't1', slug: 'the_hollows', name: 'The Hollows', mechanic: '', sort_order: 1,
    levels: [
      lvl(1, 'Vacant Heights', { cleared: true }),
      lvl(2, 'Open Lots', { current: true }),
      lvl(3, 'Holloway', { locked: true }),
      lvl(4, 'Gapstead', { locked: true }),
      lvl(5, 'Nilsen Park', { locked: true }),
    ],
  },
  {
    theme_id: 't2', slug: 'the_stacks', name: 'The Stacks', mechanic: '', sort_order: 2,
    levels: [
      lvl(6, 'Brickfall', { locked: true }),
      lvl(7, 'Tetra Heights', { locked: true }),
      lvl(8, 'Four Corners', { locked: true }),
      lvl(9, 'Jaywick', { locked: true }),
      lvl(10, 'Snug Harbor', { locked: true }),
    ],
  },
]

describe('TransitMap', () => {
  it('renders a button for every station', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Snug Harbor/i })).toBeInTheDocument()
  })

  it('disables every locked station (after the current frontier)', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Holloway/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Brickfall/i })).toBeDisabled()
  })

  it('marks the current station with aria-current=step', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Open Lots/i })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).not.toHaveAttribute('aria-current')
  })

  it('calls onSelect when the current station is clicked', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    screen.getByRole('button', { name: /Open Lots/i }).click()
    expect(onSelect).toHaveBeenCalledWith('l2')
  })

  it('keeps cleared stations tappable (revisitable)', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeEnabled()
    screen.getByRole('button', { name: /Vacant Heights/i }).click()
    expect(onSelect).toHaveBeenCalledWith('l1')
  })

  it('does not fire onSelect for a locked station', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    screen.getByRole('button', { name: /Brickfall/i }).click()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
