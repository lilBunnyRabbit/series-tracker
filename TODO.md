# TODO

Deep-dive backlog for series-tracker. Ordered by `simple × useful`.

## Tier 1 — high value, low effort

- [ ] **Continue watching rail on `/`** — filter `status === "watching"`, sort by `updatedAt`, show 5–8 cards with next-episode hint + `+` quick action. Surface the most-used path.
- [ ] **"New episodes available" signal** — for shows in `status === "watching"`, count episodes whose `air_date <= today` but `episode_number > current progress`. Surface as: (a) badge on library card showing "+N new", (b) dedicated rail on home ("New since you last watched"), (c) sort option in watchlist. Implementation: fetch `seasonDetail` for the show's current/latest season, cache for 24h. The inverse of Upcoming — Upcoming is "what's airing", this is "what aired that you're behind on". Most useful single signal a tracker can give a returning user.
- [ ] **Stats page `/stats/`** — totals (shows / movies / hours from `runtime × watchedEpisodes`), counts by status, this-year completed, avg rating, top genres. *Requires storing `genreIds` on entries going forward.* Pure local compute.
- [ ] **Top rated in curated discover** — add `/tv/top_rated` + `/movie/top_rated` sections via existing `Promise.allSettled` block.
- [ ] **Related / similar on info pages** — section after Cast. TMDB has two complementary endpoints: `/{kind}/{id}/recommendations` (algorithmic, what users also liked) and `/{kind}/{id}/similar` (keyword + genre overlap). Render both as `SearchResultCard` rows ("You might also like" + "More like this"), or merge & dedupe.
- [ ] **Search by actor (from info page for now)** — link each `CastList` entry to a search/discover filtered by the person. Cheapest path: navigate to `/discover/browse/?with_cast=<personId>` (movies) or `?with_people=<personId>` (tv) — needs the browse page to accept those params, or open a dedicated `/person/{id}/` page later. Bridge to full person pages without committing to them yet.
- [ ] **Loading skeletons** — replace "Loading..." strings with shaped placeholders (poster + lines).

## Tier 2 — high value, medium effort

- [ ] **Upcoming page `/upcoming/`** — fetch `seasonDetail` for shows in `status === "watching"` with un-aired episodes, group by air date (this week / next week / later). TMDB has the data; complexity is orchestration + caching.
- [ ] **"Mark caught up" button** — given today's date + season episode air dates, set `progress` to count of aired episodes. One button per season row. Pairs with Upcoming.
- [ ] **Where to watch** — `/tv/{id}/watch/providers` + `/movie/{id}/watch/providers` (JustWatch data, logos, region link). Region from `navigator.language`, manual override in settings.
- [ ] **Clickable cast → person pages** — `/person/{id}` + `/person/{id}/combined_credits`. Lets users browse "what else is X in?". Supersedes the lightweight "Search by actor" item once built.

## Tier 3 — nice polish

- [ ] **Settings improvements**
  - [ ] Clear-cache button (drops in-memory TMDB cache)
  - [ ] Haptics on/off toggle (wire to `setHapticsMuted`)
  - [ ] Default add status (skip the picker if user has a preferred default)
  - [ ] Region selector for watch providers
  - [ ] Group settings into sections: API → Backup → Preferences → Danger zone
- [ ] **Search by kind tabs** — TV / Movies / All filter on results page. Data already split by `media_type`.
- [ ] **Keyword/theme browsing** — `/keyword/{id}/movies` for "more like this" via shared themes.
- [ ] **iCal export of upcoming** — `.ics` download from Upcoming page (~50 lines RFC-5545).

## Clunky-now fixes

- [ ] **Discover curated visual differentiation** — 4 near-identical grid sections blur together; add per-section icon/lead or rotate featured.
- [ ] **Info page Track button** — for in-library entries, pair "Track" with an inline `+` next to it that bumps the next unaired episode without navigating.
- [ ] **Search history dropdown** — currently shown only when query empty; turn into a typed-search suggestion list.

## Skip / defer

- Light theme (deferred)
- Per-episode checkboxes (counter is the design intent)
- TMDB community reviews (low signal)
- Public TMDB lists (duplicates Browse)
- Keyboard shortcuts (mobile-first)

## Recommended ship order

`#1 (Continue watching) → #5 (skeletons) → #3 (Top rated) → #2 (Stats) → #6 (Upcoming) → #7 (Mark caught up) → #8 (Where to watch)`

That's ~80% of the perceived-value lift in 1–2 focused sessions before getting into person pages or niche features.
