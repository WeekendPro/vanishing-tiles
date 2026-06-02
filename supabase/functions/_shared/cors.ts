// supabase/functions/_shared/cors.ts
// Shared CORS support for browser callers.
//
// Edge Functions are NOT fronted by PostgREST's automatic CORS handling: each
// function must answer the browser's preflight (OPTIONS) request and echo CORS
// headers on every response, or the browser blocks the actual request. The
// supabase-js client sends authorization/apikey/x-client-info/content-type, so
// those must be allow-listed. Origin is "*" because auth rides in the
// Authorization header (no cookies), so credentialed CORS isn't needed.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Preflight responder: return this for OPTIONS before any body parsing.
export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return null
}
