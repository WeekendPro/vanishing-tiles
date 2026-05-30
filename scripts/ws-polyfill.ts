// Node < 22 has no global WebSocket; supabase-js builds a realtime client eagerly.
// Import this BEFORE any module that creates a Supabase client. (Node-only; not app code.)
import ws from 'ws'
// @ts-expect-error -- assigning a node WebSocket onto the global for supabase-js
globalThis.WebSocket ??= ws
