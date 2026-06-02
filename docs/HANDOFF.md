# Gap City — Handoff

_Last updated: 2026-05-31. Living document — edit as the project moves._

This is the onboarding doc for the next person/agent. It has two parts:

- **Part 1 — Get the live deployment working** (blocking; do this first).
- **Part 2 — Product roadmap** (what to build next, in order).

Read `CLAUDE.md` first for stack, architecture, and the critical agent rules
(Zustand `useShallow`, solver correctness, scoring guards, nvm chained-command
quirk, "verify with `npm run build`, not just tsc").

---

## Current state (snapshot)

- **Web POC: complete and playable** locally (`npm run dev`).
- **Practice mode** (offline, client-side puzzle/solver/scoring) — done.
- **Journey mode** (server-authoritative) — built and verified locally:
  seed-based authority (seed never leaves the server), 3 tries per session on
  the same puzzle, server-side `solve`/`bestFit`/scoring, results UI with pillar
  bars, level map + level-detail modal.
- **Backend lives only on local Docker Supabase.** Nothing is deployed to the
  cloud. ← _this is why the Vercel link is dead; see Part 1._
- Tests: `npm run test` → 173 passing. Build: `npm run build` clean.
- Repo: `github.com/WeekendPro/mind-the-gap`, default branch `main`.

### Known follow-ups / open decisions
- **Unplayed "Your Best" shows `0`** in the level-detail modal (the `get_level`
  RPC coalesces null → 0). Open question: show `—` instead, for consistency
  with Global Best / Last played. Decide and apply if desired.
- Over-selection (correct pieces + an extra) scores 0 with 100% coverage — this
  is **intended** (`solve` requires an exact cover using all selected pieces);
  the results copy now explains it. Not a bug.

---

## Part 1 — Get the live deployment working

### Root cause (confirmed)
The Vercel deployment is **frontend-only**. There is no cloud Supabase project:

- `.env.local` → `VITE_SUPABASE_URL=http://127.0.0.1:54321` (localhost).
- Supabase CLI is **not linked** to a cloud project and **not logged in**.
- DB schema, Auth, and both Edge Functions (`start_session`, `submit_attempt`)
  exist only in local Docker.

`src/lib/supabase.ts` runs `createClient(url, anon)` at module load, and Vite
**inlines `import.meta.env.*` at build time**. With no Vercel env var, the build
inlines `undefined` → `createClient(undefined, …)` throws on load → white screen.
(Setting it to `127.0.0.1` would also fail — that's the visitor's own machine.)

### The fix, end to end

You need: a **Supabase account**, the **Supabase CLI** (already installed
locally), and access to the project's **Vercel** settings. Steps that require an
interactive login (`supabase login`, Vercel dashboard) must be run by a human;
the rest are copy-paste CLI.

#### Step 1 — Create a cloud Supabase project
Dashboard → New project. Pick org, region (closest to your users), and a strong
DB password (save it). Note the **Project Ref** (e.g. `abcdefghijklmnop`), the
**Project URL** (`https://<ref>.supabase.co`), and the **anon/publishable key**
(Settings → API).

#### Step 2 — Log in and link the CLI
```bash
supabase login                       # interactive; opens browser
supabase link --project-ref <ref>    # prompts for the DB password from step 1
```

#### Step 3 — Push schema + seed to the cloud DB
```bash
# Applies migrations 0001–0006 (schema, profile trigger, RLS, leaderboard,
# persistence RPCs, read RPCs).
supabase db push

# Load themes + levels (the journey map is empty without this).
# Use the pooled connection string from the dashboard (Settings → Database).
psql "postgresql://postgres:<DB_PASSWORD>@db.<ref>.supabase.co:5432/postgres" \
  -f supabase/seed.sql
```
_Sanity check:_ `select count(*) from public.levels;` should return 15.

#### Step 4 — Deploy the Edge Functions
```bash
supabase functions deploy start_session
supabase functions deploy submit_attempt
```
The functions read `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` — **these are auto-injected** in deployed functions,
so no manual secrets are needed. (Import map `supabase/functions/deno.json`
resolves `@core`, `@engine`, `@types`, `@shared`.)

#### Step 5 — Enable anonymous sign-ins on the cloud project
Guest play uses anonymous auth (`signInAsGuest`). Local has it on
(`config.toml: enable_anonymous_sign_ins = true`) but **cloud defaults to OFF**.
Dashboard → Authentication → Sign In / Providers → enable **Anonymous sign-ins**.
While there, set **Site URL** and **Redirect URLs** to the Vercel domain
(`https://<your-app>.vercel.app`) so OAuth/redirects resolve.

#### Step 6 — Point Vercel at the cloud backend
In Vercel → Project → Settings → Environment Variables, add (Production +
Preview):
```
VITE_SUPABASE_URL      = https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY = <anon key from step 1>
```
Then **redeploy** (env vars are build-time; an existing build won't pick them up
until rebuilt).

#### Step 7 — Verify
- **Backend smoke against cloud** (temporarily point env at cloud, then revert):
  ```bash
  # In a scratch shell — do NOT commit this change to .env.local
  VITE_SUPABASE_URL=https://<ref>.supabase.co \
  VITE_SUPABASE_ANON_KEY=<anon key> \
  npm run smoke
  ```
  Expect: `solved:true`, a non-zero total, `OK`.
- **Live app:** open the Vercel URL → it loads the journey map → open Level 1 →
  PLAY → memorize → select → results render. No white screen, no console errors
  about `createClient`.

### Notes / gotchas
- `.env.local` stays pointed at localhost for local dev — **do not** commit
  cloud values there. Cloud values live only in Vercel.
- After any Edge Function change, redeploy that function (`supabase functions
  deploy <name>`); pushing to git does **not** deploy functions.
- After any schema change, add a new migration and `supabase db push` (never
  hand-edit the cloud DB).
- If guest sign-in 400s on the live site, step 5 (anonymous sign-ins) was missed.

---

## Part 2 — Roadmap

Ordering favors "playable and demo-able" first, infra/polish later. Each item
should go through the normal flow: **brainstorm → spec → plan → TDD
implementation** (see the superpowers skills). Specs/plans live in
`docs/superpowers/specs` and `docs/superpowers/plans`.

### Now (immediate next step)
1. **Ship the live deployment (Part 1).** Nothing else can be demoed until the
   link works. Definition of done: a fresh browser can play Level 1 end-to-end
   on the Vercel URL.

### Next (core loop completeness)
2. **Navigation shell / menu.** A hamburger or top-bar menu with: Practice,
   Global Leaderboard, Sign Out (and later Daily). Currently navigation is bare
   (`navStore` appView switch; only a "Practice" text link on the map). Gives
   players a way to move between modes and sign out.
3. **Auth polish.** Real sign-in (Google OAuth is partly configured) alongside
   guest; a clean way to upgrade a guest into a permanent account so progress
   persists. Confirm OAuth redirect URLs match the deployed domain.
4. **Leaderboard screen.** The `level_global_best` view and `get_journey`
   already surface global bests; build the screen to show per-level / global
   standings. (Backend mostly exists; this is mostly UI + a read RPC if needed.)

### Then (the headline feature)
5. **Daily Challenge.** The marquee feature. One shared puzzle per day, same for
   everyone, with its own leaderboard and streak tracking (the `profiles` table
   already has `current_streak` / `longest_streak`). Needs: a daily-seed source
   (date-derived, server-authoritative), a daily session/attempt flow reusing
   the journey engine, and a results/leaderboard view. Brainstorm scope first —
   this is big.

### Later (polish & depth — deferred on purpose)
6. **Scoring & selection layout cleanup** — visual polish of the selecting
   screen and the score panel. Deferred until core features are in.
7. **Theme mechanics** — the seed data defines themes with mechanics
   (`advanced` = trickier pieces only, `numbered` = fill in order, `flashmob` =
   one piece at a time). Only `standard` is implemented. Each non-standard
   mechanic is its own feature.
8. **Sign-in / transition animations**, sound effects.
9. **Accessibility** (ARIA, keyboard nav) — currently deferred POC-wide.

### Eventually (platform)
10. **React Native port → Apple App Store** — the stated long-term goal. The
    `_shared` core (prng, scoring, engine) is already platform-agnostic, which
    helps. Large effort; plan as its own track.

### Cross-cutting / tech debt to watch
- **Bundle size:** `npm run build` warns the JS chunk is >500 kB. Consider code-
  splitting (e.g. lazy-load Practice vs Journey) before the app grows much more.
- **CI:** there's no automated test/build gate on push yet. A GitHub Action
  running `npm run test` + `npm run build` (and ideally `supabase db test`)
  would catch regressions before deploy.
- **Edge runtime quirk (local):** after long uptime + function edits, the local
  edge runtime can serve a stale worker (`failed to determine entrypoint`). Fix:
  `docker restart supabase_edge_runtime_puzzle-game`. (Cloud is unaffected.)

---

## Quick reference

```bash
npm run dev        # http://localhost:5173
npm run test       # all tests (must pass before commit)
npm run build      # type-check + production build (catches noUnusedLocals)
npm run smoke      # end-to-end journey loop against whatever env points to
npm run db:start   # local Supabase (Docker)
npm run db:reset   # re-apply migrations + seed locally
```

- Local Supabase: API `127.0.0.1:54321`, DB `127.0.0.1:54322` (postgres/postgres),
  Studio `127.0.0.1:54323`.
- nvm quirk: chained `a && b` npm commands can error with `__init_nvm`; run
  npm/npx as separate Bash calls.
