import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ScanlineOverlay } from '../../../src/components/ui/ScanlineOverlay'

describe('ScanlineOverlay', () => {
  it('renders an aria-hidden absolute scanline layer', () => {
    const { container } = render(<ScanlineOverlay />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toBeTruthy()
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.className).toContain('absolute')
    expect(el.className).toContain('inset-0')
    expect(el.className).toContain('arcade-scanlines')
    expect(el.className).toContain('pointer-events-none')
  })

  it('merges a caller-supplied className', () => {
    const { container } = render(<ScanlineOverlay className="opacity-30" />)
    expect((container.firstElementChild as HTMLElement).className).toContain('opacity-30')
  })
})
