import { useEffect, useState } from 'react'
import { useNavStore } from '../store/navStore'
import { useSettingsStore, type Difficulty } from '../store/settingsStore'
import { getStaggerLeaderboard, type StaggerLeaderboard, type LeaderboardMe } from '../lib/api'
import { signOut } from '../lib/auth'
import { shareRank } from '../lib/shareCard'
import { analytics } from '../lib/analytics'
import { ScanlineOverlay } from './ui'

/**
 * Global Infinite Stagger rankings, split by difficulty (scores across modes
 * aren't comparable, so each mode is its own board). Layout is the stitched
 * B×C design (mockups/leaderboard-stitched.html): the you-hero card first —
 * name, overall rank, and all three bests each with its OWN global rank — then
 * one continuous top-players table where your row wears a small YOU tag (badge
 * + cyan name only; deliberately no outline ring). Guests get the board but no
 * hero (they're unranked — see get_stagger_leaderboard, migration 0014) and a
 * dashed sign-up nudge pinned at the bottom instead.
 */

/** The three boards, styled as the Home screen's mode switch (sans Training —
 *  Training has no score, so it has no board). */
const TABS: { value: Difficulty; label: string; active: string }[] = [
  {
    value: 'easy',
    label: 'Easy',
    active: 'bg-neon-green text-arcade-bg shadow-[inset_0_0_14px_rgba(57,217,138,0.5),0_0_12px_rgba(57,217,138,0.35)]',
  },
  {
    value: 'medium',
    label: 'Medium',
    active: 'bg-neon-yellow text-arcade-bg shadow-[inset_0_0_14px_rgba(250,204,21,0.5),0_0_12px_rgba(250,204,21,0.35)]',
  },
  {
    value: 'hard',
    label: 'Hard',
    active: 'bg-neon-red text-arcade-bg shadow-[inset_0_0_14px_rgba(255,77,77,0.5),0_0_12px_rgba(255,77,77,0.35)]',
  },
]

/** Rank / Player / Score / Stk / Acc — shared by the header row and every list row. */
const ROW_GRID = 'grid grid-cols-[24px_1fr_60px_38px_46px] gap-1.5 items-baseline'

const fmt = (n: number) => n.toLocaleString('en-US')

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function HeroCard({ me, total, mode }: { me: LeaderboardMe; total: number; mode: Difficulty }) {
  // "top N%" rounds up so #1 of anything reads "top 1%", never "top 0%".
  const pct = me.rank ? Math.max(1, Math.ceil((me.rank / Math.max(total, 1)) * 100)) : null

  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const onShare = async () => {
    if (sharing || me.rank === null) return
    setSharing(true)
    try {
      const method = await shareRank({
        rank: me.rank, total, mode,
        displayName: me.displayName,
        highScore: me.highScore ?? 0,
        bestStreak: me.bestStreak ?? 0,
        bestAccuracy: me.bestAccuracy ?? 0,
      })
      analytics.rankShared({ mode, method })
      if (method === 'download') {
        setShareNote('Image saved · caption copied')
        window.setTimeout(() => setShareNote(null), 2800)
      }
    } catch { /* nothing shared, nothing lost */ }
    finally { setSharing(false) }
  }

  return (
    <div className="mt-4 rounded-2xl bg-vt-panel p-4 shadow-[inset_0_0_0_1px_rgba(40,240,255,0.5),0_0_18px_rgba(40,240,255,0.16)]">
      {/* Avatar tile (left) and Share tile (right) are the same shape — they
          bookend the name block for deliberate symmetry: you, then share-you. */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl grid place-items-center flex-none font-pixel font-bold text-[15px] text-vt-cyan
          bg-gradient-to-br from-[#20303a] to-[#141420] border border-vt-cyan/35 shadow-[0_0_14px_rgba(40,240,255,0.2)]">
          {initials(me.displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-pixel font-bold text-[15px] leading-tight truncate">{me.displayName}</div>
          <div className="font-display text-[9.5px] font-semibold uppercase tracking-[0.2em] text-vt-dim mt-1">
            Rank <b className="text-vt-cyan text-glow-vt-cyan font-bold">#{me.rank}</b> of {fmt(total)}
            {pct !== null && ` · top ${pct}%`}
          </div>
        </div>
        <button
          onClick={onShare}
          disabled={sharing}
          aria-label="Share your rank"
          className="w-12 h-12 rounded-xl flex-none flex flex-col items-center justify-center gap-[3px]
            text-neon-magenta border border-neon-magenta/50 bg-neon-magenta/[0.06] shadow-[0_0_14px_rgba(255,45,155,0.18)]
            hover:bg-neon-magenta/10 hover:shadow-neon-magenta transition active:translate-y-px
            disabled:opacity-50 disabled:pointer-events-none"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
            <path d="M12 14V4" /><path d="M8 8l4-4 4 4" /><path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6" />
          </svg>
          <span className="text-[6.5px] font-bold uppercase tracking-[0.08em] leading-none">Share</span>
        </button>
      </div>
      <div className="flex gap-2 mt-3.5">
        <HeroTile label="Best score" value={fmt(me.highScore ?? 0)} rank={me.rank} tone="text-vt-amber text-glow-vt-amber" />
        <HeroTile label="Best streak" value={`×${me.bestStreak ?? 0}`} rank={me.streakRank} tone="text-vt-lime text-glow-vt-lime" />
        <HeroTile label="Accuracy" value={`${me.bestAccuracy ?? 0}%`} rank={me.accuracyRank} tone="text-vt-cyan text-glow-vt-cyan" />
      </div>
      {shareNote && (
        <div className="mt-2.5 text-center font-display text-[9px] font-semibold uppercase tracking-[0.12em] text-vt-lime text-glow-vt-lime">
          {shareNote}
        </div>
      )}
    </div>
  )
}

function HeroTile({ label, value, rank, tone }: { label: string; value: string; rank: number | null; tone: string }) {
  return (
    <div className="flex-1 rounded-lg bg-vt-void px-1 py-2 text-center shadow-[inset_0_0_0_1px_#1C1C28]">
      <div className="font-display text-[7.5px] font-semibold uppercase tracking-[0.16em] text-vt-faint">{label}</div>
      <div className={`font-pixel font-bold text-[17px] tabular-nums mt-1 ${tone}`}>{value}</div>
      {rank !== null && (
        <div className="font-display text-[9px] font-semibold text-vt-dim tabular-nums mt-1">#{rank}</div>
      )}
    </div>
  )
}

export function LeaderboardScreen() {
  const goHome = useNavStore(s => s.goHome)
  const resetNav = useNavStore(s => s.reset)
  const difficulty = useSettingsStore(s => s.settings.difficulty)

  // The board you land on is the mode you play — the persisted difficulty.
  const [mode, setMode] = useState<Difficulty>(difficulty)
  const [board, setBoard] = useState<StaggerLeaderboard | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    getStaggerLeaderboard(mode)
      .then(b => { if (!cancelled) { setBoard(b); setStatus('ready') } })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [mode, attempt])

  // A guest's exit ramp to ranking: same teardown as the menu's "Sign up" —
  // end the anonymous session and land on AuthScreen (uid-linked stats carry
  // over if they create the account from there).
  const signUp = async () => { await signOut(); resetNav() }

  const me = board?.me ?? null
  const isYou = (rank: number, name: string) =>
    me !== null && !me.isGuest && me.rank === rank && me.displayName === name

  return (
    <div className="relative min-h-dvh overflow-hidden bg-arcade-glow text-white arcade-scanlines">
      <ScanlineOverlay />
      <div className="relative mx-auto w-full max-w-sm min-h-dvh flex flex-col px-6 pt-6 pb-8">
        <button
          onClick={goHome}
          className="self-start flex items-center gap-1.5 text-neon-cyan font-display font-semibold text-sm mb-4
            transition-transform active:translate-y-px"
        >
          <span className="text-lg leading-none">‹</span> Back
        </button>

        <h1 className="text-center font-pixel font-bold text-base leading-none uppercase tracking-[0.15em] text-white text-glow-vt-cyan">
          Leaderboard
        </h1>
        <p className="mt-2 text-center font-display text-[9px] font-medium uppercase tracking-[0.24em] text-vt-magenta text-glow-vt-magenta">
          Global rankings
        </p>

        {/* Mode tabs stay pinned while the list scrolls beneath them. */}
        <div className="sticky top-0 z-10 -mx-6 px-6 pt-4 pb-2 bg-arcade-bg/90 backdrop-blur-sm">
          <div className="flex rounded-md border-2 border-arcade-edge bg-arcade-panel overflow-hidden">
            {TABS.map(t => {
              const active = t.value === mode
              return (
                <button
                  key={t.value}
                  onClick={() => setMode(t.value)}
                  aria-pressed={active}
                  className={`flex-1 py-3 px-0.5 font-pixel uppercase text-xs tracking-[0.04em] whitespace-nowrap transition
                    border-r border-arcade-edge last:border-r-0
                    ${active ? t.active : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {status === 'loading' && (
          <p className="mt-12 text-center font-display text-[11px] uppercase tracking-[0.22em] text-vt-dim animate-pulse">
            Syncing rankings…
          </p>
        )}

        {status === 'error' && (
          <div className="mt-12 flex flex-col items-center gap-4">
            <p className="text-center font-display text-[12px] text-vt-dim">Couldn’t load the rankings.</p>
            <button
              onClick={() => setAttempt(a => a + 1)}
              className="font-pixel uppercase tracking-[0.08em] rounded-md border-2 bg-arcade-panel px-6 py-2.5 text-sm
                border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 hover:shadow-neon-cyan transition active:translate-y-px"
            >
              Retry
            </button>
          </div>
        )}

        {status === 'ready' && board && (
          <>
            {me && !me.isGuest && (me.rank !== null
              ? <HeroCard me={me} total={board.total} mode={mode} />
              : (
                <div className="mt-4 rounded-2xl bg-vt-panel p-4 text-center shadow-[inset_0_0_0_1px_rgba(255,45,155,0.35)]">
                  <p className="font-display text-[12px] text-vt-dim">
                    Finish a run on this mode to enter the rankings.
                  </p>
                </div>
              ))}

            <p className="px-2 pt-4 font-display text-[8.5px] font-semibold uppercase tracking-[0.24em] text-vt-faint">
              Top players
            </p>
            <div className={`${ROW_GRID} px-2 pt-1.5 pb-1 font-display text-[8px] font-semibold uppercase tracking-[0.18em] text-vt-faint`}>
              <span>#</span><span>Player</span>
              <span className="text-right">Score</span><span className="text-right">Stk</span><span className="text-right">Acc</span>
            </div>

            {board.top.length === 0 && (
              <p className="mt-6 text-center font-display text-[12px] text-vt-dim">
                No ranked runs yet — be the first.
              </p>
            )}
            <div>
              {board.top.map(r => {
                const you = isYou(r.rank, r.displayName)
                return (
                  <div key={r.rank} className={`${ROW_GRID} px-2 py-2 rounded-lg text-[12.5px] even:bg-white/[0.025]`}>
                    <span className={`font-display font-bold text-[11px] tabular-nums ${you ? 'text-vt-cyan' : 'text-vt-faint'}`}>
                      {r.rank}
                    </span>
                    <span className={`truncate font-display ${you ? 'font-bold text-vt-cyan' : 'font-medium text-vt-text'}`}>
                      {r.displayName}
                      {you && (
                        <span className="ml-1.5 inline-block rounded-[3px] bg-vt-cyan px-1 pb-px text-[8px] font-bold tracking-[0.1em] text-arcade-bg align-[2px]">
                          YOU
                        </span>
                      )}
                    </span>
                    <span className="text-right font-pixel font-bold tabular-nums text-vt-amber text-glow-vt-amber">{fmt(r.highScore)}</span>
                    <span className="text-right font-pixel font-semibold tabular-nums text-vt-lime text-glow-vt-lime">×{r.bestStreak}</span>
                    <span className="text-right font-pixel font-semibold tabular-nums text-vt-cyan text-glow-vt-cyan">{r.bestAccuracy}%</span>
                  </div>
                )
              })}
            </div>

            {me?.isGuest && (
              <div className="mt-auto pt-5">
                <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-vt-magenta/40 bg-vt-magenta/5 px-3 py-2.5">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px] flex-none text-vt-magenta" aria-hidden="true">
                    <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.04 0-7.25 2.4-7.25 5.35V21h14.5v-1.4c0-2.95-3.21-5.35-7.25-5.35Z" />
                  </svg>
                  <span className="font-display text-[11px] leading-snug text-vt-dim">
                    Guests play unranked —{' '}
                    <button
                      onClick={signUp}
                      className="font-semibold text-vt-magenta underline-offset-2 hover:underline"
                    >
                      sign up
                    </button>{' '}
                    to claim your spot.
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
