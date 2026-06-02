import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransitMap, type JourneyTheme } from '../../src/components/JourneyMap'

function lvl(n: number, name: string, cleared: boolean) {
  return {
    level_id: `l${n}`, display_number: n, name,
    my_pr: cleared ? 900 : null, my_stars: cleared ? 2 : 0,
    cleared, last_played: null, global_best: null,
  }
}

const themes: JourneyTheme[] = [
  {
    theme_id: 't1', slug: 'the_hollows', name: 'The Hollows', mechanic: '',
    sort_order: 1, locked: false,
    levels: [lvl(1, 'Vacant Heights', true), lvl(2, 'Open Lots', false),
             lvl(3, 'Holloway', false), lvl(4, 'Gapstead', false), lvl(5, 'Nilsen Park', false)],
  },
  {
    theme_id: 't2', slug: 'the_stacks', name: 'The Stacks', mechanic: '',
    sort_order: 2, locked: true,
    levels: [lvl(6, 'Brickfall', false), lvl(7, 'Tetra Heights', false),
             lvl(8, 'Four Corners', false), lvl(9, 'Jaywick', false), lvl(10, 'Snug Harbor', false)],
  },
]

describe('TransitMap', () => {
  it('renders a button for every station', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Snug Harbor/i })).toBeInTheDocument()
  })

  it('disables stations on a locked line', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Brickfall/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).toBeEnabled()
  })

  it('marks the next stop with aria-current=step (lowest uncleared on an unlocked line)', () => {
    render(<TransitMap themes={themes} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Open Lots/i })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Vacant Heights/i })).not.toHaveAttribute('aria-current')
  })

  it('calls onSelect with the level id when a playable station is clicked', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    screen.getByRole('button', { name: /Open Lots/i }).click()
    expect(onSelect).toHaveBeenCalledWith('l2')
  })

  it('does not fire onSelect for a locked station', () => {
    const onSelect = vi.fn()
    render(<TransitMap themes={themes} onSelect={onSelect} />)
    screen.getByRole('button', { name: /Brickfall/i }).click()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
