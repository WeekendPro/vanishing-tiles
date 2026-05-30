-- supabase/tests/0003_persistence_rpcs.test.sql
-- A real auth user (the on_auth_user_created trigger makes the profile) stands in
-- for the basejump tests.create_supabase_user helper, which isn't bundled in the
-- local Postgres image. The RPCs run as the superuser test session here, mirroring
-- the service-role context the Edge Functions invoke them in.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev');
insert into public.themes (slug,name,sort_order) values ('beginner','Beginner',1);
insert into public.levels (theme_id,index_in_theme,display_number,view_duration_ms,select_duration_ms,gap_count,shape_complexity)
  select id,1,1,10000,15000,3,'simple' from public.themes where slug='beginner';

-- start_session_row returns a session id and stores the seed + window.
select lives_ok($$select public.start_session_row(
  '00000000-0000-0000-0000-0000000000a1'::uuid, (select id from public.levels limit 1), 'seed-1', 10000, 15000)$$,
  'start_session_row runs');
select is((select count(*)::int from public.level_sessions where seed = 'seed-1'), 1, 'session persisted');
select is((select status from public.level_sessions where seed = 'seed-1'), 'active', 'session active');

-- a server-scored clear on try 1, recorded against the session above.
select lives_ok($$select public.record_attempt(
  (select id from public.level_sessions where seed='seed-1'),
  true, 1.0, 800, 250, 300, 400, 1750, 3, 5000, 7500)$$, 'record_attempt runs');
select is((select best_total from public.level_progress where user_id = '00000000-0000-0000-0000-0000000000a1'), 1750, 'PR recorded');
select is((select cleared from public.level_progress where user_id = '00000000-0000-0000-0000-0000000000a1'), true, 'level cleared');
select is((select current_streak from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 1, 'streak started');
select is((select status from public.level_sessions where seed='seed-1'), 'cleared', 'session marked cleared');
-- recording against an already-cleared (non-active) session is rejected.
select throws_ok($$select public.record_attempt(
  (select id from public.level_sessions where seed='seed-1'),
  false, 0.5, 0, 0, 0, 0, 0, 0, 0, 0)$$, null, 'cannot record on a non-active session');

select * from finish();
rollback;
