// scripts/journey-smoke.ts — manual end-to-end check of the Journey aggregate loop.
// Journey now plays its 4 themed rounds entirely client-side; the only server
// round-trips are reading the level config (get_level via getJourney) and
// recording one aggregate result (record_level_result via submitLevelResult).
import './ws-polyfill' // must precede any Supabase client import (Node < 22 WebSocket)
import { supabase } from '../src/lib/supabase'
import { signInAsGuest } from '../src/lib/auth'
import { getJourney, submitLevelResult } from '../src/lib/api'

async function main() {
  await signInAsGuest()
  const journey = await getJourney() as { levels: { level_id: string }[] }[]
  const levelId = journey[0].levels[0].level_id
  console.log('level', levelId)

  // Simulate a strong 4-round clear and record the aggregate.
  const progress = await submitLevelResult({ levelId, total: 6600, stars: 2, cleared: true })
  console.log('progress', progress)

  await supabase.auth.signOut()
  console.log('OK')
}
main().catch(e => { console.error(e); process.exit(1) })
