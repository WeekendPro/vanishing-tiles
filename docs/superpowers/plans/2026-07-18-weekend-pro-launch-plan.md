# Vanishing Tiles — Weekend Pro Launch Plan

> **What this is:** a go-to-market plan for the first public release of **Vanishing Tiles**, and the
> public debut of the **Weekend Pro™** label. Written for a maker with a demanding full-time job —
> everything here is batched, weekend-timed, and designed to be done in the margins.
>
> **Companion docs:** deployment/analytics/social-metadata work is tracked in
> `2026-06-27-pwa-launch-roadmap.md`; name/IP hygiene in `docs/ip-protection-playbook.md`. This doc
> is the *distribution* layer on top of those.

---

## The thesis

Two things are launching at once, and the order matters:

1. **A game** (Vanishing Tiles), and
2. **A label** (Weekend Pro) — the brand you'll reuse for everything you ship going forward.

The single most valuable asset here isn't the game — it's the **story**: *"I have a full life and a
full-time job, so I build things on weekends and in the margins, and I made a home for that work."*
That narrative is relatable, it's credible to an engineering audience, and — critically — it
**reframes side-project energy as a positive signal** (initiative, craft, follow-through) instead of
"why is this person building games on company time." Weekend Pro *is* the disclaimer. Lead with it
everywhere.

So: **lead with the maker story, not the game mechanics.** The game is the proof, not the pitch.

---

## The optics guardrail ("don't look like I'm slacking at work")

This concern is real and it's handled by design, not by hiding:

- **The brand carries it.** Every post opens on the weekends/margins framing. "Weekend Pro" on the
  byline does more work than any disclaimer could.
- **Time your posts to the story.** Publish evenings and — especially — **Saturday mornings**.
  Launching on a Saturday literally *is* Weekend Pro. It reinforces the brand and it's when you'd
  naturally be doing this anyway. Use LinkedIn's native scheduler (or Buffer) so you're not posting
  at 2pm on a Tuesday.
- **Batch your engagement.** Reply to comments at lunch and in the evening, not continuously through
  the workday. A launch does not require you to be online 9-to-5 — and looking like it didn't is the
  point.
- **A label signals boundaries.** Framing this as *Weekend Pro* (a deliberate container) rather than
  "Luis's random side project" says "this is what I do with my own time, on purpose." That's the
  optics protection.

---

## Readiness gates (do these BEFORE any post)

You only get one first impression with your professional network. None of the public posts go out
until these are true. Most are small and already scoped in the PWA roadmap.

| # | Gate | Why it blocks a launch | Effort |
|---|------|------------------------|--------|
| 1 | **Open Graph + Twitter card metadata** (`og:title`, `og:description`, `og:image` 1200×630, `twitter:card`) — PWA roadmap **B.2** | Without it, your link renders as a bare URL with no image in LinkedIn / HN / Reddit / iMessage. This is the difference between a post that looks legit and one that looks like spam. **Verify with a real paste test, not view-source.** | S |
| 2 | **Icon / favicon** (replace default `vite.svg`) — PWA roadmap **A.1** | Doubles as the source for the OG image and the browser-tab identity. This is Weekend Pro's first visual mark. | S |
| 3 | **Analytics** (Vercel Analytics one-liner, or Plausible) — PWA roadmap **B.3** | You cannot run a launch you can't measure. Answer three questions: how many opened the link, how many started a run, how many cleared a batch. | S |
| 4 | **Mobile smoke pass** (real iOS + Android) — PWA roadmap **C.1** | Most social traffic taps through on a phone. If the board is broken or unplayable on mobile, every share is wasted. Guest play must work with no signup on mobile. | S |
| 5 | **A 15–20s demo clip** (screen recording of a run, captioned) | Native video/GIF is the single biggest reach lever on LinkedIn and X, and it's the hook that makes people click. Record it *once*, reuse everywhere. | S |
| 6 | **IP hygiene** — start using **™** on "Vanishing Tiles™" and "Weekend Pro™" in-app + in copy; run the free USPTO knockout search (Class 9 + 41) before publicizing the name; confirm the GitHub org + Vercel + Supabase are in your own control | Cheap insurance the moment the name goes public. See `ip-protection-playbook.md`. The knockout search catches an obvious name blocker *before* you get attached to it. | S |
| 7 | **A feedback path** | Decide where feedback lands: "reply in comments" is enough for v1, optionally a one-field form or your email. Don't build anything. | XS |

> **PWA install (Phase A.2–A.4) is NOT a gate.** "Play free in your browser, no download" is a
> *stronger* pitch for a cold social audience than "install this." Ship the install prompt after
> launch, in parallel.

---

## The channels (ranked by fit)

Your direct question — *"is there a public space where people post new creations and get feedback and
users?"* — has a rich answer. Yes, several, and they're better than LinkedIn for *discovery* (LinkedIn
is better for *reputation* and warm reach). Use both kinds.

### Tier 1 — the debut (highest fit)

**1. LinkedIn — your warm network + reputation play.**
Biggest network, strongest engineering community, former coworkers and bootcamp peers. This is where
the *story* lands hardest and where feedback comes from people who know you. Best for a first wave of
real players and credibility.
- *Weakness:* LinkedIn throttles posts with external links. **Mitigation:** lead with the native
  demo video in the post; put the play-link in the **first comment** and mention it in the body.
- *Format:* story-led personal post + demo video. Not a press release.

**2. Hacker News — "Show HN" — the canonical builder showcase.**
This is *the* public space for "I made a thing, tell me what you think," and its audience is exactly
your peers. A Show HN that catches drives real traffic and brutally useful feedback. The Weekend Pro
framing is native to HN culture.
- *Etiquette:* honest, hype-free title; be present in the comments all day; don't ask for upvotes.
  Weekend mornings (US) = lower traffic but far less competition — good for a first-timer.

**3. itch.io — free host + built-in discovery for web games.**
The natural home for a browser game like this. You can embed the Vercel build (or host it here) and
get an audience that *expects* to try weird indie web games. Low effort, evergreen — the page keeps
working long after the launch spike. Doubles as Weekend Pro's storefront.

### Tier 2 — targeted discovery (high-intent players)

**4. Reddit — where players actively hunt for new games to try.**
High-intent, direct feedback, but rule-heavy and allergic to drive-by self-promo. **Give before you
take** (comment on others' games first). Best subs, in order:
- **r/playmygame** — literally built for this; give feedback to others, use flair.
- **r/WebGames** — perfect fit (browser, no download), strict rules — read them.
- **r/SideProject** — rewards the Weekend Pro / built-in-margins narrative.
- **r/IndieGaming**, **r/incremental_games** (borderline), **r/Tetris**, **r/puzzlegames** — genre-adjacent.
- **Themed days:** *Feedback Friday* (r/gamedev), *Showoff Saturday* (r/webdev) — designed for exactly this.

**5. Indie Hackers + `#buildinpublic` (X/Twitter) — the brand's long game.**
THE home for the "full-time job, building on weekends" story. These communities reward the narrative
itself, not just the product. Lower for a one-day traffic spike, high for *building Weekend Pro as a
recurring thing* over months. Post the story + demo; keep showing up occasionally.

### Tier 3 — optional / later

**6. Product Hunt.** The canonical "launch" site. More tool-oriented than game-oriented, but a polished
web game can do fine. Save it for when you have the OG image + a couple of testimonials + a bit of
polish from the soft launch. Not required for v1.

**7. Warm Discord/Slack communities you're already in.** Instant, friendly, ideal for the soft-launch
bug-catch wave (see below). Don't cold-join servers to spam — only ones you're a real member of.

---

## The rollout (three weekends + a light tail)

Sequenced so your **professional network sees a polished, bug-free, socially-proven version** — never
the raw first cut. You get one first impression on LinkedIn; spend the soft launch to earn it.

### Weekend 0 — Prep (batched into 2–3 evenings)
Clear the readiness gates above, all at once:
- Ship OG tags + favicon/icon + analytics (roadmap B.2/A.1/B.3 — one focused session).
- Mobile smoke pass on a real phone.
- Record the 15–20s demo clip. Write the copy *once* (drafts below), reuse everywhere.
- ™ everywhere + USPTO knockout search. Reserve Weekend Pro handles (itch.io; X if you'll use it —
  the GitHub org `WeekendPro` already exists).
- Decide the feedback path.

### Weekend 1 — Soft launch (Saturday, low stakes)
Post to **feedback-first, forgiving** spaces only:
- **r/playmygame** + one or two Discords you're in + **DM 5–10 friends/former coworkers directly.**
- *Goals:* catch embarrassing bugs, seed the leaderboard with real names (social proof), and collect
  2–3 quotable reactions.
- Sunday: fix anything that surfaced. This is your dress rehearsal.

### Weekend 2 — The debut (Saturday morning, coordinated)
The Weekend Pro launch. Fire these within a couple of hours of each other:
- **LinkedIn flagship post** (the story + demo video; link in first comment).
- **Show HN.**
- **itch.io release** (page goes live).
- **Indie Hackers** post + an **X `#buildinpublic`** thread.
- One broader Reddit sub (**r/WebGames** or **Showoff Saturday** depending on the day).
- Be present in comments through the day — batched at breaks, not continuously.

### The tail — Sustain (light, optional, ongoing)
This is what turns a one-shot into a *label*:
- Reply to feedback; ship **one small visible improvement** and say so ("shipped this weekend based on
  your feedback").
- **~2 weeks later: a retrospective post** on LinkedIn — *"I launched my first Weekend Pro project two
  weeks ago. Here's what [N] people playing it taught me."* Numbers + lessons. This closes the loop,
  gets strong engagement, and establishes Weekend Pro as a series, not an event.
- Optional cadence: one build-in-public post every week or two — *only if you enjoy it.* Don't turn a
  weekend hobby into a content treadmill.

---

## Draft copy (write once, reuse)

### The one-liner / tagline
- *"Memorize where the gaps are, then rebuild them with Tetris pieces — before the clock runs out."*
- Tagline options: **"A memory game hiding in a Tetris costume."** · "Memorize the gaps. Rebuild them.
  Beat the clock." · "Tetris, but you have to remember where the holes were."

### LinkedIn flagship post
> I've had a quiet rule for a while: the day job gets my weekdays, but my weekends are mine to build.
>
> So I made a home for that — **Weekend Pro** — a little label for the things I create in the margins
> of a full life. This is its first release.
>
> **Vanishing Tiles** is a memory-and-speed puzzle game. You get a few seconds to memorize where the
> gaps are in a grid, then you rebuild them from a tray of Tetris pieces before the clock runs out. It
> gets faster. It gets meaner. I've lost a lot of weekend hours to it.
>
> No download, no signup — you can play it in your browser right now (there's a "continue as guest"
> button, so you can just… play). Link's in the comments 👇
>
> Built with React + TypeScript + Supabase, and all the sound is synthesized live in the browser (no
> audio files — it's pure Web Audio). The difficulty curve took an embarrassing number of iterations.
>
> I'd genuinely love your feedback — what feels good, what feels broken, and how far you get. Drop your
> high score below; I'll be watching the leaderboard.
>
> More Weekend Pro things to come — one weekend at a time.
>
> \#buildinpublic \#indiedev \#webdev
>
> *(First comment: the play link + the demo clip if not in the post.)*

### Show HN
- **Title:** `Show HN: Vanishing Tiles – a memory puzzle game I built on weekends`
- **First comment:**
> Hi HN. This is the first thing I'm releasing under a small side-project label I'm calling **Weekend
> Pro** — stuff I build on nights and weekends around a full-time job.
>
> Vanishing Tiles is a memory-and-speed game: memorize where the gaps are in a grid, then refill them
> with tetromino pieces before a select clock runs out. Three difficulties — Hard makes you recall the
> gaps in the exact order they appeared. It's endless and ramps forever.
>
> Stack: React + TS + Vite, Supabase for auth/leaderboard, all sound synthesized live via the Web
> Audio API (no audio files), deployed on Vercel. Play as a guest, no signup.
>
> I'd love feedback on the difficulty curve especially — it took forever to tune. Roast away.

### Reddit (r/playmygame / r/WebGames / r/SideProject)
- **Title:** `[WebGame] Vanishing Tiles — memorize the gaps, rebuild them with Tetris pieces before the clock runs out (free, no signup)`
- **Body:** short + honest: what it is, that it's the first release from your weekend project label,
  play free as guest, and a *specific* ask ("does the difficulty ramp feel fair? how far did you get?").
  Follow each sub's rules; give feedback on a few other posts first.

### The retrospective (LinkedIn, ~2 weeks post-launch)
- **Hook:** *"Two weeks ago I launched the first Weekend Pro project. [N] people played it. Here's what
  they taught me."* → 3–4 concrete lessons (a bug someone found, a difficulty insight, a surprise) +
  what's next. Reinforces the brand and the weekends-only cadence.

---

## What success looks like (metrics)

Don't chase virality — you're validating that people *play and enjoy* it, and planting the Weekend Pro
flag. Track:

- **Quant (from analytics):** link opens → runs started → batches cleared → return visits. The
  open→start→clear funnel tells you if the game hooks people.
- **Engagement:** leaderboard signups (guest→named conversion), LinkedIn reactions/comments, HN
  points/comment count, Reddit upvotes.
- **Qual (the real prize):** feedback themes. Cluster what people say — that's your next weekend's
  backlog. Screenshot the good reactions for the retrospective post.

A modest, honest first launch that generates real feedback and a handful of engaged players is a
**win** — it's the foundation the Weekend Pro brand compounds on.

---

## One-glance timeline

| When | Do | Channels | Goal |
|------|----|----------|------|
| **Weekend 0** | Clear readiness gates; record demo; write copy; ™ + knockout search | — | Be launch-ready |
| **Weekend 1** | Soft launch (Sat), fix bugs (Sun) | r/playmygame, Discords, direct DMs | Catch bugs, seed leaderboard, get quotes |
| **Weekend 2** | The debut (Sat AM), be present in comments | LinkedIn, Show HN, itch.io, Indie Hackers, X, r/WebGames | The Weekend Pro launch |
| **+2 weeks** | Retrospective post; ship one visible fix | LinkedIn, X | Turn launch into a series |
| **Ongoing** | Optional build-in-public cadence *(only if fun)* | LinkedIn, X, Indie Hackers | Compound the brand |
