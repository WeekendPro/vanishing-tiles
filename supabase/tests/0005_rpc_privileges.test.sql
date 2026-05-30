-- supabase/tests/0005_rpc_privileges.test.sql
-- Regression guard: the SECURITY DEFINER persistence RPCs write server-trusted
-- scores with no bounds-check, so a client JWT (anon/authenticated) must NOT be
-- able to execute them via PostgREST. Only the service role (the Edge Functions'
-- identity) may. Without this, a player could call record_attempt directly and
-- forge a perfect score, defeating the server-authoritative scoring.
begin;
select plan(6);

select function_privs_are('public', 'record_attempt',
  ARRAY['uuid','boolean','numeric','integer','integer','integer','integer','integer','integer','integer','integer'],
  'authenticated', ARRAY[]::text[], 'authenticated cannot execute record_attempt');
select function_privs_are('public', 'record_attempt',
  ARRAY['uuid','boolean','numeric','integer','integer','integer','integer','integer','integer','integer','integer'],
  'anon', ARRAY[]::text[], 'anon cannot execute record_attempt');
select function_privs_are('public', 'record_attempt',
  ARRAY['uuid','boolean','numeric','integer','integer','integer','integer','integer','integer','integer','integer'],
  'service_role', ARRAY['EXECUTE'], 'service_role can execute record_attempt');

select function_privs_are('public', 'start_session_row',
  ARRAY['uuid','uuid','text','integer','integer'],
  'authenticated', ARRAY[]::text[], 'authenticated cannot execute start_session_row');
select function_privs_are('public', 'start_session_row',
  ARRAY['uuid','uuid','text','integer','integer'],
  'service_role', ARRAY['EXECUTE'], 'service_role can execute start_session_row');

select function_privs_are('public', 'evaluate_achievements',
  ARRAY['uuid'],
  'authenticated', ARRAY[]::text[], 'authenticated cannot execute evaluate_achievements');

select * from finish();
rollback;
