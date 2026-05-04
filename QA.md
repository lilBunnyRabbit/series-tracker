# QA / Bug tracker

Ongoing list of bugs and small UX gaps caught in real use. Fix order is `bug > regression > polish > feature idea`. New entries go to the bottom of their tier; close them with `[x]` and a short note (commit hash or "fixed in vX.Y.Z") when shipped. When an entry grows past two lines, give it its own subsection and link to it from the tier list.

Sister docs: `TODO.md` (deep-dive backlog), `DESIGN_TODO.md` (UX direction). Items here are smaller, sharper, born from "this is broken / this annoys me right now" rather than design vision.

## How to use this file

- **Bugs** — broken behavior. Always top priority.
- **Friction** — works, but feels wrong. Triage by frequency × annoyance.
- **Feature ideas** — net-new. Only pull when bug + friction queues are empty, or when an idea is small enough to bundle with adjacent work.
- When a feature idea matures past one bullet, promote it to `TODO.md` and leave a one-line pointer here.

### Complexity scale

Each item is tagged `[XS]` / `[S]` / `[M]` / `[L]`. Rough budget so picking the next thing to do is cheap:

- `[XS]` — < 15 min. One-line / one-prop fix, no design questions.
- `[S]` — < 1 h. Single file, no schema or state-shape change.
- `[M]` — half-day. Crosses 2–3 files or touches a component contract; small design call required.
- `[L]` — full day+. Schema/IDB change, new route, or genuine design work; should probably get its own version bump and a `TODO.md` entry once scoped.

## Bugs

- [x] `[M]` **Watchlist drawer slide-down not working** — root cause was that the only swipe-to-dismiss impl lived inline in `StatusMenu.svelte`, so every other sheet had a handle bar but no gesture wired up. Extracted into a generic `swipeToDismiss` Svelte action in `tactile.ts` and applied to the watchlist sort/view sheet, `CardActionsSheet`, `RandomPickerSheet`, `DiaryLogSheet`, and the new episode-actions sheet on the season page. `StatusMenu` now uses the same shared action. See *Recently fixed*.
- [x] `[S]` **Search result shows duplicate status badge** — root cause was in `PosterCard.svelte`, not search: the labelled pill under the title pushed the year onto a second row and read as a redundant badge whenever a card had a status. Replaced it with a small dot overlay on the poster image so the soft border + dot are the only library-state signals. See *Recently fixed*.
- [x] `[S]` **Search result status is mispositioned after add** — fixed by the same `PosterCard` change. Year is back on a single line; the action-slot chip in search continues to act as the +Add slot replacement.
- [x] `[XS]` **Settings locale description wraps to multiple lines** — copy tightened to a single line. See *Recently fixed*.
- [x] `[XS]` **Season rating "scroll to top" actually needs scroll-to-middle** — `scrollIntoView` block changed from `start` to `center` in the season page. See *Recently fixed*.

## Friction / UX gaps

- [x] `[M]` **Manual episode toggle** — added a per-episode boolean track via `watchedEpisodes?: Record<number, number[]>` on `TvEntry`, only persisted when the user goes non-contiguous (e.g. watched E1 + E3 but not E2). Episode rows now have two tap targets: the small circle indicator (`store.toggleEpisode`) flips just that episode, while the body of the row keeps the existing "mark watched up through E{N}" contiguous flow (`store.setProgress`). Helper `isEpisodeWatched(entry, season, ep)` in `types.ts` reads the explicit set when present, otherwise falls back to the progress counter — so other surfaces (season info page, library cards, stats) work unchanged. The store keeps `progress[season]` equal to the watched count regardless of mode, so all the existing display code that reads `progress` as a count is correct in both modes; contiguous-mode actions (setProgress, completeSeason, resetSeason, setStatus("completed"), syncTvSeasons trim, +/- when not in explicit mode) clear the explicit set, and `toggleEpisode` collapses back to counter mode whenever the resulting set is contiguous from E1. See *Recently fixed*.
- [ ] `[L]` **Drop navbar, make the island dynamic** — replace fixed top bar with a Dynamic Island-style chip that morphs into a back button on detail routes and into the page title elsewhere. Likely lives in the layout (`src/routes/+layout.svelte`) and wraps `PageHeader.svelte`. Big visual change — scope as its own commit, ship under a minor bump. *Complexity: layout-level, route-aware, motion design — touches every page.*
- [x] `[S]` **Watch next / More like this should show status dot** — `status={store.get(...)?.status}` now passed to `PosterCard` on both rails, on movie + show info pages. See *Recently fixed*.
- [x] `[S]` **Picker: exclude unaired titles** — `hasAired()` predicate added to `src/routes/picker/+page.svelte`; applied to `filtered` and `counts`. Year-precision (we only store `year`, not full date), so a release later in the same year still passes — that's the conservative call. See *Recently fixed*.
- [x] `[XS]` **Longer search debounce** — bumped from 250 ms to 350 ms. Skipped the "searching…" indicator since `loading` already flips immediately when the request fires.

## Feature ideas

### Small (bundle-able)

- [x] `[M]` **"Rewatchable" status / flag** — `rewatchable?: boolean` added to both `TvEntry` and `MovieEntry` (schema bumped 4 → 5; no migration logic — the field is purely additive). Surfaces wired:
  - **Show / movie pages** — toggle row below the rating picker, just above the notes editor. Uses the secondary accent so it reads as a separate dimension from status colour.
  - **Picker boost** — each rewatchable entry takes 2 slots in the pre-shuffle lottery; sampling is dedup'd so the bracket never pits a title against itself.
  - **Watchlist filter** — `?rewatch=1` URL param + a chip in the sort/view sheet ("Rewatchable only" with live count). The sort/view trigger picks up a small dot when the filter is active so the user can see at a glance.
  - **Profile** — new "Rewatchable" poster shelf on the stats page (top 8 by rating, then recency), with a "Browse all →" link to the filtered watchlist.
- [x] `[M]` **Picker: tournament tree view after pick** — bracket history captured per pick (`{ a, b, winnerSide, round }`), and the result screen now has a "Show bracket" button that reveals every match grouped by round (Final / Semifinal / Quarterfinal / Round N). Each match is a 1fr_auto_1fr row with both posters and titles; loser is faded + struck-through, winner is full opacity. Cleared and re-built on Pick again.
- [ ] `[L]` **Picker: more mechanics** — open question. Current is single-pick. Brainstorm:
  - mood-based ("short / long", "light / heavy", "comfort / challenge")
  - "spin again" with weighted re-roll
  - "two-show coin flip" for when only torn between two
  - genre-locked roll
  - "haven't touched in N months" decay-weighted picker
  Pick one, prototype, see what sticks. Don't ship all at once. *Complexity: each individual mode is S–M, but design + UX + entrypoint integration push the umbrella to L.*

### Medium (own commit)

- [~] `[L]` **Action history / activity log** — step 1 shipped: `state.actions: ActionEntry[]` (embedded in the persisted store, schema bumped 5 → 6, capped at 200), `pushAction` hooks across every library mutation, read-only `/activity/` route grouped by day with relative timestamps, settings link. `prev` snapshot is captured on every action so step 2 (undo + clear-all in danger zone) can drop in without a migration — promoted to `TODO.md`.
- [ ] `[M]` **Browse infinite scroll** — replace pagination on `/discover/browse/` with `IntersectionObserver`-driven append. Keep page param in URL for back-restore. Consider if pagination component (`Pagination.svelte`) stays for keyboard / accessibility fallback. *Complexity: IO is easy, scroll-restore on back-nav and URL-state coherence are the awkward bits.*

### Speculative

- [x] `[M]` **Share / "Open with"** — both directions wired. Outbound: a `Share` button on movie and show pages calls `navigator.share` with the canonical TMDB URL (feature-detected; hidden on browsers without the API). Inbound: `share_target` added to the manifest (GET, action `${SCOPE}share/`, params { title, text, url }) and a new `/share/+page.svelte` parses any of the three carriers for `themoviedb.org/(tv|movie)/{id}` (also matches the app's own routes), then `goto(...)` with `replaceState: true` so the receiver step doesn't pollute the back stack. Misses fall back to a one-tap search using the shared text. Prerenders cleanly under the static adapter.

## Recently fixed

- 2026-05-04 — **Activity log (step 1)** — new `/activity/` route with a chronological list of every library mutation (add/remove/status/progress/rating/notes/rewatchable/specials/season-complete/season-reset/episode-toggle/season-rating). Backed by `state.actions: ActionEntry[]` embedded in the persisted store (schema 5 → 6, capped at 200), with `pushAction` hooks added across the matching `store.svelte.ts` methods. Background paths (`setBackdrop`, `syncTvSeasons`) and mass operations (`wipeLibrary`, `wipeAll`, `importJson` itself) intentionally skip the log. Each action snapshots the pre-mutation entry into `prev` so the deferred step 2 (undo + clear-all) can land without a migration. Settings → Activity links to the feed.
- 2026-05-04 — **Bottom sheets dismiss with swipe-down across the app** — extracted the `swipeToDismiss` Svelte action into `src/lib/tactile.ts` and applied it to every dialog with a handle (watchlist sort/view, `CardActionsSheet`, `RandomPickerSheet`, `DiaryLogSheet`, `StatusMenu`, the new episode-actions sheet on the season page). Each sheet now has a generous `*-drag` zone (`touch-action: none`) wrapping a smaller visual handle pill so the gesture has a real touch target.
- 2026-05-04 — **Per-episode tracking + split tap targets** — `watchedEpisodes?: Record<number, number[]>` on `TvEntry` plus `store.toggleEpisode` and `isEpisodeWatched()` helper. Episode rows in `src/routes/show/[id]/season/[season]/+page.svelte` are now `<li>` containers wrapping two adjacent `<button>`s (circle = per-ep toggle, body = mark-up-to-here). Season info page picks up the same helper for its watched indicator.
- 2026-05-04 — **Rewatchable flag** — `rewatchable?: boolean` on `Entry`, schema bumped to 5, `store.setRewatchable`, toggle on show + movie pages, picker boost (2× slots), watchlist filter (`?rewatch=1` + chip in the sort/view sheet), and a profile shelf on `/stats/`.
- 2026-05-04 — **Picker bracket reveal** — `bracketLog` captured per pick (a, b, winnerSide, round) and surfaced behind a "Show bracket" toggle on the result screen. Matches grouped by round with the named labels (Final / Semifinal / Quarterfinal).
- 2026-05-04 — **Web Share + share_target** — outbound `Share` button on show + movie pages (`navigator.share`, feature-detected); inbound via manifest `share_target` (GET, params { title, text, url }) routed through the new prerendered `/share/+page.svelte`, which extracts a `(tv|movie)/{id}` from the payload and `goto(...)`s the matching detail page (replaceState).
- 2026-05-04 — **Season rating scrolls to centre, not top** — `scrollIntoView` block changed `start` → `center` in `src/routes/show/[id]/season/[season]/+page.svelte`.
- 2026-05-04 — **Settings locale description fits one line** — copy tightened to "Language for TMDB titles & default region. Detected: …" in `src/routes/settings/+page.svelte`.
- 2026-05-04 — **Search debounce bumped to 350 ms** — `src/routes/search/+page.svelte`.
- 2026-05-04 — **Search result status badge no longer doubled** — dropped `status` prop from `PosterCard` in both search grids; the full-width chip in the action slot is the single source of truth.
- 2026-05-04 — **Watch next / More like this rails show status dot** — `status` prop wired on `PosterCard` for both rails on `/show/[id]/info` and `/movie/[id]/info`.
- 2026-05-04 — **Picker excludes unaired titles** — `hasAired()` predicate added to `filtered` and `counts` in `src/routes/picker/+page.svelte`. Year-precision filter (entries dated to a future year are excluded).
