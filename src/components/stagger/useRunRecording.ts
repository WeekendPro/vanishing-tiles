import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { type Difficulty } from '../../store/settingsStore'
import { useRunHistoryStore, type RunRecord } from '../../store/runHistoryStore'
import { type StaggerPhase } from '../../store/staggerStore'
import { submitStaggerRun } from '../../lib/api'
import { analytics } from '../../lib/analytics'
import { sfx } from '../../lib/sfx'

interface RunRecordingArgs {
  phase: StaggerPhase
  mode: Difficulty
  batchIndex: number
  score: number
  shapesRecalled: number
  bestStreak: number
  totalPicks: number
  correctPicks: number
}

/** Owns the once-per-run bookkeeping: the game-over recording (sfx farewell +
 *  localStorage record + analytics + fire-and-forget server submit, guarded so
 *  StrictMode never double-fires) and the run-started analytics ping. Returns the
 *  run-history `records` (for the game-over graph) and the just-recorded run id. */
export function useRunRecording({
  phase, mode, batchIndex, score, shapesRecalled, bestStreak, totalPicks, correctPicks,
}: RunRecordingArgs): { records: RunRecord[]; currentRunId: string | null } {
  const { records, recordRun } = useRunHistoryStore(useShallow(s => ({ records: s.records, recordRun: s.recordRun })))

  // Once-per-game-over run recording (guard ref prevents double-fire under StrictMode).
  const recordedRef = useRef(false)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)

  useEffect(() => {
    if (phase === 'gameOver' && !recordedRef.current) {
      recordedRef.current = true
      // The run's farewell (rides the same once-per-game-over guard as the
      // recording, so StrictMode never plays it twice).
      sfx.gameOver()
      const accuracy = totalPicks ? Math.round((correctPicks / totalPicks) * 100) : 0
      const run = recordRun({ mode, score, recalled: shapesRecalled, combo: bestStreak, accuracy })
      setCurrentRunId(run.id)
      // Analytics: the run's engagement payload — mode, how far (level =
      // batchIndex reached, 1-based), and how well. `level` here is the LAST
      // batch played (the run ends mid-batch on the fatal miss).
      analytics.runEnded({ mode, level: batchIndex + 1, score, bestStreak, accuracy })
      // Server-side per-(user, mode) stats — fire-and-forget so a network
      // failure never blocks the game-over screen (localStorage above is the
      // source of truth for the graph).
      submitStaggerRun({ mode, score, bestStreak, accuracy, gapsRecalled: shapesRecalled })
        .catch((err) => console.warn('Failed to record stagger run server-side', err))
    } else if (phase !== 'gameOver') {
      recordedRef.current = false
      setCurrentRunId(null)
    }
  }, [phase, mode, batchIndex, score, shapesRecalled, bestStreak, totalPicks, correctPicks, recordRun])

  // Analytics: fire `run_started` once when a REAL run begins. Every real run
  // (PLAY, Play again, and the demo→real handoff) enters through `countdown`;
  // the guided demo enters through `demoIntro`, so this never counts demos.
  // Keyed on the transition INTO countdown (prev phase differs) so it fires once
  // per run, not on every render, and survives StrictMode's double-invoke. The
  // null seed (not `phase`) is deliberate: PLAY with the demo disabled mounts
  // this screen already in `countdown`, and null != countdown lets that first
  // real run register.
  const prevPhaseRef = useRef<StaggerPhase | null>(null)
  useEffect(() => {
    if (phase === 'countdown' && prevPhaseRef.current !== 'countdown') {
      analytics.runStarted(mode)
    }
    prevPhaseRef.current = phase
  }, [phase, mode])

  return { records, currentRunId }
}
