import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GapNumbers } from '../../src/components/GapNumbers'
import type { Gap } from '@shared/types'

const gaps: Gap[] = [
  { pieceType: 'O', rotation: 0, anchorRow: 1, anchorCol: 2, cells: [[1, 2], [1, 3], [2, 2], [2, 3]], order: 2 },
  { pieceType: 'I', rotation: 0, anchorRow: 5, anchorCol: 0, cells: [[5, 0], [5, 1], [5, 2], [5, 3]], order: 1 },
]

describe('GapNumbers', () => {
  it('renders one badge per ordered gap showing its order number', () => {
    const { container } = render(<GapNumbers gaps={gaps} />)
    const badges = container.querySelectorAll('[data-gap-number]')
    expect(badges).toHaveLength(2)
    const labels = [...badges].map(b => b.textContent).sort()
    expect(labels).toEqual(['1', '2'])
  })

  it('renders nothing for gaps without an order (monochrome/basic gaps)', () => {
    const noOrder: Gap[] = [{ pieceType: 'O', rotation: 0, anchorRow: 0, anchorCol: 0, cells: [[0, 0]] }]
    const { container } = render(<GapNumbers gaps={noOrder} />)
    expect(container.querySelectorAll('[data-gap-number]')).toHaveLength(0)
  })
})
