import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PixelHeading } from '../../../src/components/ui/PixelHeading'

describe('PixelHeading', () => {
  it('renders an h1 by default with pixel + glow classes', () => {
    render(<PixelHeading>Mind The Gap</PixelHeading>)
    const h = screen.getByRole('heading', { level: 1, name: /Mind The Gap/i })
    expect(h.className).toContain('font-pixel')
    expect(h.className).toContain('text-glow-cyan')
  })

  it('honors the `as` tag (h2)', () => {
    render(<PixelHeading as="h2">Section</PixelHeading>)
    expect(screen.getByRole('heading', { level: 2, name: /Section/i })).toBeInTheDocument()
  })

  it('omits the glow class when glow is false', () => {
    render(<PixelHeading glow={false}>No Glow</PixelHeading>)
    expect(screen.getByRole('heading', { name: /No Glow/i }).className).not.toContain('text-glow-cyan')
  })

  it('adds a magenta underline rule when underline is set', () => {
    render(<PixelHeading underline>Ruled</PixelHeading>)
    expect(screen.getByRole('heading', { name: /Ruled/i }).className).toContain('border-neon-magenta')
  })
})
