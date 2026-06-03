import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GapBorder } from '../../src/components/GapBorder'
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
})
