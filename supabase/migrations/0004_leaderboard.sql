-- supabase/migrations/0004_leaderboard.sql
-- security_invoker = false makes the view run with the definer's rights so it can
-- read across users, but it exposes only level_id, best_total, display_name — no
-- private columns.
create view public.level_global_best
with (security_invoker = false) as
select distinct on (a.level_id)
  a.level_id, a.total as best_total, p.display_name
from public.attempts a
join public.profiles p on p.id = a.user_id
where a.solved
order by a.level_id, a.total desc, a.created_at asc;

grant select on public.level_global_best to anon, authenticated;
