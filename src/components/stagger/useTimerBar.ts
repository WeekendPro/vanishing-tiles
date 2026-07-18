import { useCallback, useRef, useState, type RefObject } from 'react'
import { LIFT_MS } from './constants'

export type BarColor = 'magenta' | 'amber' | 'lime'

export interface TimerBar {
  /** Live render values. */
  barPct: number
  barColor: BarColor
  barTransition: string
  barRef: RefObject<HTMLDivElement>
  /** Arm the reveal (memorize) drain: magenta, eased, seeded at `pct`. */
  fillReveal: (pct: number) => void
  /** Set the bar width to `pct` (reveal per-gap count, demo hold-empty, recall tick). */
  drainTo: (pct: number) => void
  /** Begin the recall drain styling (amber, linear tick). */
  startDrain: () => void
  /** Freeze the bar lime at its current width — the pre-payoff anticipation hold. */
  freezeLime: () => void
  /** Release: rush the frozen bar to empty over the LIFT_MS payoff window. */
  rushToEmpty: () => void
}

/** The §1 temperature-arc timer bar. Owns barPct/barColor/barTransition + barRef,
 *  and exposes a small semantic vocabulary instead of raw setters so the reveal
 *  driver, the recall clock, and onPick's clear-payoff can each poke the bar
 *  through named gestures. All methods are stable (safe to omit from effect deps). */
export function useTimerBar(): TimerBar {
  const [barPct, setBarPct] = useState(0)
  const [barColor, setBarColor] = useState<BarColor>('magenta')
  const [barTransition, setBarTransition] = useState('width 180ms ease-out')
  const barRef = useRef<HTMLDivElement>(null)
  // Mirror of barPct so freezeLime's fallback reads the latest width without
  // capturing a stale closure (keeps the method stable across renders).
  const barPctRef = useRef(barPct)
  barPctRef.current = barPct

  const fillReveal = useCallback((pct: number) => {
    setBarColor('magenta'); setBarTransition('width 180ms ease-out'); setBarPct(pct)
  }, [])

  const drainTo = useCallback((pct: number) => { setBarPct(pct) }, [])

  const startDrain = useCallback(() => {
    setBarColor('amber'); setBarTransition('width 120ms linear')
  }, [])

  const freezeLime = useCallback(() => {
    // Freeze the lime bar where it currently sits (the leftover time), holding it
    // for a short anticipation beat before the payoff.
    const el = barRef.current, parent = el?.parentElement
    const frozenPct = el && parent
      ? (el.getBoundingClientRect().width / parent.getBoundingClientRect().width) * 100
      : barPctRef.current
    setBarColor('lime'); setBarTransition('none'); setBarPct(frozenPct)
  }, [])

  const rushToEmpty = useCallback(() => {
    setBarTransition(`width ${LIFT_MS}ms cubic-bezier(0.33,1,0.68,1)`)
    setBarPct(0)
  }, [])

  return { barPct, barColor, barTransition, barRef, fillReveal, drainTo, startDrain, freezeLime, rushToEmpty }
}
