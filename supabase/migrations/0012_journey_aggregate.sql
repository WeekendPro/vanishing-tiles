-- supabase/migrations/0012_journey_aggregate.sql
--
-- Journey now plays all 4 themed rounds CLIENT-SIDE (mirroring Practice) with the
-- level's fixed difficulty profile, then submits ONE aggregate level result. The
-- server's role shrinks to: serve each level's difficulty profile (get_level /
-- the levels table, unchanged) + record the aggregate (best_total/best_stars/
-- cleared) with a greatest() upsert.
--
-- The old per-attempt machinery (start_session / submit_attempt Edge Functions,
-- start_session_row / record_attempt RPCs, level_sessions / attempts tables) is
-- left in place but is no longer on the live Journey path. It is harmless and
-- avoids churning the 0005 RPC tests; a future cleanup can drop it.

-- ── Clean slate ──────────────────────────────────────────────────────────────
-- The score scale changed (per-level max ~2000 → ~9000), so existing PRs are
-- incomparable. Reset progress + attempt history for a clean slate. Streaks and
-- achievements self-correct from new plays, so profiles are left untouched.
-- DELETE (not TRUNCATE) so the daily_results.best_attempt_id FK fires its
-- ON DELETE SET NULL — TRUNCATE would need CASCADE and would wipe daily_results.
delete from public.attempts;
delete from public.level_progress;

-- ── record_level_result ──────────────────────────────────────────────────────
-- Called directly by the authenticated client (lib/api submitLevelResult) once a
-- Journey level ends (perfect 4-round clear OR game over). Client-trusted: it
-- writes ONLY the caller's own progress row (auth.uid()), and the leaderboard is
-- deferred, so forging a score only inflates the player's own PR. SECURITY
-- DEFINER so it can also bump streaks/achievements (which live behind RLS).
create or replace function public.record_level_result(
  p_level_id uuid, p_total int, p_stars int, p_cleared boolean
) returns public.level_progress
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_last date;
  v_progress public.level_progress;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.levels where id = p_level_id) then
    raise exception 'unknown level';
  end if;

  insert into public.level_progress (user_id, level_id, best_total, best_stars,
    cleared, times_played, last_played_at)
  values (v_uid, p_level_id, greatest(p_total, 0), greatest(p_stars, 0),
    p_cleared, 1, now())
  on conflict (user_id, level_id) do update set
    best_total = greatest(public.level_progress.best_total, excluded.best_total),
    best_stars = greatest(public.level_progress.best_stars, excluded.best_stars),
    cleared = public.level_progress.cleared or excluded.cleared,
    times_played = public.level_progress.times_played + 1,
    last_played_at = now()
  returning * into v_progress;

  -- Only a clear advances the daily streak / achievement progress.
  if p_cleared then
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
  end if;

  return v_progress;
end; $$;

-- The client calls this with its own JWT, so authenticated needs EXECUTE. It is
-- safe because it scopes every write to auth.uid(). Strip the default PUBLIC
-- grant AND the Supabase default-privilege grant to anon (anon is granted
-- EXECUTE on new public functions directly, so revoking PUBLIC alone leaves it);
-- keep service_role (Edge Functions / admin tooling).
revoke execute on function public.record_level_result(uuid, int, int, boolean) from public, anon;
grant execute on function public.record_level_result(uuid, int, int, boolean) to authenticated, service_role;
