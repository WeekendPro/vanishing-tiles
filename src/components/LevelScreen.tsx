import { useCallback, useEffect, useState } from 'react'
import { getLevel } from '../lib/api'
import { relativeTime } from '../lib/relativeTime'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import {
  useProgressStore, emptyLevelProgress, levelTotal, levelStars, badgesUnlocked, isEarned,
} from '../store/progressStore'
import { difficultyPips, mockGlobalRecord } from '../lib/journeyScoring'
import { COMPONENT_LABEL, isPlayable, type ComponentKey } from '../lib/components'
import { track } from '../store/asyncStatus'
import { NeonButton, ScanlineOverlay } from './ui'
import type { DifficultyConfig } from '@shared/types'
import { RibbonBadge } from './level/RibbonBadge'
import {
  PlayGlyph, ColorWheelGlyph, SequenceBlocksGlyph, EyesGlyph, RiddleGlyph, BADGE_CENTER_BG,
} from './level/badgeGlyphs'

interface LevelDetail {
  level_id: string; display_number: number; name: string; theme_name: string
  view_duration_ms: number; select_duration_ms: number
  gap_count: number; shape_complexity: string; adjacency: number
  my_pr: number | null; my_stars: number; global_high: number | null; last_played: string | null
}

// Stable reference for unplayed levels — avoids creating a new object in the
// Zustand selector (which would cause an infinite render loop in Zustand 5).
const EMPTY_PROGRESS = emptyLevelProgress()

function DifficultyBars({ value }: { value: number }) {
  return (
    <div className="flex items-end gap-1.5 h-5">
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          data-testid="difficulty-pip"
          className={`w-2 h-5 rounded-sm ${i < value ? 'bg-neon-magenta' : 'bg-zinc-700'}`}
          style={i < value ? { boxShadow: '0 0 6px #ff2d95' } : undefined}
        />
      ))}
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <div className="text-4xl leading-none">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={i < value ? 'text-neon-yellow text-glow-yellow' : 'text-zinc-700'}>
          ★
        </span>
      ))}
    </div>
  )
}

type BadgeRow = {
  key: ComponentKey
  glyphKind: 'wheel' | 'seq' | 'eyes' | 'riddle'
  ribbonTitle: string
}

const BADGE_ROWS: [BadgeRow, BadgeRow][] = [
  [
    { key: 'colors',     glyphKind: 'wheel',  ribbonTitle: 'COLORS'   },
    { key: 'inSequence', glyphKind: 'seq',    ribbonTitle: 'SEQUENCE' },
  ],
  [
    { key: 'flash',      glyphKind: 'eyes',   ribbonTitle: "DON'T BLINK" },
    { key: 'riddle',     glyphKind: 'riddle', ribbonTitle: 'RIDDLE'   },
  ],
]

function glyphForKind(kind: BadgeRow['glyphKind']) {
  switch (kind) {
    case 'wheel':  return <ColorWheelGlyph />
    case 'seq':    return <SequenceBlocksGlyph />
    case 'eyes':   return <EyesGlyph />
    case 'riddle': return <RiddleGlyph />
  }
}

export function LevelScreen() {
  const selectedLevelId = useNavStore(s => s.selectedLevelId)
  const goJourney = useNavStore(s => s.goJourney)
  const enterPlaying = useNavStore(s => s.enterPlaying)
  const startComponent = useGameStore(s => s.startComponent)

  // Subscribe to the raw entry (stable ref); fall back to a stable empty constant.
  // Do NOT compute a derived object in the selector — Zustand 5 would re-render infinitely.
  const entry = useProgressStore(s => (selectedLevelId ? s.byLevel[selectedLevelId] : undefined))
  const p = entry ?? EMPTY_PROGRESS

  const [level, setLevel] = useState<LevelDetail | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!selectedLevelId) return
    setError(false); setLevel(null)
    try {
      setLevel((await track(getLevel(selectedLevelId))) as LevelDetail)
    } catch {
      setError(true)
    }
  }, [selectedLevelId])

  useEffect(() => { load() }, [load])

  const toDifficulty = (lvl: LevelDetail): DifficultyConfig => ({
    viewDuration: lvl.view_duration_ms,
    selectDuration: lvl.select_duration_ms,
    placeDuration: 0,
    gapCount: lvl.gap_count,
    complexity: (lvl.shape_complexity as DifficultyConfig['complexity']) ?? 'medium',
    adjacency: Number(lvl.adjacency) || 0,
  })

  const play = (component: ComponentKey) => {
    if (!level || !isPlayable(component)) return
    startComponent(level.level_id, component, toDifficulty(level), level.display_number, level.name)
    enterPlaying()
  }

  const unlocked = badgesUnlocked(p)

  // relativeTime expects an ISO string | null. p.lastPlayed is number | null (epoch ms).
  const lastPlayedStr = p.lastPlayed ? new Date(p.lastPlayed).toISOString() : null

  return (
    <div className="min-h-dvh bg-arcade-bg text-white arcade-scanlines px-5 py-5">
      <ScanlineOverlay />

      {/* Back button */}
      <button onClick={goJourney} className="mb-4 text-arcade-edge hover:text-neon-cyan text-sm">
        ← Map
      </button>

      {error && (
        <div className="text-center py-10">
          <p className="text-gray-400 mb-4">Couldn't load this level.</p>
          <NeonButton variant="primary" size="sm" onClick={load}>Retry</NeonButton>
        </div>
      )}

      {level && (
        <div className="max-w-sm mx-auto">
          {/* Hero: district / name / stars */}
          <div className="text-center mb-4">
            <div className="font-pixel text-[9px] tracking-[0.25em] text-neon-magenta text-glow-magenta mb-3">
              {level.theme_name}
            </div>
            <h2 className="font-pixel text-[19px] leading-tight tracking-[0.04em] text-neon-cyan text-glow-cyan mb-3">
              {level.name}
            </h2>
            <Stars value={levelStars(p)} />
          </div>

          {/* Stat cards 2×2 */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {/* World Record */}
            <div className="rounded-lg border border-arcade-edge bg-arcade-panel shadow-panel-inset p-3">
              <div className="text-[8px] font-pixel tracking-wider text-zinc-500 mb-2">🏆 WORLD RECORD</div>
              <div className="font-pixel text-base text-white">{mockGlobalRecord(level.level_id)}</div>
            </div>

            {/* Your Record */}
            <div className="rounded-lg border border-neon-cyan/40 bg-arcade-panel shadow-panel-inset p-3">
              <div className="text-[8px] font-pixel tracking-wider text-zinc-500 mb-2">⭐ YOUR RECORD</div>
              <div className="font-pixel text-base text-neon-cyan text-glow-cyan">
                {levelTotal(p) || '—'}
              </div>
            </div>

            {/* Last Attempt */}
            <div className="rounded-lg border border-arcade-edge bg-arcade-panel shadow-panel-inset p-3">
              <div className="text-[8px] font-pixel tracking-wider text-zinc-500 mb-2">⏱ LAST ATTEMPT</div>
              <div className="text-sm font-bold text-zinc-200 first-letter:uppercase">{relativeTime(lastPlayedStr)}</div>
            </div>

            {/* Difficulty */}
            <div className="rounded-lg border border-arcade-edge bg-arcade-panel shadow-panel-inset p-3">
              <div className="text-[8px] font-pixel tracking-wider text-zinc-500 mb-2">DIFFICULTY</div>
              <DifficultyBars value={difficultyPips(level.gap_count)} />
            </div>
          </div>

          {/* PLAY badge — centered; ~half width but grows to fit the level name (never wraps) */}
          <div className="w-fit min-w-[50%] max-w-full mx-auto">
            <RibbonBadge
              data-testid="badge-main"
              glyph={<PlayGlyph />}
              centerBg={BADGE_CENTER_BG.play}
              title="PLAY"
              state={p.best.main > 0 ? 'complete' : 'incomplete'}
              score={p.best.main > 0 ? p.best.main : undefined}
              ribbonColor="#16a34a"
              foldColor="#0e7a36"
              cardAccent="green"
              vibrant
              caption={level.name}
              onClick={() => play('main')}
            />
          </div>

          {/* Additional challenges divider */}
          <div className="text-center text-[8px] font-pixel tracking-[0.28em] text-zinc-500 my-4">
            ADDITIONAL CHALLENGES
          </div>

          {/* Badge rows */}
          {BADGE_ROWS.map((row, ri) => (
            <div key={ri} className={`grid grid-cols-2 gap-3 ${ri < BADGE_ROWS.length - 1 ? 'mb-3' : ''}`}>
              {row.map(({ key: c, glyphKind, ribbonTitle }) => {
                const playable = isPlayable(c)
                const badgeDisabled = !unlocked || !playable
                const badgeState = !playable
                  ? 'soon'
                  : !unlocked
                    ? 'locked'
                    : isEarned(p, c)
                      ? 'complete'
                      : 'incomplete'
                const score = p.best[c]
                return (
                  <RibbonBadge
                    key={c}
                    data-testid={`badge-${c}`}
                    glyph={glyphForKind(glyphKind)}
                    centerBg={BADGE_CENTER_BG[glyphKind]}
                    title={ribbonTitle}
                    state={badgeState}
                    score={score > 0 ? score : undefined}
                    disabled={badgeDisabled}
                    onClick={() => play(c)}
                    aria-label={COMPONENT_LABEL[c]}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
