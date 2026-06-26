import { describe, it, expect, beforeEach } from 'vitest'
import { useStaggerStore } from '../../src/store/staggerStore'
import { gapCountForBatch } from '../../src/lib/staggerCurve'

const get = () => useStaggerStore.getState()
const pairBeats = (plan: number[][]) => plan.filter(b => b.length === 2).length

beforeEach(() => get().exit())

describe('TWINS sandbox → paired reveals coupled to the locked level', () => {
  it('shows pairs on the FIRST batch, regardless of batchIndex', () => {
    get().startRun('twins')
    get().beginReveal()
    // batch 0: gapCount 3 → 1 pair. The curve alone would give 0 pairs here.
    expect(get().gaps.length).toBe(3)
    expect(pairBeats(get().revealPlan)).toBe(1)
  })

  it('keeps pairing on every subsequent batch (curve-independent)', () => {
    get().startRun('twins')
    get().beginReveal()
    for (let i = 0; i < 6; i++) {
      get().advanceBatch()
      const expectedGaps = gapCountForBatch(get().batchIndex)
      expect(get().gaps.length).toBe(expectedGaps)
      // pairs = ⌊N/2⌋ ≥ 1 for every rung (gap count never drops below 3).
      expect(pairBeats(get().revealPlan)).toBe(Math.floor(expectedGaps / 2))
    }
  })

  it('a normal (non-sandbox) run at batch 0 has NO pairs — coupling is sandbox-only', () => {
    get().startRun()
    get().beginReveal()
    expect(get().sandboxLevel).toBeNull()
    expect(pairBeats(get().revealPlan)).toBe(0)
  })
})

describe('live overrides via the tuning panel', () => {
  it('gap-count + pairs overrides take effect on rerollBatch', () => {
    get().startRun('twins')
    get().beginReveal()
    get().setSandboxOverride('gapCount', 8)
    get().rerollBatch()
    expect(get().gaps.length).toBe(8)
    expect(pairBeats(get().revealPlan)).toBe(4) // ⌊8/2⌋

    get().setSandboxOverride('pairs', 1)
    get().rerollBatch()
    expect(get().gaps.length).toBe(8)
    expect(pairBeats(get().revealPlan)).toBe(1)
  })

  it('rerollBatch is a no-op outside the sandbox', () => {
    get().startRun()
    get().beginReveal()
    const before = get().revealPlan
    get().rerollBatch()
    expect(get().revealPlan).toBe(before)
  })
})

describe('sandbox stays unlosable + locked', () => {
  it('a wrong pick never drops lives and never reaches gameOver', () => {
    get().startRun('twins')
    get().beginReveal()
    get().beginSelecting()
    const startLives = get().lives
    // Pick a piece type guaranteed absent (clear the board's shapes first is hard;
    // instead spam picks — wrong ones must not cost a life in the sandbox).
    for (let i = 0; i < 20; i++) get().pickPiece('I')
    expect(get().lives).toBe(startLives)
    expect(get().phase).not.toBe('gameOver')
  })

  it('advanceBatch never leaves the locked level (no levelComplete/won)', () => {
    get().startRun('twins')
    get().beginReveal()
    // Force a large score, then advance — sandbox must stay on 'reveal', not celebrate.
    useStaggerStore.setState({ score: 999_999 })
    get().advanceBatch()
    expect(get().phase).toBe('reveal')
    expect(get().sandboxLevel).toBe('twins')
  })
})
