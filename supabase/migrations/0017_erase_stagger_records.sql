-- supabase/migrations/0017_erase_stagger_records.sql
--
-- erase_stagger_records — lets a signed-in caller wipe their OWN Infinite
-- Stagger history: every stagger_runs row and every per-mode stagger_stats
-- aggregate keyed to auth.uid(). This is what drops the caller off (or resets
-- their bests on) every leaderboard board.
--
-- The 0013 tables are owner-READ-only (RLS exposes SELECT, with no delete
-- policy), so this can't be a client-side delete — it's a security-definer RPC
-- scoped to auth.uid(), the same client-trusted-but-self-only model as
-- record_stagger_run. A caller can only ever erase their own rows.
--
-- The app only surfaces this from an admin/localhost menu action, but the RPC
-- is safe for any authenticated user to call on themselves.

create or replace function public.erase_stagger_records()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  delete from public.stagger_runs where user_id = v_uid;
  delete from public.stagger_stats where user_id = v_uid;
end; $$;

-- Same grant hygiene as record_stagger_run (0013): strip PUBLIC and the
-- Supabase default anon grant; the client calls with its own JWT.
revoke execute on function public.erase_stagger_records() from public, anon;
grant execute on function public.erase_stagger_records() to authenticated, service_role;
