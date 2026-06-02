import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wordmark } from '../../../src/components/ui/Wordmark'

describe('Wordmark', () => {
  it('renders GAP CITY as a heading with pixel + cyan-glow classes', () => {
    render(<Wordmark />)
    const h = screen.getByRole('heading', { name: /gap city/i })
    expect(h.className).toContain('font-pixel')
    expect(h.className).toContain('text-glow-cyan')
    expect(h.className).toContain('text-white')
  })

  it('applies the lg size class when size="lg"', () => {
    render(<Wordmark size="lg" />)
    expect(screen.getByRole('heading', { name: /gap city/i }).className).toContain('text-3xl')
  })

  it('applies the sm size class by default', () => {
    render(<Wordmark />)
    expect(screen.getByRole('heading', { name: /gap city/i }).className).toContain('text-lg')
  })

  it('merges a passed className', () => {
    render(<Wordmark className="mb-3" />)
    expect(screen.getByRole('heading', { name: /gap city/i }).className).toContain('mb-3')
  })
})
