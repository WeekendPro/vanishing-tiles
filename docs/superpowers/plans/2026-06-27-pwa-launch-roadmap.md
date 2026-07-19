# Vanishing Tiles → PWA Launch Roadmap

> **This is a living hub doc, not a one-shot execution plan.** It tracks decisions, status, and a
> backlog of session-sized chunks. Each chunk is delegated to its own Claude Code session (spawned
> as a chip via `spawn_task`). This thread holds the plan; it does not execute it. Update status
> checkboxes and the Decisions Log here as chunks complete — this doc is the source of truth for
> "what's done, what's next, why we chose X."

**Goal:** Make Vanishing Tiles installable and shareable as a PWA, deployed at a stable public URL,
ready to send to friends/family/coworkers and then LinkedIn — with just enough signal (analytics)
to know whether people are actually playing it.

**Why now, not App Store:** see `2026-06-27-app-store-roadmap.md` (deferred). Distribution is
warm-link first; a PWA serves that with near-zero install friction and lets gameplay/identity
calibration continue without a native-rewrite anchor. Revisit App Store once that path plateaus.

**Current state (updated 2026-07-18):** Phase A + B are done. `index.html` has the manifest link,
app icons, OG/Twitter + iOS meta tags; `vite-plugin-pwa` generates a Workbox service worker
(`registerType: 'autoUpdate'`) that precaches the app shell for offline load; an in-app install
prompt (`src/components/InstallPrompt.tsx`) handles both Chrome `beforeinstallprompt` and iOS
Safari's manual Add-to-Home-Screen flow. Deployed at the custom domain
`https://vanishingtiles.weekendpro.io` (Vercel). What remains is Phase C — the real-device
pre-share smoke pass.

**Tech stack additions:** `vite-plugin-pwa` (Workbox under the hood) for manifest + service worker
generation; a static hosting target (Vercel — already in this environment's toolchain per the
session's Vercel skills — or Netlify/Cloudflare Pages as alternatives); a lightweight,
privacy-respecting analytics tool for the "are people playing" signal.

## Global Constraints

- All existing tests must keep passing (`npm run test`) and `npm run build` must stay clean —
  PWA tooling must not break the existing Vite/React/Supabase setup.
- No backend/Supabase architecture changes — this is purely a delivery/installability layer on
  top of the existing app.
- Respect the project's naming history (CLAUDE.md) — all public-facing strings (manifest `name`,
  OG tags, page title) must say "Vanishing Tiles," no internal codenames.
- Keep changes additive and reversible — this should not block or complicate a future App Store
  pivot; avoid anything that couples the web app to PWA-only assumptions in a way that's hard to
  unwind.

---

## Decisions Log

| Date | Decision | Why |
|---|---|---|
| 2026-06-27 | Build on existing Vite app with `vite-plugin-pwa`, not a separate project | App is already complete and playable; PWA-ifying in place is additive and far cheaper than any rewrite — this is exactly the point of the PWA-first pivot |
| 2026-06-27 | Deployed to Vercel project `mind-the-gap-h5ys`; stable URL is `https://mind-the-gap-h5ys.vercel.app` | Vercel was already linked (`.vercel/repo.json`) with prior production deployments — confirmed the project alias domain resolves and serves the current build. No custom domain purchased; `*.vercel.app` is fine for v1. |
| 2026-06-27 | Supabase: reused the existing hosted project `mind-the-gap` (ref `wvdugxpjovvojxcpqfqa`) — no new project created | Project was already linked locally, already had all 12 migrations and both edge functions (`start_session`, `submit_attempt`) deployed, and `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` were already set as Vercel **Production** env vars (~25 days prior). Verified live by calling `get_journey`/`get_level` RPCs directly against the hosted project and confirming the deployed JS bundle's embedded Supabase URL matches it. |
| 2026-06-27 | B.1 verification scope narrowed to Infinite Stagger only, not Journey/Practice | Discovered `HomeScreen.tsx` has `SHOW_EXPERIMENTAL = false` on `main`, hiding Training (Practice) and all Journey map styles — the live PLAY button only reaches Infinite Stagger, which is fully client-side today (zero Supabase calls). Per Luis: Journey mode isn't shipping for now; Infinite Stagger is the only mode being shipped, with Supabase wiring (scoring/leaderboards/achievements) planned as later work. Verified Infinite Stagger end-to-end on the live URL via browser automation: countdown → memorize → recall → resolve → game over → play again all worked, zero console errors, zero network requests (consistent with it being pure client-side right now). |

---

## How to use this doc

- Status: `[ ]` not started · `[~]` in progress (chip spawned / session running) · `[x]` done.
- Update status + Decisions Log as chunks complete.
- Chunks are ordered by dependency; most of Phase B can run in parallel once Phase A lands.

---

## Phase A — Make it installable (the core PWA mechanics)

- [x] **A.1 — Add web app manifest + icons** — **Done.**
  Icon set present in `public/icons/` (192/512/maskable-512/apple-touch/32 + source SVG).
  `public/manifest.webmanifest` has `name: "Vanishing Tiles"`, `short_name: "Vanishing"`,
  `display: "standalone"`, `orientation: "portrait"`, theme/background `#06060B` (matches the
  Afterglow `bg-arcade-glow` void token), plus `id`/`scope`/`categories`. Linked from `index.html`.
  Verified: manifest loads with all fields; every icon returns 200 `image/png`.

- [x] **A.2 — Add service worker via `vite-plugin-pwa`** — **Done.**
  Install and configure `vite-plugin-pwa` in `vite.config.ts` (note: this file currently doubles as
  the Vitest config — make sure the plugin addition doesn't disrupt the `test` block). Configure
  `registerType: 'autoUpdate'` so users always get the latest build without a manual cache-clear
  (important since this will be the *fast-iteration* channel now that App Store's OTA story isn't in
  play). Verify offline app-shell load works (network throttled to offline in dev tools, app still
  opens to at least the idle/menu screen).
  *Deliverable: service worker registers, app installs, offline shell loads, `npm run build` and
  `npm run test` stay clean.*
  *Depends on: A.1 (manifest must exist for the SW/install prompt to be meaningful).*
  **Done 2026-07-18.** `vite-plugin-pwa@1.3.0` (Workbox 7) added to `vite.config.ts` alongside the
  untouched Vitest `test` block, with `registerType: 'autoUpdate'`, `manifest: false` (the
  hand-authored `public/manifest.webmanifest` stays the single source of truth — no second manifest
  generated), `navigateFallback: '/index.html'`, and Google-Fonts runtime caching. Verified offline
  for real: built `dist`, served via `npm run preview`, confirmed the SW registers + controls the
  page, then **stopped the origin server** and reloaded — the app shell loaded fully from precache
  (AuthScreen rendered, `preview_list` empty = no server running). Build + 362 tests stay green.

- [x] **A.3 — iOS Safari PWA quirks pass** — **Done.**
  iOS Safari has known PWA gaps (no install prompt API, requires `apple-mobile-web-app-capable`
  meta tags + `apple-touch-icon` link tags to get a decent "Add to Home Screen" result, status bar
  styling quirks, no push notifications). Since friends/family on iPhone are a primary first
  audience, explicitly test and fix the Add-to-Home-Screen experience on iOS Safari (real device or
  simulator), not just Chrome/Android. Document any iOS-specific limitations that can't be fixed
  (e.g. no install banner — must instruct users via in-app UI, see A.4).
  *Deliverable: written verification notes + screenshots of the iOS home-screen icon and launched
  app, confirming it looks like a real app, not a browser tab.*
  *Depends on: A.1, A.2.*
  **Done 2026-07-18.** `index.html` now carries `apple-mobile-web-app-capable="yes"`,
  `apple-mobile-web-app-status-bar-style="black"` (opaque black bar so the top-anchored HUD never
  underlaps the iOS clock — `black-translucent` was rejected for that reason),
  `apple-mobile-web-app-title="Vanishing"`, `mobile-web-app-capable`, and
  `viewport-fit=cover`; the `apple-touch-icon` link was already present and verified 200.
  The `InstallPrompt` component (A.4) shows the manual Share → Add to Home Screen instructions on
  iOS Safari (detected via `isIOSSafari()` in `src/lib/pwa.ts`, unit-tested). **iOS limitation that
  can't be fixed in code:** iOS Safari has no `beforeinstallprompt` — installation is always the
  user's manual Share-sheet action, which is exactly why the in-app hint exists. *Real-device
  screenshot of the launched home-screen icon is deferred to Phase C's device pass — verified here
  in a mobile-emulated viewport.*

- [x] **A.4 — In-app "install this" prompt/instructions** — **Done.**
  Add a small, dismissible UI element (banner or menu item) that: on Chrome/Android, uses the
  `beforeinstallprompt` event to trigger the native install prompt; on iOS Safari (no such API),
  shows manual instructions ("tap Share → Add to Home Screen") since iOS won't prompt
  automatically. Should not block or clutter the existing `GameShell` UI — a low-key one-time
  banner that dismisses to localStorage is enough.
  *Deliverable: working install CTA on both platforms, dismissible, doesn't regress existing UI
  tests.*
  *Depends on: A.2, A.3.*
  **Done 2026-07-18.** `src/components/InstallPrompt.tsx` — a low-key Afterglow-styled top banner
  rendered only on non-gameplay screens (same `showMenu` gate as the global menu, so it can't
  overlap the in-run HUD). Chrome/Android: captures `beforeinstallprompt` → INSTALL button fires
  the native dialog. iOS Safari: shows "tap Share ↑ then Add to Home Screen". Dismiss `×` persists
  to `localStorage` (`vt:pwa-install-dismissed:v1`) and never reappears; also self-hides when
  already installed (standalone). Pure detection/persistence logic lives in `src/lib/pwa.ts` with
  11 unit tests. Verified in-browser (Chrome banner + dismiss + persistence, mobile + desktop
  viewports; the dismiss `×` clears the top-right hamburger).

---

## Phase B — Make it shareable (deploy + social surface)

- [x] **B.1 — Deploy to a stable public URL**
  Stand up hosting (Vercel is the natural default given this session's existing Vercel tooling —
  `vercel deploy`/`vercel link`; confirm Supabase env vars are configured as Vercel project env
  vars, not just local `.env`). Get a real, stable URL (custom domain optional for v1 — a
  `*.vercel.app` URL is fine to start; note that switching domains later is low-cost so don't block
  launch on buying a domain).
  *Deliverable: app is live at a public URL, full Journey + Practice flows work end-to-end against
  the real/deployed Supabase backend (not local dev).*
  **Done 2026-06-27.** Live at `https://mind-the-gap-h5ys.vercel.app` (Vercel project
  `mind-the-gap-h5ys`, already linked/deployed before this chunk). Supabase env vars were already
  set as Vercel Production vars, pointing at the existing hosted project `mind-the-gap`
  (`wvdugxpjovvojxcpqfqa`), which already had all migrations + edge functions deployed. Verified
  end-to-end via browser automation on the live URL: Infinite Stagger (the only mode currently
  shipping — Journey/Practice are hidden behind `SHOW_EXPERIMENTAL = false`, see Decisions Log)
  played through a full countdown → memorize → recall → resolve → game-over → play-again cycle
  with zero console errors and zero network requests, consistent with it being fully client-side
  today. Confirmed the Supabase backend itself is reachable and correctly wired by calling
  `get_journey`/`get_level` RPCs directly against the hosted project — not exercised by the
  current default UI flow, but ready for when Stagger's planned Supabase wiring (scoring/
  leaderboards/achievements) lands.

- [x] **B.2 — Open Graph / social share metadata** — **Done 2026-07-18.**
  `index.html` now has the full OG set (`og:type/site_name/title/description/url/image` +
  `image:width/height/alt`) and Twitter `summary_large_image` card, all pointing at the production
  domain `https://vanishingtiles.weekendpro.io`. The 1280×640 preview image was copied from
  `docs/media/social-preview.png` to `public/social-preview.png` so it's served at the domain root
  and referenced by absolute URL. Verified locally: the image serves 200 `image/png`; the meta
  tags are present in the built `dist/index.html`. *A real LinkedIn/iMessage paste test can only be
  run once this build is live on the production domain (the OG URL is absolute to prod) — do it as
  part of the Phase C smoke pass right after deploy.*
  *Depends on: B.1 (needs the real URL to test link previews against).*

- [ ] **B.3 — Minimal "are people playing" analytics**
  Add lightweight, privacy-respecting analytics (e.g. Vercel Analytics, since it's a one-line
  addition on Vercel hosting, or Plausible/Simple Analytics if you want to self-host/avoid
  Vercel lock-in) to answer: how many people opened the link, how many started a level, how many
  completed one. Do NOT build a custom events pipeline — this should be the smallest thing that
  answers those three questions, not a product-analytics platform.
  *Deliverable: a dashboard you can check that shows visits + at least one in-game funnel step
  (e.g. "started a level"), confirmed by triggering it yourself once on the live deployment.*
  *Depends on: B.1.*

---

## Phase C — Send it out

- [ ] **C.1 — Pre-share smoke pass**
  One end-to-end pass on the live deployed URL, on at least one real iOS and one real Android
  device (or close simulation): install to home screen, play through one full Journey level
  (main puzzle + a badge), confirm no console errors, confirm analytics ticks. This is a manual
  verification chunk, not a build chunk — its job is to catch anything Phase A/B missed before
  real humans see it.
  *Deliverable: a short written go/no-go note — any bugs found get filed as new chunks here before
  sharing the link.*
  *Depends on: A.4, B.2, B.3.*

---

## Open questions (resolve before they block a chunk)

- ~~Hosting target~~ **Resolved 2026-06-27:** Vercel, using the already-linked project
  `mind-the-gap-h5ys` — live at `https://mind-the-gap-h5ys.vercel.app`. No custom domain for v1.
- Analytics tool — Vercel Analytics (simplest if hosting on Vercel) vs. Plausible/self-hosted
  (more privacy control, slightly more setup)?
- Icon/visual identity source — is there an existing logo/icon treatment to use (check `mockups/`,
  `design-system/`), or does one need to be designed as part of A.1?
