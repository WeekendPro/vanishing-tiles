-- supabase/migrations/0005_persistence_rpcs.sql

-- Persist a server-issued session. Called by the start_session Edge Function
-- (service role) after it picks the seed + generates the puzzle. p_user_id is
-- the authenticated caller resolved by the Edge Function from the JWT.
create or replace function public.start_session_row(
  p_user_id uuid, p_level_id uuid, p_seed text,
  p_view_duration_ms int, p_select_duration_ms int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.level_sessions (user_id, level_id, seed, view_duration_ms, select_duration_ms)
  values (p_user_id, p_level_id, p_seed, p_view_duration_ms, p_select_duration_ms)
  returning id into v_id;
  return v_id;
end; $$;
