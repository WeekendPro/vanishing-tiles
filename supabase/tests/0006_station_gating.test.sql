-- supabase/tests/0006_station_gating.test.sql
-- Per-station sequential gating: get_journey emits per-level current/locked from
-- display_number + the player's cleared set (replaces the old 70% theme rule).
-- `supabase test db` loads seed.sql during reset, so the 15 seeded levels exist.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'gate@test.dev');

-- Read a single level's flag (current/locked) by display_number from get_journey.
create or replace function pg_temp.flag(p_dn int, p_flag text)
returns boolean language sql as $$
  select (lv->>p_flag)::boolean
  from jsonb_array_elements(public.get_journey()) th,
       jsonb_array_elements(th->'levels') lv
  where (lv->>'display_number')::int = p_dn
$$;

-- Count levels where a boolean flag is true.
create or replace function pg_temp.flag_count(p_flag text)
returns bigint language sql as $$
  select count(*)
  from jsonb_array_elements(public.get_journey()) th,
       jsonb_array_elements(th->'levels') lv
  where (lv->>p_flag)::boolean
$$;

-- (A) No progress: level 1 is the frontier.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(pg_temp.flag(1,'current'), true,  'dn1 is current with no progress');
select is(pg_temp.flag(1,'locked'),  false, 'dn1 is not locked');
select is(pg_temp.flag(2,'current'), false, 'dn2 is not current');
select is(pg_temp.flag(2,'locked'),  true,  'dn2 is locked behind dn1');
reset role;

-- (B) Clear levels 1-3 → frontier advances to 4.
insert into public.level_progress (user_id, level_id, cleared)
select '00000000-0000-0000-0000-0000000000b1', id, true
from public.levels where display_number in (1,2,3);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(pg_temp.flag(4,'current'), true,  'dn4 is current after clearing 1-3');
select is(pg_temp.flag(4,'locked'),  false, 'the current station is never locked');
select is(pg_temp.flag(5,'locked'),  true,  'dn5 is locked beyond the frontier');
select is(pg_temp.flag(1,'current'), false, 'cleared dn1 is not current');
select is(pg_temp.flag(1,'locked'),  false, 'cleared dn1 stays revisitable (not locked)');
reset role;

-- (B2) Clear all of district 1 (1-5) → frontier crosses into district 2 at dn6.
insert into public.level_progress (user_id, level_id, cleared)
select '00000000-0000-0000-0000-0000000000b1', id, true
from public.levels where display_number in (4,5)
on conflict (user_id, level_id) do update set cleared = true;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(pg_temp.flag(6,'current'), true,  'dn6 (first of district 2) is current after clearing all of district 1');
select is(pg_temp.flag(6,'locked'),  false, 'cross-district frontier station is not locked');
reset role;

-- (C) Clear everything → no frontier.
insert into public.level_progress (user_id, level_id, cleared)
select '00000000-0000-0000-0000-0000000000b1', id, true
from public.levels
on conflict (user_id, level_id) do update set cleared = true;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(pg_temp.flag_count('current'), 0::bigint, 'no current station when all cleared');
select is(pg_temp.flag_count('locked'),  0::bigint, 'nothing locked when all cleared');
reset role;

select * from finish();
rollback;
