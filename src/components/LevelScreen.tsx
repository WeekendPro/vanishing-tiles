import { useCallback, useEffect, useState } from 'react'
import { getLevel } from '../lib/api'
import { relativeTime } from '../lib/relativeTime'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import {
  useProgressStore, emptyLevelProgress, levelTotal, levelStars, badgesUnlocked, isEarned,
} from '../store/progressStore'
import { difficultyPips, mockGlobalRecord } from '../lib/journeyScoring'
import { BADGE_COMPONENTS, COMPONENT_LABEL, isPlayable, type ComponentKey } from '../lib/components'
import { track } from '../store/asyncStatus'
import { NeonButton, ScanlineOverlay } from './ui'
import type { DifficultyConfig } from '@shared/types'

interface LevelDetail {
  level_id: string; display_number: number; name: string; theme_name: string
  view_duration_ms: number; select_duration_ms: number
  gap_count: number; shape_complexity: string; adjacency: number
  my_pr: number | null; my_stars: number; global_high: number | null; last_played: string | null
}

// Stable reference for unplayed levels — avoids creating a new object in the
// Zustand selector (which would cause an infinite render loop in Zustand 5).
const EMPTY_PROGRESS = emptyLevelProgress()

function Pips({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`Difficulty ${value} of 5`}>
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          data-testid="difficulty-pip"
          className={`h-2 w-2 rounded-full ${i < value ? 'bg-neon-magenta shadow-[0_0_6px_#f0f]' : 'bg-arcade-edge'}`}
        />
      ))}
    </span>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-base">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={i < value ? 'text-neon-yellow text-glow-yellow' : 'text-arcade-edge'}>★</span>
      ))}
    </span>
  )
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
    <div className="min-h-dvh bg-arcade-bg text-white arcade-scanlines px-4 py-6">
      <ScanlineOverlay />
      <button onClick={goJourney} className="mb-4 text-arcade-edge hover:text-neon-cyan text-sm">← Map</button>

      {error && (
        <div className="text-center py-10">
          <p className="text-gray-400 mb-4">Couldn't load this level.</p>
          <NeonButton variant="primary" size="sm" onClick={load}>Retry</NeonButton>
        </div>
      )}

      {level && (
        <div className="max-w-sm mx-auto">
          <div className="font-pixel text-[9px] uppercase tracking-[0.15em] text-neon-magenta text-glow-magenta mb-1">
            {level.theme_name}
          </div>
          <h2 className="font-pixel text-lg uppercase tracking-[0.08em] text-neon-cyan text-glow-cyan mb-2">
            {level.name}
          </h2>
          <div className="flex items-center gap-4 mb-5">
            <Pips value={difficultyPips(level.gap_count)} />
            <Stars value={levelStars(p)} />
          </div>

          <dl className="text-sm text-gray-300 space-y-1 mb-6">
            <div className="flex justify-between">
              <dt className="text-gray-500">Global Record</dt>
              <dd>{mockGlobalRecord(level.level_id)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Personal Record</dt>
              <dd>{levelTotal(p) || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Stars</dt>
              <dd>{levelStars(p)} / 5</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Last played</dt>
              <dd>{relativeTime(lastPlayedStr)}</dd>
            </div>
          </dl>

          <NeonButton fullWidth variant="go" onClick={() => play('main')} className="mb-2">
            {p.best.main > 0 ? `▶ Play  ·  Best ${p.best.main}` : '▶ Play'}
          </NeonButton>

          <div className="grid grid-cols-2 gap-2 mt-4">
            {BADGE_COMPONENTS.map(c => {
              const playable = isPlayable(c)
              const disabled = !unlocked || !playable
              const earned = isEarned(p, c)
              return (
                <button
                  key={c}
                  disabled={disabled}
                  onClick={() => play(c)}
                  aria-label={COMPONENT_LABEL[c]}
                  className={`relative rounded-md border-2 p-3 text-left transition
                    ${disabled
                      ? 'border-arcade-edge text-gray-500 opacity-60'
                      : 'border-neon-cyan text-white hover:shadow-[0_0_8px_#0ff]'}`}
                >
                  <div className="font-pixel text-[10px] uppercase tracking-[0.08em]">
                    {COMPONENT_LABEL[c]}
                  </div>
                  <div className="text-[11px] mt-1 text-gray-400">
                    {!playable
                      ? 'Coming soon'
                      : !unlocked
                        ? '🔒 Solve main'
                        : earned
                          ? `Best ${p.best[c]}`
                          : 'Not earned'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
