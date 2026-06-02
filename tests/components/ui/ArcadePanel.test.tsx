import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArcadePanel } from '../../../src/components/ui/ArcadePanel'

describe('ArcadePanel', () => {
  it('renders children', () => {
    render(<ArcadePanel><span>Inside</span></ArcadePanel>)
    expect(screen.getByText('Inside')).toBeInTheDocument()
  })

  it('applies recessed neon-edge panel classes', () => {
    render(<ArcadePanel data-testid="panel">x</ArcadePanel>)
    const el = screen.getByTestId('panel')
    expect(el.className).toContain('bg-arcade-panel')
    expect(el.className).toContain('border-arcade-edge')
    expect(el.className).toContain('shadow-panel-inset')
    expect(el.className).toContain('rounded-md')
  })

  it('merges a caller-supplied className', () => {
    render(<ArcadePanel data-testid="panel" className="p-6">x</ArcadePanel>)
    expect(screen.getByTestId('panel').className).toContain('p-6')
  })
})
