// supabase/functions/start_session/index.ts
import { createClient } from '@supabase/supabase-js'
import { makeRng, randomSeed } from '@core/prng.ts'
import { generatePuzzle } from '@engine/puzzleGenerator.ts'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight
  try {
    const { level_id } = await req.json()
    if (!level_id) return json({ error: 'level_id required' }, 400)

    // Caller identity from the JWT (anon-key client + the request's auth header).
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return json({ error: 'not authenticated' }, 401)

    // Service-role client for privileged reads/writes.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: level, error: lerr } = await admin
      .from('levels')
      .select('id, gap_count, shape_complexity, adjacency, view_duration_ms, select_duration_ms')
      .eq('id', level_id).single()
    if (lerr || !level) return json({ error: 'unknown level' }, 404)

    const seed = randomSeed()
    const { grid, gaps } = generatePuzzle(
      { gapCount: level.gap_count, complexity: level.shape_complexity, adjacency: level.adjacency },
      makeRng(seed),
    )

    const { data: sessionId, error: serr } = await admin.rpc('start_session_row', {
      p_user_id: user.id, p_level_id: level.id, p_seed: seed,
      p_view_duration_ms: level.view_duration_ms, p_select_duration_ms: level.select_duration_ms,
    })
    if (serr) return json({ error: serr.message }, 500)

    // Seed is intentionally NOT returned — the client only needs the rendered puzzle.
    return json({
      session_id: sessionId, puzzle: { grid, gaps },
      view_duration_ms: level.view_duration_ms, select_duration_ms: level.select_duration_ms,
      max_tries: 3,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
