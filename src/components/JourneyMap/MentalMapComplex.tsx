// Mental Map (Complex) — the "showstopper" dense dendrite-bloom brain.
//
// Ported from mockups/map-brain-lush.html (the look) + mockups/map-brain-zoom.html
// (the camera). A dense dendritic field, clipped to a lateral brain silhouette,
// blooms outward from the brainstem; 15 bright hub-neurons ride on top as the
// levels. The bloom lights up region-by-region as nodes clear.
//
// Performance: the bloom is static for a given progress state, so it's rendered
// ONCE to an offscreen canvas (regenerated only when themes / size / camera
// change) and blitted each frame. Only the pulsing "next" node animates, via a
// single rAF that runs solely while a "next" node exists and stops on unmount.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { JourneyMapProps } from './types'
import { flattenJourney } from './brainModel'

const TAU = Math.PI * 2

// Lobe colors (district tint). Stars are gold.
const REGION = ['#22d3ee', '#ff2d95', '#a78bfa']
const STAR = '#facc15'

// CSS footprint — mobile-first, matches the transit-map width (~382px).
const CSS_W = 382
const CSS_H = 460
const PR = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

// World→canvas placement (mirrors the lush mockup's s/ox/oy).
const WS = 1.06
const WOX = -16
const WOY = 40

// ---- lateral brain outline as a Path2D (facing left) ----
function brainPath(ox: number, oy: number, s: number): Path2D {
  const p = new Path2D()
  const P = (x: number, y: number): [number, number] => [x * s + ox, y * s + oy]
  p.moveTo(...P(48, 190))
  p.bezierCurveTo(...P(46, 140), ...P(78, 96), ...P(120, 90))
  p.bezierCurveTo(...P(150, 86), ...P(165, 70), ...P(196, 74))
  p.bezierCurveTo(...P(230, 78), ...P(248, 92), ...P(280, 100))
  p.bezierCurveTo(...P(312, 110), ...P(330, 150), ...P(322, 188))
  p.bezierCurveTo(...P(316, 212), ...P(300, 214), ...P(300, 232))
  p.bezierCurveTo(...P(300, 262), ...P(286, 286), ...P(262, 290))
  p.bezierCurveTo(...P(250, 292), ...P(246, 300), ...P(238, 318))
  p.bezierCurveTo(...P(234, 326), ...P(226, 326), ...P(222, 318))
  p.bezierCurveTo(...P(216, 304), ...P(214, 296), ...P(206, 290))
  p.bezierCurveTo(...P(180, 286), ...P(150, 288), ...P(120, 278))
  p.bezierCurveTo(...P(100, 272), ...P(86, 262), ...P(78, 246))
  p.bezierCurveTo(...P(70, 232), ...P(54, 224), ...P(50, 206))
  p.closePath()
  return p
}

// Hue by x-position across the cortex → cyan→magenta→violet sweep.
function hueAt(x: number, s: number, ox: number): number {
  const t = ((x - ox) / s - 48) / (322 - 48)
  return 200 + t * 200
}

interface Seg {
  x1: number
  y1: number
  x2: number
  y2: number
  depth: number
}

// ---- recursive dendrite generator (deterministic) ----
function buildTree(ox: number, oy: number, s: number): Seg[] {
  let seed = 987654
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const segs: Seg[] = []
  const rootX = 236 * s + ox
  const rootY = 320 * s + oy
  const trunks = 10
  const A0 = -2.5
  const A1 = -0.66 // up-left .. up-right

  const grow = (x: number, y: number, ang: number, len: number, depth: number) => {
    if (depth > 7 || len < 5) return
    const nx = x + Math.cos(ang) * len
    const ny = y + Math.sin(ang) * len
    segs.push({ x1: x, y1: y, x2: nx, y2: ny, depth })
    const kids = depth < 2 ? 3 : rnd() < 0.78 ? 2 : 1
    for (let k = 0; k < kids; k++) {
      const spread = 0.5 + depth * 0.05
      const na =
        ang + ((k - (kids - 1) / 2) * spread) / Math.max(1, kids - 1 || 1) + (rnd() - 0.5) * 0.4
      grow(nx, ny, na, len * (0.75 + rnd() * 0.11), depth + 1)
    }
  }
  for (let i = 0; i < trunks; i++) {
    const a = A0 + (A1 - A0) * (i / (trunks - 1)) + (rnd() - 0.5) * 0.08
    grow(rootX, rootY, a, 50 * s, 0)
  }
  return segs
}

// 15 hub positions (level neurons), with lobe index r.
const HUB_BASE: { x: number; y: number; r: number }[] = [
  { x: 80, y: 172, r: 0 }, { x: 104, y: 138, r: 0 }, { x: 134, y: 118, r: 0 }, { x: 120, y: 172, r: 0 }, { x: 154, y: 150, r: 0 },
  { x: 176, y: 118, r: 1 }, { x: 208, y: 120, r: 1 }, { x: 198, y: 166, r: 1 }, { x: 238, y: 142, r: 1 }, { x: 160, y: 198, r: 1 },
  { x: 266, y: 132, r: 2 }, { x: 288, y: 174, r: 2 }, { x: 274, y: 216, r: 2 }, { x: 238, y: 202, r: 2 }, { x: 258, y: 256, r: 2 },
]

interface Camera {
  scale: number
  x: number
  y: number
}

const MIN_SCALE = 0.85
const MAX_SCALE = 3.5

export function MentalMapComplex({ themes, onSelect }: JourneyMapProps) {
  const model = useMemo(() => flattenJourney(themes), [themes])
  const { nodes, clearedCount, totalStars } = model

  // Hub world coords aligned to nodes (node.index → HUB_BASE[index]); fall back
  // to a hub if there are ever fewer/more nodes than coords.
  const hubs = useMemo(
    () =>
      nodes.map((n, i) => {
        const base = HUB_BASE[i] ?? HUB_BASE[HUB_BASE.length - 1]
        return {
          node: n,
          wx: base.x * WS + WOX,
          wy: base.y * WS + WOY,
          lobe: base.r,
        }
      }),
    [nodes],
  )

  const nextHub = useMemo(() => hubs.find((h) => h.node.state === 'next') ?? null, [hubs])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bloomRef = useRef<HTMLCanvasElement | null>(null)
  const camRef = useRef<Camera>({ scale: 1, x: 0, y: 0 })
  const rafRef = useRef<number>(0)
  // Bumped whenever the cached bloom must be regenerated (progress/camera change).
  const [bloomKey, setBloomKey] = useState(0)

  // ---- camera helpers (closures read camRef so they stay current) ----
  const w2s = (wx: number, wy: number): [number, number] => {
    const c = camRef.current
    return [wx * c.scale + c.x, wy * c.scale + c.y]
  }
  const s2w = (sx: number, sy: number): [number, number] => {
    const c = camRef.current
    return [(sx - c.x) / c.scale, (sy - c.y) / c.scale]
  }

  // ---- (re)build the static bloom into the offscreen canvas ----
  useEffect(() => {
    let bloom = bloomRef.current
    if (!bloom) {
      bloom = document.createElement('canvas')
      bloomRef.current = bloom
    }
    bloom.width = CSS_W * PR
    bloom.height = CSS_H * PR
    const ctx = bloom.getContext('2d')
    if (!ctx) return

    const cam = camRef.current
    // Reset transform first — cold contexts drop their first paint otherwise.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, bloom.width, bloom.height)
    // Apply devicePixelRatio + camera together.
    ctx.setTransform(cam.scale * PR, 0, 0, cam.scale * PR, cam.x * PR, cam.y * PR)

    const path = brainPath(WOX, WOY, WS)
    const segs = buildTree(WOX, WOY, WS)
    const litFrac = clearedCount / Math.max(1, hubs.length)

    // faint silhouette fill
    ctx.fillStyle = 'rgba(80,110,210,0.05)'
    ctx.fill(path)

    // bloom (clipped to brain)
    ctx.save()
    ctx.clip(path)
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    for (const seg of segs) {
      const midx = (seg.x1 + seg.x2) / 2
      const frac = ((midx - WOX) / WS - 48) / (322 - 48)
      const lit = frac < litFrac
      ctx.lineWidth = Math.max(0.6, (8 - seg.depth) * 0.5)
      if (lit) {
        const h = hueAt(midx, WS, WOX)
        ctx.strokeStyle = `hsla(${h},90%,62%,0.85)`
        ctx.shadowColor = `hsla(${h},90%,60%,1)`
        ctx.shadowBlur = 8
      } else {
        ctx.strokeStyle = 'rgba(150,165,210,0.10)'
        ctx.shadowBlur = 0
      }
      ctx.beginPath()
      ctx.moveTo(seg.x1, seg.y1)
      const mx = (seg.x1 + seg.x2) / 2 + (seg.y2 - seg.y1) * 0.06
      const my = (seg.y1 + seg.y2) / 2 + (seg.x1 - seg.x2) * 0.06
      ctx.quadraticCurveTo(mx, my, seg.x2, seg.y2)
      ctx.stroke()
    }
    // sparkle tips on lit terminals
    ctx.shadowBlur = 6
    for (const seg of segs) {
      if (seg.depth < 5) continue
      const frac = ((seg.x2 - WOX) / WS - 48) / (322 - 48)
      if (frac >= litFrac) continue
      const h = hueAt(seg.x2, WS, WOX)
      ctx.fillStyle = `hsla(${h},95%,70%,0.9)`
      ctx.shadowColor = `hsla(${h},95%,65%,1)`
      ctx.beginPath()
      ctx.arc(seg.x2, seg.y2, 1.3, 0, TAU)
      ctx.fill()
    }
    ctx.restore() // end clip

    // bright silhouette edge
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = 'rgba(170,190,255,0.5)'
    ctx.lineWidth = 1.8
    ctx.shadowColor = 'rgba(150,170,255,0.8)'
    ctx.shadowBlur = 10
    ctx.stroke(path)
    ctx.restore()

    // cleared + ghost hub neurons (the pulsing "next" hub is drawn live on top)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const h of hubs) {
      if (h.node.state === 'cleared') {
        const col = REGION[h.lobe] ?? REGION[0]
        ctx.shadowColor = col
        ctx.shadowBlur = 16
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.arc(h.wx, h.wy, 5.5, 0, TAU)
        ctx.fill()
      } else if (h.node.state === 'ghost') {
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(170,185,225,0.25)'
        ctx.beginPath()
        ctx.arc(h.wx, h.wy, 3.2, 0, TAU)
        ctx.fill()
      }
    }
    ctx.restore()
    // dark cores + tiny star pips on cleared hubs
    for (const h of hubs) {
      if (h.node.state !== 'cleared') continue
      ctx.fillStyle = '#04050c'
      ctx.beginPath()
      ctx.arc(h.wx, h.wy, 2, 0, TAU)
      ctx.fill()
      if (h.node.stars > 0) {
        ctx.fillStyle = STAR
        ctx.shadowColor = STAR
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(h.wx, h.wy - 9, 1.4, 0, TAU)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    // Blit immediately so the bloom shows even if no "next" rAF is running.
    blit()
    // Re-blit on the next frame — belt-and-suspenders for cold-context drops.
    requestAnimationFrame(blit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloomKey, hubs, clearedCount])

  // ---- blit cached bloom + live pulsing "next" node ----
  function blit(t = 0) {
    const canvas = canvasRef.current
    const bloom = bloomRef.current
    if (!canvas || !bloom) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0) // cold-context guard
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bloom, 0, 0)

    if (!nextHub) return
    // Draw the pulsing white "next" neuron + label in screen space.
    ctx.setTransform(PR, 0, 0, PR, 0, 0)
    const [sx, sy] = w2s(nextHub.wx, nextHub.wy)
    const pulse = 0.5 + 0.5 * Math.sin(t / 360)

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.shadowColor = '#fff'
    ctx.shadowBlur = 20 + pulse * 16
    ctx.globalAlpha = 0.45 + pulse * 0.25
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(sx, sy, 11 + pulse * 4, 0, TAU)
    ctx.fill()
    ctx.restore()

    ctx.shadowColor = '#fff'
    ctx.shadowBlur = 12
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(sx, sy, 5, 0, TAU)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(sx, sy, 11 + pulse * 3, 0, TAU)
    ctx.stroke()

    // neon-chip label for the next level
    const name = nextHub.node.name
    ctx.font = '600 12px ui-sans-serif,system-ui,sans-serif'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(name).width
    const pad = 8
    const bw = tw + pad * 2 + 16
    const bh = 22
    let bx = sx + 14
    const by = sy - bh / 2
    if (bx + bw > CSS_W - 4) bx = sx - 14 - bw // flip to the left near the edge
    ctx.fillStyle = 'rgba(8,12,26,0.85)'
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1
    roundRect(ctx, bx, by, bw, bh, 7)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(name, bx + pad, by + bh / 2)
    ctx.fillText('▶', bx + bw - 14, by + bh / 2)
  }

  // ---- animation loop: only runs while there's a "next" node to pulse ----
  useEffect(() => {
    if (!nextHub) {
      blit() // static final blit when fully cleared
      return
    }
    let mounted = true
    const loop = (t: number) => {
      if (!mounted) return
      blit(t)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      mounted = false
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextHub, bloomKey])

  // ---- pointer interaction: drag-pan + tap-to-select nearest hub ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null

    const onDown = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      drag = {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        cx: camRef.current.x,
        cy: camRef.current.y,
        moved: false,
      }
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!drag) return
      const r = canvas.getBoundingClientRect()
      const dx = e.clientX - r.left - drag.x
      const dy = e.clientY - r.top - drag.y
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
      camRef.current = { ...camRef.current, x: drag.cx + dx, y: drag.cy + dy }
      setBloomKey((k) => k + 1) // re-render bloom under the new camera
    }
    const onUp = (e: PointerEvent) => {
      const wasDrag = drag?.moved
      drag = null
      if (wasDrag) return
      // Tap: hit-test nearest hub within a small screen radius.
      const r = canvas.getBoundingClientRect()
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      const [wx, wy] = s2w(px, py)
      let best: (typeof hubs)[number] | null = null
      let bestD = Infinity
      for (const h of hubs) {
        const d = (h.wx - wx) ** 2 + (h.wy - wy) ** 2
        if (d < bestD) {
          bestD = d
          best = h
        }
      }
      // Radius in world units; the largest hub glow is ~12px screen.
      const hitR = 18 / camRef.current.scale
      if (best && bestD <= hitR * hitR) {
        onSelect(best.node.levelId, best.node.locked)
      }
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
    }
  }, [hubs, onSelect])

  // ---- zoom controls (keep the world point under center) ----
  const zoom = (factor: number) => {
    const c = camRef.current
    const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, c.scale * factor))
    const [cwx, cwy] = s2w(CSS_W / 2, CSS_H / 2)
    camRef.current = { scale: ns, x: CSS_W / 2 - cwx * ns, y: CSS_H / 2 - cwy * ns }
    setBloomKey((k) => k + 1)
  }
  const resetCam = () => {
    camRef.current = { scale: 1, x: 0, y: 0 }
    setBloomKey((k) => k + 1)
  }

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#161f3a] bg-[#04050c]">
        {/* top chrome */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 py-2"
          style={{ background: 'linear-gradient(to bottom, #04050c, transparent)' }}
        >
          <span className="font-pixel text-[10px] text-neon-magenta text-glow-magenta">
            MENTAL MAP
          </span>
          <span className="font-pixel text-[9px] text-yellow-300">
            ★ {totalStars} · {clearedCount}/{hubs.length}
          </span>
        </div>

        <canvas
          ref={canvasRef}
          width={CSS_W * PR}
          height={CSS_H * PR}
          style={{ width: CSS_W, height: CSS_H, display: 'block', touchAction: 'none' }}
          className="mx-auto cursor-pointer"
        />

        {/* zoom controls */}
        <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-1.5">
          <ZoomBtn label="＋" onClick={() => zoom(1.5)} />
          <ZoomBtn label="－" onClick={() => zoom(1 / 1.5)} />
          <ZoomBtn label="⤢" onClick={resetCam} />
        </div>
      </div>
      <p className="mt-2 px-1 text-center text-[11px] text-gray-500">
        Tap a neuron to enter its level. Drag to pan, use ＋／－ to zoom.
      </p>
    </div>
  )
}

function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-pixel flex h-7 w-7 items-center justify-center rounded-md border border-[#243056] bg-[#111934] text-[10px] text-[#cdd6f4] hover:bg-[#182250] active:translate-y-px"
    >
      {label}
    </button>
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
