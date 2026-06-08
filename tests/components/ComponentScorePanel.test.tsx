import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComponentScorePanel } from '../../src/components/ResolutionPhase/ComponentScorePanel'

describe('ComponentScorePanel', () => {
  it('shows the component total and level total', () => {
    render(
      <ComponentScorePanel
        show componentLabel="Main" solved livesLost={1}
        componentTotal={90} levelTotal={90} stars={1}
      />,
    )
    expect(screen.getByText('Main')).toBeTruthy()
    expect(screen.getByText('90')).toBeTruthy()
  })

  it('renders five star slots', () => {
    const { container } = render(
      <ComponentScorePanel show componentLabel="Colors" solved={false} livesLost={2}
        componentTotal={0} levelTotal={90} stars={1} />,
    )
    expect(container.querySelectorAll('[data-star]')).toHaveLength(5)
  })
})
