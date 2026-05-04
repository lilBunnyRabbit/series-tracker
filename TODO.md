# TODO

Deep-dive backlog for series-tracker. Ordered by `simple × useful`.

## Tier 1 — high value, low effort

- [x] **Continue watching rail on `/`** — filter `status === "watching"`, sort by `updatedAt`, show 5–8 cards with next-episode hint + `+` quick action. Surface the most-used path.
- [x] **"New episodes available" signal** — for shows in `status === "watching"`, count episodes whose `air_date <= today` but `episode_number > current progress`. Surface as: (a) badge on library card showing "+N new", (b) dedicated rail on home ("New since you last watched"), (c) sort option in watchlist. Implementation: fetch `seasonDetail` for the show's current/latest season, cache for 24h. The inverse of Upcoming — Upcoming is "what's airing", this is "what aired that you're behind on". Most useful single signal a tracker can give a returning user.
- [x] **Stats page `/stats/`** — totals (shows / movies / hours from `runtime × watchedEpisodes`), counts by status, this-year completed, avg rating, top genres. *Requires storing `genreIds` on entries going forward.* Pure local compute.
- [x] **Top rated in curated discover** — add `/tv/top_rated` + `/movie/top_rated` sections via existing `Promise.allSettled` block.
- [x] **Related / similar on info pages** — section after Cast. TMDB has two complementary endpoints: `/{kind}/{id}/recommendations` (algorithmic, what users also liked) and `/{kind}/{id}/similar` (keyword + genre overlap). Render both as `SearchResultCard` rows ("You might also like" + "More like this"), or merge & dedupe.
- [x] **Search by actor (from info page for now)** — link each `CastList` entry to a search/discover filtered by the person. Cheapest path: navigate to `/discover/browse/?with_cast=<personId>` (movies) or `?with_people=<personId>` (tv) — needs the browse page to accept those params, or open a dedicated `/person/{id}/` page later. Bridge to full person pages without committing to them yet.
- [x] **Loading skeletons** — replace "Loading..." strings with shaped placeholders (poster + lines).

## Tier 2 — high value, medium effort

- [x] **Upcoming page `/upcoming/`** — fetch `seasonDetail` for shows in `status === "watching"` with un-aired episodes, group by air date (this week / next week / later). TMDB has the data; complexity is orchestration + caching.
- [x] **"Mark caught up" button** — given today's date + season episode air dates, set `progress` to count of aired episodes. One button per season row. Pairs with Upcoming.
- [x] **Where to watch** — `/tv/{id}/watch/providers` + `/movie/{id}/watch/providers` (JustWatch data, logos, region link). Region from `navigator.language`, manual override in settings.
- [x] **Clickable cast → person pages** — `/person/{id}` + `/person/{id}/combined_credits`. Lets users browse "what else is X in?". Supersedes the lightweight "Search by actor" item once built.

## Tier 3 — nice polish

- [x] **Settings improvements**
  - [x] Clear-cache button (drops in-memory TMDB cache)
  - [x] Haptics on/off toggle (wire to `setHapticsMuted`)
  - [x] Default add status (skip the picker if user has a preferred default)
  - [x] Region selector for watch providers
  - [x] Group settings into sections: API → Backup → Preferences → Danger zone
- [x] **Search by kind tabs** — TV / Movies / All filter on results page. Data already split by `media_type`.
- [ ] **Keyword/theme browsing** — `/keyword/{id}/movies` for "more like this" via shared themes.
- [x] **iCal export of upcoming** — `.ics` download from Upcoming page (~50 lines RFC-5545).

## Tactile / mobile-feel — follow-ups to v0.2.0

The press / haptic / sheet pass shipped in 0.2.0. These were scoped out and are worth their own commits.

- [ ] **View Transitions API for navigation** — wrap SvelteKit nav in `document.startViewTransition`. Detail pages slide in from the right; back-navigation slides out. Pair with `view-transition-name: card-{kind}-{id}` on poster wrappers in `LibraryCard` / `PosterCard` / `EpisodeCard` and on the hero poster in detail pages → shared-element animation when a Continue Watching card opens its detail page. ~30 lines of glue + per-card style attribute. Ship as `0.3.0` since it's user-visible.
- [ ] **Pull-to-refresh** on `/`, `/watchlist`, `/upcoming` — wraps `<main>`'s direct children with a touch-handler that translateY's on overdrag and fires a refresh on threshold cross. Spec: ~50 line action; haptic on threshold crossed; respects `prefers-reduced-motion`. Each route passes its own `onRefresh` (re-fetch upcoming buckets, re-warm new-episode signal, etc.).
- [ ] **Counter flip animation in `SeasonCounter`** — when `current` changes, the displayed number pops from old to new with a quick translateY + fade. Requires keying the number span on `current` so Svelte re-mounts it; CSS `@starting-style` does the rest. Pure cosmetic but completes the "press feedback fires for every action" loop.
- [ ] **Page-load stagger on rails** — when home / discover renders multiple rails at once, fade-and-rise each rail with a 30–50ms stagger. Single `@keyframes` + `animation-delay: calc(var(--i) * 40ms)` on each Rail wrapper. Skip when `prefers-reduced-motion`.
- [ ] **44×44 hit-target audit** — most icon buttons were bumped from h-7/h-8 to h-9/h-10 in 0.2.0, but a sweep with the Chrome DevTools "Tap target" audit would catch the stragglers (e.g. inline IMDb chips on info pages, the tiny ⌕ icon in search history items).
- [ ] **Long-press hint** — first-time users won't discover long-press. After ~3 sessions with library items, show a one-time toast on home: "Tip: long-press a card for quick actions." Persist `seenLongPressHint: true` in `preferences`.
- [ ] **Haptics-on-toggle confirmation** — Settings → Preferences haptics toggle currently flips silently. Fire a "success" pattern on enable and a "warn" on disable so the user gets immediate feedback that the API works on their device.
- [ ] **Card-actions sheet → status change should pulse the card** — when a status change happens via the long-press sheet, briefly highlight the card border in the new status colour so the user sees the change land before the sheet closes. Pure CSS via a transient class set in `LibraryCard.$effect`.

## Clunky-now fixes

- [x] **Discover curated visual differentiation** — 4 near-identical grid sections blur together; add per-section icon/lead or rotate featured.
- [x] **Info page Track button** — for in-library entries, pair "Track" with an inline `+` next to it that bumps the next unaired episode without navigating.
- [x] **Search history dropdown** — currently shown only when query empty; turn into a typed-search suggestion list.

## Skip / defer

- Light theme (deferred)
- Per-episode checkboxes (counter is the design intent)
- TMDB community reviews (low signal)
- Public TMDB lists (duplicates Browse)
- Keyboard shortcuts (mobile-first)

## Recommended ship order

`#1 (Continue watching) → #5 (skeletons) → #3 (Top rated) → #2 (Stats) → #6 (Upcoming) → #7 (Mark caught up) → #8 (Where to watch)`

That's ~80% of the perceived-value lift in 1–2 focused sessions before getting into person pages or niche features.

## Implementation plan (post-0.2.x)

Pulls still-open items from this file + `DESIGN_TODO.md`, grouped into shippable chunks ordered by effort × impact.

### Phase 1 — quick polish wins (~30 min, no version bump)

One-touch fixes on infrastructure that already exists.

- [ ] Wire `episodeCount={c.episode_count}` on `PersonCard` in `show/[id]/info/+page.svelte` — `PersonCard` already accepts the prop.
- [ ] Pass `onAction` to the `Watch next` and `More like this` `Rail`s on info pages so the `⊕` quick-add affordance shows there too.
- [ ] Fire `success` haptic on enable / `warn` on disable in the Settings haptics toggle.
- [ ] Counter flip animation in `SeasonCounter` — key the number `<span>` on `current`; `@starting-style` for the entry transform.

### Phase 2 — tactile pass, ship as 0.3.0 (~half day)

Group these because they share the "movement / feedback" vocabulary and are user-visible enough to warrant a `CHANGELOG` entry.

- [ ] **View Transitions API for navigation** — `document.startViewTransition` wrap; `view-transition-name: card-{kind}-{id}` on poster wrappers and detail hero.
- [ ] **Pull-to-refresh** on `/`, `/watchlist`, `/upcoming` — Svelte action with touch handler + threshold + haptic; per-route `onRefresh`.
- [ ] **Page-load stagger on rails** — `--i: {index}` on each Rail wrapper, single `@keyframes` with `animation-delay: calc(var(--i) * 40ms)`.
- [ ] **Long-press hint toast** — add `seenLongPressHint` to `preferences`; show on home after ~3 sessions.
- [ ] **Card border pulse on status change** — `$effect` in `LibraryCard` watches `entry.status`, sets transient class, removes after animation.
- [ ] **44×44 hit-target audit** — manual sweep with Chrome DevTools "Tap target" audit; bump stragglers.

### Phase 3 — Continue Watching + Upcoming go landscape (~half day)

- [ ] **Swap Continue Watching rail to `EpisodeCard`** on home. Component exists (currently only in style-guide). Wire `backdrop` (still or show backdrop), `topLeft` (runtime), `bottomLeft` (`{remaining} remaining · {daysSinceUpdate}d`), `episodeLabel`, `watched`, `onMenu`. May need to fetch episode stills.
- [ ] **Add Upcoming Schedule rail to home** — pulls from `getUpcomingEpisodes`, renders `EpisodeCard` with "In Nd" badge as `topLeft`. Sits between Continue Watching and Start Watching.

### Phase 4 — new feature work (~day each)

- [ ] **Keyword/theme browsing** — `/keyword/{id}/movies` route; surface keyword chips on info pages from `detail.keywords`; integrate with discover/browse.
- [ ] **Genre tag on watchlist rows** — schema change: store `genreIds: number[]` on `Entry`, backfill via TMDB on next visit. Surface as small tag under title in `ListCard`. Pairs with Stats genre breakdown.
- [ ] **ListCard "status under poster" layout** — move status chip out of metadata row into the poster column.
- [ ] **Activity log step 2 — undo + clear-all** — surfaces on top of the step-1 read-only feed at `/activity/`. Adds:
  - per-row `Undo` button when (a) the action is `< 24h` old, (b) `undoneAt` is unset, (c) no newer action exists for the same `(kind, refId)` — prevents the "rolling back through someone else's later edit" footgun.
  - `store.undoAction(id)`: replaces `state.library[key]` with `action.prev` for all types except `add` (→ `removeFromLibrary`) and `remove` (→ re-add `prev`). Mark the action `undoneAt` rather than deleting it; do not push a new "undo" action (avoids redo loops).
  - `Clear activity history` button in Settings → Danger zone, sets `state.actions = []`. Distinct from wipe library / wipe all.

  Step 1 already persists `prev` on every action and reserves `undoneAt`, so no schema migration is needed. *Complexity: small UI plus undo correctness — budget half a day.*

### Suggested ship order

`Phase 1` (commit, no bump) → `Phase 2` (0.3.0) → `Phase 3` (0.3.1 or 0.4.0) → `Phase 4` items individually as picked up.
