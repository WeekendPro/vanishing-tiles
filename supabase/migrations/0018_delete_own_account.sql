-- supabase/migrations/0018_delete_own_account.sql
--
-- delete_own_account — full account deletion for the signed-in caller. Deletes
-- their auth.users row, which cascades all the way down: auth.users → profiles
-- (0001, on delete cascade) → every per-user table (stagger_runs / stagger_stats
-- / level_progress / attempts / …, all on delete cascade). So one delete wipes
-- the account AND all game history.
--
-- This is the heavier sibling of erase_stagger_records (0017): that one clears
-- only the leaderboard/game rows and leaves the profile + account intact ("Erase
-- my In-Game Data"); this one removes the account entirely ("Erase my Account").
--
-- Deleting from auth.users needs elevated rights the anon/authenticated roles
-- don't have, so this is a security-definer RPC scoped to auth.uid() — a caller
-- can only ever delete THEIR OWN account. After it runs the caller's JWT points
-- at a user that no longer exists, so the client must sign out immediately.

create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = v_uid;
end; $$;

-- Same grant hygiene as record_stagger_run (0013) / erase_stagger_records (0017):
-- strip PUBLIC and the Supabase default anon grant; the client calls with its
-- own JWT.
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated, service_role;
