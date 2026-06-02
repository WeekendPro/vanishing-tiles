-- 0008_gap_city_districts.sql
-- Gap City identity: re-theme Journey progression around New York districts.
-- Adds a per-level neighborhood name, replaces the five legacy skill-tier themes
-- with three district themes, and re-points the existing 15 levels into a 5/5/5
-- split — preserving the durations/gap configs recalibrated by 0007 (this only
-- touches theme_id, index_in_theme, name). Also extends the read RPCs with `name`.
--
-- Keep in sync with: supabase/seed.sql, DIFFICULTY_TABLE (src/store/gameStore.ts),
-- LEVEL_CONFIGS (supabase/functions/_shared/core/levelConfig.ts).

begin;

-- 1. Per-level neighborhood name.
alter table public.levels add column if not exists name text;

-- 2. The three district themes. Upsert so re-runs stay correct.
--    unlock_threshold lives on a theme and gates the theme AFTER it (get_journey
--    reads prev.unlock_threshold). First theme is always unlocked. We mirror the
--    prior pattern (first 0.0, rest 0.7): the_bronx always open, brooklyn always
--    open (bronx 0.0 gate is a no-op, as beginner's was), manhattan needs >=70%
--    of brooklyn cleared. manhattan's 0.7 is inert (no district follows it).
insert into public.themes (slug,name,description,sort_order,unlock_threshold,piece_set,mechanic) values
  ('the_bronx','The Bronx','Where the run begins',1,0.0,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
  ('brooklyn','Brooklyn','Picking up speed',2,0.7,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
  ('manhattan','Manhattan','The big leagues',3,0.7,'{I,O,T,S,Z,J,L,SINGLE}','standard')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  unlock_threshold = excluded.unlock_threshold,
  piece_set = excluded.piece_set,
  mechanic = excluded.mechanic;

-- 3. Re-point + name the 15 levels by display_number. Destination theme ids are
--    new, so no (theme_id, index_in_theme) collision is possible. Durations and
--    gap configs are deliberately NOT in this UPDATE.
update public.levels as l set
  theme_id       = th.id,
  index_in_theme = v.idx,
  name           = v.name
from (values
  (1,  'the_bronx', 1, 'Castle Hill'),
  (2,  'the_bronx', 2, 'East Tremont'),
  (3,  'the_bronx', 3, 'Hunts Point'),
  (4,  'the_bronx', 4, 'Melrose'),
  (5,  'the_bronx', 5, 'City Island'),
  (6,  'brooklyn',  1, 'Bed-Stuy'),
  (7,  'brooklyn',  2, 'Canarsie'),
  (8,  'brooklyn',  3, 'Bushwick'),
  (9,  'brooklyn',  4, 'Flatbush'),
  (10, 'brooklyn',  5, 'Red Hook'),
  (11, 'manhattan', 1, 'Harlem'),
  (12, 'manhattan', 2, 'Chelsea'),
  (13, 'manhattan', 3, 'SoHo'),
  (14, 'manhattan', 4, 'Washington Heights'),
  (15, 'manhattan', 5, 'Tribeca')
) as v(display_number, slug, idx, name)
join public.themes th on th.slug = v.slug
where l.display_number = v.display_number;

-- 4. Remove the now-empty legacy themes (incl. advanced/numbered/flashmob, which
--    were never populated). Keeping empties would collide on sort_order and corrupt
--    get_journey's row_number() lock chain. Safe: no levels reference them now;
--    progress/attempts reference level_id, not theme_id.
delete from public.themes
where slug in ('beginner','intermediate','advanced','numbered','flashmob');

-- 5. RPCs: add `name` to each journey level and to the level detail.
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
        'level_id', l.id, 'display_number', l.display_number, 'name', l.name,
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
    'level_id', l.id, 'display_number', l.display_number, 'name', l.name, 'theme_name', t.name,
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

commit;
