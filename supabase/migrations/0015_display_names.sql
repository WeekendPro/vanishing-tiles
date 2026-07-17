-- supabase/migrations/0015_display_names.sql
--
-- Display names become real: the 0002 trigger's 'Player' placeholder is
-- retired, names are unique (case-insensitively) across ranked players, and
-- claiming/editing goes through one validated RPC. Profiles that haven't
-- claimed a name yet (the backfilled pre-0015 accounts) disappear from the
-- leaderboard until they claim — then their existing stats reappear under
-- the real name (stats survive; nothing is wiped).

-- 1. Backfill: the pre-0015 accounts all carry the trigger default.
--    Nulling the name is what funnels them into the client's claim gate.
update public.profiles set display_name = null where display_name = 'Player';

-- 2. Case-insensitive uniqueness, ranked (non-guest) names only. Partial:
--    guests keep null and never claim, so they can't collide.
create unique index profiles_display_name_unique
  on public.profiles (lower(display_name))
  where not is_guest and display_name is not null;

-- 3. Trigger: stop defaulting to 'Player'. New profiles start unnamed (null)
--    and get gated client-side; an explicit metadata display_name (e.g. a
--    future native sign-up form) is still honored.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, is_guest, display_name)
  values (new.id, coalesce((new.raw_user_meta_data->>'is_guest')::boolean, new.email is null),
          new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end; $$;

-- 4. The one write path for names. Validation mirrors src/lib/displayName.ts
--    exactly; the unique index (not a pre-check) decides races atomically.
create or replace function public.set_display_name(p_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_is_guest boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if v_name !~ '^[A-Za-z][A-Za-z0-9_]{2,15}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Self-heal a missing profile row (trigger somehow skipped), mirroring
  -- handle_new_user's is_guest derivation.
  insert into public.profiles (id, is_guest, display_name)
  select u.id,
         coalesce((u.raw_user_meta_data->>'is_guest')::boolean, u.email is null),
         null
  from auth.users u where u.id = v_uid
  on conflict (id) do nothing;

  select is_guest into v_is_guest from public.profiles where id = v_uid;
  if v_is_guest then
    return jsonb_build_object('ok', false, 'reason', 'guest');
  end if;

  begin
    update public.profiles set display_name = v_name where id = v_uid;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end;

  return jsonb_build_object('ok', true, 'display_name', v_name);
end; $$;

revoke execute on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated, service_role;

-- 5. Leaderboard: hide unclaimed (null-name) profiles from the ranked
--    population. Everything else is byte-identical to 0014 — same payload,
--    same guest semantics, same grants.
create or replace function public.get_stagger_leaderboard(p_mode text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if p_mode is null or p_mode not in ('easy','medium','hard') then
    raise exception 'unknown mode';
  end if;

  with ranked as (
    select s.user_id, p.display_name, s.high_score, s.best_streak, s.best_accuracy,
           rank() over (order by s.high_score desc)    as score_rank,
           rank() over (order by s.best_streak desc)   as streak_rank,
           rank() over (order by s.best_accuracy desc) as accuracy_rank
    from public.stagger_stats s
    join public.profiles p on p.id = s.user_id
    where s.mode = p_mode and not p.is_guest and p.display_name is not null
  ),
  top_rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'rank', t.score_rank,
      'display_name', t.display_name,
      'high_score', t.high_score,
      'best_streak', t.best_streak,
      'best_accuracy', t.best_accuracy
    ) order by t.score_rank, t.display_name), '[]'::jsonb) as top
    from (
      select * from ranked order by score_rank, display_name limit 50
    ) t
  ),
  caller as (
    select jsonb_build_object(
      'display_name', p.display_name,
      'is_guest', p.is_guest,
      'high_score', s.high_score,
      'best_streak', s.best_streak,
      'best_accuracy', s.best_accuracy,
      'rank', r.score_rank,
      'streak_rank', r.streak_rank,
      'accuracy_rank', r.accuracy_rank
    ) as me
    from public.profiles p
    left join public.stagger_stats s on s.user_id = p.id and s.mode = p_mode
    left join ranked r on r.user_id = p.id
    where p.id = v_uid
  )
  select jsonb_build_object(
    'total', (select count(*) from ranked),
    'top', (select top from top_rows),
    'me', coalesce((select me from caller), 'null'::jsonb)
  ) into v_result;

  return v_result;
end; $$;

revoke execute on function public.get_stagger_leaderboard(text) from public, anon;
grant execute on function public.get_stagger_leaderboard(text) to authenticated, service_role;
