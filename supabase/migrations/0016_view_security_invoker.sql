-- supabase/migrations/0016_view_security_invoker.sql
--
-- Resolves the Supabase advisor's two "Security Definer View" findings.
-- Definer views execute with the creator's rights, silently bypassing RLS for
-- ANY caller PostgREST lets in — a standing liability even when the exposed
-- columns are currently safe.

-- stagger_mode_best: dead code. Nothing reads it — the leaderboard ships
-- through get_stagger_leaderboard (0014/0015), which queries stagger_stats
-- directly. The view predates that RPC; its anon-readable grant is surface
-- area with no consumer. Drop it outright.
drop view if exists public.stagger_mode_best;

-- level_global_best: live, but only inside the legacy security-definer read
-- RPCs (get_journey / get_level — 0006/0008/0010). Those run as the function
-- owner, who bypasses RLS as table owner, so the view itself doesn't need
-- definer rights: flipped to invoker, the RPCs return identical results while
-- a hypothetical direct read stops seeing across users. No client queries it
-- via PostgREST, so the direct grants go too.
alter view public.level_global_best set (security_invoker = true);
revoke select on public.level_global_best from anon, authenticated;
