-- supabase/migrations/0003_rls.sql
-- world-readable reference tables
alter table public.themes enable row level security;
alter table public.levels enable row level security;
alter table public.achievements enable row level security;
alter table public.daily_challenges enable row level security;
create policy "ref readable" on public.themes for select using (true);
create policy "ref readable" on public.levels for select using (true);
create policy "ref readable" on public.achievements for select using (true);
create policy "ref readable" on public.daily_challenges for select using (true);

-- owner-only tables
alter table public.profiles enable row level security;
alter table public.level_sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.level_progress enable row level security;
alter table public.daily_results enable row level security;
alter table public.user_achievements enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
-- level_sessions: the client may READ its own sessions but NEVER write them.
-- Inserts/updates come only from the service-role Edge Functions (RLS is
-- bypassed by the service role), so a client can't forge a seed or reset tries.
create policy "read own sessions" on public.level_sessions
  for select using (auth.uid() = user_id);
-- attempts: read-only for the owner; writes happen via the service-role
-- record_attempt RPC, so the client can't insert a hand-crafted score.
create policy "read own attempts" on public.attempts
  for select using (auth.uid() = user_id);
create policy "own progress" on public.level_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own daily results" on public.daily_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own achievements" on public.user_achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
