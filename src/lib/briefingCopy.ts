import type { PlayableComponent } from './components'

/** One-line objective shown on the puzzle-detail (briefing) page. Title comes
 * from COMPONENT_LABEL; this is just the "what you're trying to do" line. */
export const BRIEFING_OBJECTIVE: Record<PlayableComponent, string> = {
  main: 'Memorize where the gaps are, then pick the exact pieces to fill them — before the clock runs out.',
  colors: "Like The Classic — but the gaps are colored. Match each piece to its gap's color, not just its shape.",
  inSequence: 'Fill the gaps in the right sequence. Each gap is numbered — place 1, then 2, then 3.',
  flash: 'The gaps flash once, then vanish. Memorize fast — you only get a glimpse.',
}
