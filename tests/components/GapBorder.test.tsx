import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GapBorder } from '../../src/components/GapBorder'
import { gapBorderClass } from '../../src/lib/gapPalette'
import type { Gap } from '@shared/types'

const oGap: Gap = {
  pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
  cells: [[0, 0], [0, 1], [1, 0], [1, 1]],
}

describe('GapBorder', () => {
  it('renders one dashed outline element per gap', () => {
    const { container } = render(<GapBorder gaps={[oGap]} />)
    expect(container.querySelectorAll('[data-gap-border]').length).toBe(1)
  })

  it('renders nothing when there are no gaps', () => {
    const { container } = render(<GapBorder gaps={[]} />)
    expect(container.querySelectorAll('[data-gap-border]').length).toBe(0)
  })

  it('applies the per-gap palette border color when gap.color is set', () => {
    const colored: Gap = {
      pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0,
      cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: 'green',
    }
    const { container } = render(<GapBorder gaps={[colored]} />)
    const wrapper = container.querySelector('[data-gap-border]')!
    const cells = wrapper.querySelectorAll('div')
    expect([...cells].some(el => el.className.includes(gapBorderClass('green')))).toBe(true)
  })
})
