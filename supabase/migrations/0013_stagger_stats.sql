-- supabase/migrations/0013_stagger_stats.sql
--
-- Per-user, per-mode Infinite Stagger stat tracking. Every stat is keyed by
-- (user_id, mode) — mode is the run's snapshotted difficulty ('easy' | 'medium'
-- | 'hard', staggerStore.mode) — so easy and hard scores are never conflated.
--
-- Two tables:
--   stagger_runs  — one append-only row per completed run (game over). Kept so
--                   a leaderboard / richer history can be computed later; the
--                   sibling leaderboard project queries by (user_id, mode) and
--                   (mode, score).
--   stagger_stats — per-(user, mode) aggregate (high score / best streak /
--                   best accuracy), upserted with greatest() on every run.
--
-- Writes go ONLY through the record_stagger_run RPC (same client-trusted model
-- as record_level_result in 0012): it scopes every write to auth.uid(), so a
-- forged score only inflates the caller's own stats. The leaderboard surface
-- exposes nothing private (see stagger_mode_best below, per the 0004 pattern).
--
-- Guests: anonymous sign-ins ARE authenticated users (auth.uid() exists and the
-- 0002 trigger gives them a profiles row with is_guest = true), so their runs
-- and aggregates record exactly like full accounts — if a guest later converts
-- (links email/OAuth), Supabase keeps the same uid and their history carries
-- over. Guests are only excluded from the GLOBAL view (stagger_mode_best), so
-- unnamed anon accounts never appear on a public leaderboard.

create table public.stagger_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('easy','medium','hard')),
  score int not null check (score >= 0),
  best_streak int not null check (best_streak >= 0),
  accuracy int not null check (accuracy between 0 and 100),
  gaps_recalled int not null default 0 check (gaps_recalled >= 0),
  created_at timestamptz not null default now()
);
-- Per-player history ("my recent hard runs") …
create index stagger_runs_user_mode_idx on public.stagger_runs (user_id, mode, created_at desc);
-- … and global top-N per mode for the leaderboard project.
create index stagger_runs_mode_score_idx on public.stagger_runs (mode, score desc);

create table public.stagger_stats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('easy','medium','hard')),
  high_score int not null default 0,
  best_streak int not null default 0,
  best_accuracy int not null default 0 check (best_accuracy between 0 and 100),
  runs_played int not null default 0,
  last_played_at timestamptz,
  primary key (user_id, mode)
);

-- Owner-read-only; ALL writes come via the security-definer RPC below, so the
-- client can't insert hand-crafted rows or edit aggregates directly.
alter table public.stagger_runs enable row level security;
alter table public.stagger_stats enable row level security;
create policy "read own stagger runs" on public.stagger_runs
  for select using (auth.uid() = user_id);
create policy "read own stagger stats" on public.stagger_stats
  for select using (auth.uid() = user_id);

-- ── record_stagger_run ───────────────────────────────────────────────────────
-- Called by the authenticated client once per game over (lib/api
-- submitStaggerRun): appends the run row and greatest()-upserts the
-- per-(user, mode) aggregate. Returns the updated aggregate row.
create or replace function public.record_stagger_run(
  p_mode text, p_score int, p_best_streak int, p_accuracy int, p_gaps_recalled int
) returns public.stagger_stats
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_score int := greatest(coalesce(p_score, 0), 0);
  v_streak int := greatest(coalesce(p_best_streak, 0), 0);
  v_accuracy int := least(greatest(coalesce(p_accuracy, 0), 0), 100);
  v_recalled int := greatest(coalesce(p_gaps_recalled, 0), 0);
  v_stats public.stagger_stats;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_mode is null or p_mode not in ('easy','medium','hard') then
    raise exception 'unknown mode';
  end if;

  insert into public.stagger_runs (user_id, mode, score, best_streak, accuracy, gaps_recalled)
  values (v_uid, p_mode, v_score, v_streak, v_accuracy, v_recalled);

  insert into public.stagger_stats
    (user_id, mode, high_score, best_streak, best_accuracy, runs_played, last_played_at)
  values (v_uid, p_mode, v_score, v_streak, v_accuracy, 1, now())
  on conflict (user_id, mode) do update set
    high_score = greatest(public.stagger_stats.high_score, excluded.high_score),
    best_streak = greatest(public.stagger_stats.best_streak, excluded.best_streak),
    best_accuracy = greatest(public.stagger_stats.best_accuracy, excluded.best_accuracy),
    runs_played = public.stagger_stats.runs_played + 1,
    last_played_at = now()
  returning * into v_stats;

  return v_stats;
end; $$;

-- Same grant hygiene as record_level_result (0012): strip PUBLIC and the
-- Supabase default anon grant; the client calls with its own JWT.
revoke execute on function public.record_stagger_run(text, int, int, int, int) from public, anon;
grant execute on function public.record_stagger_run(text, int, int, int, int) to authenticated, service_role;

-- ── Global per-mode bests (leaderboard surface) ──────────────────────────────
-- Follows 0004_leaderboard.sql: security_invoker = false so the view can read
-- across users, but it exposes ONLY safe columns (mode, bests, display_name) —
-- no user ids, no private data. Guests (is_guest) are excluded; their stats
-- still record privately and surface here if they convert to a full account.
create view public.stagger_mode_best
with (security_invoker = false) as
select s.mode, s.high_score, s.best_streak, s.best_accuracy, p.display_name
from public.stagger_stats s
join public.profiles p on p.id = s.user_id
where not p.is_guest;

grant select on public.stagger_mode_best to anon, authenticated;
