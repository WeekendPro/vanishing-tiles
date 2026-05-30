// scripts/journey-smoke.ts — manual end-to-end check of the server journey loop.
import './ws-polyfill' // must precede any Supabase client import (Node < 22 WebSocket)
import { supabase } from '../src/lib/supabase'
import { signInAsGuest } from '../src/lib/auth'
import { startSession, submitAttempt, getJourney } from '../src/lib/api'
import type { Gap } from '@shared/types'

async function main() {
  await signInAsGuest()
  const journey = await getJourney() as { levels: { level_id: string }[] }[]
  const levelId = journey[0].levels[0].level_id

  const s = await startSession(levelId)
  console.log('session', s.session_id, 'gaps', s.puzzle.gaps.length)

  // Correct selection = one piece per gap (the server will solve+score it).
  const selectionMap: Record<string, number> = {}
  for (const g of s.puzzle.gaps as Gap[]) selectionMap[g.pieceType] = (selectionMap[g.pieceType] ?? 0) + 1
  const selection = Object.entries(selectionMap).map(([pieceType, count]) => ({ pieceType: pieceType as Gap['pieceType'], count }))

  const res = await submitAttempt({
    sessionId: s.session_id, selection,
    viewMsRemaining: 3000, selectMsRemaining: 5000,
  }) as { attempt: { solved: boolean; total: number; stars: number }; session_status: string }
  console.log('result', res.attempt, res.session_status)
  if (!res.attempt.solved) throw new Error('expected a clear for a correct selection')
  await supabase.auth.signOut()
  console.log('OK')
}
main().catch(e => { console.error(e); process.exit(1) })
