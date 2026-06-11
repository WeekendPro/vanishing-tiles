import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HowToAnimation } from '../../src/components/briefing/HowToAnimation'

describe('HowToAnimation', () => {
  it('renders a demo container keyed to the component', () => {
    const { rerender } = render(<HowToAnimation component="main" />)
    expect(screen.getByTestId('howto-main')).toBeTruthy()
    rerender(<HowToAnimation component="flash" />)
    expect(screen.getByTestId('howto-flash')).toBeTruthy()
    rerender(<HowToAnimation component="colors" />)
    expect(screen.getByTestId('howto-colors')).toBeTruthy()
    rerender(<HowToAnimation component="inSequence" />)
    expect(screen.getByTestId('howto-inSequence')).toBeTruthy()
  })
})
