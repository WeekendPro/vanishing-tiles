# Display Names + Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unique, validated display names for ranked players — claimed via a gate screen before Home, editable from the hamburger menu — plus a game-over → leaderboard link and icon-only pause buttons.

**Architecture:** A Postgres migration (`0015`) adds a case-insensitive unique index and a `set_display_name` security-definer RPC (typed `ok/taken/invalid/guest` results), and hides unclaimed profiles from the leaderboard. Client-side, a new `profileStore` becomes the single source of truth for the name (replacing GlobalMenu's auth-metadata read); a `routeAfterAuth()` helper gates non-guests with a null name into a new `claimName` view before Home. A shared `DisplayNameForm` component serves both the claim screen and the menu's edit overlay.

**Tech Stack:** React 18 + Zustand 5 (`useShallow` for object selectors — see CLAUDE.md), Supabase (Postgres RPCs, RLS), Vitest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-16-display-name-profile-design.md`

## Global Constraints

- Display name regex, identical client- and server-side: `^[A-Za-z][A-Za-z0-9_]{2,15}$` (letters/digits/underscore, starts with a letter, 3–16 chars, no spaces).
- Uniqueness is case-insensitive (`lower(display_name)`), non-guest rows only.
- The field's user-facing label is **"Display name"** — never "username".
- Guests never see the claim screen and cannot set a name.
- Zustand 5: any multi-field selector MUST use `useShallow` (inline object selectors infinite-loop).
- `npm run test` AND `npm run build` must pass before every commit (`build` catches `noUnusedLocals`; `tsc --noEmit` alone is not enough).
- nvm quirk: do NOT chain npm/npx with `&&` in Bash calls — run each as its own command.
- RPC grant hygiene (match 0013/0014): `revoke ... from public, anon; grant ... to authenticated, service_role`.
- Do not touch the legacy Journey/Practice code paths.

---

### Task 1: Migration `0015_display_names.sql`

**Files:**
- Create: `supabase/migrations/0015_display_names.sql`

**Interfaces:**
- Produces: RPC `set_display_name(p_name text) returns jsonb` → `{"ok": true, "display_name": "..."}` or `{"ok": false, "reason": "invalid" | "guest" | "taken"}`. Task 3's `api.ts` wrapper consumes this shape verbatim.
- Produces: `get_stagger_leaderboard` now excludes null-name profiles from the ranked population (payload shape unchanged).

There is no client-side test harness for SQL; verification is review + (if a local Supabase stack is configured) a reset. The SQL below is complete — copy it exactly.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0015_display_names.sql
--
-- Display names become real: the 0002 trigger's 'Player' placeholder is
-- retired, names are unique (case-insensitively) across ranked players, and
-- claiming/editing goes through one validated RPC. Profiles that haven't
-- claimed a name yet (the backfilled pre-0015 accounts) disappear from the
-- leaderboard until they claim — then their existing stats reappear under
-- the real name (stats survive; nothing is wiped).

-- 1. Backfill: the ~3 pre-0015 accounts all carry the trigger default.
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
```

- [ ] **Step 2: Verify locally if a local stack is configured**

Run: `npx supabase status` (own Bash call, no chaining).
If it reports a running local stack: run `npx supabase db reset` and confirm all 15 migrations apply cleanly. If no local stack (command errors / not configured), skip — the SQL is deploy-time verified.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0015_display_names.sql
git commit -m "DB: display names — unique index, set_display_name RPC, unnamed profiles off the board"
```

---

### Task 2: `src/lib/displayName.ts` — shared validation (TDD)

**Files:**
- Create: `src/lib/displayName.ts`
- Test: `tests/lib/displayName.test.ts`

**Interfaces:**
- Produces:
  - `DISPLAY_NAME_REGEX: RegExp`
  - `type NameValidation = { ok: true; name: string } | { ok: false; reason: NameRuleReason }` where `type NameRuleReason = 'empty' | 'tooShort' | 'tooLong' | 'badStart' | 'badChars'`
  - `validateDisplayName(raw: string): NameValidation` (trims first; `name` is the trimmed value)
  - `NAME_RULE_MESSAGES: Record<NameRuleReason, string>` (user-facing copy)
  - `sanitizeSuggestion(raw: string | null | undefined): string` (strips to allowed charset, drops leading non-letters, clips to 16; returns `''` when < 3 chars survive)
- Consumed by Tasks 4 (store), 6 (form).

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/displayName.test.ts
import { describe, it, expect } from 'vitest'
import { validateDisplayName, sanitizeSuggestion, NAME_RULE_MESSAGES } from '../../src/lib/displayName'

describe('validateDisplayName', () => {
  it('accepts a plain handle and returns the trimmed name', () => {
    expect(validateDisplayName('  NeonRider ')).toEqual({ ok: true, name: 'NeonRider' })
    expect(validateDisplayName('lou99')).toEqual({ ok: true, name: 'lou99' })
    expect(validateDisplayName('neon_rider_99')).toEqual({ ok: true, name: 'neon_rider_99' })
  })

  it('rejects empties and whitespace-only input as empty', () => {
    expect(validateDisplayName('')).toEqual({ ok: false, reason: 'empty' })
    expect(validateDisplayName('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('enforces 3–16 chars (after trim)', () => {
    expect(validateDisplayName('ab')).toEqual({ ok: false, reason: 'tooShort' })
    expect(validateDisplayName('a'.repeat(17))).toEqual({ ok: false, reason: 'tooLong' })
    expect(validateDisplayName('abc').ok).toBe(true)
    expect(validateDisplayName('a'.repeat(16)).ok).toBe(true)
  })

  it('must start with a letter', () => {
    expect(validateDisplayName('9lives')).toEqual({ ok: false, reason: 'badStart' })
    expect(validateDisplayName('_lou')).toEqual({ ok: false, reason: 'badStart' })
  })

  it('rejects spaces and special characters (no "A B C D E F" junk)', () => {
    expect(validateDisplayName('A B C D E F')).toEqual({ ok: false, reason: 'badChars' })
    expect(validateDisplayName('lou.alejo')).toEqual({ ok: false, reason: 'badChars' })
    expect(validateDisplayName('lou-alejo')).toEqual({ ok: false, reason: 'badChars' })
    expect(validateDisplayName('lou😀')).toEqual({ ok: false, reason: 'badChars' })
  })

  it('has user-facing copy for every reason', () => {
    for (const reason of ['empty', 'tooShort', 'tooLong', 'badStart', 'badChars'] as const) {
      expect(NAME_RULE_MESSAGES[reason].length).toBeGreaterThan(0)
    }
  })
})

describe('sanitizeSuggestion', () => {
  it('strips a dotted email prefix to a valid handle', () => {
    expect(sanitizeSuggestion('lou.m.alejo')).toBe('loumalejo')
  })
  it('strips spaces from a Google full name', () => {
    expect(sanitizeSuggestion('Luis Alejo')).toBe('LuisAlejo')
  })
  it('drops leading non-letters and clips to 16', () => {
    expect(sanitizeSuggestion('99problems')).toBe('problems')
    expect(sanitizeSuggestion('a'.repeat(20))).toBe('a'.repeat(16))
  })
  it('returns empty string when nothing usable survives', () => {
    expect(sanitizeSuggestion('日本語')).toBe('')
    expect(sanitizeSuggestion('12')).toBe('')
    expect(sanitizeSuggestion(null)).toBe('')
    expect(sanitizeSuggestion(undefined)).toBe('')
  })
  it('always produces a valid name or empty', () => {
    for (const raw of ['lou.m.alejo', 'Luis Alejo', '99problems', '日本語', 'x']) {
      const s = sanitizeSuggestion(raw)
      if (s !== '') expect(validateDisplayName(s).ok).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/displayName.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/displayName`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/displayName.ts
//
// The ONE definition of what a valid display name is, mirrored verbatim by
// the set_display_name RPC (migration 0015). Handle-style on purpose: no
// spaces (blocks "A B C D E F"-style board junk), no specials beyond
// underscore, uniqueness normalization stays trivial (lower()).

export const DISPLAY_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{2,15}$/

export type NameRuleReason = 'empty' | 'tooShort' | 'tooLong' | 'badStart' | 'badChars'

export type NameValidation =
  | { ok: true; name: string }
  | { ok: false; reason: NameRuleReason }

export const NAME_RULE_MESSAGES: Record<NameRuleReason, string> = {
  empty: 'Pick a display name',
  tooShort: 'At least 3 characters',
  tooLong: 'At most 16 characters',
  badStart: 'Must start with a letter',
  badChars: 'Letters, numbers and underscores only',
}

/** Validates raw input (trimming first). The specific broken rule comes back
 *  as `reason` so forms can show targeted copy, not a generic error. */
export function validateDisplayName(raw: string): NameValidation {
  const name = raw.trim()
  if (name.length === 0) return { ok: false, reason: 'empty' }
  if (name.length < 3) return { ok: false, reason: 'tooShort' }
  if (name.length > 16) return { ok: false, reason: 'tooLong' }
  if (!/^[A-Za-z]/.test(name)) return { ok: false, reason: 'badStart' }
  if (!DISPLAY_NAME_REGEX.test(name)) return { ok: false, reason: 'badChars' }
  return { ok: true, name }
}

/** Turns a Google full name / email prefix into a prefill suggestion:
 *  strips everything outside the charset, drops leading non-letters, clips
 *  to 16. Empty string when fewer than 3 chars survive — the form starts
 *  blank rather than pre-broken. */
export function sanitizeSuggestion(raw: string | null | undefined): string {
  if (!raw) return ''
  const clipped = raw
    .replace(/[^A-Za-z0-9_]/g, '')
    .replace(/^[^A-Za-z]+/, '')
    .slice(0, 16)
  return clipped.length >= 3 ? clipped : ''
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/displayName.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/displayName.ts tests/lib/displayName.test.ts
git commit -m "Lib: display-name validation + prefill sanitizer (mirrors the 0015 RPC rules)"
```

---

### Task 3: `api.ts` wrappers — `getOwnProfile` + `setDisplayName`

**Files:**
- Modify: `src/lib/api.ts` (append after `getStaggerLeaderboard`)

**Interfaces:**
- Consumes: RPC/table contracts from Task 1.
- Produces (consumed by Task 4's store; tested through the store's tests with this module mocked — same convention as every other `api.ts` wrapper):
  - `interface OwnProfile { displayName: string | null; isGuest: boolean }`
  - `getOwnProfile(): Promise<OwnProfile | null>` — RLS-scoped read of the caller's own `profiles` row (`null` if no row visible)
  - `type SetDisplayNameResult = { ok: true; displayName: string } | { ok: false; reason: 'invalid' | 'taken' | 'guest' }`
  - `setDisplayName(name: string): Promise<SetDisplayNameResult>`

- [ ] **Step 1: Append the wrappers**

```ts
/** The caller's own profiles row. RLS ("own profile", migration 0003) scopes
 *  the select to auth.uid(), so no explicit id filter is needed. Null when
 *  no row is visible (no session, or the trigger somehow skipped —
 *  set_display_name self-heals the latter). */
export interface OwnProfile {
  displayName: string | null
  isGuest: boolean
}

export async function getOwnProfile(): Promise<OwnProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name,is_guest')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { displayName: data.display_name, isGuest: data.is_guest }
}

/** Claims/edits the caller's display name via the 0015 RPC. Validation and
 *  uniqueness are decided server-side; `taken`/`invalid`/`guest` come back
 *  as typed results (not thrown) so forms can render inline errors. */
export type SetDisplayNameResult =
  | { ok: true; displayName: string }
  | { ok: false; reason: 'invalid' | 'taken' | 'guest' }

export async function setDisplayName(name: string): Promise<SetDisplayNameResult> {
  const { data, error } = await supabase.rpc('set_display_name', { p_name: name })
  if (error) throw error
  const raw = data as { ok: boolean; display_name?: string; reason?: 'invalid' | 'taken' | 'guest' }
  return raw.ok
    ? { ok: true, displayName: raw.display_name as string }
    : { ok: false, reason: raw.reason as 'invalid' | 'taken' | 'guest' }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS (no unused-local or type errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "API: getOwnProfile + setDisplayName wrappers"
```

---

### Task 4: `profileStore` + `routeAfterAuth` (TDD)

**Files:**
- Create: `src/store/profileStore.ts`
- Test: `tests/store/profileStore.test.ts`

**Interfaces:**
- Consumes: `getOwnProfile`, `setDisplayName`, `SetDisplayNameResult` from `../lib/api`; `getUser` from `../lib/auth`; `validateDisplayName` from `../lib/displayName`; `useNavStore` (Task 5 adds `goClaimName` — write this store against that name now; Task 5 lands before the suite is run across both only at final verification, but to keep every commit green, Task 4 MUST be committed AFTER Task 5's navStore change. See Step 0.)
- Produces (consumed by Tasks 5–8):
  - `interface ProfileSnapshot { displayName: string | null; isGuest: boolean; email: string | null; avatarUrl: string | null; authName: string | null }`
  - Store state: `ProfileSnapshot & { loaded: boolean }`
  - `loadProfile(): Promise<ProfileSnapshot | null>` — null when no session
  - `claimDisplayName(raw: string): Promise<SetDisplayNameResult>` — client-validates first (returns `{ok:false, reason:'invalid'}` without a network call), then RPC; on `ok` updates `displayName` in the store
  - `clear(): void`
  - Module-level helper `routeAfterAuth(): Promise<void>` — loads the profile and routes: no session → `goAuth`; non-guest with null name → `goClaimName`; otherwise → `goHome`

- [ ] **Step 0: Ordering note**

Task 5 Step 1 (navStore `claimName`) is a 3-line change with its own test. To keep every commit compiling, do Task 5 Step 1–3 (navStore only) FIRST, then return here. The plan keeps them as separate tasks because they're separately reviewable; the executor just interleaves: navStore change → this task → rest of Task 5.

- [ ] **Step 1: Write the failing test**

```ts
// tests/store/profileStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({
  getOwnProfile: vi.fn(),
  setDisplayName: vi.fn(),
}))
vi.mock('../../src/lib/auth', () => ({
  getUser: vi.fn(),
}))
import * as api from '../../src/lib/api'
import * as auth from '../../src/lib/auth'
import { useProfileStore, routeAfterAuth } from '../../src/store/profileStore'
import { useNavStore } from '../../src/store/navStore'

const luis = {
  data: {
    user: {
      email: 'lou@example.com',
      is_anonymous: false,
      user_metadata: { full_name: 'Luis Alejo', avatar_url: 'https://img/x.png' },
    },
  },
}

beforeEach(() => {
  useProfileStore.getState().clear()
  useNavStore.getState().reset()
  vi.clearAllMocks()
})

describe('profileStore.loadProfile', () => {
  it('merges the auth user (email/avatar/authName) with the profiles row (name/guest)', async () => {
    vi.mocked(auth.getUser).mockResolvedValue(luis as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: 'NeonRider', isGuest: false })
    const snap = await useProfileStore.getState().loadProfile()
    expect(snap).toEqual({
      displayName: 'NeonRider', isGuest: false,
      email: 'lou@example.com', avatarUrl: 'https://img/x.png', authName: 'Luis Alejo',
    })
    expect(useProfileStore.getState().loaded).toBe(true)
    expect(useProfileStore.getState().displayName).toBe('NeonRider')
  })

  it('returns null (and stays unloaded-as-empty) when there is no session', async () => {
    vi.mocked(auth.getUser).mockResolvedValue({ data: { user: null } } as never)
    const snap = await useProfileStore.getState().loadProfile()
    expect(snap).toBeNull()
    expect(api.getOwnProfile).not.toHaveBeenCalled()
  })

  it('treats a missing profiles row as unnamed non-guest (self-heal happens at claim time)', async () => {
    vi.mocked(auth.getUser).mockResolvedValue(luis as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue(null)
    const snap = await useProfileStore.getState().loadProfile()
    expect(snap?.displayName).toBeNull()
    expect(snap?.isGuest).toBe(false)
  })

  it('trusts is_anonymous for guests even without a profiles row', async () => {
    vi.mocked(auth.getUser).mockResolvedValue({
      data: { user: { email: null, is_anonymous: true, user_metadata: {} } },
    } as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue(null)
    const snap = await useProfileStore.getState().loadProfile()
    expect(snap?.isGuest).toBe(true)
  })
})

describe('profileStore.claimDisplayName', () => {
  it('rejects invalid input client-side without a network call', async () => {
    const res = await useProfileStore.getState().claimDisplayName('A B C')
    expect(res).toEqual({ ok: false, reason: 'invalid' })
    expect(api.setDisplayName).not.toHaveBeenCalled()
  })

  it('claims via the RPC (trimmed) and updates the store on ok', async () => {
    vi.mocked(api.setDisplayName).mockResolvedValue({ ok: true, displayName: 'NeonRider' })
    const res = await useProfileStore.getState().claimDisplayName('  NeonRider ')
    expect(api.setDisplayName).toHaveBeenCalledWith('NeonRider')
    expect(res.ok).toBe(true)
    expect(useProfileStore.getState().displayName).toBe('NeonRider')
  })

  it('passes "taken" through without touching the store', async () => {
    vi.mocked(api.setDisplayName).mockResolvedValue({ ok: false, reason: 'taken' })
    const res = await useProfileStore.getState().claimDisplayName('NeonRider')
    expect(res).toEqual({ ok: false, reason: 'taken' })
    expect(useProfileStore.getState().displayName).toBeNull()
  })
})

describe('routeAfterAuth', () => {
  it('routes an unnamed non-guest to the claim gate', async () => {
    vi.mocked(auth.getUser).mockResolvedValue(luis as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: null, isGuest: false })
    await routeAfterAuth()
    expect(useNavStore.getState().appView).toBe('claimName')
  })

  it('routes a named player home', async () => {
    vi.mocked(auth.getUser).mockResolvedValue(luis as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: 'NeonRider', isGuest: false })
    await routeAfterAuth()
    expect(useNavStore.getState().appView).toBe('home')
  })

  it('routes guests straight home — no gate', async () => {
    vi.mocked(auth.getUser).mockResolvedValue({
      data: { user: { email: null, is_anonymous: true, user_metadata: {} } },
    } as never)
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: null, isGuest: true })
    await routeAfterAuth()
    expect(useNavStore.getState().appView).toBe('home')
  })

  it('routes to auth when there is no session', async () => {
    vi.mocked(auth.getUser).mockResolvedValue({ data: { user: null } } as never)
    useNavStore.setState({ appView: 'home' })
    await routeAfterAuth()
    expect(useNavStore.getState().appView).toBe('auth')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/store/profileStore.test.ts`
Expected: FAIL — cannot resolve `../../src/store/profileStore`.

- [ ] **Step 3: Write the implementation**

```ts
// src/store/profileStore.ts
//
// Single source of truth for WHO the player is on screen. The name comes
// only from public.profiles (the leaderboard's source), never from auth
// metadata — that split is exactly what had the menu saying "Luis Alejo"
// while the board said "Player". Auth metadata still contributes email,
// avatar art, and the prefill suggestion (authName).
import { create } from 'zustand'
import { getOwnProfile, setDisplayName, type SetDisplayNameResult } from '../lib/api'
import { getUser } from '../lib/auth'
import { validateDisplayName } from '../lib/displayName'
import { useNavStore } from './navStore'

export interface ProfileSnapshot {
  displayName: string | null
  isGuest: boolean
  email: string | null
  avatarUrl: string | null
  /** Auth-metadata name (Google full name etc.) — prefill fodder, never shown. */
  authName: string | null
}

interface ProfileState extends ProfileSnapshot {
  loaded: boolean
  loadProfile: () => Promise<ProfileSnapshot | null>
  claimDisplayName: (raw: string) => Promise<SetDisplayNameResult>
  clear: () => void
}

const EMPTY: ProfileSnapshot & { loaded: boolean } = {
  loaded: false, displayName: null, isGuest: false, email: null, avatarUrl: null, authName: null,
}

export const useProfileStore = create<ProfileState>((set) => ({
  ...EMPTY,

  loadProfile: async () => {
    const { data } = await getUser()
    if (!data.user) {
      set({ ...EMPTY })
      return null
    }
    const m = data.user.user_metadata ?? {}
    // is_anonymous decides guesthood even before a profiles row exists;
    // a missing row otherwise reads as "unnamed non-guest" and the claim
    // RPC self-heals it on submit.
    const row = await getOwnProfile()
    const snap: ProfileSnapshot = {
      displayName: row?.displayName ?? null,
      isGuest: row?.isGuest ?? (data.user.is_anonymous ?? false),
      email: data.user.email ?? null,
      avatarUrl: (m.avatar_url || m.picture || null) as string | null,
      authName: (m.full_name || m.name || null) as string | null,
    }
    set({ ...snap, loaded: true })
    return snap
  },

  claimDisplayName: async (raw) => {
    const v = validateDisplayName(raw)
    if (!v.ok) return { ok: false, reason: 'invalid' }
    const res = await setDisplayName(v.name)
    if (res.ok) set({ displayName: res.displayName })
    return res
  },

  clear: () => set({ ...EMPTY }),
}))

/** The one post-auth router: session → (claim gate | home), no session → auth.
 *  Used by App's mount effect AND AuthScreen's email/guest paths, so every
 *  entrance goes through the same gate. */
export async function routeAfterAuth(): Promise<void> {
  const snap = await useProfileStore.getState().loadProfile()
  const nav = useNavStore.getState()
  if (!snap) { nav.goAuth(); return }
  if (!snap.isGuest && snap.displayName === null) nav.goClaimName()
  else nav.goHome()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/store/profileStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (combined with Task 5 Step 1's navStore change if interleaved as noted)

```bash
git add src/store/profileStore.ts tests/store/profileStore.test.ts
git commit -m "Store: profileStore (profiles-backed identity) + routeAfterAuth gate"
```

---

### Task 5: `claimName` view — navStore, App gate, AuthScreen routing (TDD)

**Files:**
- Modify: `src/store/navStore.ts` (add `'claimName'` to `AppView`, add `goClaimName`)
- Modify: `src/App.tsx` (gate on mount, route the view, suppress menu)
- Modify: `src/components/AuthScreen.tsx` (route via `routeAfterAuth`)
- Test: `tests/components/App.test.tsx` (extend)

**Interfaces:**
- Consumes: `routeAfterAuth` from Task 4; `ClaimNameScreen` from Task 6 (see Step 4 note — a placeholder-free ordering is preserved by doing Task 6's screen file in the same commit series; App's `case 'claimName'` line lands in Task 6).
- Produces: `useNavStore.getState().goClaimName()` sets `appView: 'claimName'`.

- [ ] **Step 1: navStore — add the view**

In `src/store/navStore.ts`:
1. `AppView` union: change the second line to
   ```ts
   | 'leaderboard' | 'soundDesign' | 'claimName'
   ```
2. Interface: add `goClaimName: () => void` after `goLeaderboard`.
3. Store body: add `goClaimName: () => set({ appView: 'claimName' }),` after `goLeaderboard`.

- [ ] **Step 2: Run existing suite to confirm nothing broke**

Run: `npm run test -- tests/store`
Expected: PASS.

- [ ] **Step 3: Commit navStore (with Task 4's store, per the ordering note)**

If following the interleave: this was already committed with Task 4. Otherwise:

```bash
git add src/store/navStore.ts
git commit -m "Nav: claimName view"
```

- [ ] **Step 4: Write the failing App gate test**

Extend `tests/components/App.test.tsx`. Replace the two `vi.mock` blocks at the top with (adds profile mocks):

```ts
vi.mock('../../src/lib/auth', () => ({
  getSession: vi.fn(),
  getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
  signOut: vi.fn(),
}))
// Keep the journey/leaderboard screens from hitting the network in this routing test.
vi.mock('../../src/lib/api', () => ({
  getJourney: vi.fn().mockResolvedValue([]),
  getStaggerLeaderboard: vi.fn().mockResolvedValue({ total: 0, top: [], me: null }),
  getOwnProfile: vi.fn().mockResolvedValue(null),
  setDisplayName: vi.fn(),
}))
import * as auth from '../../src/lib/auth'
import * as api from '../../src/lib/api'
import App from '../../src/App'
import { useNavStore } from '../../src/store/navStore'
import { useProfileStore } from '../../src/store/profileStore'
```

Add to `beforeEach`: `useProfileStore.getState().clear()`.

Update the existing "routes to the Home landing page" test — the session-exists path now also needs a user + named profile:

```ts
  it('routes to the Home landing page when a session exists and the profile is named', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    ;(auth.getUser as any).mockResolvedValue({
      data: { user: { email: 'lou@example.com', is_anonymous: false, user_metadata: {} } },
    })
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: 'NeonRider', isGuest: false })
    render(<App />)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('home'))
  })
```

Apply the same `getUser` + `getOwnProfile` mocks inside the leaderboard-view test (it also goes through the gate).

Add the two new cases:

```ts
  it('gates an unnamed non-guest into the claim screen before Home', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    ;(auth.getUser as any).mockResolvedValue({
      data: { user: { email: 'lou@example.com', is_anonymous: false, user_metadata: {} } },
    })
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: null, isGuest: false })
    render(<App />)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('claimName'))
    expect(await screen.findByText(/Choose your display name/i)).toBeInTheDocument()
    // It's a gate: the global menu is suppressed here.
    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument()
  })

  it('guests skip the gate and land on Home unnamed', async () => {
    ;(auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'g1' } } } })
    ;(auth.getUser as any).mockResolvedValue({
      data: { user: { email: null, is_anonymous: true, user_metadata: {} } },
    })
    vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: null, isGuest: true })
    render(<App />)
    await waitFor(() => expect(useNavStore.getState().appView).toBe('home'))
  })
```

- [ ] **Step 5: Run to verify the new cases fail**

Run: `npm run test -- tests/components/App.test.tsx`
Expected: FAIL — gate not implemented (`appView` stays `home` / `Choose your display name` not found).

- [ ] **Step 6: Implement — App.tsx**

```tsx
// src/App.tsx — changed parts only. Imports: add
import { routeAfterAuth } from './store/profileStore'
import { ClaimNameScreen } from './components/ClaimNameScreen'

// Mount effect: replace the getSession().then(...) body with the shared
// post-auth router (it handles all three destinations):
  useEffect(() => {
    let cancelled = false
    getSession()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.session) void routeAfterAuth()
        else goAuth()
      })
      .catch(() => { if (!cancelled) goAuth() })
    return () => { cancelled = true }
  }, [goAuth])

// View switch: add above the leaderboard case
      case 'claimName': return <ClaimNameScreen />

// Menu suppression: the claim gate has no menu (nothing to navigate to yet)
  const showMenu = appView !== 'auth' && appView !== 'claimName'
    && appView !== 'stagger' && appView !== 'training'
```

(`goHome` leaves the destructured navStore selector since the effect no longer uses it — remove it from the `useShallow` selector to satisfy `noUnusedLocals`.)

Note: this step compiles only once Task 6's `ClaimNameScreen` file exists. Executor: create Task 6's screen (and its test) before running this task's test — the two tasks land as consecutive commits, App last. This is the one intentional cross-task compile dependency.

- [ ] **Step 7: Implement — AuthScreen.tsx**

```tsx
// src/components/AuthScreen.tsx — changed parts only.
import { routeAfterAuth } from '../store/profileStore'

export function AuthScreen() {
  // DELETE: const goHome = useNavStore(s => s.goHome)  (and the now-unused
  // useNavStore import if nothing else uses it)
  ...
  const run = async (fn: () => Promise<{ error: { message: string } | null }>, navigate: boolean) => {
    setError(null)
    setBusy(true)
    try {
      const { error } = await track(fn())
      if (error) { setError(error.message); return }
      if (navigate) await routeAfterAuth()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }
```

(Google OAuth keeps `navigate: false` — the full-page redirect re-enters through App's mount effect, which now routes through the same gate.)

- [ ] **Step 8: Run the full component suites**

Run: `npm run test -- tests/components/App.test.tsx tests/components/AuthScreen.test.tsx`
Expected: PASS. If `AuthScreen.test.tsx` asserted `goHome`/`appView === 'home'` after email sign-in, update those assertions to mock `getOwnProfile` (named profile) and expect `home` — the behavior for a named player is unchanged.

- [ ] **Step 9: Commit** (lands after Task 6's screen commit — see Step 6 note)

```bash
git add src/App.tsx src/components/AuthScreen.tsx tests/components/App.test.tsx tests/components/AuthScreen.test.tsx
git commit -m "App: claim-name gate — every entrance routes through routeAfterAuth"
```

---

### Task 6: `DisplayNameForm` + `ClaimNameScreen` (TDD)

**Files:**
- Create: `src/components/DisplayNameForm.tsx`
- Create: `src/components/ClaimNameScreen.tsx`
- Test: `tests/components/ClaimNameScreen.test.tsx`

**Interfaces:**
- Consumes: `useProfileStore` (`claimDisplayName`, `authName`, `email`, `displayName`), `validateDisplayName`, `NAME_RULE_MESSAGES`, `sanitizeSuggestion` (Tasks 2/4).
- Produces: `DisplayNameForm({ initialName, submitLabel, onDone, onCancel? })` — reused by Task 7's edit overlay. `ClaimNameScreen` — routed by Task 5.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/ClaimNameScreen.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({
  getOwnProfile: vi.fn(),
  setDisplayName: vi.fn(),
}))
vi.mock('../../src/lib/auth', () => ({
  getUser: vi.fn(),
}))
import * as api from '../../src/lib/api'
import { ClaimNameScreen } from '../../src/components/ClaimNameScreen'
import { useProfileStore } from '../../src/store/profileStore'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useProfileStore.getState().clear()
  useNavStore.setState({ appView: 'claimName' })
  vi.clearAllMocks()
})

describe('ClaimNameScreen', () => {
  it('prefills a sanitized suggestion from the auth name and previews initials', () => {
    useProfileStore.setState({ loaded: true, authName: 'Luis Alejo', email: 'lou@example.com', isGuest: false })
    render(<ClaimNameScreen />)
    const input = screen.getByLabelText(/display name/i) as HTMLInputElement
    expect(input.value).toBe('LuisAlejo')
    // Single-word handle → first-two-letters avatar preview.
    expect(screen.getByText('LU')).toBeInTheDocument()
  })

  it('falls back to the email prefix when there is no auth name', () => {
    useProfileStore.setState({ loaded: true, authName: null, email: 'lou.m.alejo@gmail.com', isGuest: false })
    render(<ClaimNameScreen />)
    expect((screen.getByLabelText(/display name/i) as HTMLInputElement).value).toBe('loumalejo')
  })

  it('shows the specific rule violation live and disables submit', async () => {
    useProfileStore.setState({ loaded: true, authName: null, email: null, isGuest: false })
    const user = userEvent.setup()
    render(<ClaimNameScreen />)
    await user.type(screen.getByLabelText(/display name/i), 'A B C')
    expect(screen.getByText(/letters, numbers and underscores only/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /claim name/i })).toBeDisabled()
  })

  it('claims and goes Home on success', async () => {
    useProfileStore.setState({ loaded: true, authName: 'Luis Alejo', email: null, isGuest: false })
    vi.mocked(api.setDisplayName).mockResolvedValue({ ok: true, displayName: 'LuisAlejo' })
    const user = userEvent.setup()
    render(<ClaimNameScreen />)
    await user.click(screen.getByRole('button', { name: /claim name/i }))
    await waitFor(() => expect(useNavStore.getState().appView).toBe('home'))
    expect(useProfileStore.getState().displayName).toBe('LuisAlejo')
  })

  it('renders "taken" inline and stays on the gate', async () => {
    useProfileStore.setState({ loaded: true, authName: 'Luis Alejo', email: null, isGuest: false })
    vi.mocked(api.setDisplayName).mockResolvedValue({ ok: false, reason: 'taken' })
    const user = userEvent.setup()
    render(<ClaimNameScreen />)
    await user.click(screen.getByRole('button', { name: /claim name/i }))
    expect(await screen.findByText(/that name is taken/i)).toBeInTheDocument()
    expect(useNavStore.getState().appView).toBe('claimName')
  })

  it('has no skip affordance — it is a gate', () => {
    useProfileStore.setState({ loaded: true, authName: null, email: null, isGuest: false })
    render(<ClaimNameScreen />)
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/ClaimNameScreen.test.tsx`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement `DisplayNameForm`**

```tsx
// src/components/DisplayNameForm.tsx
//
// The one display-name form, shared by the claim gate and the menu's edit
// overlay. Validation is live (specific rule, not a generic error); server
// verdicts (taken/invalid) render inline under the field. Styling matches
// AuthScreen's lit-hardware inputs.
import { useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { useProfileStore } from '../store/profileStore'
import { validateDisplayName, NAME_RULE_MESSAGES } from '../lib/displayName'
import { track } from '../store/asyncStatus'

function initialsOf(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) return '?'
  return trimmed.slice(0, 2).toUpperCase()
}

const inputClass =
  'w-full h-12 px-3.5 rounded-[11px] bg-[#0a0a12] text-vt-text font-grotesk text-sm ' +
  'border border-white/10 placeholder-vt-faint shadow-[inset_0_1px_2px_#000] ' +
  'focus:outline-none focus:border-vt-cyan ' +
  'focus:shadow-[inset_0_1px_2px_#000,0_0_0_1px_rgba(40,240,255,0.33),0_0_14px_rgba(40,240,255,0.2)] ' +
  'disabled:opacity-50'

export function DisplayNameForm({ initialName, submitLabel, onDone, onCancel }: {
  initialName: string
  submitLabel: string
  onDone: () => void
  onCancel?: () => void
}) {
  const { claimDisplayName } = useProfileStore(useShallow(s => ({ claimDisplayName: s.claimDisplayName })))
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const validation = validateDisplayName(name)
  // 'empty' before first keystroke reads as nagging — hold the message until
  // there's input (the disabled submit still guards it).
  const liveError = !validation.ok && name.trim().length > 0 ? NAME_RULE_MESSAGES[validation.reason] : null
  const canSubmit = validation.ok && !busy

  const submit = async () => {
    if (!validation.ok) return
    setServerError(null)
    setBusy(true)
    try {
      const res = await track(claimDisplayName(name))
      if (res.ok) { onDone(); return }
      setServerError(
        res.reason === 'taken' ? 'That name is taken.'
        : res.reason === 'guest' ? 'Guests can’t set a name — create an account first.'
        : NAME_RULE_MESSAGES.badChars,
      )
    } catch {
      setServerError('Something glitched — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Live initials-avatar preview — same gradient badge as the menu. */}
        <div className="w-12 h-12 shrink-0 rounded-full grid place-items-center font-black text-lg text-white
          bg-gradient-to-br from-neon-cyan to-neon-magenta ring-1 ring-white/15">
          {initialsOf(name)}
        </div>
        <div className="relative flex-1">
          <span className="absolute -top-[7px] left-3 z-10 px-1.5 bg-vt-panel font-grotesk text-[9px] tracking-[0.12em] uppercase text-vt-faint">
            Display name
          </span>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setServerError(null) }}
            disabled={busy}
            aria-label="Display name"
            placeholder="NeonRider"
            maxLength={24}
            autoFocus
            className={inputClass}
          />
        </div>
      </div>

      <p className="font-grotesk text-[10px] tracking-[0.06em] text-vt-faint">
        3–16 characters — letters, numbers and underscores. Shown on the global leaderboard.
      </p>

      {(liveError || serverError) && (
        <p className="font-grotesk text-vt-red text-glow-vt-red text-sm">{serverError ?? liveError}</p>
      )}

      <button
        disabled={!canSubmit}
        onClick={submit}
        className="mt-1 h-12 rounded-[11px] inline-flex items-center justify-center gap-2
          border-2 border-vt-cyan bg-vt-raised text-vt-cyan
          font-grotesk text-[13px] tracking-[0.1em] uppercase
          shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_16px_rgba(40,240,255,0.27)]
          hover:bg-vt-cyan/10 transition-colors active:translate-y-px
          disabled:opacity-50 disabled:pointer-events-none"
      >
        {submitLabel}
      </button>

      {onCancel && (
        <button
          disabled={busy}
          onClick={onCancel}
          className="h-11 rounded-[11px] inline-flex items-center justify-center
            border border-white/10 bg-vt-raised text-vt-dim
            font-grotesk text-[12px] tracking-[0.06em]
            hover:text-vt-text hover:border-white/20 transition-colors active:translate-y-px
            disabled:opacity-50 disabled:pointer-events-none"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implement `ClaimNameScreen`**

```tsx
// src/components/ClaimNameScreen.tsx
//
// The post-auth gate: a non-guest without a display name lands here before
// Home and can't proceed without claiming one (no skip — unnamed players
// can't rank, and "Player" placeholders are exactly what this feature
// retires). AuthScreen's panel language, minus the brand ceremony.
import { useShallow } from 'zustand/shallow'
import { useProfileStore } from '../store/profileStore'
import { useNavStore } from '../store/navStore'
import { sanitizeSuggestion } from '../lib/displayName'
import { DisplayNameForm } from './DisplayNameForm'

export function ClaimNameScreen() {
  const goHome = useNavStore(s => s.goHome)
  const { authName, email } = useProfileStore(useShallow(s => ({
    authName: s.authName,
    email: s.email,
  })))

  const suggestion = sanitizeSuggestion(authName) || sanitizeSuggestion(email?.split('@')[0])

  return (
    <div className="relative min-h-dvh vt-vignette flex items-center justify-center px-6 overflow-hidden">
      <div className="relative w-full max-w-sm rounded-[28px] bg-vt-panel border border-white/5 shadow-[0_40px_90px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] px-7 py-9 flex flex-col items-center">
        <div className="text-center mb-7">
          <h1 className="font-silk text-base text-vt-text uppercase tracking-[0.15em]">
            Choose your display name
          </h1>
          <p className="mt-2.5 font-grotesk text-[10px] tracking-[0.22em] uppercase text-vt-magenta text-glow-vt-magenta">
            This is you on the leaderboard
          </p>
        </div>

        <DisplayNameForm initialName={suggestion} submitLabel="Claim name" onDone={goHome} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- tests/components/ClaimNameScreen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/DisplayNameForm.tsx src/components/ClaimNameScreen.tsx tests/components/ClaimNameScreen.test.tsx
git commit -m "UI: DisplayNameForm + ClaimNameScreen (the post-auth claim gate)"
```

(Then finish Task 5's App/AuthScreen steps and commit them — see Task 5 Step 6 note.)

---

### Task 7: GlobalMenu — profileStore identity + tap-to-edit (TDD)

**Files:**
- Modify: `src/components/GlobalMenu.tsx`
- Test: `tests/components/GlobalMenu.test.tsx` (rework the identity mocks; add edit tests)

**Interfaces:**
- Consumes: `useProfileStore` (all identity fields + `loadProfile` + `clear`), `DisplayNameForm` (Task 6).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Rework the test file's mocks and add failing tests**

In `tests/components/GlobalMenu.test.tsx`:

1. Extend the auth mock and add an api mock (GlobalMenu's identity now flows through profileStore → `getUser` + `getOwnProfile`):

```ts
vi.mock('../../src/lib/auth', () => ({
  getUser: vi.fn().mockResolvedValue({
    data: { user: { email: 'luis@example.com', is_anonymous: false, user_metadata: {} } },
  }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('../../src/lib/api', () => ({
  getOwnProfile: vi.fn().mockResolvedValue({ displayName: 'NeonRider', isGuest: false }),
  setDisplayName: vi.fn(),
}))
import * as api from '../../src/lib/api'
import { useProfileStore } from '../../src/store/profileStore'
```

2. In `beforeEach`, add `useProfileStore.getState().clear()` (before `vi.clearAllMocks()` — and note `vi.clearAllMocks` wipes the `mockResolvedValue` defaults above, so move those defaults into `beforeEach` after the `clearAllMocks` call):

```ts
beforeEach(() => {
  useNavStore.getState().reset()
  useGameStore.getState().resetGame()
  useSettingsStore.setState({ settings: { hideBriefing: {}, mapStyle: 'transit', difficulty: 'easy', soundEnabled: true, sfxVolume: 1 } })
  useTrainingStore.getState().exit()
  useProfileStore.getState().clear()
  vi.clearAllMocks()
  vi.mocked(auth.getUser).mockResolvedValue({
    data: { user: { email: 'luis@example.com', is_anonymous: false, user_metadata: {} } },
  } as never)
  vi.mocked(auth.signOut).mockResolvedValue({ error: null } as never)
  vi.mocked(api.getOwnProfile).mockResolvedValue({ displayName: 'NeonRider', isGuest: false })
})
```

3. Guest-flavored tests: alongside their existing `getUser` override, add
   `vi.mocked(api.getOwnProfile).mockResolvedValueOnce({ displayName: null, isGuest: true })`.

4. Add the new tests:

```ts
  it('shows the profiles display name, not the auth-metadata name', async () => {
    vi.mocked(auth.getUser).mockResolvedValueOnce({
      data: { user: { email: 'luis@example.com', is_anonymous: false, user_metadata: { full_name: 'Luis Alejo' } } },
    } as never)
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(await screen.findByText('NeonRider')).toBeInTheDocument()
    expect(screen.queryByText('Luis Alejo')).not.toBeInTheDocument()
  })

  it('tapping the profile header opens the edit form; saving updates the header', async () => {
    vi.mocked(api.setDisplayName).mockResolvedValue({ ok: true, displayName: 'GapMaster' })
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(await screen.findByRole('button', { name: /edit profile/i }))

    const input = screen.getByLabelText(/display name/i) as HTMLInputElement
    expect(input.value).toBe('NeonRider') // prefilled with the current name
    await user.clear(input)
    await user.type(input, 'GapMaster')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText('GapMaster')).toBeInTheDocument()
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument() // overlay closed
  })

  it('Cancel closes the edit form without saving', async () => {
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(await screen.findByRole('button', { name: /edit profile/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument()
    expect(api.setDisplayName).not.toHaveBeenCalled()
  })

  it('guests have no edit affordance on the header', async () => {
    vi.mocked(auth.getUser).mockResolvedValueOnce({
      data: { user: { email: null, is_anonymous: true, user_metadata: {} } },
    } as never)
    vi.mocked(api.getOwnProfile).mockResolvedValueOnce({ displayName: null, isGuest: true })
    useNavStore.setState({ appView: 'home' })
    const user = userEvent.setup()
    render(<GlobalMenu />)
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(await screen.findByRole('img', { name: /guest avatar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npm run test -- tests/components/GlobalMenu.test.tsx`
Expected: new tests FAIL (menu still reads auth metadata; no edit affordance).

- [ ] **Step 3: Implement the GlobalMenu rework**

Changes to `src/components/GlobalMenu.tsx`:

1. Imports: drop `getUser` (keep `signOut`); add:
```ts
import { useProfileStore } from '../store/profileStore'
import { DisplayNameForm } from './DisplayNameForm'
```
2. Delete `interface MenuUser` and the `getUser` effect + `user` state. Replace with store reads + a mount load:
```ts
  const { loaded, displayName, isGuest, email, avatarUrl, loadProfile, clearProfile } =
    useProfileStore(useShallow(s => ({
      loaded: s.loaded, displayName: s.displayName, isGuest: s.isGuest,
      email: s.email, avatarUrl: s.avatarUrl,
      loadProfile: s.loadProfile, clearProfile: s.clear,
    })))
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!loaded) void loadProfile()
  }, [loaded, loadProfile])

  // The visible identity: profiles.display_name is the truth for players;
  // guests show as Guest; the email prefix only bridges the (unreachable
  // post-gate) unnamed case.
  const name = displayName ?? (isGuest ? 'Guest' : email?.split('@')[0] ?? '')
```
3. `Avatar` keeps its three variants but takes `{ name, avatarUrl, isGuest }` props instead of `MenuUser` (update its body accordingly — same JSX, new prop names).
4. Sign-out clears the profile store:
```ts
  const handleSignOut = async () => { setOpen(false); clearProfile(); await signOut(); resetNav() }
```
5. Header block: render only when `loaded`; non-guests get a button wrapper:
```tsx
          {loaded && (
            isGuest ? (
              <div className="flex items-center gap-3 mb-8">
                <Avatar name={name} avatarUrl={avatarUrl} isGuest />
                <div className="min-w-0">
                  <div className="font-pixel text-sm leading-tight truncate">{name}</div>
                  <div className="text-xs text-gray-400 truncate">Guest session</div>
                </div>
              </div>
            ) : (
              <button
                aria-label="Edit profile"
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-3 mb-8 text-left group"
              >
                <Avatar name={name} avatarUrl={avatarUrl} isGuest={false} />
                <div className="min-w-0">
                  <div className="font-pixel text-sm leading-tight truncate group-hover:text-neon-cyan transition-colors">{name}</div>
                  <div className="text-xs text-gray-400 truncate">{email ?? ''}</div>
                </div>
              </button>
            )
          )}
```
6. Edit overlay — render inside the open menu, after the header block:
```tsx
          {editOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70">
              <div className="relative w-full max-w-sm rounded-[28px] bg-vt-panel border border-white/5 shadow-[0_40px_90px_rgba(0,0,0,0.6)] px-7 py-8">
                <h2 className="font-silk text-sm text-vt-text uppercase tracking-[0.15em] mb-6 text-center">
                  Edit profile
                </h2>
                <DisplayNameForm
                  initialName={displayName ?? ''}
                  submitLabel="Save"
                  onDone={() => setEditOpen(false)}
                  onCancel={() => setEditOpen(false)}
                />
              </div>
            </div>
          )}
```
7. Escape-key effect: closing the menu should also drop the overlay — add `setEditOpen(false)` inside `close()`.

- [ ] **Step 4: Run the menu suite**

Run: `npm run test -- tests/components/GlobalMenu.test.tsx`
Expected: PASS — all pre-existing tests (identity now via mocked `getOwnProfile`) plus the four new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/GlobalMenu.tsx tests/components/GlobalMenu.test.tsx
git commit -m "Menu: identity from profileStore; tap the header to edit your display name"
```

---

### Task 8: Game-over leaderboard link + icon-only pause (TDD where testable)

**Files:**
- Modify: `src/components/StaggerScreen.tsx` (game-over buttons; pause label)
- Modify: `src/components/TrainingScreen.tsx` (pause label)
- Test: `tests/components/StaggerGameOver.test.tsx` (new, minimal)

**Interfaces:**
- Consumes: `useNavStore.goLeaderboard` (exists), `useStaggerStore` state.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing game-over test**

Mirror TrainingScreen.test.tsx's setup style; mock `lib/api` (StaggerScreen submits the run on game over) and drive the store directly:

```tsx
// tests/components/StaggerGameOver.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/lib/api', () => ({
  submitStaggerRun: vi.fn().mockResolvedValue({}),
  getOwnProfile: vi.fn().mockResolvedValue({ displayName: 'NeonRider', isGuest: false }),
  setDisplayName: vi.fn(),
}))
import { StaggerScreen } from '../../src/components/StaggerScreen'
import { useStaggerStore } from '../../src/store/staggerStore'
import { useNavStore } from '../../src/store/navStore'

beforeEach(() => {
  useNavStore.setState({ appView: 'stagger' })
  useStaggerStore.setState({ phase: 'gameOver', mode: 'medium', score: 4200, lives: 0 })
})

describe('StaggerScreen game over', () => {
  it('offers Play again / Leaderboard / Home', async () => {
    render(<StaggerScreen />)
    expect(await screen.findByRole('button', { name: /play again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /leaderboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument()
  })

  it('Leaderboard tears the run down and navigates to the rankings', async () => {
    const user = userEvent.setup()
    render(<StaggerScreen />)
    await user.click(await screen.findByRole('button', { name: /leaderboard/i }))
    expect(useNavStore.getState().appView).toBe('leaderboard')
    expect(useStaggerStore.getState().phase).toBe('idle')
  })
})
```

Executor note: StaggerScreen has never had a component test. If rendering it at `phase: 'gameOver'` trips over unrelated effects (timers, sfx, framer-motion), fix the TEST setup (additional mocks like `vi.mock('../../src/lib/sfx', ...)` with a stub object, or store fields the game-over branch reads — check `recordedRef`/`runHistoryStore` usage around `StaggerScreen.tsx:279`), not the component. If it needs `useRunHistoryStore` state for the graph, leave `currentRunId` unset — the graph block is conditional.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/components/StaggerGameOver.test.tsx`
Expected: FAIL — no `Leaderboard` button on the summary.

- [ ] **Step 3: Implement the game-over button**

In `src/components/StaggerScreen.tsx`:

1. The component already selects from navStore; add `goLeaderboard` wherever `goHome` is obtained (keep `useShallow` if it becomes an object selector).
2. Game-over button stack (currently `Play again` + `Home` in a `w-44` column) becomes:

```tsx
            <div className="flex flex-col gap-3 w-44 pointer-events-auto">
              <NeonButton variant="primary" fullWidth onClick={() => startRun(mode)}>Play again</NeonButton>
              {/* The post-run itch the summary creates — "where did that
                  rank?" — gets its own door. Lands on this run's mode tab:
                  the board opens on the persisted difficulty, which is what
                  this run was started with. */}
              <NeonButton variant="ghost" fullWidth onClick={() => { exit(); goLeaderboard() }}>Leaderboard</NeonButton>
              <NeonButton variant="ghost" fullWidth onClick={() => { exit(); goHome() }}>Home</NeonButton>
            </div>
```

- [ ] **Step 4: Icon-only pause — both screens**

In BOTH `src/components/StaggerScreen.tsx` and `src/components/TrainingScreen.tsx`, the pause `<button>` currently renders a two-bar icon span + the text `Pause`. Change each to:

1. Delete the trailing text node `Pause` (keep `aria-label="Pause"` — the existing tests query by accessible name, which the aria-label still provides).
2. Grow the bars so the button doesn't look empty: on the two inner `<span>`s, change `w-[3px] h-3.5` → `w-[5px] h-4`.
3. On the outer icon wrapper span, change `gap-[3px]` → `gap-[4px]`.

The button keeps its full-width frame, border, and paddings — it reads as the same control, just wordless (the universal two-bar glyph carries it).

- [ ] **Step 5: Run the affected suites**

Run: `npm run test -- tests/components/StaggerGameOver.test.tsx tests/components/TrainingScreen.test.tsx`
Expected: PASS (TrainingScreen's pause tests query `{ name: /Pause/i }` → still matched via aria-label).

- [ ] **Step 6: Commit**

```bash
git add src/components/StaggerScreen.tsx src/components/TrainingScreen.tsx tests/components/StaggerGameOver.test.tsx
git commit -m "Game over: Leaderboard link on the summary; pause buttons go icon-only"
```

---

### Task 9: Docs, full verification, push

**Files:**
- Modify: `CLAUDE.md` (entry-flow section)

- [ ] **Step 1: Update CLAUDE.md's "Entry flow" paragraph**

Weave in (matching the surrounding prose style, don't bolt on a new section):
- After auth, non-guests without a `display_name` are gated into `ClaimNameScreen` (`routeAfterAuth` in `src/store/profileStore.ts`) before Home; guests skip it.
- Display names: unique (case-insensitive), `^[A-Za-z][A-Za-z0-9_]{2,15}$`, claimed/edited via the `set_display_name` RPC (migration `0015`); the menu header is tap-to-edit; `profileStore` is the single source of identity truth (the menu no longer reads auth metadata for the name).
- Leaderboard hides unclaimed profiles; game-over summary links to the leaderboard.
- File-map bullets: add `profileStore.ts`, `displayName.ts`, `ClaimNameScreen.tsx`, `DisplayNameForm.tsx`.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: ALL suites pass. Fix anything red before proceeding (do not skip/weaken tests).

- [ ] **Step 3: Build (type-check + noUnusedLocals)**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Lint if configured**

Run: `npm run lint` (skip silently if no such script).

- [ ] **Step 5: Commit + pull + push**

```bash
git add CLAUDE.md
git commit -m "Docs: display-name gate + profile editing in the project map"
git pull --no-rebase --no-edit
```

Then run `npm run test` once more if the pull merged anything; then:

```bash
git push
```

(Parallel sessions are active on this repo — the pull-before-push is not optional.)
