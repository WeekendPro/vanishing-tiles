-- supabase/migrations/0001_core_schema.sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  is_guest boolean not null default true,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_played_date date,
  created_at timestamptz not null default now()
);

create table public.themes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  sort_order int not null,
  unlock_threshold numeric not null default 0.7,
  piece_set text[] not null default '{I,O,T,S,Z,J,L,SINGLE}',
  mechanic text not null default 'standard',
  created_at timestamptz not null default now()
);

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.themes(id) on delete cascade,
  index_in_theme int not null,
  display_number int not null,
  view_duration_ms int not null,
  select_duration_ms int not null,
  gap_count int not null,
  shape_complexity text not null,
  adjacency int not null default 0,
  modifiers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (theme_id, index_in_theme)
);

create table public.level_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  seed text not null,
  view_duration_ms int not null,
  select_duration_ms int not null,
  tries_used int not null default 0,
  max_tries int not null default 3,
  status text not null default 'active' check (status in ('active','cleared','exhausted')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index level_sessions_user_idx on public.level_sessions (user_id, level_id);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  session_id uuid not null references public.level_sessions(id) on delete cascade,
  try_number int not null check (try_number between 1 and 3),
  solved boolean not null,
  coverage numeric not null check (coverage >= 0 and coverage <= 1),
  accuracy int not null,
  speed_bonus int not null,
  efficiency_bonus int not null,
  attempts_bonus int not null,
  total int not null,
  stars int not null check (stars between 0 and 3),
  view_ms_remaining int not null default 0,
  select_ms_remaining int not null default 0,
  created_at timestamptz not null default now()
);
create index attempts_user_level_idx on public.attempts (user_id, level_id, created_at);

create table public.level_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  best_total int not null default 0,
  best_stars int not null default 0,
  best_try_count int,
  cleared boolean not null default false,
  times_played int not null default 0,
  last_played_at timestamptz,
  primary key (user_id, level_id)
);

create table public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  date date unique not null,
  level_id uuid references public.levels(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.daily_results (
  user_id uuid not null references public.profiles(id) on delete cascade,
  daily_challenge_id uuid not null references public.daily_challenges(id) on delete cascade,
  best_total int not null default 0,
  best_attempt_id uuid references public.attempts(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, daily_challenge_id)
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  criteria jsonb not null default '{}'::jsonb
);

create table public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
