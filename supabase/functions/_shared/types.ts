// ── Pieces ──────────────────────────────────────────────────────────────────

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export type Rotation = 0 | 1 | 2 | 3  // 0=0°, 1=90°, 2=180°, 3=270°

/** Relative [row, col] offsets from the anchor cell (top-left of bounding box) */
export type PieceCells = [number, number][]

export interface PieceDefinition {
  type: PieceType
  color: string         // Tailwind bg class, e.g. 'bg-cyan-400'
  cells: PieceCells     // canonical (rotation=0) shape
}

// ── Grid ────────────────────────────────────────────────────────────────────

export type CellStatus = 'filled' | 'empty' | 'placed' | 'preview'

export interface Cell {
  status: CellStatus
  pieceType?: PieceType   // which piece occupies this cell (if placed)
  color?: string          // palette id when a placed cell belongs to a colored gap
}

/** Grid is ROWS × COLS. grid[row][col]. 12 rows, 12 cols. */
export type Grid = Cell[][]

export const ROWS = 12 as const
export const COLS = 12 as const

// ── Gap ─────────────────────────────────────────────────────────────────────

/** A set of cells that form one tetromino-shaped gap in the grid */
export interface Gap {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: PieceCells  // absolute [row, col] positions
  color?: string     // palette id (color-coded rounds); undefined for monochrome themes
  order?: number     // 1..N badge for Sequential rounds; undefined otherwise
}

// ── Placement (a piece positioned on the grid) ────────────────────────────────

export interface Placement {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: [number, number][]
  color?: string  // palette id for color-coded rounds; undefined otherwise
}

// ── Selection ────────────────────────────────────────────────────────────────

export interface SelectionEntry {
  pieceType: PieceType
  color?: string        // palette id when the theme is color-coded; undefined otherwise
  freeCount: number     // freely added this round — can decrement to 0
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface RoundScore {
  accuracy: number
  speedBonus: number
  efficiencyBonus: number
  attemptsBonus: number
  stars: number
  total: number
}

// ── Multi-round levels ────────────────────────────────────────────────────────

/** A playable puzzle within a Journey level (client concept). `riddle` is a placeholder. */
export type ComponentKey = 'main' | 'colors' | 'inSequence' | 'flash' | 'riddle'

/** Themes are fixed by round position within a level. */
export type RoundTheme = 'basic' | 'colorCoded' | 'sequential' | 'flashMob'

/** The theme played at each round index. Theme plans (2–4) replace entries as
 *  each mechanic ships; until then every round plays Basic. */
export const THEME_SEQUENCE: RoundTheme[] = ['basic', 'colorCoded', 'sequential', 'flashMob']

export const THEME_LABEL: Record<RoundTheme, string> = {
  basic: 'Basic',
  colorCoded: 'Color-coded',
  sequential: 'Sequential',
  flashMob: 'Flash Mob',
}

// ── Resolution (drives the resolving phase animation) ─────────────────────────

export type ResolutionReason = 'too-many' | 'wrong-shapes' | 'missed-one' | 'missed-many' | 'wrong-order'

export interface Resolution {
  kind: 'perfect' | 'partial'
  placements: Placement[]
  coverage: number   // 1 for perfect; filledCells/totalCells for partial
  reason?: ResolutionReason   // set only when kind === 'partial'
}

// ── Difficulty ───────────────────────────────────────────────────────────────

export interface DifficultyConfig {
  viewDuration: number     // ms
  selectDuration: number   // ms
  placeDuration: number    // ms
  gapCount: number         // number of tetromino gaps placed in the puzzle
  complexity: 'simple' | 'medium' | 'complex'
  adjacency?: number       // 0 = scatter gaps; higher = more clustered (Journey levels)
}

// ── Game phases ───────────────────────────────────────────────────────────────

export type GamePhase =
  | 'idle'
  | 'briefing'
  | 'countdown'
  | 'viewing'
  | 'selecting'
  | 'resolving'

// ── Full game state ───────────────────────────────────────────────────────────

export interface GameState {
  mode: 'practice' | 'journey'
  phase: GamePhase
  paused: boolean             // true while the full-screen pause menu is open mid-game
  round: number
  score: number
  triesUsed: number           // 1..maxTries; current attempt at this level
  maxTries: number            // tries allowed per level before game over
  sessionId: string           // id for the current level session
  levelId: string | null      // server level id once journey is wired (null offline)
  sessionGrid: Grid           // pristine puzzle board, replayed on each retry
  grid: Grid
  gaps: Gap[]                 // gaps placed in current puzzle
  selection: SelectionEntry[] // current selection cart
  phaseStartTime: number      // Date.now() when current phase started
  phaseDuration: number       // ms; 0 = no timer for this phase
  viewTimeRemaining: number   // ms of view time left when viewing ended; feeds the Speed bonus
  roundScore: RoundScore | null
  difficulty: DifficultyConfig
  // ── Multi-round level state (practice mode) ──
  roundIndex: number            // 0..ROUNDS_PER_LEVEL-1; which round of the level
  roundTheme: RoundTheme        // theme for the current round
  livesRemaining: number        // 3 pooled across the level; a FAIL decrements, a clear does not
  roundResults: number[]        // cleared round totals so far (drives the level total)
  levelComplete: boolean        // true once all rounds are cleared
  // ── Journey single-play (new model) ──
  activeComponent: ComponentKey | null  // which component this play targets; null in practice
  livesLost: number                     // wrong submissions in the CURRENT play (0..2 when solved)
}
