-- supabase/tests/0004_read_rpcs.test.sql
-- Native-auth stand-in for the basejump helpers: a real auth user (trigger makes
-- the profile) plus `set local role authenticated` + request.jwt.claims so the
-- SECURITY DEFINER read RPCs resolve auth.uid() to that user.
begin;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev');

-- `supabase test db` loads seed.sql during its reset, so the read RPCs run
-- against the seeded catalog — no need to insert our own themes/levels.

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select isnt_empty($$select public.get_journey()$$, 'get_journey returns rows');
select lives_ok($$select public.get_level((select id from public.levels order by display_number, id limit 1))$$, 'get_level runs');
select lives_ok($$select public.get_stats()$$, 'get_stats runs');
reset role;

select * from finish();
rollback;
