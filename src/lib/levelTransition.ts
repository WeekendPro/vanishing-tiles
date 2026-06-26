import { isWon, levelIndexForScore } from './staggerLevels'

/** The outcome of evaluating a level transition at a BATCH BOUNDARY.
 *
 *  - `continue` — stay on `currentLevelIndex` (sandbox always lands here, as
 *    does any non-sandbox run that hasn't crossed a new threshold).
 *  - `levelComplete` — the run crossed into a new (non-final) level;
 *    `nextLevelIndex` is the level the score now falls in (may skip several
 *    levels on a big jump).
 *  - `won` — the run crossed the final (crawlers) threshold.
 */
export type LevelTransitionResult =
  | { kind: 'continue'; nextLevelIndex: number }
  | { kind: 'levelComplete'; nextLevelIndex: number }
  | { kind: 'won'; nextLevelIndex: number }

/** Pure decision function for whether a level transition fires. Called ONLY
 *  at batch boundaries (never mid-batch) so the player is never yanked into a
 *  celebration overlay while gaps are still on screen.
 *
 *  Sandbox runs are locked to `currentLevelIndex` and never advance, win, or
 *  complete a level — the calibration sandbox plays one level forever. */
export function levelTransition(
  score: number,
  currentLevelIndex: number,
  isSandbox: boolean,
): LevelTransitionResult {
  if (isSandbox) return { kind: 'continue', nextLevelIndex: currentLevelIndex }
  if (isWon(score)) return { kind: 'won', nextLevelIndex: currentLevelIndex }
  const targetIndex = levelIndexForScore(score)
  if (targetIndex > currentLevelIndex) return { kind: 'levelComplete', nextLevelIndex: targetIndex }
  return { kind: 'continue', nextLevelIndex: currentLevelIndex }
}
