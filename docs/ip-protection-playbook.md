# IP Protection Playbook — Vanishing Tiles™

A triaged, cheap-first plan for protecting the game's intellectual property as a
solo developer, without spending money or time before the product has traction.

> ⚠️ **Not legal advice.** This is a practical summary of publicly available
> fee/procedure information to help prioritize. For anything with real money or
> legal consequence, confirm with a licensed attorney — a one-hour consult is
> cheap insurance. US-based assumptions throughout. Figures verified late 2025 /
> early 2026; re-check before filing.

The through-line: **almost all the protection you need right now is free and
automatic.** The paid steps (registration, trademark, LLC) mostly buy you
*enforcement leverage* and *liability shielding* — which only matter once there's
something worth fighting over. So: lock in the free stuff now, hold the paid
stuff until traction.

---

## ✅ Do now (free / near-free, high leverage)

1. **Proprietary `LICENSE` file** — done (see [`/LICENSE`](../LICENSE)). Holder =
   your legal name for now. A public repo does **not** forfeit copyright;
   "source-visible" ≠ "public domain."
2. **Start using ™** on "Vanishing Tiles™" and "Weekend Pro™" in the app, README,
   and marketing. Common-law trademark rights attach automatically the moment a
   name is used in commerce — free, no filing. (Do **not** use ® — that's only
   legal once you hold a *federal* registration.)
3. **Run the free USPTO knockout search** at <https://tmsearch.uspto.gov/>
   (filter to Class 9 + 41) plus an App Store / Google / domain check — ~15 min.
   Do this *before* getting attached to the name, to catch an obvious blocker.
4. **Keep the Apple Developer account and GitHub repo in your own control.**
   Never let a contractor/agency own them. This is the single most important
   practical ownership point.
5. **Set a launch-day reminder to register copyright within 3 months of App
   Store launch** (see below). Free to schedule.
6. **Write the required privacy policy** before App Store submission — the app
   collects account/leaderboard data (Supabase auth, display names, stats), so
   Apple requires a public privacy-policy URL. The account-deletion feature
   ("Erase My Data") is already built and satisfies guideline 5.1.1(v).

**Total cost today: ~$0.**

---

## 💵 Do when it gets traction (or near launch)

7. **Register the copyright — ~$45** (Single Application, one solo author) for
   the source code as a literary work, filed via <https://www.copyright.gov/registration/>.
   **The magic window: within 3 months of first public launch.** That timing is
   what unlocks **statutory damages ($750–$30,000/work, up to $150,000 if
   willful) + attorney's fees** against a clone — without it you're limited to
   hard-to-prove actual damages, and (for US works) you can't even file suit
   until you've registered. You can redact trade secrets in the deposit. This is
   the **highest bang-for-buck paid step.** Optionally a second ~$45–65
   registration for the audiovisual work.
8. **File the federal trademark — ~$350** (single class, base fee, via the USPTO
   Trademark Center) once committed to the name. **Class 9** = downloadable game
   software (start here); add **Class 41** (online/multiplayer game *services*,
   ~$350 more) only if relevant. Pick goods/services descriptions from the USPTO
   ID Manual to avoid surcharges. Consider a 1(b) "intent-to-use" filing to lock
   priority pre-launch if the knockout search is clean.
9. **Form an LLC — ~$50–$300** + possible annual fee — when you have revenue,
   collaborators, outside money, or want the org (not personal) name as the App
   Store seller. Then assign the IP into it and update the copyright notice to
   `© 2026 Weekend Pro LLC`. (Watch state annual fees — e.g. CA ~$800/yr min;
   AZ/MO/NM/OH charge none.)
10. **One hour with an IP attorney** — a few hundred dollars — right before
    spending real money on #7–9, to sanity-check trademark + entity for your state.

---

## 🚫 Skip for now

- Federal trademark filing *before* validating the name/product.
- Copyright registration *before* launch (use the post-launch 3-month window).
- LLC *before* revenue/risk exists (especially in a high-annual-fee state).
- The ® symbol (illegal until you hold a federal registration).
- Comprehensive attorney searches, international filings, patents (game
  *mechanics* generally aren't patentable and it's hugely expensive).

---

## Public vs. private repo

A *public* proprietary repo gives portfolio value + discoverability but **zero
secrecy** — anyone can read (not legally *use*) the code. GitHub has no
"public README, private code" mode on one repo; making it private hides
everything (README, About, topics included). For a game whose mechanic is simple
enough to clone just by playing it, the source isn't the moat — execution,
polish, brand, and shipping cadence are. Guard the **name and secrets**, not the
source. (Verified: `.env.local` is gitignored; no keys are committed.)

---

## The one-line takeaway

Your copyright already exists for free. The single paid step actually worth
prioritizing is a **$45 copyright registration within 3 months of App Store
launch** — everything else is either free-and-now or wait-for-traction.

### Sources
- US Copyright Office fees & registration — copyright.gov/about/fees.html · copyright.gov/registration · Circular 61
- Statutory-damages timing — 17 U.S.C. § 412
- USPTO 2025 fee changes & search — uspto.gov · tmsearch.uspto.gov
- LLC costs — chamberofcommerce.org/llc-costs-by-state
- Apple — developer.apple.com/programs/enroll · App Store privacy & user data
