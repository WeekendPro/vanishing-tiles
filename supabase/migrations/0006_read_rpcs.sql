-- supabase/migrations/0006_read_rpcs.sql
create or replace function public.get_journey()
returns jsonb language sql security definer set search_path = public stable as $$
  with themes_ord as (
    select t.*, row_number() over (order by t.sort_order) as rn from public.themes t
  ),
  theme_clear as (
    select l.theme_id,
      count(*) as total_levels,
      count(*) filter (where lp.cleared) as cleared_levels
    from public.levels l
    left join public.level_progress lp
      on lp.level_id = l.id and lp.user_id = auth.uid()
    group by l.theme_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'theme_id', t.id, 'slug', t.slug, 'name', t.name, 'mechanic', t.mechanic,
    'sort_order', t.sort_order,
    'locked', case when t.rn = 1 then false else
      coalesce((select (tc.cleared_levels::numeric / nullif(tc.total_levels,0)) >= prev.unlock_threshold
                from themes_ord prev join theme_clear tc on tc.theme_id = prev.id
                where prev.rn = t.rn - 1), false) = false end,
    'levels', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'level_id', l.id, 'display_number', l.display_number,
        'my_pr', coalesce(lp.best_total, 0), 'my_stars', coalesce(lp.best_stars, 0),
        'cleared', coalesce(lp.cleared, false), 'last_played', lp.last_played_at,
        'global_best', gb.best_total
      ) order by l.index_in_theme), '[]'::jsonb)
      from public.levels l
      left join public.level_progress lp on lp.level_id = l.id and lp.user_id = auth.uid()
      left join public.level_global_best gb on gb.level_id = l.id
      where l.theme_id = t.id)
  ) order by t.sort_order), '[]'::jsonb)
  from themes_ord t;
$$;

create or replace function public.get_level(p_level_id uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'level_id', l.id, 'display_number', l.display_number, 'theme_name', t.name,
    'view_duration_ms', l.view_duration_ms, 'select_duration_ms', l.select_duration_ms,
    'gap_count', l.gap_count, 'shape_complexity', l.shape_complexity, 'adjacency', l.adjacency,
    'my_pr', coalesce(lp.best_total, 0), 'my_stars', coalesce(lp.best_stars, 0),
    'global_high', gb.best_total, 'last_played', lp.last_played_at)
  from public.levels l
  join public.themes t on t.id = l.theme_id
  left join public.level_progress lp on lp.level_id = l.id and lp.user_id = auth.uid()
  left join public.level_global_best gb on gb.level_id = l.id
  where l.id = p_level_id;
$$;

create or replace function public.get_stats()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'streak', (select jsonb_build_object('current', current_streak, 'longest', longest_streak)
               from public.profiles where id = auth.uid()),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object(
        'level_id', level_id, 'total', total, 'stars', stars, 'solved', solved,
        'created_at', created_at) order by created_at)
      from public.attempts where user_id = auth.uid()), '[]'::jsonb));
$$;

grant execute on function public.get_journey() to authenticated;
grant execute on function public.get_level(uuid) to authenticated;
grant execute on function public.get_stats() to authenticated;
