-- supabase/migrations/0014_stagger_leaderboard_rpc.sql
--
-- One-call leaderboard read for the LeaderboardScreen: the top of one mode's
-- global board PLUS the caller's own standing, so the client never has to
-- stitch rankings together (or see anyone's user id) itself.
--
-- Layered on 0013_stagger_stats.sql: ranks are computed over the same
-- population stagger_mode_best exposes — per-(user, mode) bests of NON-GUEST
-- profiles — and the payload carries only safe columns (display_name + bests).
-- Guests still get their own private bests back in `me` (owner-scoped via
-- auth.uid()), but every rank field stays null: guests play unranked until
-- they convert, at which point the same uid starts ranking automatically.
--
-- Payload shape (consumed by src/lib/api.ts getStaggerLeaderboard):
--   {
--     "total": 1204,                -- ranked (non-guest) players on this board
--     "top":   [{ "rank", "display_name", "high_score", "best_streak", "best_accuracy" }, ...],
--     "me":    {                    -- null only when unauthenticated
--       "display_name", "is_guest",
--       "high_score", "best_streak", "best_accuracy",   -- null until a run is recorded
--       "rank", "streak_rank", "accuracy_rank"          -- null for guests / no runs
--     }
--   }
--
-- The board orders by high_score; streak_rank / best_accuracy ranks exist so
-- the hero card can show "your best axis" per metric. rank() (not row_number)
-- keeps tied bests at the same rank.

create or replace function public.get_stagger_leaderboard(p_mode text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if p_mode is null or p_mode not in ('easy','medium','hard') then
    raise exception 'unknown mode';
  end if;

  with ranked as (
    select s.user_id, p.display_name, s.high_score, s.best_streak, s.best_accuracy,
           rank() over (order by s.high_score desc)    as score_rank,
           rank() over (order by s.best_streak desc)   as streak_rank,
           rank() over (order by s.best_accuracy desc) as accuracy_rank
    from public.stagger_stats s
    join public.profiles p on p.id = s.user_id
    where s.mode = p_mode and not p.is_guest
  ),
  top_rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'rank', t.score_rank,
      'display_name', t.display_name,
      'high_score', t.high_score,
      'best_streak', t.best_streak,
      'best_accuracy', t.best_accuracy
    ) order by t.score_rank, t.display_name), '[]'::jsonb) as top
    from (
      select * from ranked order by score_rank, display_name limit 50
    ) t
  ),
  caller as (
    select jsonb_build_object(
      'display_name', p.display_name,
      'is_guest', p.is_guest,
      'high_score', s.high_score,
      'best_streak', s.best_streak,
      'best_accuracy', s.best_accuracy,
      'rank', r.score_rank,
      'streak_rank', r.streak_rank,
      'accuracy_rank', r.accuracy_rank
    ) as me
    from public.profiles p
    left join public.stagger_stats s on s.user_id = p.id and s.mode = p_mode
    left join ranked r on r.user_id = p.id
    where p.id = v_uid
  )
  select jsonb_build_object(
    'total', (select count(*) from ranked),
    'top', (select top from top_rows),
    'me', coalesce((select me from caller), 'null'::jsonb)
  ) into v_result;

  return v_result;
end; $$;

-- Same grant hygiene as record_stagger_run (0013): strip PUBLIC and the
-- Supabase default anon grant. Guests are AUTHENTICATED (anonymous sign-ins),
-- so they can read the board; only tokenless callers are shut out.
revoke execute on function public.get_stagger_leaderboard(text) from public, anon;
grant execute on function public.get_stagger_leaderboard(text) to authenticated, service_role;
