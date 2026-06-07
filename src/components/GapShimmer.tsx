import { useEffect, useState, type RefObject } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Gap } from '@shared/types'

// Experiment (2026-06-07): the glare originally existed to help the eye read each
// gap's silhouette when many gaps clustered. The dashed gap borders now do that
// job, so we're trialling the game WITHOUT the glare. Flip back to `true` to
// restore it. (Kept as an in-file toggle to avoid touching ViewingPhase.tsx while
// the Flash Mob round is being built in parallel.)
const SHIMMER_ENABLED = false

// Feel knobs — tune freely.
const SWEEP_MS = 2600   // time for the glare band to cross the board (one pass)
// Soft, cool-white, narrow highlight; screen-blended and masked to the gap shapes,
// so the glare is only ever visible where it crosses a gap — never the filled board.
const GLARE = 'linear-gradient(115deg, transparent 42%, rgba(190,230,255,0.55) 50%, transparent 58%)'

/** An alpha mask (white = visible) covering only the gap cells, in board coords. */
function buildGapMask(rects: { left: number; top: number; size: number }[], w: number, h: number): string {
  const body = rects
    .map(c => `<rect x='${c.left.toFixed(1)}' y='${c.top.toFixed(1)}' width='${c.size}' height='${c.size}' rx='3'/>`)
    .join('')
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${Math.round(w)}' height='${Math.round(h)}'><g fill='#fff'>${body}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

interface Props {
  /** Wrapper whose box the overlay fills (the grid's relative container). */
  containerRef: RefObject<HTMLDivElement | null>
  /** Live map of "row,col" → cell rect, populated by the grid's cellRef. */
  cellRects: RefObject<Map<string, DOMRect>>
  gaps: Gap[]
}

/**
 * A one-time glare sweep that glints across the gap shapes. Renders as an overlay
 * on top of the grid; it does not touch game state and plays once on mount.
 */
export function GapShimmer({ containerRef, cellRects, gaps }: Props) {
  const reduce = useReducedMotion()
  const [mask, setMask] = useState<string | null>(null)

  // Glare disabled — see SHIMMER_ENABLED note above. Hooks run first to keep
  // hook order stable; we just skip the mask work and render nothing.

  // NOTE: useEffect (not useLayoutEffect) is deliberate. containerRef points to
  // GapShimmer's PARENT div (the grid wrapper) — and React attaches a host's ref
  // only after its children's effects have fired. With useLayoutEffect this
  // effect ran before containerRef.current was attached (it was null in prod
  // builds; dev's StrictMode mount/unmount/remount happened to mask it). useEffect
  // runs after paint, by which point all refs are attached. The one-frame delay
  // before the mask is computed is imperceptible for a one-time sweep.
  useEffect(() => {
    if (!SHIMMER_ENABLED || reduce || !containerRef.current || !cellRects.current || gaps.length === 0) return
    const root = containerRef.current.getBoundingClientRect()
    const rects: { left: number; top: number; size: number }[] = []
    for (const gap of gaps) {
      for (const [r, c] of gap.cells) {
        const rect = cellRects.current.get(`${r},${c}`)
        if (rect) rects.push({ left: rect.left - root.left, top: rect.top - root.top, size: rect.width })
      }
    }
    if (rects.length === 0) return
    setMask(buildGapMask(rects, root.width, root.height))
  }, [reduce, gaps, containerRef, cellRects])

  if (!SHIMMER_ENABLED || !mask) return null
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
      style={{
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        // No mix-blend-mode: iOS Safari has long-standing rendering bugs with
        // mix-blend-mode under masks/filters that cause the glare to vanish on
        // mobile. Over the dim "empty" gap cells, an alpha-composited band
        // reads almost identically to the screen-blended version on desktop,
        // and now renders everywhere. `isolation: isolate` is a defensive
        // hint for any future blending we add inside this container.
        isolation: 'isolate',
      }}
    >
      <motion.div
        className="absolute"
        style={{ left: '-50%', top: '-50%', width: '200%', height: '200%', background: GLARE }}
        initial={{ x: '-55%', y: '-30%' }}
        animate={{ x: '55%', y: '30%' }}
        transition={{ duration: SWEEP_MS / 1000, ease: 'linear' }}
      />
    </div>
  )
}
