# Road to v1.0

The minimum punch list to ship `1.0.0`. Anything not pulled into this file is implicitly `1.x` work — see `TODO.md`, `DESIGN_TODO.md`, `QA.md` for the wider backlog.

Currently shipping `0.17.0`. Temptation feature in flight (separate agent).

## How to use this file

- Tick `[x]` when shipped, with the version it landed in.
- Only add new entries if they materially change "is this 1.0?". Other ideas → `TODO.md` / `DESIGN_TODO.md` / `QA.md`.
- Complexity tags follow `QA.md`: `[XS]` < 15 min · `[S]` < 1 h · `[M]` ½-day · `[L]` day+.
- Tiers are a prediction, not a contract. Demote a Tier-1 item to Tier-2 (or kill it) if it stops feeling load-bearing on a re-read.
- Delete this file when 1.0 ships.

## What v1.0 means

A first stable, recommendable release.

- The dashboard story from `DESIGN_TODO.md` is finished — home reads as a dashboard, not a hybrid.
- The README accurately describes the app you'd actually be linking people to.
- No obvious "step 2 coming later" gaps in shipped features.
- Schema is whatever V9 lands with temptation; backups stay compatible.

This is **not** "the backlog is empty". Tactile polish (Phase 2 in `TODO.md`), picker variants, infinite scroll, keyword browsing — all 1.x.

## In flight

- [ ] `[L]` **Temptation feature** — schema V8→V9, heat-based engagement signal, watchlist sort, pacing preset. Plan owned by a separate agent. Once landed, the home dashboard rails in Tier 1 can optionally read the temptation value (e.g. surface "burning" titles on Continue Watching).

## Tier 1 — must ship

- [ ] `[S]` **README rewrite** — currently claims state lives in `localStorage` (it's IDB) and lists almost none of the features that exist today: Diary, Picker, Discover/Feed, Stats, Leaderboard, Activity, Upcoming, Person pages, Where to Watch, Share + share_target, Tour, Guide. Lead with a screenshot or short demo gif. The README is the first thing anyone sees at 1.0; it can't be the 0.1.0 README.
- [ ] `[M]` **Continue Watching rail → `EpisodeCard`** — landscape card with backdrop / still, runtime overlay, "N remaining · Md", episode label, ✓ + ⋯ menu. Component already exists, currently only rendered in `/style-guide`. Source: `DESIGN_TODO.md` → Home / Library.
- [ ] `[S]` **Upcoming Schedule rail on home** — driven by `getUpcomingEpisodes`, sits between Continue Watching and Start Watching, "In Nd" badge. Pairs with the `EpisodeCard` swap above. Source: `DESIGN_TODO.md`.

## Tier 2 — strongly recommended

Design intent that's already scoped but not wired. Each one is small enough to bundle into a release commit.

- [ ] `[XS]` **Wire `episodeCount` on `PersonCard`** in `show/[id]/info/+page.svelte`. Prop is already accepted.
- [ ] `[XS]` **Pass `onAction` to Watch next / More like this `Rail`s** on info pages so the `⊕` quick-add shows there too.
- [ ] `[XS]` **Haptics confirmation on toggle** — `success` pattern on enable, `warn` on disable in Settings → Preferences.
- [ ] `[S]` **Counter flip animation in `SeasonCounter`** — key the number `<span>` on `current`; `@starting-style` for entry transform.
- [ ] `[S]` **`ListCard` status chip under poster** — move status out of the metadata row into the poster column. Source: `DESIGN_TODO.md` → Watchlist.
- [ ] `[M]` **Activity log step 2 — undo + clear-all** — step 1 already persists `prev` snapshots in anticipation. Shipping a permanently read-only activity log at 1.0 leaves an obvious half-feature. Source: `TODO.md` Phase 4.

## Tier 3 — fold in if time allows

The Phase 2 tactile pass from `TODO.md` is entirely open. None of these individually blocks 1.0; if a chunk lands during the run-up, fold it into the release notes.

- [ ] `[M]` View Transitions API for navigation
- [ ] `[M]` Pull-to-refresh on `/`, `/watchlist`, `/upcoming`
- [ ] `[S]` Page-load stagger on rails
- [ ] `[S]` Long-press hint toast
- [ ] `[S]` Card border pulse on status change
- [ ] `[S]` 44×44 hit-target audit
- [ ] `[L]` Genre tag on watchlist rows — schema change to capture `genreIds` per entry, backfill on detail-page visit. Pairs with Stats breakdown.

## Explicitly 1.x or later

- Picker: more mechanics (mood-based, spin again, two-show coin flip, genre-locked, **decay-weighted — note: overlaps the temptation feature, re-evaluate after temptation lands**)
- Browse infinite scroll
- Keyword/theme browsing
- Light theme (always deferred)
- Sentiment summary (LLM dependency)
- Reviews rail
- Streak gamification
- Public TMDB lists
- Keyboard shortcuts (mobile-first)

## Ship checklist

When every Tier-1 item is `[x]`:

1. Sweep Tier 2 — anything still open either gets finished or demoted to `TODO.md`.
2. Update `src/lib/guide.ts` for any user-visible features that landed since `0.17.0` (per `CLAUDE.md`).
3. Promote `[Unreleased]` to `## [1.0.0] - YYYY-MM-DD` in `CHANGELOG.md`.
4. Bump `package.json` to `1.0.0`.
5. Confirm `README.md` reflects the shipped 1.0 (Tier-1 item).
6. `bun run check`.
7. Commit both changes (version + changelog + README + guide) together, push.
8. Delete this file.
