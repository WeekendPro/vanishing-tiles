import { useEffect, useRef, useState } from 'react'
import { type Difficulty } from '../../store/settingsStore'
import { type StaggerGap, type StaggerPhase } from '../../store/staggerStore'
import { STAGGER } from '../../lib/staggerCurve'
import { sfx } from '../../lib/sfx'
import { haptics } from '../../lib/haptics'
import { PIECE_BLOOM_HEX, REVEAL_MAGENTA } from './palette'
import { type Bloom, bloomForGap } from './bloom'
import { type TimerBar } from './useTimerBar'

interface RevealDriverArgs {
  phase: StaggerPhase
  batchIndex: number
  gaps: StaggerGap[]
  revealPlan: number[]
  mode: Difficulty
  demo: boolean
  paused: boolean
  beginSelecting: () => void
  timerBar: TimerBar
}

/** Reveal driver (shape-bloom): bloom each gap in turn — the gap's cells all get
 *  .vt-bloom at the same tick, flood the piece color (EASY) or magenta
 *  (MEDIUM/HARD), then decay along a ghost tail back to the void (fading away in a
 *  per-cell wave).
 *  Decays cascade (the next gap blooms before the last finishes dying), draining
 *  the bar one step per gap as a COUNT, then hand off to selecting. Because the
 *  reveals forwards-fill back to the void, past gaps leave no readable hole.
 *  Returns the active blooms to render. */
export function useRevealDriver({
  phase, batchIndex, gaps, revealPlan, mode, demo, paused, beginSelecting, timerBar,
}: RevealDriverArgs): Bloom[] {
  const [blooms, setBlooms] = useState<Bloom[]>([])

  // Reveal/decay timing for this run — the STAGGER constants. Held in a ref so
  // the reveal driver reads the LATEST values as each beat fires without
  // re-arming the whole effect and flickering.
  const timing = {
    stepMs: STAGGER.REVEAL_STEP_MS,
    bloomMs: STAGGER.REVEAL_BLOOM_MS,
    decayMs: STAGGER.REVEAL_DECAY_MS,
    waveMs: STAGGER.REVEAL_WAVE_MS,
  }
  const timingRef = useRef(timing)
  timingRef.current = timing

  // Where a paused reveal picks back up: the index of the gap that was blooming
  // (or queued) when the pause hit. Any FRESH reveal — next batch, timeout
  // replay, paid replay — resets it to 0 (this effect's deps change on all of
  // those but NOT on a pause/resume toggle, which only flips `paused`). It must
  // run before the driver below so the driver reads the reset value.
  const revealIdxRef = useRef(0)
  useEffect(() => {
    if (phase === 'reveal') revealIdxRef.current = 0
  }, [phase, batchIndex, gaps, revealPlan])

  useEffect(() => {
    if (phase !== 'reveal' || gaps.length === 0 || paused) return
    let cancelled = false
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    // The reveal plays as a sequence of gaps, in revealPlan's shuffled order; fall
    // back to index order if a batch somehow arrived without a plan (e.g. legacy state).
    const order = revealPlan.length ? revealPlan : gaps.map((_, i) => i)
    const n = order.length
    // Difficulty shapes the reveal: EASY floods each gap in its own piece
    // colour; MEDIUM floods the uniform branded pink; HARD paints the self-
    // colored graphite "impasto" (StaggerBoard renders .vt-paint for HARD, so
    // this color is unused there). All tiers play at the same reveal speed.
    const colorFor = (gap: StaggerGap) =>
      mode === 'easy' ? PIECE_BLOOM_HEX[gap.pieceType] : REVEAL_MAGENTA
    // Reveal/decay timing is read LIVE from timingRef per gap. `step` (gap-to-gap
    // spacing) outruns one bloom's lifetime, so the next gap flashes while the
    // previous is still decaying.
    // Memorize bar DRAINS: starts full and empties one step per gap as the
    // sequence plays out (a visual count of memorize time spent). A reveal
    // resumed from pause starts at the interrupted gap (re-blooming it in
    // full), with the bar re-wound to just before that step. The demo's bar
    // stays inert/empty — its whole point is that no clock exists yet.
    const startIdx = revealIdxRef.current
    if (demo) { timerBar.drainTo(0) } else { timerBar.fillReveal((1 - startIdx / n) * 100) }
    setBlooms([])
    let id = 0

    const show = (idx: number) => {
      if (cancelled) return
      revealIdxRef.current = idx
      if (idx >= n) {
        // Let the final gap finish its decay before recall lights-out.
        const { stepMs, bloomMs, decayMs } = timingRef.current
        at(Math.max(0, bloomMs + decayMs - stepMs), beginSelecting)
        return
      }
      if (!demo) timerBar.drainTo((1 - (idx + 1) / n) * 100)
      const gi = order[idx]
      const { stepMs, bloomMs, decayMs, waveMs } = timingRef.current
      const lifetime = bloomMs + decayMs + 3 * waveMs + 80
      const myId = ++id
      if (!cancelled) {
        setBlooms(prev => [...prev, bloomForGap(myId, gaps[gi], colorFor(gaps[gi]), bloomMs, decayMs, waveMs)])
        // Each bloom climbs one pentatonic step — the reveal sequence plays as
        // a rising melody, so pitch order doubles as a memory hook for order.
        sfx.bloom(idx)
        haptics.bloom()
      }
      // Clear this gap's bloom once it has fully decayed.
      at(lifetime, () => {
        if (!cancelled) setBlooms(prev => prev.filter(b => b.id !== myId))
      })
      at(stepMs, () => show(idx + 1))
    }
    // A short breath before the first gap (also paces continuous next batches
    // and re-entry from a mid-reveal pause).
    at(350, () => show(startIdx))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [phase, batchIndex, gaps, revealPlan, beginSelecting, mode, demo, paused])

  return blooms
}
