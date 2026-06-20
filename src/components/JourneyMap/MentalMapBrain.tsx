// Low-poly "Mental Map" brain renderer for the Journey map.
//
// Ports mockups/map-brain-lowpoly-interactive.html to React: a static faceted
// SVG mesh (Delaunay-triangulated brain outline, faux-3D depth shading, organic
// nearest-hub lobes, connectome edges that ignite when both endpoints clear) plus
// a camera transform for pan/zoom. The scene mesh is rebuilt only when `themes`
// changes (useMemo); pan/zoom only mutate the <g> camera transform — never the
// scene — and there is NO idle requestAnimationFrame loop (the "next" pulse is a
// CSS keyframe). Tapping any node calls onSelect(levelId, locked); ghost/locked
// nodes stay tappable so the level detail can surface the lock.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Delaunator from 'delaunator'
import type { JourneyMapProps } from './types'
import { flattenJourney, type BrainNode } from './brainModel'

// ── palette ──────────────────────────────────────────────────────────────────
const REGION = ['#22d3ee', '#ff2d95', '#a78bfa'] // lobe 0/1/2: cyan / magenta / violet
const RGB: Record<string, [number, number, number]> = {
  '#22d3ee': [34, 211, 238],
  '#ff2d95': [255, 45, 149],
  '#a78bfa': [167, 139, 250],
}
const LIGHT: Record<string, string> = {
  '#22d3ee': '#bff4ff',
  '#ff2d95': '#ffc7e1',
  '#a78bfa': '#e4dcff',
}
const STAR = '#facc15'
const UNLIT: [number, number, number] = [44, 58, 104]
const VIEW = { w: 360, h: 380 }

// ── geometry (verbatim from the mockup) ──────────────────────────────────────
const OUTLINE: [number, number][] = [
  [64, 196], [62, 166], [72, 130], [98, 104], [126, 90], [152, 84], [176, 80], [200, 78], [224, 80], [250, 86],
  [276, 96], [300, 106], [320, 122], [334, 148], [338, 176], [330, 198], [320, 214], [326, 234], [336, 260],
  [324, 286], [300, 300], [280, 300], [266, 286], [258, 302], [250, 324], [243, 335], [235, 335], [231, 318],
  [236, 292], [238, 268], [224, 252], [198, 250], [168, 250], [140, 250], [114, 248], [90, 238], [74, 220], [66, 206],
]

// 15 hub coordinates [x, y, lobe]. node.index -> HUB[index].
const HUB: [number, number, number][] = [
  [82, 176, 0], [106, 140, 0], [136, 116, 0], [120, 176, 0], [154, 150, 0],
  [178, 116, 1], [210, 120, 1], [200, 168, 1], [240, 140, 1], [162, 200, 1],
  [268, 134, 2], [290, 176, 2], [300, 250, 2], [238, 206, 2], [300, 210, 2],
]

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 4], [0, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [5, 9],
  [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [11, 14], [2, 5],
]

function inPoly(x: number, y: number, poly: [number, number][]): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

function buildPoints(): [number, number][] {
  let seed = 7
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const pts: [number, number][] = []
  OUTLINE.forEach((p) => pts.push([p[0], p[1]]))
  HUB.forEach((h) => pts.push([h[0], h[1]]))
  for (let gx = 70; gx < 334; gx += 29)
    for (let gy = 90; gy < 300; gy += 29) {
      const x = gx + (rnd() - 0.5) * 18
      const y = gy + (rnd() - 0.5) * 18
      if (inPoly(x, y, OUTLINE)) pts.push([x, y])
    }
  return pts
}

function nearestHub(cx: number, cy: number): number {
  let bi = 0, bd = 1e9
  for (let i = 0; i < HUB.length; i++) {
    const dx = HUB[i][0] - cx, dy = HUB[i][1] - cy, d = dx * dx + dy * dy
    if (d < bd) { bd = d; bi = i }
  }
  return bi
}

// faux-3D Lambert shading: bulge the flat outline into a dome and light it.
const C = { x: 198, y: 178, rx: 152, ry: 112 }
const L = (() => {
  const v = [-0.45, -0.62, 0.64]
  const m = Math.hypot(v[0], v[1], v[2])
  return v.map((n) => n / m)
})()
function shadeAt(cx: number, cy: number, hash: number): number {
  const dx = (cx - C.x) / C.rx, dy = (cy - C.y) / C.ry, r2 = Math.min(1, dx * dx + dy * dy)
  const nz = Math.sqrt(Math.max(0.05, 1 - r2)), nl = Math.hypot(dx, dy, nz)
  const diff = Math.max(0, (dx * L[0] + dy * L[1] + nz * L[2]) / nl)
  const jitter = 0.9 + ((Math.imul(hash, 2654435761) >>> 0) % 18) / 100
  return (0.42 + 0.72 * diff) * jitter
}
const frgb = (base: [number, number, number], k: number) =>
  `rgb(${base.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))).join(',')})`

// Precompute the facet mesh once at module load — pure geometry, no game state.
interface Facet {
  d: string
  hub: number
  lobe: number
  sh: number
}
const FACETS: Facet[] = (() => {
  const points = buildPoints()
  const tris = Delaunator.from(points).triangles
  const facets: Facet[] = []
  for (let i = 0; i < tris.length; i += 3) {
    const a = points[tris[i]], b = points[tris[i + 1]], c = points[tris[i + 2]]
    const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3
    if (!inPoly(cx, cy, OUTLINE)) continue
    const hub = nearestHub(cx, cy)
    facets.push({
      d: `M${a[0]},${a[1]} L${b[0]},${b[1]} L${c[0]},${c[1]} Z`,
      hub,
      lobe: HUB[hub][2],
      sh: shadeAt(cx, cy, i),
    })
  }
  return facets
})()

const clampS = (s: number) => Math.max(0.8, Math.min(6, s))

// ── component ────────────────────────────────────────────────────────────────
export function MentalMapBrain({ themes, onSelect }: JourneyMapProps) {
  const model = useMemo(() => flattenJourney(themes), [themes])
  const { nodes, totalStars } = model

  const svgRef = useRef<SVGSVGElement | null>(null)
  const camRef = useRef<SVGGElement | null>(null)

  // Camera lives in refs, not React state — pan/zoom mutate the <g> transform
  // directly so the scene never re-renders. `scale` is mirrored into state only
  // to toggle the "zoomed" label-visibility class and counter-scale labels.
  const cam = useRef({ s: 1, x: 0, y: 0 })
  const camRAF = useRef(0)
  const anim = useRef<{ s0: number; x0: number; y0: number; s1: number; x1: number; y1: number; t: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [grabbing, setGrabbing] = useState(false)

  const applyCam = useCallback(() => {
    const c = cam.current
    if (camRef.current) camRef.current.setAttribute('transform', `translate(${c.x} ${c.y}) scale(${c.s})`)
    setScale(c.s)
  }, [])

  const scheduleCam = useCallback(() => {
    if (!camRAF.current)
      camRAF.current = requestAnimationFrame(() => {
        camRAF.current = 0
        applyCam()
      })
  }, [applyCam])

  // pointer/client coords -> viewBox coords
  const vb = useCallback((e: { clientX: number; clientY: number }): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) * (VIEW.w / r.width), (e.clientY - r.top) * (VIEW.h / r.height)]
  }, [])

  // fly-to easing — a one-shot RAF chain that stops when it lands (no idle loop).
  const stepAnim = useCallback(() => {
    const a = anim.current
    if (!a) return
    a.t = Math.min(1, a.t + 0.12)
    const k = 1 - Math.pow(1 - a.t, 3)
    cam.current.s = a.s0 + (a.s1 - a.s0) * k
    cam.current.x = a.x0 + (a.x1 - a.x0) * k
    cam.current.y = a.y0 + (a.y1 - a.y0) * k
    applyCam()
    if (a.t < 1) requestAnimationFrame(stepAnim)
    else anim.current = null
  }, [applyCam])

  const flyTo = useCallback(
    (ns: number, wx: number, wy: number, atVx?: number, atVy?: number) => {
      const vx = atVx ?? VIEW.w / 2, vy = atVy ?? VIEW.h / 2
      anim.current = { s0: cam.current.s, x0: cam.current.x, y0: cam.current.y, s1: clampS(ns), x1: vx - wx, y1: vy - wy, t: 0 }
      stepAnim()
    },
    [stepAnim],
  )

  const flyCenter = useCallback(
    (ns: number) => {
      const c = cam.current
      const cw = (VIEW.w / 2 - c.x) / c.s, ch = (VIEW.h / 2 - c.y) / c.s
      flyTo(ns, cw * clampS(ns), ch * clampS(ns))
    },
    [flyTo],
  )

  // wheel listener attached imperatively so it can be non-passive (preventDefault).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const [vx, vy] = vb(e)
      const c = cam.current
      const ns = clampS(c.s * Math.exp(-e.deltaY * 0.0015))
      const wx = (vx - c.x) / c.s, wy = (vy - c.y) / c.s
      c.s = ns
      c.x = vx - wx * ns
      c.y = vy - wy * ns
      anim.current = null
      scheduleCam()
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [vb, scheduleCam])

  useEffect(() => () => { if (camRAF.current) cancelAnimationFrame(camRAF.current) }, [])

  const drag = useRef<{ vx: number; vy: number; cx: number; cy: number; moved: boolean } | null>(null)

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const [vx, vy] = vb(e)
    drag.current = { vx, vy, cx: cam.current.x, cy: cam.current.y, moved: false }
    svgRef.current?.setPointerCapture(e.pointerId)
    setGrabbing(true)
    anim.current = null
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const [vx, vy] = vb(e)
    const dx = vx - drag.current.vx, dy = vy - drag.current.vy
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true
    cam.current.x = drag.current.cx + dx
    cam.current.y = drag.current.cy + dy
    scheduleCam()
  }
  const onPointerUp = () => {
    setGrabbing(false)
    drag.current = null
  }

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const [vx, vy] = vb(e)
    const c = cam.current
    const wx = (vx - c.x) / c.s, wy = (vy - c.y) / c.s
    if (c.s > 2.6) flyTo(1, VIEW.w / 2, VIEW.h / 2)
    else flyTo(4, wx * 4, wy * 4, vx, vy)
  }

  // A node tap fires only if the pointer didn't pan (so dragging never selects).
  const tapNode = (node: BrainNode) => {
    if (drag.current?.moved) return
    onSelect(node.levelId, node.locked)
  }

  const zoomed = scale > 1.9
  const invScale = 1 / scale // counter-scale labels so they stay a constant size
  const lod = scale < 1.4 ? 'overview' : scale < 2.4 ? 'zoom · region' : scale < 3.6 ? 'zoom · path' : 'zoom · synapse'

  return (
    <div className="relative mx-auto w-full max-w-md">
      <style>{`
        .mmb-svg { touch-action: none; cursor: grab; }
        .mmb-svg.mmb-grabbing { cursor: grabbing; }
        .mmb-label { opacity: 0; transition: opacity .2s; }
        .mmb-svg.mmb-zoomed .mmb-label { opacity: 1; }
        @keyframes mmbPulse { 0%,100% { r: 7; opacity: 1 } 50% { r: 10.5; opacity: .65 } }
        .mmb-next-ring { animation: mmbPulse 1.4s ease-in-out infinite; transform-box: fill-box; }
        @media (prefers-reduced-motion: reduce) { .mmb-next-ring { animation: none; } }
      `}</style>

      <div className="relative overflow-hidden rounded-[22px] border-2 border-arcade-edge bg-[#04050c]">
        {/* top chrome: wordmark + star total */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 py-2"
          style={{ background: 'linear-gradient(to bottom,#04050c,transparent)' }}
        >
          <span className="font-pixel font-bold tracking-[0.05em] text-[10px] text-white text-glow-cyan">VANISHING TILES</span>
          <span className="font-pixel text-[9px] text-yellow-400" style={{ color: STAR }}>
            ★ {totalStars}
          </span>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          xmlns="http://www.w3.org/2000/svg"
          className={`mmb-svg block w-full${zoomed ? ' mmb-zoomed' : ''}${grabbing ? ' mmb-grabbing' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <defs>
            <filter id="mmbGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g ref={camRef}>
            {/* ── faceted mesh ── */}
            {FACETS.map((f, i) => {
              const lit = f.hub < nodes.length && nodes[f.hub].state === 'cleared'
              return lit ? (
                <path
                  key={i}
                  d={f.d}
                  fill={frgb(RGB[REGION[f.lobe]], 0.3 + 0.62 * f.sh)}
                  stroke="#04050c"
                  strokeOpacity={0.3}
                  strokeWidth={0.5}
                />
              ) : (
                <path
                  key={i}
                  d={f.d}
                  fill={frgb(UNLIT, 0.55 * f.sh)}
                  stroke="#9fb0e0"
                  strokeOpacity={0.07}
                  strokeWidth={0.4}
                />
              )
            })}

            {/* outline */}
            <polygon
              points={OUTLINE.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke="#aab8ff"
              strokeOpacity={0.5}
              strokeWidth={1.4}
            />

            {/* ── connectome edges (ignite when both endpoints cleared) ── */}
            {EDGES.map(([a, b], i) => {
              const A = HUB[a], B = HUB[b]
              const aLit = a < nodes.length && nodes[a].state === 'cleared'
              const bLit = b < nodes.length && nodes[b].state === 'cleared'
              if (aLit && bLit) {
                return (
                  <g key={i}>
                    <line
                      x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]}
                      stroke="#04050c" strokeOpacity={0.55} strokeWidth={2.8} strokeLinecap="round"
                    />
                    <line
                      x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]}
                      stroke={LIGHT[REGION[HUB[b][2]]]} strokeOpacity={0.95} strokeWidth={1.3}
                      strokeLinecap="round" filter="url(#mmbGlow)"
                    />
                  </g>
                )
              }
              return (
                <line
                  key={i}
                  x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]}
                  stroke="#9fb0e0" strokeOpacity={0.13} strokeWidth={0.8} strokeDasharray="1.5 4"
                />
              )
            })}

            {/* ── nodes + neon labels ── */}
            {nodes.map((node) => {
              const hub = HUB[node.index]
              if (!hub) return null
              const [x, y] = hub
              const color = REGION[node.lobe % REGION.length]
              const tap = () => tapNode(node)
              // labels: next is always shown; others fade in only when zoomed (CSS).
              const showLabel = node.state !== 'ghost'
              const labelAlwaysOn = node.state === 'next'

              return (
                <g key={node.levelId} style={{ cursor: 'pointer' }} onClick={tap}>
                  {/* generous invisible hit target so taps land on phones */}
                  <circle cx={x} cy={y} r={12} fill="transparent" />

                  {node.state === 'cleared' && (
                    <>
                      <circle cx={x} cy={y} r={5.4} fill={color} filter="url(#mmbGlow)" />
                      <circle cx={x} cy={y} r={2.4} fill="#fff" />
                    </>
                  )}
                  {node.state === 'next' && (
                    <>
                      <circle
                        className="mmb-next-ring"
                        cx={x} cy={y} r={7} fill="none" stroke="#fff" strokeWidth={2}
                      />
                      <circle cx={x} cy={y} r={4.4} fill="#fff" filter="url(#mmbGlow)" />
                    </>
                  )}
                  {node.state === 'ghost' && (
                    <circle cx={x} cy={y} r={3} fill="#aeb9da" fillOpacity={0.3} />
                  )}

                  {showLabel && (
                    <NodeLabel
                      x={x}
                      y={y}
                      text={node.name}
                      stars={node.stars}
                      isNext={node.state === 'next'}
                      color={color}
                      invScale={invScale}
                      className={labelAlwaysOn ? undefined : 'mmb-label'}
                    />
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* zoom controls */}
        <div className="absolute bottom-2 right-2 z-20 flex flex-col gap-1.5">
          <ZoomBtn label="＋" onClick={() => flyCenter(cam.current.s * 1.6)} />
          <ZoomBtn label="－" onClick={() => flyCenter(cam.current.s / 1.6)} />
          <ZoomBtn
            label="⤢"
            onClick={() => {
              anim.current = { s0: cam.current.s, x0: cam.current.x, y0: cam.current.y, s1: 1, x1: 0, y1: 0, t: 0 }
              stepAnim()
            }}
          />
        </div>

        {/* level-of-detail pill */}
        <div className="pointer-events-none absolute bottom-2 left-2 z-20 rounded bg-black/50 px-2 py-1 text-[11px] text-gray-400">
          {lod}
        </div>
      </div>
    </div>
  )
}

// A neon-arcade name chip, counter-scaled so it stays a constant readable size
// regardless of camera zoom. Drawn in SVG user units around the node, then the
// whole group is scaled by 1/cameraScale about the node's anchor.
function NodeLabel({
  x,
  y,
  text,
  stars,
  isNext,
  color,
  invScale,
  className,
}: {
  x: number
  y: number
  text: string
  stars: number
  isNext: boolean
  color: string
  invScale: number
  className?: string
}) {
  const label = text.toUpperCase()
  // Space Grotesk bold; size it down hard so a chip fits next to a 5px dot.
  // width ≈ chars * ~5.2 at 5px glyphs (slight overestimate for this proportional font).
  const fontSize = 5
  const charW = 5.4
  const padX = 5
  const chipW = label.length * charW + padX * 2
  const chipH = 12
  const showStars = !isNext && stars > 0

  return (
    <g
      className={className}
      transform={`translate(${x + 8} ${y - 9}) scale(${invScale}) translate(${-(x + 8)} ${-(y - 9)})`}
    >
      <rect
        x={x + 8}
        y={y - 9}
        width={chipW}
        height={chipH}
        rx={3}
        fill="#080c1aee"
        stroke={isNext ? '#ffffffaa' : `${color}88`}
        strokeWidth={0.7}
      />
      <text
        x={x + 8 + padX}
        y={y - 9 + chipH / 2}
        fontFamily="'Space Grotesk', Inter, ui-sans-serif, system-ui, sans-serif"
        fontWeight={700}
        fontSize={fontSize}
        dominantBaseline="central"
        fill={isNext ? '#ffffff' : '#dbe2ff'}
      >
        {label}
      </text>
      {showStars && (
        <text
          x={x + 8 + padX}
          y={y - 9 + chipH + 6}
          fontSize={6}
          fill={STAR}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {'★'.repeat(Math.min(5, stars))}
        </text>
      )}
    </g>
  )
}

function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-pixel select-none rounded-lg border border-arcade-edge bg-[#111934cc] px-2.5 py-2 text-[9px] text-gray-200 hover:bg-[#182250] active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {label}
    </button>
  )
}
