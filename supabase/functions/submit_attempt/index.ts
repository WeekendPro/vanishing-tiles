// supabase/functions/submit_attempt/index.ts
import { createClient } from '@supabase/supabase-js'
import { makeRng } from '@core/prng.ts'
import { generatePuzzle } from '@engine/puzzleGenerator.ts'
import { solve, bestFit } from '@engine/solver.ts'
import { scoreClear } from '@core/scoring.ts'
import type { PieceType } from '@types'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight
  try {
    const { session_id, selection, view_ms_remaining, select_ms_remaining } = await req.json()
    if (!session_id || !Array.isArray(selection)) return json({ error: 'bad payload' }, 400)

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } })
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return json({ error: 'not authenticated' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Load the authoritative session (must be the caller's and active).
    const { data: s, error: serr } = await admin
      .from('level_sessions')
      .select('id, user_id, level_id, seed, view_duration_ms, select_duration_ms, tries_used, max_tries, status')
      .eq('id', session_id).single()
    if (serr || !s) return json({ error: 'unknown session' }, 404)
    if (s.user_id !== user.id) return json({ error: 'forbidden' }, 403)
    if (s.status !== 'active' || s.tries_used >= s.max_tries) return json({ error: 'session not playable' }, 409)

    const { data: level } = await admin.from('levels')
      .select('gap_count, shape_complexity, adjacency').eq('id', s.level_id).single()

    // Regenerate the EXACT board from the stored seed (authoritative).
    const { grid, gaps } = generatePuzzle(
      { gapCount: level!.gap_count, complexity: level!.shape_complexity, adjacency: level!.adjacency },
      makeRng(s.seed))

    // Tally the player's selection into piece counts.
    const pieceCount: Partial<Record<PieceType, number>> = {}
    for (const e of selection as { pieceType: PieceType; count: number }[]) {
      if (e.count > 0) pieceCount[e.pieceType] = (pieceCount[e.pieceType] ?? 0) + e.count
    }

    const result = solve(pieceCount, grid, gaps)
    const tryNumber = s.tries_used + 1
    const selectedPieces = Object.values(pieceCount).reduce((a, n) => a + (n ?? 0), 0)

    // Clamp client timings to the session window (Speed = bounded-trust).
    const vRem = clamp(view_ms_remaining, 0, s.view_duration_ms)
    const sRem = clamp(select_ms_remaining, 0, s.select_duration_ms)

    let solved = false, coverage = 0
    let pillars = { accuracy: 0, speed: 0, efficiency: 0, attempts: 0, total: 0, stars: 0 }
    let placements
    if (result.solvable) {
      solved = true; coverage = 1
      pillars = scoreClear({
        triesUsed: tryNumber,
        viewTimeRemaining: vRem, viewDuration: s.view_duration_ms,
        selectTimeRemaining: sRem, selectDuration: s.select_duration_ms,
        minPieces: gaps.length, selectedPieces,
      })
      placements = result.placements ?? []
    } else {
      const fit = bestFit(pieceCount, grid)
      coverage = fit.totalCells === 0 ? 0 : fit.filledCells / fit.totalCells
      placements = fit.placements
      // No clear → all pillars 0 (no negative penalty — spec §3).
    }

    const { data: progress, error: rerr } = await admin.rpc('record_attempt', {
      p_session_id: s.id, p_solved: solved, p_coverage: coverage,
      p_accuracy: pillars.accuracy, p_speed_bonus: pillars.speed,
      p_efficiency_bonus: pillars.efficiency, p_attempts_bonus: pillars.attempts,
      p_total: pillars.total, p_stars: pillars.stars,
      p_view_ms_remaining: vRem, p_select_ms_remaining: sRem,
    })
    if (rerr) return json({ error: rerr.message }, 500)

    const sessionStatus = solved ? 'cleared' : (tryNumber >= s.max_tries ? 'exhausted' : 'active')
    return json({
      attempt: { solved, coverage, pillars, total: pillars.total, stars: pillars.stars },
      placements, session_status: sessionStatus, progress,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(n) || 0))
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
