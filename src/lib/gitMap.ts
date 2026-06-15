import type { ComponentKey } from './components'
import type { ProgressMap } from '../store/progressStore'
import { emptyLevelProgress } from '../store/progressStore'

export type GitTrackKey = 'classic' | 'chromatic' | 'sequential' | 'glimpse'

export interface GitTrack {
  key: GitTrackKey
  label: string
  /** Existing playable component → engine theme (see COMPONENT_THEME). */
  component: Exclude<ComponentKey, 'riddle'>
  floors: number
  accent: string
  /** x world-coordinate of this track's vertical lane. */
  lane: number
  /** Parent track this branches off, and the parent level it sprouts from. */
  parent?: GitTrackKey
  at?: number
}

export const GIT_TRACKS: Record<GitTrackKey, GitTrack> = {
  classic:    { key: 'classic',    label: 'The Classic', component: 'main',       floors: 45, accent: '#38bdf8', lane: 0 },
  sequential: { key: 'sequential', label: 'Sequential',  component: 'inSequence', floors: 44, accent: '#fbbf24', lane: 230, parent: 'classic',   at: 15 },
  chromatic:  { key: 'chromatic',  label: 'Chromatic',   component: 'colors',     floors: 38, accent: '#e879f9', lane: 460, parent: 'classic',   at: 9  },
  glimpse:    { key: 'glimpse',    label: 'Glimpse',     component: 'flash',      floors: 51, accent: '#34d399', lane: 690, parent: 'chromatic', at: 12 },
}

/** Build/render order (matters for branch sprouting + stable z-order). */
export const GIT_TRACK_ORDER: GitTrackKey[] = ['classic', 'sequential', 'chromatic', 'glimpse']

/** World-space vertical distance between adjacent nodes. */
export const SP = 190

export const nodeId = (track: GitTrackKey, level: number): string => `git:${track}:${level}`

/** Node position in world space. y grows UP (negative). Main is a straight lane;
 *  a branch's level 1 sits one SP above its parent's branch commit. */
export function nodePos(track: GitTrackKey, level: number): { x: number; y: number } {
  const t = GIT_TRACKS[track]
  if (!t.parent) return { x: t.lane, y: (1 - level) * SP }
  const origin = nodePos(t.parent, t.at!)
  return { x: t.lane, y: (origin.y - SP) - (level - 1) * SP }
}

function progressFor(progress: ProgressMap, track: GitTrackKey, level: number) {
  return progress[nodeId(track, level)] ?? emptyLevelProgress()
}

export function bestScore(progress: ProgressMap, track: GitTrackKey, level: number): number {
  return progressFor(progress, track, level).best[GIT_TRACKS[track].component]
}

export function isCleared(progress: ProgressMap, track: GitTrackKey, level: number): boolean {
  return bestScore(progress, track, level) > 0
}

/** A track is available once its parent's branch commit is cleared (recursively).
 *  `classic` (no parent) is always available. */
export function isAvailable(progress: ProgressMap, track: GitTrackKey): boolean {
  const t = GIT_TRACKS[track]
  if (!t.parent) return true
  return isCleared(progress, t.parent, t.at!) && isAvailable(progress, t.parent)
}

/** Lowest uncleared level on an available track (the playable head). null when the
 *  track is unavailable, or when every level is cleared. */
export function currentLevel(progress: ProgressMap, track: GitTrackKey): number | null {
  if (!isAvailable(progress, track)) return null
  const t = GIT_TRACKS[track]
  for (let l = 1; l <= t.floors; l++) if (!isCleared(progress, track, l)) return l
  return null
}

export interface GitNodeView {
  id: string
  track: GitTrackKey
  level: number
  x: number
  y: number
  cleared: boolean
  current: boolean
  accent: string
}

export function allNodes(progress: ProgressMap): GitNodeView[] {
  const out: GitNodeView[] = []
  for (const key of GIT_TRACK_ORDER) {
    const t = GIT_TRACKS[key]
    const cur = currentLevel(progress, key)
    for (let l = 1; l <= t.floors; l++) {
      const { x, y } = nodePos(key, l)
      out.push({
        id: nodeId(key, l), track: key, level: l, x, y,
        cleared: isCleared(progress, key, l),
        current: cur === l,
        accent: t.accent,
      })
    }
  }
  return out
}

export interface GitSegment { x1: number; y1: number; x2: number; y2: number; color: string; key: string }

/** Paths that have "sprouted": an intra-track segment l→l+1 exists once level l is
 *  cleared; a branch sprout (parent commit → child level 1) exists once the parent's
 *  branch commit is cleared. Unreached tracks therefore render as loose dots. */
export function sproutedSegments(progress: ProgressMap): GitSegment[] {
  const segs: GitSegment[] = []
  for (const key of GIT_TRACK_ORDER) {
    const t = GIT_TRACKS[key]
    if (t.parent && isCleared(progress, t.parent, t.at!) && isAvailable(progress, t.parent)) {
      const a = nodePos(t.parent, t.at!)
      const b = nodePos(key, 1)
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: t.accent, key: `branch-${key}` })
    }
    for (let l = 1; l < t.floors; l++) {
      if (isCleared(progress, key, l)) {
        const a = nodePos(key, l)
        const b = nodePos(key, l + 1)
        segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: t.accent, key: `${key}-${l}` })
      }
    }
  }
  return segs
}
