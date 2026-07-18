export const CELL = 28
export const CELL_PITCH = CELL + 2   // cell + 2px grid gap
export const BOARD_PAD = 12          // p-3 around the board

// Streak chip: hold the multiplier fully visible for STREAK_HOLD_MS after the last
// streak step, then let it fade away over STREAK_FADE_MS in the signature style.
export const STREAK_HOLD_MS = 2000
export const STREAK_FADE_MS = 900

// How long the recall → memorize ghost pieces stay mounted — the 420ms
// vt-tray-decay ghost tail (index.css) plus a small buffer so the last frame
// (sealed into the socket surface) lands before the unmount.
export const PIECE_FADE_MS = 460

// Time → score "Lift" payoff (the cleared-batch animation): after a short
// anticipation BEAT the timer bar rushes to empty over LIFT_MS while a single
// big "+bonus" lifts off the bar and dissolves into the score, and the score
// counts up by exactly that bonus over the SAME window — remaining time visibly
// turning into points.
export const LIFT_BEAT_MS = 260
export const LIFT_MS = 1300

// Hard-mode out-of-order hint: on a right-shape-wrong-order miss the PHASE LABEL
// (the central MEMORIZE/RECALL/CLEAR! line above the grid) swaps to "IN ORDER",
// runs the two-pulse white↔magenta blink (700ms, .vt-order-flash in index.css),
// then holds magenta for the rest of this window before reverting to RECALL.
export const ORDER_HINT_MS = 1500

// Floating white labels (the per-pick "+points" and the "+N" in the earned-life
// heart) sit over bright piece/heart color. Contrast comes from a soft DOWNWARD
// drop shadow — never a hard stroke/outline (§9: shadow for legibility, and glow
// never substitutes for contrast).
export const FLOAT_TEXT_SHADOW = '0 2px 5px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.95)'
