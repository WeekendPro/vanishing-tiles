-- supabase/tests/0003_persistence_rpcs.test.sql
-- A real auth user (the on_auth_user_created trigger makes the profile) stands in
-- for the basejump tests.create_supabase_user helper, which isn't bundled in the
-- local Postgres image. The RPCs run as the superuser test session here, mirroring
-- the service-role context the Edge Functions invoke them in.
begin;
select plan(3);

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

select * from finish();
rollback;
