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

-- Persist a server-SCORED attempt. Called by the submit_attempt Edge Function
-- after it regenerated the board from the session seed, solved the selection,
-- and computed the pillars. Derives try_number from the session, enforces the
-- try cap, and runs the full progress/streak/achievement recompute. No
-- bounds-check: every value here was produced by the server, not the client.
create or replace function public.record_attempt(
  p_session_id uuid, p_solved boolean, p_coverage numeric,
  p_accuracy int, p_speed_bonus int, p_efficiency_bonus int, p_attempts_bonus int,
  p_total int, p_stars int, p_view_ms_remaining int, p_select_ms_remaining int
) returns public.level_progress
language plpgsql security definer set search_path = public as $$
declare
  v_session public.level_sessions;
  v_uid uuid;
  v_today date := (now() at time zone 'utc')::date;
  v_last date;
  v_try int;
  v_progress public.level_progress;
begin
  select * into v_session from public.level_sessions where id = p_session_id for update;
  if not found then raise exception 'unknown session'; end if;
  if v_session.status <> 'active' then raise exception 'session not active'; end if;
  if v_session.tries_used >= v_session.max_tries then raise exception 'no tries left'; end if;

  v_uid := v_session.user_id;
  v_try := v_session.tries_used + 1;

  insert into public.attempts (user_id, level_id, session_id, try_number, solved,
    coverage, accuracy, speed_bonus, efficiency_bonus, attempts_bonus, total, stars,
    view_ms_remaining, select_ms_remaining)
  values (v_uid, v_session.level_id, p_session_id, v_try, p_solved, p_coverage,
    p_accuracy, p_speed_bonus, p_efficiency_bonus, p_attempts_bonus, p_total, p_stars,
    p_view_ms_remaining, p_select_ms_remaining);

  -- Advance the session: clear ends it; exhausting the try cap ends it; else stays active.
  update public.level_sessions set
    tries_used = v_try,
    status = case when p_solved then 'cleared'
                  when v_try >= max_tries then 'exhausted'
                  else 'active' end,
    ended_at = case when p_solved or v_try >= max_tries then now() else null end
  where id = p_session_id;

  -- Only a clear writes progress/streak (an exhausted session earns nothing — spec §3).
  if p_solved then
    insert into public.level_progress (user_id, level_id, best_total, best_stars,
      best_try_count, cleared, times_played, last_played_at)
    values (v_uid, v_session.level_id, p_total, p_stars, v_try, true, 1, now())
    on conflict (user_id, level_id) do update set
      best_total = greatest(public.level_progress.best_total, excluded.best_total),
      best_stars = greatest(public.level_progress.best_stars, excluded.best_stars),
      best_try_count = least(coalesce(public.level_progress.best_try_count, excluded.best_try_count), excluded.best_try_count),
      cleared = true,
      times_played = public.level_progress.times_played + 1,
      last_played_at = now()
    returning * into v_progress;

    select last_played_date into v_last from public.profiles where id = v_uid;
    update public.profiles set
      current_streak = case
        when v_last = v_today then current_streak
        when v_last = v_today - 1 then current_streak + 1
        else 1 end,
      longest_streak = greatest(longest_streak, case
        when v_last = v_today then current_streak
        when v_last = v_today - 1 then current_streak + 1
        else 1 end),
      last_played_date = v_today
    where id = v_uid;

    perform public.evaluate_achievements(v_uid);
  else
    select * into v_progress from public.level_progress
      where user_id = v_uid and level_id = v_session.level_id;
  end if;

  return v_progress;
end; $$;

-- Achievement evaluator (idempotent).
create or replace function public.evaluate_achievements(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a record; v_first_try int;
begin
  select count(*) into v_first_try from public.level_progress
    where user_id = p_uid and cleared and best_try_count = 1;
  for a in select * from public.achievements loop
    if a.criteria->>'type' = 'first_try_clears'
       and v_first_try >= (a.criteria->>'count')::int then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_uid, a.id) on conflict do nothing;
    end if;
  end loop;
end; $$;

-- These SECURITY DEFINER writers take server-computed values with NO bounds-check
-- and write rows for an arbitrary user_id, so they must never be reachable by a
-- client JWT (anon/authenticated) via PostgREST — that would let a player forge a
-- perfect score and bypass the server-authoritative scoring entirely. Supabase's
-- default privileges grant EXECUTE on new public functions to anon, authenticated,
-- AND service_role, so revoking from PUBLIC alone is not enough — strip anon and
-- authenticated explicitly. service_role keeps its grant (the Edge Functions call
-- these with the service-role key); the grant is restated to make that intent loud.
revoke execute on function public.start_session_row(uuid, uuid, text, int, int)
  from public, anon, authenticated;
grant execute on function public.start_session_row(uuid, uuid, text, int, int) to service_role;

revoke execute on function public.record_attempt(
  uuid, boolean, numeric, int, int, int, int, int, int, int, int) from public, anon, authenticated;
grant execute on function public.record_attempt(
  uuid, boolean, numeric, int, int, int, int, int, int, int, int) to service_role;

-- Only ever called internally by record_attempt (as its definer); never by a client.
revoke execute on function public.evaluate_achievements(uuid) from public, anon, authenticated;
