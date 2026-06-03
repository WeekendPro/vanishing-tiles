-- supabase/migrations/0010_per_station_gating.sql
-- Per-station sequential gating. Replaces the 70% theme-unlock rule with a single
-- linear frontier across all levels (ordered by display_number). get_journey now
-- emits per-level `current`/`locked`; the theme object no longer carries `locked`.
-- The unlock_threshold column is removed (no longer read by any RPC).
begin;

create or replace function public.get_journey()
returns jsonb language sql security definer set search_path = public stable as $$
  with prog as (
    select l.id, l.theme_id, l.display_number, l.index_in_theme, l.name,
           coalesce(lp.cleared, false) as cleared,
           coalesce(lp.best_total, 0)  as my_pr,
           coalesce(lp.best_stars, 0)  as my_stars,
           lp.last_played_at,
           gb.best_total as global_best
    from public.levels l
    left join public.level_progress lp
      on lp.level_id = l.id and lp.user_id = auth.uid()
    left join public.level_global_best gb on gb.level_id = l.id
  ),
  frontier as (
    select min(display_number) as dn from prog where not cleared
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'theme_id', t.id, 'slug', t.slug, 'name', t.name, 'mechanic', t.mechanic,
    'sort_order', t.sort_order,
    'levels', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'level_id', p.id, 'display_number', p.display_number, 'name', p.name,
        'my_pr', p.my_pr, 'my_stars', p.my_stars,
        'cleared', p.cleared, 'last_played', p.last_played_at,
        'global_best', p.global_best,
        'current', (f.dn is not null and p.display_number = f.dn),
        'locked',  (f.dn is not null and p.display_number > f.dn)
      ) order by p.index_in_theme), '[]'::jsonb)
      from prog p, frontier f
      where p.theme_id = t.id)
  ) order by t.sort_order), '[]'::jsonb)
  from public.themes t;
$$;

alter table public.themes drop column unlock_threshold;

commit;
