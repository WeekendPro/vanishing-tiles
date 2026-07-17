# Display Names + Profile — Design

**Date:** 2026-07-16
**Status:** Approved (brainstormed with Luis)

## Problem

Every leaderboard row reads "Player" — the `profiles.display_name` column exists but the
`handle_new_user` trigger (migration `0002`) defaults it to `'Player'` and nothing ever sets a
real value. Meanwhile the hamburger menu ignores `profiles` entirely and derives a name from
Supabase auth metadata (Google name / email prefix), so the menu and the leaderboard disagree.
There is also no way for a player to set or change any profile detail.

## Goals

1. Every ranked (non-guest) player has a unique, validated **display name** — the term is
   "display name", not "username", so it isn't confused with the email used to sign in.
2. New sign-ups (email or Google OAuth) claim a display name before reaching Home.
3. Players can edit their display name later.
4. The leaderboard and hamburger menu show the same name, from one source of truth.
5. Small tweaks riding along: game-over screen links to the leaderboard; the in-game and
   training pause buttons are icon-only.

## Non-goals

- Avatar image upload (deliberately deferred — the initials avatar stays; a single-letter
  avatar from a one-word name is acceptable and intended).
- Guest display names — guests stay anonymous (person-icon avatar) and unranked; they pick a
  name only after converting to a real account.
- Any other profile fields (bio, country, etc.).

## Validation rules (display name)

- Charset: letters, digits, underscore. **No spaces** (prevents "A B C D E F"-style junk and
  keeps validation/normalization simple).
- Must start with a letter.
- Length 3–16 characters (after trimming).
- Regex, enforced identically client- and server-side: `^[A-Za-z][A-Za-z0-9_]{2,15}$`
- Uniqueness is **case-insensitive** (`lower(display_name)`), enforced by a partial unique
  index over non-guest rows with non-null names.

## Architecture (chosen: Postgres RPC claim)

Considered: (A) security-definer RPC, (B) direct table update under RLS + constraint-error
parsing, (C) edge function. **A** was chosen — it matches the existing `record_stagger_run` /
`get_stagger_leaderboard` RPC pattern, makes the claim atomic via the unique index, and returns
typed errors the form can render without parsing raw Postgres errors. B leaks constraint
violations into the client; C adds a deploy surface for one SQL statement.

### Migration `0015_display_names.sql`

1. **Backfill:** `update public.profiles set display_name = null where display_name = 'Player'`.
   (~3 existing accounts; their stats survive — no wipe. Luis OK'd either; backfill chosen as
   the less destructive equivalent.)
2. **Unique index:** `create unique index profiles_display_name_unique on
   public.profiles (lower(display_name)) where not is_guest and display_name is not null;`
3. **Trigger:** re-create `handle_new_user` without the `'Player'` fallback — new profiles get
   `display_name = null` (still honors an explicit `raw_user_meta_data->>'display_name'` if
   present).
4. **RPC:** `set_display_name(p_name text) returns jsonb`, `security definer`:
   - trims input; validates the regex; rejects guests (`is_guest`) and unauthenticated callers;
   - upserts the caller's row (`insert … on conflict (id) do update`, so a missing profile
     row self-heals); catches `unique_violation`;
   - returns `{"ok": true, "display_name": "..."}` or `{"ok": false, "reason": "invalid" | "taken" | "guest"}`;
   - grants: revoke from `public, anon`; grant to `authenticated, service_role` (same hygiene
     as 0013/0014).
5. **Leaderboard RPC:** re-create `get_stagger_leaderboard` with
   `and p.display_name is not null` added to the ranked population, so backfilled-but-unclaimed
   accounts are hidden from the board (they reappear under their real name once they claim,
   stats intact). Payload shape unchanged.

## Client

### `profileStore` (new Zustand store) — single source of truth

State: `{ loaded: boolean, displayName: string | null, isGuest: boolean, email: string | null,
avatarUrl: string | null }`.
Actions: `loadProfile()` (session + own `profiles` row), `claimDisplayName(name)` (calls the
RPC, updates state, returns the typed result), `clear()` (on sign-out).
`avatarUrl` keeps coming from Google auth metadata as fallback art; the **name** comes only
from `profiles`. GlobalMenu switches to this store — fixing the menu/leaderboard mismatch.

Shared validation helper `src/lib/displayName.ts`: `validateDisplayName(raw): { ok: true,
name: string } | { ok: false, reason: string }` + `sanitizeSuggestion(raw)` (strips a Google
full name / email prefix down to the allowed charset, e.g. `lou.m.alejo` → `loumalejo`;
returns `''` if nothing survives). Unit-tested.

### Gate (App.tsx + navStore)

New `appView: 'claimName'`. After the session resolves, `loadProfile()`; route:
- no session → `auth`
- session, `!isGuest && displayName === null` → `claimName`
- otherwise → `home`

The gate also runs after sign-in/sign-up from AuthScreen (any path that lands on Home).
GlobalMenu is suppressed on `claimName` (like `auth`). There is **no skip** — it's a gate.

### ClaimNameScreen

AuthScreen's visual language (same panel, inputs, neon buttons — modern-arcadey, not
over-indexed on arcade). Contents:
- Title: **"Choose your display name"**; subtext: shown on the global leaderboard.
- One field labeled **Display name**, prefilled with `sanitizeSuggestion(googleName ?? emailPrefix)`.
- Live initials-avatar preview beside the field (same gradient avatar as the menu).
- Client validation live (helper line turns red with the specific rule broken); server
  `taken` renders "That name is taken."
- Submit → `claimDisplayName` → on `ok`, `goHome()`.

### Edit profile

The avatar + name header in `GlobalMenu` becomes a button (non-guests only) opening the same
form as an overlay in edit mode: current name prefilled, **Save / Cancel**. Same store action,
RPC, and validation. Success updates the store; menu header re-renders immediately.

### Small tweaks

- **Game over → leaderboard:** add a `Leaderboard` NeonButton between `Play again` and `Home`
  on the StaggerScreen game-over summary; `exit(); goLeaderboard()`. LeaderboardScreen already
  opens on the persisted difficulty, which always equals the finished run's mode (snapshotted
  at `startRun`, only changeable from Home) — no mode plumbing needed.
- **Icon-only pause:** StaggerScreen and TrainingScreen pause buttons drop the "Pause" text,
  keep `aria-label="Pause"`, and scale the existing two-bar icon up slightly.

## Error handling

- RPC failures (network): form shows a generic retry error; the gate never strands the user —
  retry stays available.
- Race on claim: unique index wins; loser sees `taken` inline and picks another name.
- Profile row missing (trigger somehow skipped): `loadProfile()` treats it as
  `displayName: null` → user lands on the claim screen, and `set_display_name` upserts.

## Testing

- Unit: `validateDisplayName` (charset, spaces rejected, length bounds, leading-char rule,
  trim), `sanitizeSuggestion`.
- Store/gate: null name + non-guest → `claimName`; guest → `home`; claim success → `home`.
- Full suite `npm run test` and `npm run build` must pass before commit (build catches
  `noUnusedLocals`).

## Files touched

| Area | Files |
|---|---|
| DB | `supabase/migrations/0015_display_names.sql` |
| API | `src/lib/api.ts` (setDisplayName call), `src/lib/displayName.ts` (new) |
| State | `src/store/profileStore.ts` (new), `src/store/navStore.ts` (claimName view) |
| Screens | `src/components/ClaimNameScreen.tsx` (new), `src/App.tsx` (gate), `src/components/GlobalMenu.tsx` (store + edit overlay) |
| Tweaks | `src/components/StaggerScreen.tsx` (leaderboard button, icon-only pause), `src/components/TrainingScreen.tsx` (icon-only pause) |
