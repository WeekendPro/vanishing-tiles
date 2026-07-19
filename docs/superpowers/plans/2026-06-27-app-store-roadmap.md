# Vanishing Tiles → Apple App Store — strategy note

> **STATUS: DEFERRED (2026-06-27).** This is a "not now," not a "no." It records *why* the
> App Store path is paused and *when* to revisit. The original detailed execution plan
> (Phase 0–4 chunks) was **removed 2026-07-18** because it had gone stale — it planned to
> port files that no longer exist (`gameStore.ts`, `journeyScoring.ts`, `JourneyScreen`,
> `GameShell`, `SelectingPhase`, the `ResolutionPhase/*` suite, etc., all deleted with the
> Journey/Practice removal) and referenced a `mobile/` Expo skeleton that isn't in the repo.
> When this path resumes, **re-plan the port from the current codebase**, not from the old
> chunk list — see git history (`docs/superpowers/plans/2026-06-27-app-store-roadmap.md`
> before 2026-07-18) if you want the original detail.

## Why deferred — go PWA-first instead

Decided 2026-06-27, after the earliest scaffolding was underway: **pause the App Store path
in favor of shipping as a PWA / shareable web link first.**

The actual distribution plan is **warm-network** (friends / family / coworkers → LinkedIn →
eventually an influencer), not App Store search/browse discovery. A link has less install
friction than an App Store download for that channel, and warm-network trust comes from the
personal referral, not Apple's review stamp — store trust matters for *cold* audiences, which
is a later stage. Meanwhile the game is still **mid-calibration** (difficulty ramp, stagger
mechanics, scoring); committing to a full React Native / Reanimated rewrite now risks redoing
native animation work every time calibration shifts from real user feedback. The native
rewrite is also the **single largest cost** in the whole effort — better spent once
gameplay/identity is validated.

**What "now" looks like instead:** make the existing web app a PWA (installable / shareable),
run the personal-network → LinkedIn loop, gather real feedback, finish calibration. (PWA work
is tracked separately and being actively finished.)

## When to revisit

Once gameplay/identity has stabilized from real user feedback **and** warm-network reach is
plateauing — i.e., you're about to push into cold audiences (influencers, strangers) where
store presence and trust actually start to matter.

## The one architecture decision worth keeping

If/when this resumes, the intended approach is a **React Native rewrite via Expo** — *not* a
WebView/Capacitor wrapper. Reuse the pure logic (`_shared/` engine + types, the Zustand
stores, `lib/`) near-verbatim; rebuild the view layer in RN + Reanimated. Rationale: avoids
Apple's 4.2 "thin wrapper" rejection risk, gives better touch/animation feel for a
timing-sensitive game, and unlocks EAS OTA updates for JS-only changes (gameplay/scoring
tuning) without an App Review round. Bundle ID `com.luisalejo.vanishingtiles` was a
placeholder pick — **needs explicit sign-off before any real submission** (hard to change
post-submission).
