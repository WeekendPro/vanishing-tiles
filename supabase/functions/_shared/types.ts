// ── Pieces ──────────────────────────────────────────────────────────────────

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L' | 'SINGLE'

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
}

// ── Placement (a piece positioned on the grid) ────────────────────────────────

export interface Placement {
  pieceType: PieceType
  rotation: Rotation
  anchorRow: number
  anchorCol: number
  cells: [number, number][]
}

// ── Selection ────────────────────────────────────────────────────────────────

export interface SelectionEntry {
  pieceType: PieceType
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

// ── Resolution (drives the resolving phase animation) ─────────────────────────

export type ResolutionReason = 'too-many' | 'wrong-shapes' | 'missed-one' | 'missed-many'

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
}

// ── Game phases ───────────────────────────────────────────────────────────────

export type GamePhase =
  | 'idle'
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
}
