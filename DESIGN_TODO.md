# DESIGN TODO

UX direction inspired by reference screenshots. Colors out of scope — these are layout & interaction patterns.

## Universal patterns to adopt

- [x] **Horizontal scrolling rails** as the primary content-discovery pattern. Each rail is a section: title + `›` chevron (tap to "see all") + optional `⊕` quick-action on the right.
- [x] **Section header convention** — left-aligned heading, chevron link, far-right small icon button (e.g. add/expand). Reuse on home, info, search.
- [x] **Per-card three-dot menu** for quick actions (status change, remove, mark complete) without navigating to detail.
- [x] **Episode-watched checkmark** (small ✓) directly on cards in any rail, so the visual state is readable mid-scroll.
- [x] **Card overlay metadata** — bottom-of-poster strip for context (runtime, "X remaining · Nd", "In 3 days", episode count). Single-line, dark-tinted readability.

## Home / Library — multi-rail dashboard

The library page becomes a dashboard of rails. The current grid moves to "All" / "Watchlist" (kept, accessed via bottom-nav or a "see all").

- [ ] **Continue Watching rail** — landscape cards (16:9-ish, not portrait posters) showing a scene/still or season banner. Each card:
  - Episode runtime in top-left overlay
  - "N remaining · Md" in bottom-left overlay (episodes left + days since last update)
  - Title below ("Grey's Anatomy"), then "S11 · E19 — Crazy Love"
  - ✓ if episode marked, ⋯ menu top-right
  - **Status:** rail exists on home, but uses portrait `PosterCard` with `S/E · N left` meta. To complete: swap to `EpisodeCard` (already built, currently only shown in style-guide), wire `topLeft` (runtime), `bottomLeft` (`N remaining · Md`), `episodeLabel`, `watched`, `onMenu`.
- [x] **Start Watching rail** (= our "plan to watch") — portrait poster cards, compact label "S1 · E1" or runtime ("2h").
- [ ] **Upcoming Schedule rail** — landscape stills, "In 3 days" badge, "S24 · E13 - Title". Driven by air-date data.
  - **Status:** standalone `/upcoming/` page exists with bucketed list rows, but no rail on home. To complete: add rail to home using `EpisodeCard` driven by `getUpcomingEpisodes`.
- [x] **History rail** — recently completed / dropped, lightweight chronological view.
- [ ] **Streak card** (defer / nice-to-have) — gamified watching streak with day pips. Lives between rails.

## Detail / Info pages

Restructure into one continuous scroll: hero → action bar → overview → rails.

- [x] **Hero = poster only** (no separate backdrop). Centered, large, drop-shadow. Frees us from the cropping issues we hit earlier.
- [x] **Multi-source rating row** under poster — small icons + percentages (TMDB ★, IMDb if linked, RT if available — we only have TMDB now, but lay out the row so adding sources later is one slot).
- [x] **Title block** — "Created by [linked name]", year · ep count · cert · genre, status pill (Returning Series / Ended / etc).
- [x] **Action bar** — pill row of icon buttons: ✓ (primary, highlighted), 🔖 save/plan, ▶ trailer, ⋯ more. Currently we have wide labeled buttons; icons-in-a-pill is denser and more on-brand for a tracker.
- [x] **Where to Watch rail** — provider logo cards labeled "Stream" / "Buy" / "Rent". Region-aware. (Pairs with the Tier-2 watch-providers TODO.)
- [x] **Actors rail** — circular/portrait-cropped headshots, episode count overlay ("20 eps."), name + character below. Tap → person page (Tier 2) or fallback to actor search.
- [x] **Related Shows rail** — portrait posters with year + ep count. Wire to existing recommendations + similar endpoints.
- [ ] **Sentiment summary** (defer — heavy, needs LLM) — bullet pros/cons. Skip for now, but design the page so the slot is there.
- [ ] **Reviews rail** (defer — already in skip list) — but if added later, rail format with reactions + comment count fits.

## Search

- [x] **Search input at bottom** of viewport (above nav) — better one-handed reach on mobile. Sticky.
- [x] **Filter chips above the input** — Media (selected), Calendar, Target/genre, Person, List. Toggles facets.
- [x] **3-column poster grid** for results, more density than current 1–2 columns. Current `SearchResultCard` becomes the rail format; compact poster grid becomes the search format.
- [x] **Top Searches when empty** — render a curated/popular grid where the empty state currently lives. Already have search history; can co-exist as a small chip row above the grid.
- [x] **Card metadata** — small icon + year (`📅 2026` for upcoming, `▶` for series, etc.) under poster. Bookmark indicator if in library.

## Card vocabulary (consolidate)

We end up with ~four distinct card formats. Worth componentizing properly:

- [x] **EpisodeCard** (landscape, overlay metadata) — Continue Watching, Upcoming.
- [x] **PosterCard** (portrait, year + ep count below) — Start Watching, Related, Search grid, Discover.
- [x] **ListCard** (horizontal row, background-image bleed) — Watchlist all-view (our current "compact" but with the poster + bleed treatment from the screenshots).
- [x] **PersonCard** (portrait headshot, ep count overlay) — Actors rail.

## Watchlist (current Library home, repurposed)

When the dashboard becomes home, the existing filterable grid lives at `/watchlist/` (or `/library/`). Keep filters/sort/views, but apply the row treatment from screenshot 4:

- [x] **Background-image bleed** — the show's backdrop fades in from the right behind the metadata text. Subtle, not loud.
- [ ] **Bookmark/status icon under poster** — small chip showing status without taking metadata-row space.
  - **Status:** `ListCard` shows status inline in the metadata row, not as a separate chip under the poster column.
- [x] **Personal rating right-aligned**, prominent (★ %).
- [ ] **Genre as a visible tag** under title (we don't store genre on entries today; would need to capture at add time).

## Bottom navigation

Screenshots show 5 tabs: home, ✨ (discover), ☰ (watchlist), 🔍 (search), 👤 (profile/notifications).

- [x] **Add a Profile/Stats tab** — fits the Tier 1 stats page TODO. Replaces or sits next to settings.
- [x] **Discover gets the ✨ slot** as the second tab (we already have this).
- [x] **Reorder if home becomes a dashboard**: Home, Discover, Watchlist, Search, Profile.

## Polish details worth stealing

- [~] ~~**`⊕` quick-add affordance** on every section header~~ — **killed.** Tried briefly (Start Watching had one in 0.x), removed in 0.16.0 along with the home top-right search button. Cards read better when the only library affordance is the status border + dot; rails get to where they need via tap, not a corner button. See `src/lib/roadmap.ts` → "Won't ship".
- [ ] **Episode count badge on actor cards** — clever way to show "this actor's involvement in THIS show", not their general fame.
  - **Status:** `PersonCard` accepts `episodeCount`; show info doesn't pass it. To complete: pass `c.episode_count` from TMDB credits in `show/[id]/info/+page.svelte`.
- [x] **"In Nd" / "X remaining" copy** — relative time strings instead of absolute dates on watching/upcoming cards.
- [x] **Status pill in colored text** under metadata (e.g. "Returning Series" in accent) — small but communicates state at a glance.

## Out of scope / explicit no

- AI sentiment summary (LLM dependency, heavy).
- Reviews / community comments (already deferred — clutters tracker).
- VIP / paywall surface (we are not selling anything).
- Streak gamification (cute, defer).
