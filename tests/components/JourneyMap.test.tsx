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
    completedCount: opts.cleared ? 3 : 0,
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
    theme_id: 't2', slug: 'the_stacks', name: 'The Sticks', mechanic: '', sort_order: 2,
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

  it('keeps locked stations tappable but marks them aria-disabled', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    const holloway = screen.getByRole('button', { name: /Holloway/i })
    const brickfall = screen.getByRole('button', { name: /Brickfall/i })
    expect(holloway).toBeEnabled()
    expect(holloway).toHaveAttribute('aria-disabled', 'true')
    expect(brickfall).toBeEnabled()
    expect(brickfall).toHaveAttribute('aria-disabled', 'true')
  })

  it('marks the current station with aria-current=step', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Open Lots/i })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).not.toHaveAttribute('aria-current')
  })

  it('calls onSelect (unlocked) when the current station is clicked', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    screen.getByRole('button', { name: /Open Lots/i }).click()
    expect(onSelect).toHaveBeenCalledWith('l2', false)
  })

  it('keeps cleared stations tappable (revisitable)', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeEnabled()
    screen.getByRole('button', { name: /Vacant Heights/i }).click()
    expect(onSelect).toHaveBeenCalledWith('l1', false)
  })

  it('fires onSelect with locked=true for a locked station (opens the detail)', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    screen.getByRole('button', { name: /Brickfall/i }).click()
    expect(onSelect).toHaveBeenCalledWith('l6', true)
  })

  it('renders all-clear (no current station) with everything tappable and nothing marked', () => {
    const allClear: JourneyTheme[] = [
      {
        theme_id: 't1', slug: 'the_hollows', name: 'The Hollows', mechanic: '', sort_order: 1,
        levels: [
          lvl(1, 'Vacant Heights', { cleared: true }),
          lvl(2, 'Open Lots', { cleared: true }),
        ],
      },
    ]
    render(<TransitMap themes={allClear} onSelect={() => {}} />)
    const a = screen.getByRole('button', { name: /Vacant Heights/i })
    const b = screen.getByRole('button', { name: /Open Lots/i })
    expect(a).toBeEnabled()
    expect(b).toBeEnabled()
    expect(a).not.toHaveAttribute('aria-current')
    expect(b).not.toHaveAttribute('aria-current')
  })

  it('renders 5 star slots with completedCount filled for a cleared station', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    const btn = screen.getByRole('button', { name: /Vacant Heights/i })
    const stars = [...btn.querySelectorAll('span')].filter(s => s.textContent === '★')
    expect(stars).toHaveLength(5)
    expect(stars.filter(s => s.classList.contains('text-yellow-400'))).toHaveLength(3)
  })
})
