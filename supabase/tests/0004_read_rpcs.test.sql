-- supabase/tests/0004_read_rpcs.test.sql
-- Native-auth stand-in for the basejump helpers: a real auth user (trigger makes
-- the profile) plus `set local role authenticated` + request.jwt.claims so the
-- SECURITY DEFINER read RPCs resolve auth.uid() to that user.
begin;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev');
insert into public.themes (slug,name,sort_order) values ('beginner','Beginner',1),('intermediate','Intermediate',2);
insert into public.levels (theme_id,index_in_theme,display_number,view_duration_ms,select_duration_ms,gap_count,shape_complexity)
  select id,1,1,10000,15000,3,'simple' from public.themes where slug='beginner';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select isnt_empty($$select public.get_journey()$$, 'get_journey returns rows');
select lives_ok($$select public.get_level((select id from public.levels limit 1))$$, 'get_level runs');
select lives_ok($$select public.get_stats()$$, 'get_stats runs');
reset role;

select * from finish();
rollback;
