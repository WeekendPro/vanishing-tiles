import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LivesCounter } from '../../../src/components/ui/LivesCounter'

describe('LivesCounter', () => {
  it('renders one heart per slot at the starting cap (no ×N)', () => {
    render(<LivesCounter lives={5} cap={5} />)
    expect(screen.getAllByText('♥')).toHaveLength(5)
    expect(screen.queryByText('×5')).toBeNull()
  })

  it('keeps a heart per slot when some are spent (filled + grey shells)', () => {
    render(<LivesCounter lives={3} cap={5} />)
    expect(screen.getAllByText('♥')).toHaveLength(5) // 3 filled + 2 shells
    expect(screen.getByLabelText('3 lives')).toBeInTheDocument()
  })

  it('collapses to a compact ♥×N above the cap (earned lives)', () => {
    render(<LivesCounter lives={6} cap={5} />)
    expect(screen.getByText('×6')).toBeInTheDocument()
    expect(screen.getAllByText('♥')).toHaveLength(1)
  })

  it('respects a custom cap (e.g. the 3-life modes)', () => {
    render(<LivesCounter lives={2} cap={3} />)
    expect(screen.getAllByText('♥')).toHaveLength(3)
  })

  it('shows all shells and an out label at zero', () => {
    render(<LivesCounter lives={0} cap={5} />)
    expect(screen.getAllByText('♥')).toHaveLength(5)
    expect(screen.getByLabelText('0 lives')).toBeInTheDocument()
  })
})
