import { useEffect, useMemo, useRef, useState } from 'react'
import { useProgressStore } from '../../store/progressStore'
import { useGameStore, gitDifficulty } from '../../store/gameStore'
import { useNavStore } from '../../store/navStore'
import { difficultyPips } from '../../lib/journeyScoring'
import {
  GIT_TRACKS, allNodes, sproutedSegments, currentLevel, bestScore,
} from '../../lib/gitMap'

const R = 16
const MIN_SCALE = 0.18
const MAX_SCALE = 2.6

// Rounded branch curve: leave parent horizontally, enter child vertically.
function path(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(x1 - x2) < 1) return `M${x1},${y1} L${x2},${y2}`
  const c1x = x1 + (x2 - x1) * 0.55
  const c2y = y1 + (y2 - y1) * 0.45
  return `M${x1},${y1} C ${c1x},${y1} ${x2},${c2y} ${x2},${y2}`
}

export function GitMap() {
  const progress = useProgressStore(s => s.byLevel)
  const startGitLevel = useGameStore(s => s.startGitLevel)
  const enterPlaying = useNavStore(s => s.enterPlaying)

  const nodes = useMemo(() => allNodes(progress), [progress])
  const segs = useMemo(() => sproutedSegments(progress), [progress])

  // Default selection: the current node on The Classic (the "you are here").
  const classicCur = currentLevel(progress, 'classic')
  const defaultSel = classicCur != null ? `git:classic:${classicCur}` : 'git:classic:1'
  const [selected, setSelected] = useState<string>(defaultSel)

  const wrapRef = useRef<HTMLDivElement>(null)
  const camRef = useRef<SVGGElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const view = useRef({ scale: 1.4, tx: 0, ty: 0 })
  const drag = useRef({ on: false, moved: false, captured: false, last: [0, 0] as [number, number], id: -1 })

  const selNode = nodes.find(n => n.id === selected) ?? nodes[0]
  const selTrack = selNode.track
  const selLevel = selNode.level
  const playable = selNode.current || selNode.cleared
  const best = bestScore(progress, selTrack, selLevel)
  const pips = difficultyPips(gitDifficulty(selTrack, selLevel).gapCount)

  function applyCam() {
    const cam = camRef.current
    if (cam) cam.setAttribute('transform', `translate(${view.current.tx},${view.current.ty}) scale(${view.current.scale})`)
    positionCard()
  }
  function positionCard() {
    const wrap = wrapRef.current, c = cardRef.current
    if (!wrap || !c) return
    const { tx, ty, scale } = view.current
    const sx = tx + selNode.x * scale, sy = ty + selNode.y * scale
    const cw = c.offsetWidth || 188, ch = c.offsetHeight || 120
    let left = sx + R * scale + 14, top = sy - ch / 2
    left = Math.max(10, Math.min(wrap.clientWidth - cw - 10, left))
    top = Math.max(10, Math.min(wrap.clientHeight - ch - 80, top))
    c.style.left = `${left}px`; c.style.top = `${top}px`
  }
  function findMe() {
    const wrap = wrapRef.current; if (!wrap) return
    view.current.scale = 1.4
    view.current.tx = wrap.clientWidth * 0.42 - selNode.x * 1.4
    view.current.ty = wrap.clientHeight * 0.5 - selNode.y * 1.4
    applyCam()
  }
  function zoomAt(mx: number, my: number, f: number) {
    const v = view.current
    const ns = Math.max(MIN_SCALE, Math.min(v.scale * f, MAX_SCALE))
    v.tx = mx - ((mx - v.tx) * ns) / v.scale
    v.ty = my - ((my - v.ty) * ns) / v.scale
    v.scale = ns
    applyCam()
  }
  function fit() {
    const wrap = wrapRef.current; if (!wrap) return
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9
    for (const n of nodes) { a = Math.min(a, n.x); b = Math.min(b, n.y); c = Math.max(c, n.x); d = Math.max(d, n.y) }
    const w = c - a + 120, h = d - b + 120
    const v = view.current
    v.scale = Math.max(MIN_SCALE, Math.min(Math.min(wrap.clientWidth / w, wrap.clientHeight / h) * 0.92, 2))
    v.tx = wrap.clientWidth / 2 - (a - 60 + w / 2) * v.scale
    v.ty = wrap.clientHeight / 2 - (b - 60 + h / 2) * v.scale
    applyCam()
  }

  // Center on the current node on first mount.
  useEffect(() => { findMe() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the card glued to the selected node when selection changes.
  useEffect(() => { positionCard() }) // eslint-disable-line react-hooks/exhaustive-deps

  function onWheel(e: React.WheelEvent) {
    const wrap = wrapRef.current; if (!wrap) return
    const r = wrap.getBoundingClientRect()
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016))
  }
  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('[data-card]')) return
    drag.current = { on: true, moved: false, captured: false, last: [e.clientX, e.clientY], id: e.pointerId }
  }
  function onPointerMove(e: React.PointerEvent) {
    const dr = drag.current; if (!dr.on) return
    const dx = e.clientX - dr.last[0], dy = e.clientY - dr.last[1]
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      dr.moved = true
      if (!dr.captured) { dr.captured = true; (e.currentTarget as HTMLElement).setPointerCapture(dr.id) }
    }
    view.current.tx += dx; view.current.ty += dy; dr.last = [e.clientX, e.clientY]
    applyCam()
  }
  function onPointerUp(e: React.PointerEvent) {
    const dr = drag.current; const wasDrag = dr.moved; dr.on = false
    if (dr.captured) { try { (e.currentTarget as HTMLElement).releasePointerCapture(dr.id) } catch { /* noop */ } }
    if (wasDrag) return
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    if (!el || el.closest('[data-card]')) return
    const g = el.closest('[data-node]') as HTMLElement | null
    if (!g) return
    const id = g.getAttribute('data-node')!
    const n = nodes.find(x => x.id === id)
    if (n && (n.cleared || n.current)) setSelected(id)
  }

  function play() {
    startGitLevel(selTrack, selLevel)
    enterPlaying()
  }

  return (
    <div
      ref={wrapRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative w-full touch-none select-none overflow-hidden rounded-2xl border-2 border-arcade-edge cursor-grab"
      style={{
        height: 'calc(100dvh - 120px)',
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(255,255,255,.05) 1px, transparent 0), radial-gradient(140% 90% at 30% 100%, #0c1838 0%, #070b16 60%)',
        backgroundSize: '30px 30px, cover',
      }}
    >
      <svg className="block h-full w-full">
        <g ref={camRef}>
          {segs.map(s => (
            <path key={s.key} d={path(s.x1, s.y1, s.x2, s.y2)} fill="none" stroke={s.color} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
          ))}
          {nodes.map(n => (
            <g key={n.id} data-node={n.id} style={{ cursor: n.cleared || n.current ? 'pointer' : 'default' }}>
              {n.current ? (
                <>
                  <circle cx={n.x} cy={n.y} r={24} fill={n.accent} opacity={0.4} />
                  <circle cx={n.x} cy={n.y} r={R} fill="#fff" stroke={n.accent} strokeWidth={5} />
                </>
              ) : n.cleared ? (
                <circle cx={n.x} cy={n.y} r={R} fill={n.accent} />
              ) : (
                <circle cx={n.x} cy={n.y} r={10} fill="#0c1326" stroke="#2b3a5c" strokeWidth={2} />
              )}
              {n.id === selected && (
                <circle cx={n.x} cy={n.y} r={R + 8} fill="none" stroke="#fff" strokeWidth={2} opacity={0.9} />
              )}
            </g>
          ))}
        </g>
      </svg>

      {/* Metadata card pinned to the selected node */}
      <div
        ref={cardRef}
        data-card
        className="absolute z-10 w-[188px] rounded-2xl border border-arcade-edge p-3.5 shadow-xl"
        style={{ background: 'linear-gradient(180deg,#0f1834,#0a0f22)' }}
      >
        <div className="text-base font-extrabold text-white">{GIT_TRACKS[selTrack].label} {String(selLevel).padStart(2, '0')}</div>
        <div className="my-2.5 flex items-center gap-4">
          <div className="text-[11px] font-bold text-zinc-400">Best<b className="mt-0.5 block text-[17px] text-white">{best > 0 ? `${best}%` : '—'}</b></div>
          <div className="text-[11px] font-bold text-zinc-400">Difficulty
            <div className="mt-1 flex gap-[3px]">
              {Array.from({ length: 5 }, (_, i) => (
                <i key={i} className="h-[5px] w-[13px] rounded" style={{ background: i < pips ? selNode.accent : '#243049' }} />
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={play}
          className={`w-full rounded-xl py-3 text-sm font-extrabold ${playable ? 'text-[#04140a]' : 'text-zinc-400'}`}
          style={playable
            ? { background: 'linear-gradient(180deg,#22c55e,#16a34a)' }
            : { background: '#16203a' }}
          disabled={!playable}
        >
          {selNode.current ? '▶ Play' : selNode.cleared ? '↺ Replay' : 'Locked'}
        </button>
      </div>

      {/* Bottom dock: legend + zoom controls */}
      <div className="absolute inset-x-3.5 bottom-3.5 z-10 flex items-center justify-between gap-2.5 rounded-2xl border border-arcade-edge bg-[rgba(10,15,26,.92)] px-3 py-2.5">
        <div className="flex gap-3 text-[10.5px] font-semibold text-zinc-400">
          <span className="flex items-center gap-1.5"><span className="h-[11px] w-[11px] rounded-full bg-white" style={{ boxShadow: '0 0 0 3px rgba(56,189,248,.4)' }} />Here</span>
          <span className="flex items-center gap-1.5"><span className="h-[11px] w-[11px] rounded-full" style={{ background: '#38bdf8' }} />Cleared</span>
          <span className="flex items-center gap-1.5"><span className="h-[11px] w-[11px] rounded-full border-2 border-[#2b3a5c] bg-[#0c1326]" />Locked</span>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => { const w = wrapRef.current!; zoomAt(w.clientWidth / 2, w.clientHeight / 2, 1 / 1.3) }} className="grid h-8 w-8 place-items-center rounded-lg border border-arcade-edge bg-[#0c1326] font-extrabold text-zinc-200">−</button>
          <button onClick={fit} className="grid h-8 w-8 place-items-center rounded-lg border border-arcade-edge bg-[#0c1326] text-zinc-200" title="Fit">⤢</button>
          <button onClick={findMe} className="grid h-8 w-8 place-items-center rounded-lg border border-arcade-edge bg-[#0c1326] text-zinc-200" title="Find me">◎</button>
          <button onClick={() => { const w = wrapRef.current!; zoomAt(w.clientWidth / 2, w.clientHeight / 2, 1.3) }} className="grid h-8 w-8 place-items-center rounded-lg border border-arcade-edge bg-[#0c1326] font-extrabold text-zinc-200">+</button>
        </div>
      </div>
    </div>
  )
}
