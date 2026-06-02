-- 0007_recalibrate_level_durations.sql
-- Recalibrate the time-to-difficulty curve so every level stays solvable and the
-- challenge is HOW FAST you clear it, not WHETHER you can. The memorize (view)
-- timer now RISES with gap_count on a comfortable ~1.2-1.33s/gap budget instead
-- of falling as complexity climbs; select_duration rises too so picking pieces is
-- never the bottleneck. seed.sql uses `on conflict do nothing`, so existing rows
-- need this explicit UPDATE to pick up the new timing.
--
-- Keep in sync with: DIFFICULTY_TABLE (src/store/gameStore.ts),
-- LEVEL_CONFIGS (supabase/functions/_shared/core/levelConfig.ts), seed.sql.

update public.levels as l set
  view_duration_ms   = v.view_ms,
  select_duration_ms = v.select_ms
from (values
  (1,  4000,  10000),
  (2,  5000,  11000),
  (3,  6500,  12000),
  (4,  8000,  14000),
  (5,  9000,  15000),
  (6,  10000, 16000),
  (7,  11000, 17000),
  (8,  12000, 18000),
  (9,  13000, 19000),
  (10, 14000, 20000),
  (11, 15000, 21000),
  (12, 16000, 22000),
  (13, 16500, 22000),
  (14, 17000, 23000),
  (15, 17000, 23000)
) as v(display_number, view_ms, select_ms)
where l.display_number = v.display_number;
