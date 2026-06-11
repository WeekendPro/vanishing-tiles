import type { JourneyTheme } from '../components/JourneyMap'
import { LEVEL_COMPONENTS } from './components'
import { type ProgressMap, emptyLevelProgress, levelTotal, levelStars } from '../store/progressStore'

/**
 * Re-derive the map's progression flags from CLIENT progress (localStorage),
 * because completion now lives in `progressStore`, not the server.
 *
 * A level is **cleared** once its Main puzzle is solved (`best.main > 0`) — badges
 * are optional and never gate progression. The **current** station is the lowest
 * `display_number` that isn't cleared; everything past it is **locked**
 * (per-station sequential gating, mirroring the old `get_journey` RPC). Per-station
 * stars/PR are also taken from client progress so the map matches the level hub.
 *
 * The server still supplies the catalog (names, order, difficulty); we ignore its
 * now-stale `cleared`/`current`/`locked`/`my_stars`/`my_pr`.
 */
export function applyClientProgress(themes: JourneyTheme[], progress: ProgressMap): JourneyTheme[] {
  const isCleared = (levelId: string) => (progress[levelId]?.best.main ?? 0) > 0

  const unclearedNumbers = themes
    .flatMap(t => t.levels)
    .filter(l => !isCleared(l.level_id))
    .map(l => l.display_number)
  const frontier = unclearedNumbers.length ? Math.min(...unclearedNumbers) : null

  return themes.map(theme => ({
    ...theme,
    levels: theme.levels.map(l => {
      const p = progress[l.level_id] ?? emptyLevelProgress()
      const total = levelTotal(p)
      const completedCount = LEVEL_COMPONENTS.filter(c => p.best[c] > 0).length
      return {
        ...l,
        cleared: p.best.main > 0,
        current: frontier !== null && l.display_number === frontier,
        locked: frontier !== null && l.display_number > frontier,
        my_stars: levelStars(p),  // score-based; not rendered on the map (the map uses completedCount) — kept for derivation tests / future use
        my_pr: total || null,
        completedCount,
      }
    }),
  }))
}
