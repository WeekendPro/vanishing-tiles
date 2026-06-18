import { useCallback, useEffect, useState } from 'react'
import { getLevel } from '../lib/api'
import { useNavStore } from '../store/navStore'
import { useGameStore } from '../store/gameStore'
import { useProgressStore, emptyLevelProgress, levelTotal } from '../store/progressStore'
import { mockGlobalRecord } from '../lib/journeyScoring'
import { LEVEL_COMPONENTS, COMPONENT_LABEL, isPlayable, type ComponentKey } from '../lib/components'
import { track } from '../store/asyncStatus'
import { NeonButton, ScanlineOverlay } from './ui'
import type { DifficultyConfig } from '@shared/types'
import { ScoreBar } from './level/ScoreBar'
import { DifficultyMeta } from './level/DifficultyMeta'
import { PuzzleDeck, type DeckPuzzle } from './level/PuzzleDeck'

interface LevelDetail {
  level_id: string; display_number: number; name: string; theme_name: string
  view_duration_ms: number; select_duration_ms: number
  gap_count: number; shape_complexity: string; adjacency: number
  my_pr: number | null; my_stars: number; global_high: number | null; last_played: string | null
}

// Stable reference for unplayed levels — avoids creating a new object in the
// Zustand selector (which would cause an infinite render loop in Zustand 5).
const EMPTY_PROGRESS = emptyLevelProgress()

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

  // Every puzzle is available from the start; only Riddle is a "coming soon" placeholder.
  const puzzles: DeckPuzzle[] = LEVEL_COMPONENTS.map(c => ({
    component: c,
    label: COMPONENT_LABEL[c],
    score: p.best[c],
    soon: !isPlayable(c),
  }))

  return (
    <div className="min-h-dvh bg-arcade-bg text-white arcade-scanlines px-5 py-5">
      <ScanlineOverlay />

      {/* Back button */}
      <button onClick={goJourney} className="mb-4 text-neon-cyan text-glow-cyan hover:opacity-80 text-sm font-semibold">
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
          {/* Header: district + level name */}
          <div className="text-center mb-2">
            <div className="font-pixel text-[8px] tracking-[0.25em] text-neon-magenta text-glow-magenta mb-2">
              {level.theme_name.toUpperCase()}
            </div>
            <h2 className="font-pixel font-bold text-[17px] leading-tight tracking-[0.04em] text-neon-cyan text-glow-cyan">
              {level.name}
            </h2>
          </div>

          {/* Difficulty + last-played strip */}
          <div className="mb-4">
            <DifficultyMeta gapCount={level.gap_count} lastPlayed={p.lastPlayed} />
          </div>

          {/* Level score bar (with world-record ghost + 65% unlock tick) */}
          <div className="mb-5">
            <ScoreBar total={levelTotal(p)} worldRecord={mockGlobalRecord(level.level_id)} />
          </div>

          {/* Puzzle carousel + detail */}
          <PuzzleDeck puzzles={puzzles} onPlay={play} />
        </div>
      )}
    </div>
  )
}
