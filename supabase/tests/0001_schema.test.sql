-- supabase/tests/0001_schema.test.sql
begin;
select plan(14);
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'themes', 'themes exists');
select has_table('public', 'levels', 'levels exists');
select has_table('public', 'level_sessions', 'level_sessions exists');
select has_table('public', 'attempts', 'attempts exists');
select has_table('public', 'level_progress', 'level_progress exists');
select has_table('public', 'daily_challenges', 'daily_challenges exists');
select has_table('public', 'daily_results', 'daily_results exists');
select has_table('public', 'achievements', 'achievements exists');
select has_table('public', 'user_achievements', 'user_achievements exists');
select col_is_pk('public', 'level_progress', ARRAY['user_id','level_id'], 'level_progress composite pk');
select has_column('public', 'levels', 'adjacency', 'levels has adjacency lever');
select has_column('public', 'level_sessions', 'seed', 'level_sessions stores the puzzle seed');
select has_function('public', 'handle_new_user', 'new-user trigger fn exists');
select * from finish();
rollback;
