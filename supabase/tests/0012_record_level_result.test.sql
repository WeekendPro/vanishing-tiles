-- supabase/tests/0012_record_level_result.test.sql
-- Journey now submits ONE aggregate level result via record_level_result, called
-- directly by the authenticated client. It writes ONLY the caller's own progress
-- row (auth.uid()) with a greatest() upsert, and bumps the streak on a clear.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'bob@test.dev');

-- authenticated (the client JWT) CAN execute it; anon cannot.
select function_privs_are('public', 'record_level_result',
  ARRAY['uuid','integer','integer','boolean'],
  'authenticated', ARRAY['EXECUTE'], 'authenticated can execute record_level_result');
select function_privs_are('public', 'record_level_result',
  ARRAY['uuid','integer','integer','boolean'],
  'anon', ARRAY[]::text[], 'anon cannot execute record_level_result');

-- Impersonate the caller (auth.uid() reads from request.jwt.claims).
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

-- A first cleared result records the PR + stars + cleared flag.
select lives_ok($$select public.record_level_result(
  (select id from public.levels order by display_number, id limit 1), 5800, 2, true)$$,
  'record_level_result runs for a cleared level');
select is((select best_total from public.level_progress where user_id = '00000000-0000-0000-0000-0000000000b1'), 5800, 'PR recorded');
select is((select best_stars from public.level_progress where user_id = '00000000-0000-0000-0000-0000000000b1'), 2, 'stars recorded');
select is((select cleared from public.level_progress where user_id = '00000000-0000-0000-0000-0000000000b1'), true, 'level cleared');
select is((select current_streak from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 1, 'streak started');

-- A lower subsequent total does NOT lower the PR (greatest upsert).
select lives_ok($$select public.record_level_result(
  (select id from public.levels order by display_number, id limit 1), 1000, 1, true)$$,
  'a lower replay still runs');
select is((select best_total from public.level_progress where user_id = '00000000-0000-0000-0000-0000000000b1'), 5800, 'PR not lowered by a weaker replay');

reset role;
select * from finish();
rollback;
