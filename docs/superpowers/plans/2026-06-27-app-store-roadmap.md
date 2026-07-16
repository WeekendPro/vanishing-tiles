# Vanishing Tiles → Apple App Store Roadmap

> **STATUS: DEFERRED (as of 2026-06-27).** See the "Deferred — why and when to revisit" section
> right below. The research and Phase 0 work below are preserved as-is, not discarded — this is a
> "not now," not a "no." Do not resume Phase 1+ without re-reading that section first.

> **This is a living hub doc, not a one-shot execution plan.** It tracks decisions, status, and a
> backlog of session-sized chunks. Each chunk is delegated to its own Claude Code session (spawned
> as a chip via `spawn_task`, or manually started referencing this doc). This thread holds the plan;
> it does not execute it. Update status checkboxes and the Decisions Log here as chunks complete —
> this doc is the source of truth for "what's done, what's next, why we chose X."

## Deferred — why and when to revisit

Decided 2026-06-27, after Phase 0 was already underway (0.2 done, 0.1 in progress): **pause the
App Store path in favor of shipping as a PWA / shareable web link first.**

**Why:** the actual distribution plan is warm-network (friends/family/coworkers → LinkedIn →
eventually an influencer), not App Store search/browse discovery. A link has less install friction
than an App Store download for that channel, and warm-network trust comes from the personal
referral, not from Apple's review stamp — App Store trust matters for *cold* audiences, which is a
later stage. Meanwhile the game is still mid-calibration (difficulty tables, stagger mechanics,
scoring); committing to a full RN/Reanimated rewrite now risks redoing native animation work every
time calibration shifts from real user feedback. The native rewrite is also the single largest cost
in this whole roadmap (Phase 2) — better to spend that effort once gameplay/identity is validated.

**What "now" looks like instead:** make the existing web app PWA-installable/shareable, run the
personal-network → LinkedIn loop, gather real feedback, finish calibration.

**When to revisit App Store:** once gameplay/identity has stabilized from real user feedback *and*
warm-network reach is plateauing — i.e., you're about to push into cold audiences (influencers,
strangers) where store presence and trust actually start to matter. At that point, resume from
Phase 1 (0.1/0.2 are already done or in progress).

---

**Goal:** Ship Vanishing Tiles to the Apple App Store as a native iOS app. *(Deferred — see above.)*

**Chosen architecture:** React Native rewrite via **Expo** (not a WebView/Capacitor wrapper).
Reuse `engine/`, `lib/`, and Zustand store logic from the web app near-verbatim; rebuild the
`components/` view layer in RN + Reanimated. Rationale: avoids Apple's 4.2 "thin wrapper"
rejection risk, gives better touch/animation feel for a timing-sensitive game, and unlocks
EAS OTA updates for all JS-only changes post-launch (see Decisions Log).

**Source repo:** this repo (`vanishing-tiles`, web POC, Vite + React + Supabase). The RN app is a
**new project** — likely a new directory or sibling repo (TBD in Chunk 0.1) — that imports/ports
logic from here. This doc tracks both the web repo's role as source-of-logic and the new RN
project's progress.

---

## Decisions Log

| Date | Decision | Why |
|---|---|---|
| 2026-06-27 | Native RN/Expo rewrite, not WebView wrapper | Apple 4.2 rejection risk on thin wrappers; better feel for timing-sensitive gameplay; enables EAS OTA updates for JS-only changes (no App Review needed for gameplay/scoring tuning) |
| 2026-06-27 | Hub-and-spoke execution model | User wants this thread to hold the plan only; each chunk executes in its own delegated Claude session, started via spawn_task chip |
| 2026-06-27 | RN project lives at `mobile/` inside this repo, not a sibling repo | Keeps engine/lib porting (Phase 1) a same-repo copy/diff instead of a cross-repo sync; trivially movable to a sibling repo later (just `git mv` + new remote) if that ever becomes a problem, so low-risk to decide now |
| 2026-06-27 | Bundle ID `com.luisalejo.vanishingtiles` (iOS bundle identifier + Android package) | No existing reverse-domain convention found in the repo/docs; picked a sensible default — **needs explicit confirmation from Luis before any real TestFlight/App Store submission**, since it's hard to change post-submission |
| 2026-06-27 | Test runner: Jest via `jest-expo` preset (not Vitest) | Expo's own template/tooling (`expo install`, native-module mocks for `react-native`) is built around `jest-expo`; fighting that to keep Vitest isn't worth it. Web app (`puzzle-game` root) keeps Vitest unchanged — only the new `mobile/` project uses Jest |
| 2026-06-27 | `eas.json` hand-authored, not generated via `eas build:configure` | That command requires an authenticated Expo account (`eas login`); sandboxed session has no credentials. Wrote the standard development/preview/production profile shape by hand — re-run `eas build:configure` once logged in to confirm/replace it |
| 2026-06-27 | iOS simulator run blocked: only Xcode Command Line Tools installed, not full Xcode | `npx expo run:ios` fails at `pod install` / `xcodebuild` because `xcode-select`'s active developer dir is CLT-only (`/Library/Developer/CommandLineTools`). Verified app health instead via `npx tsc --noEmit` (clean) and `npx jest` (trivial test passes). Real simulator/device build needs either a full Xcode install in this environment or running this chunk's remaining verification on a machine with Xcode, or via `eas build --profile development --platform ios` once logged in to EAS |
| 2026-06-27 | **Defer the whole App Store roadmap; pursue PWA-first instead** | Distribution plan is warm-network (friends/family/LinkedIn), which a shareable link serves better than an App Store install; game is still mid-calibration and a native rewrite now risks redoing work as calibration shifts; App Store trust/discovery benefits matter for the later cold-audience stage, not now. Revisit once gameplay stabilizes and warm-network reach plateaus. See "Deferred" section at top of doc |

---

## How to use this doc

- Each **Chunk** below is sized to run in one delegated session (a few hours of agent work, one
  reviewable deliverable).
- Status: `[ ]` not started · `[~]` in progress (chip spawned / session running) · `[x]` done.
- When a chunk completes, update its status and add any decisions it produced to the Decisions Log.
- New chunks get added as the plan firms up (e.g. Phase 2 will fan out into one chunk per
  component once Phase 1 confirms the porting pattern).

---

## Phase 0 — Accounts, tooling, project skeleton

- [ ] **0.1 — Apple Developer Program enrollment + entity decision**
  Decide individual vs. org account (org needs D-U-N-S, 1–2 week lead time — start this first
  regardless of other progress). Enroll, confirm access to App Store Connect.
  *Deliverable: active Apple Developer account, confirmed App Store Connect login.*

- [x] **0.2 — Expo project skeleton + EAS wiring**
  Stand up a new Expo (React Native) project. Configure `eas build` and `eas submit`. Decide
  bundle ID and confirm public-facing app name is unambiguously "Vanishing Tiles" (the repo has a
  history of internal name churn — Gap City → Phosphor → Vanishing Shapes → Vanishing Tiles —
  make sure nothing leaks into the store listing). Get an empty app building and running on an
  iOS simulator via `eas build` locally or in CI.
  *Deliverable: empty Expo app, builds and runs on simulator, EAS configured.*
  *Depends on: 0.1 (need Apple account for any device/TestFlight build, not strictly for simulator).*
  *Done 2026-06-27: scaffolded `mobile/` (Expo SDK 56, blank-typescript template, RN 0.85, React 19).
  `app.json` sets name "Vanishing Tiles" / slug `vanishing-tiles` / bundle ID & package
  `com.luisalejo.vanishingtiles` (no internal codenames leak in). `eas-cli` installed as a devDependency;
  `eas.json` hand-authored with development/preview/production profiles (see Decisions Log re: why not
  `eas build:configure`). `npx tsc --noEmit` is clean; `npx jest` passes a trivial sanity test (see 0.2's
  test-runner decision). **Not done: actually running on an iOS simulator** — this sandbox only has Xcode
  Command Line Tools, not full Xcode, so `expo run:ios` fails at `pod install`/`xcodebuild`, and `eas build`
  needs an authenticated EAS account this session doesn't have. Whoever picks up 0.1/login should verify
  the simulator run as a quick follow-up; the project itself is otherwise ready.*

---

## Phase 1 — Logic port (low risk, mechanical)

- [ ] **1.1 — Port `engine/` and `lib/` to the RN project**
  Copy/adapt `src/engine/pieces.ts`, `puzzleGenerator.ts`, `solver.ts`, and `src/lib/components.ts`,
  `journeyScoring.ts` into the RN project. These are pure TS with no DOM dependency — should port
  near-verbatim. Port the matching test files (`tests/lib/...`, solver tests) and confirm they pass
  under the RN project's test runner (Jest via `jest-expo`, decided in 0.2 — see Decisions Log).
  *Deliverable: ported logic + passing tests in the RN project, no UI yet.*

- [ ] **1.2 — Port `gameStore.ts` (Zustand) + swap persistence**
  Port the Zustand store. Replace `progressStore.ts`'s `localStorage` usage with
  `@react-native-async-storage/async-storage` or `expo-secure-store`. Write a unit test confirming
  progress persists across a simulated app restart (re-instantiate the store, confirm state reload).
  *Deliverable: store ported, persistence test passing.*
  *Depends on: 1.1 (store types reference engine/lib types).*

- [ ] **1.3 — Verify Supabase client under RN/Expo**
  Wire up `@supabase/supabase-js` in the Expo project pointed at the existing (or a test) Supabase
  instance. Confirm `get_journey`/`get_level` calls succeed on a physical device or simulator,
  including over a network that forces IPv6 (Apple requires IPv6-only compatibility — test this,
  don't assume it works because it works on web).
  *Deliverable: confirmed working Supabase round-trip from the RN app, documented any IPv6/config
  gotchas in the Decisions Log.*

---

## Phase 2 — View layer rewrite (largest phase — will fan out into one chunk per surface)

Each of these ports one logical screen/surface from the web app's `components/` into RN +
Reanimated. Do not start these until Phase 1 is fully merged — they all depend on the ported
store/engine.

- [ ] **2.1 — `Grid` + `PieceShape` (the core rendering primitives)**
  Port the 12×12 grid renderer and tetromino shape renderer to RN `View`s. This is the foundation
  every other screen renders on top of — get cell sizing/spacing right here once.
- [ ] **2.2 — `CountdownPhase` + `GapShimmer`**
  Port the pre-round countdown fade and the one-time gap shimmer sweep. These are pure
  animation/timing — good first animation chunk since they don't touch game-state.
- [ ] **2.3 — `ViewingPhase` + `ProgressBar`**
  Port the memorization view + countdown timer bar.
- [ ] **2.4 — `SelectingPhase`**
  Port the piece menu + selection cart.
- [ ] **2.5 — `ResolutionPhase/*` (auto-placement, badges, score panel)**
  Port the resolution animation suite: `FlyerOverlay`, `PartialBadge`, `CelebrationBadge`,
  `ScorePanel`, `ComponentScorePanel`, `NextRoundButton`, `SelectionCart`. This is the most
  animation-heavy chunk — consider splitting further once scoped.
- [ ] **2.6 — `GameShell` + `LevelScreen`**
  Port the top bar / phase router / Journey level hub (main puzzle + 4 badge tiles).
- [ ] **2.7 — `JourneyScreen` + `JourneyMap`**
  Port the transit-map Journey screen (SVG → `react-native-svg`).
- [ ] **2.8 — `ScoringPhase` (Practice Game Over)**
  Port the Practice-mode game-over screen.

*(Chunks 2.1–2.8 are listed in dependency order but several can run in parallel once 2.1 lands,
since most don't depend on each other — only on the ported `Grid`/store.)*

---

## Phase 3 — Store readiness

- [ ] **3.1 — Disable/hide unfinished placeholder content**
  Confirm the Riddle "Coming soon" badge is hidden or fully non-interactive in the submitted build
  — Apple rejects visible-but-non-functional UI. Audit for any other placeholder/dead-end UI.
- [ ] **3.2 — Privacy policy + App Privacy questionnaire**
  Write a privacy policy (host it somewhere with a stable URL). Audit exactly what Supabase
  auth/usage collects (IP, device info, session data) and fill out App Store Connect's privacy
  "nutrition label" accurately.
- [ ] **3.3 — Store listing assets**
  App icon (1024×1024 + full icon set), screenshots for all required device size classes,
  age rating questionnaire, app description/keywords.
- [ ] **3.4 — TestFlight internal round**
  Build via `eas build`, submit to TestFlight, internal testers run the full Journey + Practice
  flows end-to-end. Log bugs found back into this doc as new chunks if they're non-trivial.

---

## Phase 4 — Submit & operate

- [ ] **4.1 — First App Store submission**
  Submit via `eas submit`, include reviewer notes/demo account if any login wall exists. Track
  review outcome here.
- [ ] **4.2 — Post-launch update workflow doc**
  Document (in this doc or a new one) the EAS OTA update process for JS-only changes (gameplay
  tuning, scoring, difficulty table) vs. the full native-rebuild path for anything touching
  permissions/native modules/icons. This becomes the standing reference for all future tuning work.

---

## Open questions (resolve before they block a chunk)

- ~~Where does the RN project live — new directory in this repo, or a sibling repo?~~ **Resolved
  2026-06-27: `mobile/` inside this repo.** See Decisions Log.
- ~~Test runner for the RN project — Jest (Expo default) or keep Vitest?~~ **Resolved 2026-06-27:
  Jest (`jest-expo` preset).** See Decisions Log.
- Org vs. individual Apple Developer account? (Affects 0.1 timeline — org needs D-U-N-S.)
- **New (0.2 follow-up):** Nobody has confirmed an iOS simulator run actually succeeds yet — this
  sandbox lacks full Xcode, only CLI Tools. Needs a real Xcode environment or an authenticated
  `eas build --profile development --platform ios` to close the loop on 0.2's stated deliverable.
- **New (0.2 follow-up):** `com.luisalejo.vanishingtiles` bundle ID needs Luis's explicit sign-off
  before any TestFlight/App Store submission (picked with no existing convention to follow).
