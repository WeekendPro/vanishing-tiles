import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NeonButton } from '../../../src/components/ui/NeonButton'

describe('NeonButton', () => {
  it('renders its label as a button (accessible name preserved)', () => {
    render(<NeonButton>Done ✓</NeonButton>)
    expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument()
  })

  it('defaults to the primary (cyan) variant', () => {
    render(<NeonButton>Play</NeonButton>)
    const btn = screen.getByRole('button', { name: /Play/i })
    expect(btn.className).toContain('border-neon-cyan')
    expect(btn.className).toContain('shadow-neon-cyan')
    expect(btn.className).toContain('font-pixel')
  })

  it('applies the go (green) variant classes', () => {
    render(<NeonButton variant="go">Go</NeonButton>)
    const btn = screen.getByRole('button', { name: /Go/i })
    expect(btn.className).toContain('border-neon-green')
    expect(btn.className).toContain('shadow-neon-green')
  })

  it('applies the danger (red) variant classes', () => {
    render(<NeonButton variant="danger">Sign Out</NeonButton>)
    expect(screen.getByRole('button', { name: /Sign Out/i }).className).toContain('border-neon-red')
  })

  it('adds w-full when fullWidth is set', () => {
    render(<NeonButton fullWidth>Wide</NeonButton>)
    expect(screen.getByRole('button', { name: /Wide/i }).className).toContain('w-full')
  })

  it('forwards disabled and onClick like a native button', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<NeonButton onClick={onClick}>Tap</NeonButton>)
    await user.click(screen.getByRole('button', { name: /Tap/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<NeonButton onClick={onClick} disabled>Tap</NeonButton>)
    expect(screen.getByRole('button', { name: /Tap/i })).toBeDisabled()
  })
})
