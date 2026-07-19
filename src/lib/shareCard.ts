// The game-over share artifact: a self-contained Afterglow card the player can
// post to Stories / TikTok / the feed, carrying the run's numbers, the game's
// name, and a link back — every share is a small acquisition loop.
//
// Split by testability: the copy/number helpers at the top are pure (unit
// tested); the canvas render + Web Share flow below are the thin imperative
// wrapper that only runs in a real browser (guarded, never in jsdom tests).
import type { Difficulty } from '../store/settingsStore'

/** The public play link — kept in sync with index.html's OG tags. */
export const PLAY_URL = 'vanishingtiles.weekendpro.io'
const PLAY_URL_FULL = `https://${PLAY_URL}/`

export interface ShareData {
  score: number
  shapesRecalled: number
  bestStreak: number
  correctPicks: number
  totalPicks: number
  mode: Difficulty
  displayName: string | null
  isGuest: boolean
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Whole-percent accuracy, 0 when no picks were made. */
export function accuracyPct(correctPicks: number, totalPicks: number): number {
  if (totalPicks <= 0) return 0
  return Math.round((correctPicks / totalPicks) * 100)
}

/** Who the card is credited to: the display name for signed-in players, a
 *  neutral "a challenger" for guests (whose link is the sign-up hook). */
export function shareHandle(displayName: string | null, isGuest: boolean): string {
  if (isGuest || !displayName) return 'a challenger'
  return `@${displayName}`
}

/** The human hook that gets the post read — on-voice for a memory game, not a
 *  bare number. Handles the singular tile. */
export function buildHookLine(shapesRecalled: number): string {
  const tiles = shapesRecalled === 1 ? '1 tile' : `${shapesRecalled} tiles`
  return `${tiles} recalled before my memory faded.`
}

const MODE_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

/** The copyable text brag for text-first places (X / iMessage / Discord),
 *  shared alongside the image. Spoiler-free, link included. */
export function buildBragText(data: ShareData): string {
  const acc = accuracyPct(data.correctPicks, data.totalPicks)
  return [
    `Vanishing Tiles · ${MODE_LABEL[data.mode]} 🧠`,
    `Score ${data.score.toLocaleString()} · Streak ×${data.bestStreak} · ${acc}%`,
    buildHookLine(data.shapesRecalled),
    PLAY_URL_FULL,
  ].join('\n')
}

// ── Afterglow palette (mirrors tailwind.config vt-*) ─────────────────────────
const C = {
  text: '#EAEAF2', dim: '#8A8AA0', faint: '#4A4A5C',
  magenta: '#FF2D9B', cyan: '#28F0FF', amber: '#FFC23D', red: '#FF3B47', lime: '#B6FF3C',
}
const MODE_COLOR: Record<Difficulty, string> = { easy: C.lime, medium: C.amber, hard: C.red }

const CARD_W = 1080
const CARD_H = 1920

// ── Canvas render ────────────────────────────────────────────────────────────

/** Best-effort: make sure the webfont is ready so canvas text isn't drawn in a
 *  fallback face. No-ops where the Font Loading API is absent. */
async function ensureFont(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts?.load) return
  try {
    await Promise.all([
      fonts.load('700 120px "Space Grotesk"'),
      fonts.load('600 34px "Space Grotesk"'),
      fonts.load('500 40px "Space Grotesk"'),
    ])
  } catch { /* fall back to system sans */ }
}

function font(weight: number, px: number): string {
  return `${weight} ${px}px "Space Grotesk", Inter, system-ui, sans-serif`
}

/** Render the 9:16 story card to a PNG blob. Browser-only. */
export async function renderShareCardBlob(data: ShareData): Promise<Blob> {
  await ensureFont()

  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  const modeColor = MODE_COLOR[data.mode]
  const acc = accuracyPct(data.correctPicks, data.totalPicks)
  const PAD = 90

  // Background: radial void with a faint magenta bloom up top.
  ctx.fillStyle = '#050509'
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  const bg = ctx.createRadialGradient(CARD_W / 2, 150, 60, CARD_W / 2, 150, CARD_H * 0.9)
  bg.addColorStop(0, '#16121c')
  bg.addColorStop(0.55, '#0a0a12')
  bg.addColorStop(1, '#050509')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Faint decorative tiles (the vanishing motif) — kept to the two empty bands
  // (upper, between header and hook; lower, between the stat band and footer) so
  // they never collide with type.
  const tiles: [number, number, number, string][] = [
    [CARD_W - 150, 300, 70, 'rgba(255,45,155,0.14)'],
    [CARD_W - 250, 252, 42, 'rgba(40,240,255,0.12)'],
    [120, 470, 58, 'rgba(182,255,60,0.10)'],
    [CARD_W - 220, 1560, 44, 'rgba(255,194,61,0.10)'],
    [150, 1610, 34, 'rgba(255,45,155,0.10)'],
  ]
  for (const [x, y, s, color] of tiles) {
    ctx.fillStyle = color
    roundRect(ctx, x, y, s, s, 10)
    ctx.fill()
  }

  const glow = (color: string, blur: number, draw: () => void) => {
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = blur
    draw()
    ctx.restore()
  }

  // Header: wordmark (left) + difficulty badge (right).
  ctx.textBaseline = 'alphabetic'
  ctx.font = font(700, 36)
  ctx.textAlign = 'left'
  ctx.fillStyle = C.text
  ctx.fillText('VANISHING', PAD, 150)
  const vwidth = ctx.measureText('VANISHING ').width
  glow(C.magenta, 24, () => { ctx.fillStyle = C.magenta; ctx.fillText('TILES', PAD + vwidth, 150) })

  // Difficulty badge — a hairline pill in the tier color.
  const badge = MODE_LABEL[data.mode].toUpperCase()
  ctx.font = font(700, 28)
  const bw = ctx.measureText(badge).width + 56
  const bx = CARD_W - PAD - bw
  ctx.strokeStyle = modeColor
  ctx.lineWidth = 3
  glow(modeColor, 18, () => { roundRect(ctx, bx, 116, bw, 52, 12); ctx.stroke() })
  ctx.fillStyle = modeColor
  ctx.textAlign = 'center'
  ctx.fillText(badge, bx + bw / 2, 152)

  // Hook line — the human brag, wrapped, dim with a bright "N tiles".
  ctx.textAlign = 'left'
  const hookY = 760
  ctx.font = font(500, 52)
  const tilesWord = data.shapesRecalled === 1 ? '1 tile' : `${data.shapesRecalled} tiles`
  glow(C.text, 0, () => { ctx.fillStyle = C.text; ctx.fillText(tilesWord, PAD, hookY) })
  const rest = ' recalled before'
  ctx.fillStyle = C.dim
  ctx.fillText(rest, PAD + ctx.measureText(tilesWord).width, hookY)
  ctx.fillText('my memory faded.', PAD, hookY + 66)

  // Final score — the hero. Fit-to-width so a huge late-run score can't spill
  // past the card edge: shrink the type until it clears the inner column.
  ctx.font = font(600, 34)
  ctx.fillStyle = C.dim
  ctx.fillText('FINAL SCORE', PAD, hookY + 190)
  const innerCol = CARD_W - PAD * 2
  const scoreStr = data.score.toLocaleString()
  let scorePx = 190
  ctx.font = font(700, scorePx)
  while (ctx.measureText(scoreStr).width > innerCol && scorePx > 90) {
    scorePx -= 6
    ctx.font = font(700, scorePx)
  }
  glow(C.amber, 40, () => {
    ctx.fillStyle = C.amber
    ctx.fillText(scoreStr, PAD - 4, hookY + 360)
  })

  // Stat trio — best streak / accuracy / recalled — bordered band.
  const bandY = hookY + 470
  const bandH = 200
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 2
  line(ctx, PAD, bandY, CARD_W - PAD, bandY)
  line(ctx, PAD, bandY + bandH, CARD_W - PAD, bandY + bandH)
  const cols: [string, string, string][] = [
    [`×${data.bestStreak}`, 'BEST STREAK', C.lime],
    [`${acc}%`, 'ACCURACY', C.cyan],
    [`${data.shapesRecalled}`, 'RECALLED', C.magenta],
  ]
  const innerW = CARD_W - PAD * 2
  cols.forEach(([val, label, color], i) => {
    const cx = PAD + innerW * (i + 0.5) / 3
    if (i > 0) line(ctx, PAD + innerW * i / 3, bandY + 34, PAD + innerW * i / 3, bandY + bandH - 34)
    ctx.textAlign = 'center'
    ctx.font = font(700, 74)
    glow(color, 20, () => { ctx.fillStyle = color; ctx.fillText(val, cx, bandY + 108) })
    ctx.font = font(600, 26)
    ctx.fillStyle = C.faint
    ctx.fillText(label, cx, bandY + 158)
  })

  // Footer: who + where.
  ctx.textAlign = 'left'
  ctx.font = font(600, 38)
  ctx.fillStyle = C.dim
  const handle = shareHandle(data.displayName, data.isGuest)
  ctx.fillText(handle, PAD, CARD_H - 130)
  ctx.font = font(700, 34)
  glow(C.lime, 16, () => { ctx.fillStyle = C.lime; ctx.fillText(PLAY_URL, PAD, CARD_H - 80) })

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png')
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the click a tick before revoking the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** How the share resolved — the native OS sheet, or the desktop fallback
 *  (PNG downloaded + brag text copied). */
export type ShareResult = 'native' | 'download'

/** Render the card and hand it off: the native share sheet on mobile (one
 *  gesture to every app), a PNG download + clipboard caption everywhere else. */
export async function shareRun(data: ShareData): Promise<ShareResult> {
  const blob = await renderShareCardBlob(data)
  const text = buildBragText(data)
  const file = new File([blob], 'vanishing-tiles.png', { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (d?: { files?: File[] }) => boolean }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text })
      return 'native'
    } catch (err) {
      // The user dismissing the sheet is a success, not a fallback trigger.
      if ((err as Error).name === 'AbortError') return 'native'
      // Anything else (unsupported payload, permission) → fall through.
    }
  }

  downloadBlob(blob, 'vanishing-tiles.png')
  try { await navigator.clipboard?.writeText(text) } catch { /* clipboard blocked — the PNG still saved */ }
  return 'download'
}
