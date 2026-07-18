import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Pure fit-scale math: the largest uniform scale (never above 1:1) that fits a
 * `designW × naturalH` surface inside an `availW × availH` box. Extracted from
 * the component so it can be unit-tested without a DOM.
 */
export function computeFitScale({
  availW, availH, designW, naturalH,
}: { availW: number; availH: number; designW: number; naturalH: number }): number {
  if (naturalH <= 0 || designW <= 0 || availW <= 0 || availH <= 0) return 1
  return Math.min(1, availW / designW, availH / naturalH)
}

/**
 * Renders `children` at their natural pixel size (a fixed design width, natural
 * height) and shrinks the whole surface UNIFORMLY to fit the viewport — never
 * enlarging past 1:1. The play surface is authored at a fixed size (~384px wide,
 * ~713–736px tall); on smaller screens this scales it down so the entire board +
 * tray fits with no scroll and no horizontal overflow, while desktop (where the
 * surface already fits) stays at scale 1 and looks exactly as before.
 *
 * How it stays correct:
 * - `stage.offsetHeight` is the UNSCALED layout height (transforms don't affect
 *   offset metrics), so we can measure the natural size even while a transform is
 *   applied — no measurement feedback loop.
 * - The `frame` is laid out at the SCALED footprint (`designW·k × naturalH·k`);
 *   a bare transform doesn't change layout size, so the frame is what makes the
 *   surface center and produces zero scroll.
 * - A `ResizeObserver` on both the container and the stage recomputes `k` when
 *   the viewport changes (resize/rotate) or the content height changes (Easy 713
 *   → Hard 736, phase swaps). `useLayoutEffect` applies it before paint.
 *
 * IMPORTANT: a CSS transform makes this element the containing block for any
 * `position: fixed` descendant — so full-screen fixed overlays (game over, pause,
 * flyers) must render OUTSIDE this wrapper, never inside `children`.
 */
export function ScaleToFit({ children, designWidth = 384 }: { children: ReactNode; designWidth?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [box, setBox] = useState<{ w: number; h: number }>({ w: designWidth, h: 0 })

  useLayoutEffect(() => {
    const container = containerRef.current
    const stage = stageRef.current
    if (!container || !stage) return

    const measure = () => {
      const naturalH = stage.offsetHeight
      // clientWidth/clientHeight INCLUDE padding, so subtract it to get the space
      // actually free for the surface (the padding is the base gutter + safe-area
      // insets). The container is a fixed 100dvh box (see below), so clientHeight
      // is the stable viewport height — NOT the content height — which is what
      // lets the vertical constraint actually bind.
      const cs = getComputedStyle(container)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const k = computeFitScale({
        availW: container.clientWidth - padX,
        availH: container.clientHeight - padY,
        designW: designWidth,
        naturalH,
      })
      setScale(k)
      setBox({ w: designWidth * k, h: naturalH * k })
    }

    measure()
    // ResizeObserver catches content-height changes (Easy 713 → Hard 736, phase
    // swaps) and container resizes; guarded because some environments (jsdom in
    // tests, very old browsers) don't provide it — there the initial measure plus
    // the window `resize` listener still keep the scale correct.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(container)
    ro?.observe(stage)
    window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [designWidth])

  return (
    <div
      ref={containerRef}
      className="w-full flex justify-center items-start overflow-hidden"
      style={{
        // A FIXED viewport-height box (not min-height / flex-grow) so its
        // clientHeight is the stable viewport — otherwise the box grows to fit its
        // own scaled content and the height constraint never binds. overflow-hidden
        // guarantees no scroll (hence no scrollbar reflow "jump") even if a
        // sub-pixel rounding leaves the surface a hair over.
        height: '100dvh',
        // Base gutter + safe-area insets so the surface never touches the edges or
        // tucks under a notch / home indicator (subtracted from the available box).
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Frame laid out at the scaled footprint so the surface centers and never
          scrolls; the stage inside is scaled from its top-left corner. */}
      <div style={{ width: box.w, height: box.h }}>
        <div
          ref={stageRef}
          style={{ width: designWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
