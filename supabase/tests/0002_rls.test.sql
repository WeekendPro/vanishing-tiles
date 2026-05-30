-- supabase/tests/0002_rls.test.sql
-- RLS is exercised with native Postgres primitives (no test-helper extension):
-- inserting into auth.users fires the on_auth_user_created trigger to make a
-- profile, and `set local role authenticated` + a `request.jwt.claims` JSON
-- makes auth.uid() resolve to that user so the owner-only policies apply.
begin;
select plan(5);

-- Two real auth users; the trigger creates their profiles.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@test.dev');

-- Seed a level, then (as the superuser running this test = service-role-equivalent,
-- RLS bypassed) create a session + attempt for alice, mirroring the Edge Functions.
-- The client is never allowed to do these inserts (asserted below).
insert into public.themes (slug,name,sort_order) values ('t','T',1);
insert into public.levels (theme_id,index_in_theme,display_number,view_duration_ms,select_duration_ms,gap_count,shape_complexity)
  select id,1,1,10000,15000,3,'simple' from public.themes where slug='t';
insert into public.level_sessions (id, user_id, level_id, seed, view_duration_ms, select_duration_ms)
  select '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', id, 'seed-1', 10000, 15000
  from public.levels limit 1;
insert into public.attempts (user_id,level_id,session_id,try_number,solved,coverage,accuracy,speed_bonus,efficiency_bonus,attempts_bonus,total,stars)
  select '00000000-0000-0000-0000-0000000000a1', id, '00000000-0000-0000-0000-000000000001',1,true,1,800,0,0,400,1200,2
  from public.levels limit 1;

-- alice reads her own attempt.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select isnt_empty($$select * from public.attempts$$, 'alice sees her own attempt');

-- bob sees nothing (RLS).
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is_empty($$select * from public.attempts$$, 'bob sees no attempts (RLS)');

-- alice can NOT forge an attempt directly (no insert policy).
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok($$insert into public.attempts (user_id,level_id,session_id,try_number,solved,coverage,accuracy,speed_bonus,efficiency_bonus,attempts_bonus,total,stars)
  select '00000000-0000-0000-0000-0000000000a1', id, '00000000-0000-0000-0000-000000000001',1,true,1,800,0,0,400,1200,2 from public.levels limit 1$$,
  null, 'client cannot insert attempts directly (RLS)');
-- alice can NOT forge a session (no insert policy).
select throws_ok($$insert into public.level_sessions (user_id,level_id,seed,view_duration_ms,select_duration_ms)
  select '00000000-0000-0000-0000-0000000000a1', id, 'forged', 999999, 999999 from public.levels limit 1$$,
  null, 'client cannot insert level_sessions directly (RLS)');

reset role;

-- Task 3.2: the per-level global-best leaderboard view exists.
select has_view('public', 'level_global_best', 'global best view exists');

select * from finish();
rollback;
