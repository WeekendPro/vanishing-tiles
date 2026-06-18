import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LivesCounter } from '../../../src/components/ui/LivesCounter'

describe('LivesCounter', () => {
  it('renders a heart glyph and the count for a normal value', () => {
    render(<LivesCounter lives={5} />)
    expect(screen.getByText('♥')).toBeInTheDocument()
    expect(screen.getByText('×5')).toBeInTheDocument()
  })

  it('shows a count above the starting five (future earned lives)', () => {
    render(<LivesCounter lives={6} />)
    expect(screen.getByText('×6')).toBeInTheDocument()
  })

  it('renders ×0 when out of lives', () => {
    render(<LivesCounter lives={0} />)
    expect(screen.getByText('×0')).toBeInTheDocument()
  })

  it('exposes an accessible label of the count', () => {
    render(<LivesCounter lives={3} />)
    expect(screen.getByLabelText('3 lives')).toBeInTheDocument()
  })
})
