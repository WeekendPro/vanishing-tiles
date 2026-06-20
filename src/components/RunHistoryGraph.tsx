import { useState } from 'react'
import type { RunRecord } from '../store/runHistoryStore'
import {
  METRICS,
  type MetricDef,
  ordinal,
  formatMetric,
  rankOf,
  seriesStats,
  recentRuns,
  ladderRows,
} from '../lib/runHistory'
import { relativeTime } from '../lib/relativeTime'

// ── Catmull-Rom → cubic bezier (ported from the mockup's smooth()) ────────────
interface Point { x: number; y: number }

function smooth(pts: Point[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

// ── Layout constants (mirror the mockup) ──────────────────────────────────────
const W = 320
const H = 116
const PAD_L = 8
const PAD_R = 12
const PAD_T = 18
const PAD_B = 16

// ── Props ─────────────────────────────────────────────────────────────────────
export interface RunHistoryGraphProps {
  records: RunRecord[]
  currentId: string
  recentCount?: number
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
interface SparklineProps {
  window: RunRecord[]
  allRecords: RunRecord[]
  metric: MetricDef
  currentId: string
  selectedIdx: number | null
  onSelectIdx: (idx: number | null) => void
}

function Sparkline({ window: win, allRecords, metric, currentId, selectedIdx, onSelectIdx }: SparklineProps) {
  const iw = W - PAD_L - PAD_R
  const ih = H - PAD_T - PAD_B

  const { min, max, avg } = seriesStats(win, metric.key)
  const span = (max - min) || 1
  const yOf = (v: number) => PAD_T + ih * (1 - (v - min) / span)

  const pts: (Point & { record: RunRecord; idx: number; trueRunNumber: number })[] = win.map((r, i) => ({
    x: PAD_L + iw * (win.length > 1 ? i / (win.length - 1) : 0.5),
    y: yOf(r[metric.key]),
    record: r,
    idx: i,
    // True 1-based position within the full records array.
    // The window is the last win.length records chronologically, so window
    // index i maps to overall index (allRecords.length - win.length + i).
    trueRunNumber: allRecords.length - win.length + i + 1,
  }))

  const curIdx = win.findIndex(r => r.id === currentId)
  const curPt = curIdx >= 0 ? pts[curIdx] : null

  const linePath = smooth(pts)
  const areaPath = linePath
    ? `${linePath} L ${pts[pts.length - 1].x} ${H - PAD_B} L ${pts[0].x} ${H - PAD_B} Z`
    : ''

  const gradId = `grad_${metric.key}`

  // Rank across ALL records (not just window)
  const rank = currentId ? rankOf(allRecords, metric.key, currentId) : 0

  const handleOverlayClick = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.closest('svg')!.getBoundingClientRect()
    const xsvg = (e.clientX - rect.left) * (W / rect.width)
    let idx = win.length > 1
      ? Math.round((xsvg - PAD_L) / iw * (win.length - 1))
      : 0
    idx = Math.max(0, Math.min(win.length - 1, idx))
    if (idx === selectedIdx) {
      onSelectIdx(null)
    } else {
      onSelectIdx(idx)
    }
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', width: '100%', overflow: 'visible', WebkitTapHighlightColor: 'transparent' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={metric.hex} stopOpacity={0.3} />
            <stop offset="1" stopColor={metric.hex} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* BEST reference line */}
        {win.length > 0 && (
          <>
            <line
              x1={PAD_L} y1={yOf(max)} x2={W - PAD_R} y2={yOf(max)}
              stroke={metric.hex} strokeOpacity={0.55} strokeDasharray="2 3"
            />
            <text
              x={PAD_L + 1} y={yOf(max) - 3}
              fontSize={8} fontFamily="Space Grotesk, sans-serif"
              letterSpacing="0.06em" fill={metric.hex} fillOpacity={0.75}
            >
              BEST
            </text>
          </>
        )}

        {/* AVG reference line (only if more than 1 run) */}
        {win.length > 1 && (
          <>
            <line
              x1={PAD_L} y1={yOf(avg)} x2={W - PAD_R} y2={yOf(avg)}
              stroke="#8A8AA0" strokeOpacity={0.42} strokeDasharray="2 3"
            />
            <text
              x={PAD_L + 1} y={yOf(avg) - 3}
              fontSize={8} fontFamily="Space Grotesk, sans-serif"
              letterSpacing="0.06em" fill="#8A8AA0" fillOpacity={0.75}
            >
              AVG
            </text>
          </>
        )}

        {/* Area fill */}
        {areaPath && (
          <path d={areaPath} fill={`url(#${gradId})`} />
        )}

        {/* Glow stroke (blurred, beneath crisp line) */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={metric.hex}
            strokeWidth={5}
            strokeOpacity={0.16}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`blur(3px)`}
          />
        )}

        {/* Crisp line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={metric.hex}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Per-run dots (non-current) */}
        {pts.map((p, i) => {
          if (i === curIdx) return null
          return (
            <circle
              key={p.record.id}
              cx={p.x}
              cy={p.y}
              r={2}
              fill={metric.hex}
              fillOpacity={0.55}
            />
          )
        })}

        {/* Pulsing halo + blip on current run */}
        {curPt && (
          <>
            <circle cx={curPt.x} cy={curPt.y} r={4} fill={metric.hex} fillOpacity={0.5}>
              <animate attributeName="r" values="4;9;4" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="fill-opacity" values=".5;0;.5" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle
              cx={curPt.x} cy={curPt.y} r={4.2}
              fill="#06060B"
              stroke={metric.hex}
              strokeWidth={2.5}
              filter={`drop-shadow(0 0 6px ${metric.hex})`}
            />
          </>
        )}

        {/* Transparent overlay for tap-to-inspect */}
        {win.length > 0 && (
          <rect
            x={PAD_L - 4} y={0}
            width={iw + 8} height={H}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={handleOverlayClick}
          />
        )}
      </svg>

      {/* Rank chip pinned to current blip */}
      {curPt && rank > 0 && (
        <RankChip pt={curPt} metric={metric} rank={rank} svgWidth={W} svgHeight={H} />
      )}

      {/* Inspect card */}
      {selectedIdx !== null && pts[selectedIdx] && (
        <InspectCard
          pt={pts[selectedIdx]}
          metric={metric}
          svgWidth={W}
          svgHeight={H}
        />
      )}
    </div>
  )
}

// ── Rank chip ─────────────────────────────────────────────────────────────────
interface RankChipProps {
  pt: Point
  metric: MetricDef
  rank: number
  svgWidth: number
  svgHeight: number
}

function RankChip({ pt, metric, rank, svgWidth, svgHeight }: RankChipProps) {
  // Convert SVG coords to percentage-based CSS positioning
  const leftPct = (pt.x / svgWidth) * 100
  const topPct = (pt.y / svgHeight) * 100

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: 'translate(-100%, -50%)',
        marginLeft: '-10px',
        pointerEvents: 'none',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        background: '#0c0c14',
        border: `1px solid ${metric.hex}`,
        borderRadius: '9px',
        padding: '5px 9px',
        boxShadow: `0 0 18px ${metric.hex}33, inset 0 0 0 1px rgba(255,255,255,0.04)`,
        whiteSpace: 'nowrap',
        color: metric.hex,
      }}
    >
      {/* Arrow tail */}
      <div
        style={{
          content: '',
          position: 'absolute',
          right: '-5px',
          top: '50%',
          transform: 'translateY(-50%) rotate(45deg)',
          width: '8px',
          height: '8px',
          background: '#0c0c14',
          borderRight: `1px solid ${metric.hex}`,
          borderTop: `1px solid ${metric.hex}`,
        }}
      />
      <div style={{
        fontSize: '13px',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
        color: metric.hex,
        textShadow: `0 0 10px ${metric.hex}`,
      }}>
        {ordinal(rank)} best
      </div>
      <div style={{
        fontSize: '7.5px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#8A8AA0',
        marginTop: '3px',
      }}>
        all-time
      </div>
    </div>
  )
}

// ── Inspect card ──────────────────────────────────────────────────────────────
interface InspectCardProps {
  pt: Point & { record: RunRecord; idx: number; trueRunNumber: number }
  metric: MetricDef
  svgWidth: number
  svgHeight: number
}

function InspectCard({ pt, metric, svgWidth, svgHeight }: InspectCardProps) {
  const leftPct = (pt.x / svgWidth) * 100
  const topPct = (pt.y / svgHeight) * 100
  const when = relativeTime(new Date(pt.record.playedAt).toISOString())

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: 'translate(-50%, -122%)',
        pointerEvents: 'none',
        opacity: 1,
        background: '#0c0c14ee',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '9px',
        padding: '8px 10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.68)',
        zIndex: 6,
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ fontSize: '8px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4A4A5C' }}>
        {when} · run {pt.trueRunNumber}
      </div>
      <div style={{
        fontSize: '15px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        marginTop: '2px', color: metric.hex,
      }}>
        {formatMetric(metric, pt.record[metric.key])}
      </div>
      <div style={{ fontSize: '9px', color: '#8A8AA0', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
        {pt.record.score} pts · ×{pt.record.combo} · {pt.record.accuracy}%
      </div>
    </div>
  )
}

// ── Ladder ────────────────────────────────────────────────────────────────────
interface LadderProps {
  records: RunRecord[]
  metric: MetricDef
  currentId: string
}

function Ladder({ records, metric, currentId }: LadderProps) {
  const rows = ladderRows(records, metric.key, currentId, 5)
  if (rows.length === 0) return null

  const maxVal = Math.max(...rows.map(r => r.record[metric.key]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '16px' }}>
      {rows.map((row) => {
        const you = row.isCurrent
        const barWidth = maxVal > 0 ? Math.round((row.record[metric.key] / maxVal) * 100) : 0
        const barFill = you
          ? 'linear-gradient(90deg, rgba(40,240,255,0.4), #28F0FF)'
          : `linear-gradient(90deg, ${metric.hex}55, ${metric.hex})`
        const barGlow = you ? '#28F0FF' : metric.hex
        const when = relativeTime(new Date(row.record.playedAt).toISOString())

        return (
          <div
            key={row.record.id}
            data-testid="ladder-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 11px',
              borderRadius: '10px',
              background: you
                ? 'linear-gradient(90deg, rgba(40,240,255,0.09), rgba(40,240,255,0.02))'
                : 'rgba(255,255,255,0.02)',
              border: you ? '1px solid rgba(40,240,255,0.33)' : '1px solid rgba(255,255,255,0.04)',
              boxShadow: you ? '0 0 20px rgba(40,240,255,0.11)' : 'none',
            }}
          >
            {/* Rank */}
            <div style={{
              fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              color: you ? '#28F0FF' : '#4A4A5C', width: '24px',
              textShadow: you ? '0 0 8px #28F0FF' : 'none',
            }}>
              {row.rank}
            </div>
            {/* When label */}
            <div style={{ fontSize: '9px', color: '#4A4A5C', width: '72px', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {when}
            </div>
            {/* Bar */}
            <div style={{ flex: 1, height: '6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <div style={{
                display: 'block', height: '100%', borderRadius: '4px',
                width: `${barWidth}%`,
                background: barFill,
                boxShadow: `0 0 8px ${barGlow}88`,
                transition: 'width 0.4s cubic-bezier(0.7,0,0.3,1)',
              }} />
            </div>
            {/* Value */}
            <div style={{
              fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              color: you ? '#EAEAF2' : '#8A8AA0', width: '46px', textAlign: 'right',
            }}>
              {formatMetric(metric, row.record[metric.key])}
            </div>
            {/* You tag */}
            <div style={{
              fontSize: '7.5px', letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#28F0FF', width: '26px', textAlign: 'right',
            }}>
              {you ? 'You' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function RunHistoryGraph({ records, currentId, recentCount = 14 }: RunHistoryGraphProps) {
  const [activeMetricKey, setActiveMetricKey] = useState<string>('score')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const metric = METRICS.find(m => m.key === activeMetricKey) ?? METRICS[0]
  const win = recentRuns(records, recentCount)

  const switchMetric = (key: string) => {
    setActiveMetricKey(key)
    setSelectedIdx(null)
  }

  return (
    <div className="font-grotesk text-vt-text">
      {/* Series tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {METRICS.map((m) => {
          const isActive = m.key === activeMetricKey
          return (
            <button
              key={m.key}
              data-testid={isActive ? 'active-tab' : undefined}
              onClick={() => switchMetric(m.key)}
              style={{
                flex: 1,
                fontSize: '9px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 600,
                fontFamily: 'Space Grotesk, sans-serif',
                color: isActive ? '#06060B' : '#4A4A5C',
                background: isActive ? m.hex : 'rgba(255,255,255,0.024)',
                border: isActive ? '1px solid transparent' : '1px solid rgba(255,255,255,0.055)',
                cursor: 'pointer',
                padding: '7px 4px',
                borderRadius: '8px',
                boxShadow: isActive ? `0 0 10px ${m.hex}77` : 'none',
                transition: 'all 0.25s cubic-bezier(0.1, 0.9, 0.2, 1)',
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      {/* Sparkline */}
      <Sparkline
        window={win}
        allRecords={records}
        metric={metric}
        currentId={currentId}
        selectedIdx={selectedIdx}
        onSelectIdx={setSelectedIdx}
      />

      {/* Ladder */}
      <Ladder records={records} metric={metric} currentId={currentId} />
    </div>
  )
}
