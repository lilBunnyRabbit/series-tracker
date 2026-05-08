# Changelog

All notable user-visible changes to Series Tracker. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.23.0] - 2026-05-08

### Added
- First-time long-press hint: after a few app sessions, a one-time toast appears on Watchlist — "Tip: long-press a card for quick actions" — with a Got it button and an auto-dismiss after a few seconds. Won't reappear once seen.

### Changed
- Home rails (Continue Watching, Upcoming, Start Watching, History) and Discover sections (Trending, Recommended, Popular, Top rated) now fade-and-rise on page load with a small per-row stagger, so the page reads as content flowing in rather than appearing all at once. Skipped automatically when the OS prefers-reduced-motion is set.
- Tap-target audit: the ⋯ menus on watchlist cards, the diary edit / delete buttons, the watchlist title-search clear ✕, the IMDb chips on movie + show pages, the recent-searches pills + Clear, and the +/− steppers in the diary log sheet are all bumped up to the same minimum 36px square so they're easier to hit cleanly without zooming.

## [0.22.0] - 2026-05-08

### Added
- Started / Untouched filter on the Watchlist (in the Sort & view sheet) and the Picker. Splits your library by whether you've already cracked open a title — most useful in Plan to watch for separating fresh entries from ones you've parked partway through. Counts as "started" if a show has any watched episode or a movie is marked watched.

## [0.21.1] - 2026-05-08

### Fixed
- Home and Upcoming pages no longer fire redundant TMDB requests when warming the upcoming-episodes cache. Most noticeable on libraries with many watching shows — page opens are far quieter on the network tab.

## [0.21.0] - 2026-05-08

### Added
- Movies now support optional minutes-watched progress. On any movie in your library, drag the new ruler-style scrubber to record where you paused — minute-by-minute haptics, half-hour marks, and a soft bounce on each tick as you scroll past. The checkpoint shows up in the Continue Watching rail next to TV ("45m of 155m · 3d"), partial minutes count toward your stats hours-watched, and reaching the runtime auto-marks the movie watched.

### Changed
- Library and Watchlist cards no longer show progress bars at 0% (not started) or 100% (completed) — empty / full bars were noise once the status chip already conveys the state. Bars now appear only for in-flight progress.

## [0.20.0] - 2026-05-08

### Added
- Home: new "Upcoming" rail of landscape episode cards for shows you're watching, sitting between Continue Watching and Start Watching. Each card shows the next unaired episode's still or backdrop, an "In Nd" / "Today" / "Tomorrow" badge, and the runtime. Tap to open the show.
- Show info → Actors rail: each cast card now shows "N eps." in the corner so you can read an actor's involvement in the show at a glance.
- Settings → Haptics toggle now fires a confirmation pulse — a "success" pattern on enable and a "warn" pattern on disable — so you get device-level feedback the moment you flip it.
- Activity log: each entry from the last 24 hours now has an "Undo" button that reverts that single library change — handy for an accidental status flip, episode tick, or rating tap. Undone rows stay visible (greyed out, marked "undone") so the timeline still tells the full story.
- Settings → Danger zone: new "Clear activity log" button wipes the entire timeline of changes without touching your library, ratings, or progress.

### Changed
- Home → Continue Watching now shows landscape episode cards with the show's backdrop, per-episode runtime, and a "N remaining · Md" line so the rail reads as a real "what to play next" dashboard. The warm Temptation halo carries through onto cards in the Hot / Burning bands.
- Season counters now flip with a small slide-and-fade whenever progress changes, so every +/- press registers visually alongside the haptic.

## [0.19.1] - 2026-05-07

### Added
- Roadmap: new "Vaults & cloud sync" section under After v1.0, covering multiple separate libraries (committed) and optional per-vault sync to your own cloud storage like Google Drive (under consideration).

## [0.19.0] - 2026-05-07

### Added
- New Roadmap page in Settings — see what's lined up for v1.0, what already shipped (with the version it landed in), what's being considered post-1.0, and what's been ruled out. Linked from a new chip in the Settings header alongside Guide / Activity / Style guide.

### Fixed
- Settings header chips no longer wrap onto two lines on narrow viewports — "Style guide" now stays on a single line; the row scrolls horizontally if it overflows instead.

## [0.18.1] - 2026-05-07

### Added
- Feed setup: a "Try to restore" affordance below the saved-feeds list — scans local backups (a load-time snapshot, the previous-save snapshot, the raw IDB record, and any legacy localStorage data) for any saved feed sessions that aren't in the live list, and merges them back in. Newer wins on conflicts.

### Changed
- Storage saves are now bulletproofed against the failure mode that could overwrite a healthy IDB record with the empty default. Saves now require an explicit successful load (not just "load attempt finished"), and every save first rotates the previous successful state into a backup slot. A second load-time backup is written once per session.

### Fixed
- Post-update guide tour ("What's new in vX.Y.Z") now reliably closes when you press Skip or Get started.

## [0.18.0] - 2026-05-07

### Added
- Temptation: every title in your library now carries a 0–100% Temptation score that builds up as you engage (watching episodes, opening pages, picking it in the bracket, rating it highly) and fades over time when you don't. Visible as a heat-gradient bar on each show / movie page with band, percent, trend arrow, and a caption for the last bump.
- Watchlist: new "Temptation" sort (now the default) surfaces what you're actively in plus the candidates pulling at you for what's next.
- Watchlist + grid cards: a refined warm halo lights up cards in the Hot or Burning bands so high-temptation titles catch your eye without studying the list. The halo's hue follows the entry's status colour.
- Settings → Preferences → Temptation pacing: a 4-preset selector (Lingering / Balanced / Reactive / Restless) controls how fast scores fade — anywhere from a ~70-day half-life to ~10 days.
- Guide: a Temptation section in the in-app guide explains the score, the bands, and the pacing presets, with an animated demo bar.
- Post-update tour: after an app update, the guide tour auto-opens with just the new or updated sections (e.g. only "Temptation" this time), banner-tagged "What's new in vX.Y.Z". Skipped on builds that don't change any guide content.

## [0.17.0] - 2026-05-07

### Added
- New Guide page in Settings — a paged walkthrough of every feature, with a TOC chip rail at the top and animated demos for each section (cycling status colours, a fake season counter ticking up and down, a picker showdown alternating winners, the mobile floating-island indicator sliding between tabs). Linked from the Settings header alongside Activity and Style guide.
- First-launch tour — auto-opens once for brand-new users (empty library) on top of whatever route they land on. Eight paged steps cover the essentials: Welcome, TMDB key, statuses, finding titles, watchlist, tracking, picker, profile. Swipe, arrow keys, or buttons to navigate; "Skip" available on every step; the last step has a "View full guide" shortcut into Settings → Guide.
- "Take the tour" button on the new Guide page — opens the same first-launch tour on demand, so existing users can replay the walkthrough at any time.

## [0.16.3] - 2026-05-07

### Added
- Search: the kind tabs (All / TV / Movies) now show counts of what's on screen — search hits when you've typed a query, popular titles when empty.

### Changed
- Search: kind tabs picked up the watchlist's hero-tab styling — active tab fills the row in its category colour, inactive tabs sit compact alongside — replacing the previous round pill chips.
- Search: the input is more compact (square corners, smaller icon) so the kind tabs above it carry the visual weight of the row.
- Discover: the "Hide added" chip is now under a labelled "Filters" group, matching /discover/browse.
- Bulk search: removed the redundant "Single search" back button from the header; the bottom island already carries that affordance.
- Feed setup: saved feeds get a richer card with a kind-coded accent bar (TV vs Movies), a "TV"/"Movies" pill next to the sort name, every applied genre listed by name (wrapping rather than truncating), and a page + item position line — much easier to tell two saved feeds apart at a glance.

### Fixed
- Feed: a forward swipe on the last loaded card while the next page is still loading no longer leaves you stuck — the advance lands automatically as soon as the next card arrives, instead of forcing a re-swipe.
- Feed: adding a saved show from its details page no longer breaks resume. Coming back to the feed with "hide already added" on used to drop you at the top of the page (no "where you left off" marker) and not save further progress until you scrolled well past your old spot.
- Feed: the action rail no longer shifts left when a card's status is "Plan to watch" — that label is shortened to "Plan" in the rail, and the column itself is pinned to a fixed width so longer labels can never push the circles around.

## [0.16.1] - 2026-05-06

### Changed
- Profile: removed the entry count badge from the Diary action so it lines up with Leaderboard and Settings as a plain icon-and-label chip.

## [0.16.0] - 2026-05-06

### Added
- Mobile: a new "page actions" rail rises out of the top of the floating island, carrying page-specific shortcuts like Upcoming/Pick on Watchlist, Surprise/Feed/Browse all on Discover, Diary/Leaderboard/Settings on Profile, and Activity/Style guide on Settings. The rail scrolls horizontally if it overflows, and animates in/out when you change pages.
- Watchlist: All / TV / Movies tabs now show counts that respect the active status filter — pick "Watching" and you see how many TV shows vs movies are in that bucket at a glance.
- Browse: a "Filters" section grouping Hide added with the sort dropdown on its own row, separate from the kind tabs above.

### Changed
- Mobile: dropped the top navbar. The bottom island now carries both the tab nav (on hub pages) and the back arrow + page title (on detail pages), and stays visible while scrolling instead of hiding away.
- Search: dropped the bottom-docked search island. The query input, kind filter (Media / TV / Movies), and Bulk button now live at the top of the page like a normal search; recent searches are a single horizontal scrolling row.
- Hub pages (Home, Discover, Watchlist, Search, Profile) no longer show a redundant page title — the highlighted tab in the island already tells you where you are. Other pages have unified titles that match the island's back-mode label.
- Browse and Feed: removed redundant back-to-parent buttons since the back island carries that affordance now.
- Watchlist: filter button moved next to the title-search input. "Pick" no longer dominates the row — uses the same opacity-tinted accent style as other shortcuts.
- Home: dropped the top-right search button and the "Open feed" CTA at the bottom; tightened spacing between Continue Watching, Start Watching, and History rails. Removed the "+" quick-add button on the Start Watching rail.
- Upcoming: the Calendar download button now sits next to the page title instead of in the actions rail.

## [0.15.0] - 2026-05-06

### Added
- The feed setup screen now lists every saved feed you've left in progress, not just one. You can keep parallel resume points (e.g. one for TV / Popular and another for Movies / Newest) and pick whichever to jump back into.
- Each saved feed row has a small trash button to drop it; tapping asks for confirmation so you don't lose a deep session by mistake.

## [0.14.7] - 2026-05-05

### Fixed
- Scrolling backward in the feed to load earlier pages now drops you into the just-loaded content instead of teleporting you to the first item of the page you were on.

## [0.14.6] - 2026-05-05

### Changed
- Resuming a deep feed session is now nearly instant. Instead of paging through every TMDB page from the start to find your saved card, the feed jumps straight to the page you left off on. Scrolling backward from there pulls earlier pages on demand.
- Feed only renders the cards near the one you're viewing — the rest are lightweight placeholders. Long sessions no longer pile up hundreds of full cards in memory.
- Position counter shows your absolute position in the feed (e.g. `3142 / 11921`) instead of your spot within the currently-loaded window, so the number stays meaningful across resumes.

## [0.14.5] - 2026-05-05

### Fixed
- Items you add from the feed no longer disappear when "hide already added" is on and you tap into the details, then back. The card stays in the queue so you can keep scrolling from where you were.

## [0.14.4] - 2026-05-05

### Fixed
- Feed resume now reliably brings you back to the card you left off on — even after a deep scroll. The "left off" marker only ever advances; if a resume can't find your card, the saved spot is preserved instead of being overwritten with the top of the feed.

## [0.14.3] - 2026-05-05

### Added
- Position counter in the feed — top-right pill showing your spot in the queue (e.g. `5 / 47`). Flashes in when you change cards and fades out a moment after.

## [0.14.2] - 2026-05-05

### Changed
- Feed swipes now feel sharper on iPhone — momentum scrolling is disabled on the carousel so the scroll stops the instant your finger lifts, and the pointerup snap actually feels like a snap. Smaller flicks also commit to the next card.

## [0.14.1] - 2026-05-05

### Changed
- Feed scroll reverted to native browser scroll-snap. The JS-driven and library-based variants we tried over the last few releases all hit mobile main-thread limits and felt laggy on phones; native scroll-snap runs entirely on the compositor thread and is the smoothest path available.

## [0.14.0] - 2026-05-05

### Changed
- Feed now uses Embla under the hood for the swipe + snap. Drag follows your finger through to the next card without an obvious "stop, then snap" — momentum carries continuously into the commit. Should feel noticeably smoother on phones.

## [0.13.8] - 2026-05-05

### Fixed
- Removed a frame of input lag from feed swipes. The drag now updates the moment your finger moves instead of waiting for the next animation frame.

## [0.13.7] - 2026-05-05

### Fixed
- Feed drag now tracks your finger smoothly on mobile — drag updates are batched to one paint per display frame instead of one per touch sample.

## [0.13.6] - 2026-05-05

### Fixed
- Feed swipes are noticeably smoother on mobile — the frosted-glass blur on the action-rail buttons now drops out while you're actively swiping and reappears when the card settles.

## [0.13.5] - 2026-05-05

### Fixed
- Feed no longer shows a sliver of the next card peeking up from the bottom of the screen.
- Feed swipes feel smoother on mobile — fewer GPU layers in flight while you drag.

## [0.13.4] - 2026-05-05

### Changed
- Feed scrolling redesigned for snappier swipes — your finger now drags the card directly without any browser momentum, and release commits cleanly to the next card. Quick flicks advance reliably without overshooting.
- Loading and end-of-feed indicators now appear as a small overlay pill at the bottom of the active card, instead of a separate slot you have to swipe past.

### Added
- Keyboard navigation in the feed — arrow keys, Page Up / Down, Home, End, and Space all step between cards.

## [0.13.3] - 2026-05-05

### Changed
- Feed title moved up under the poster as a large centered headline, with year/rating/genres/overview now living below as supporting metadata.
- "Where you left off" marker is now a horizontal stripe with accent gradient lines, sitting between the poster and the title — replaces the small chip in the top corner.
- Year is now the headline of the meta row (1.25rem semibold), with rating, language, and genres reading as supporting detail.
- Overview now wraps up to 6 lines (was 3), filling the space the title used to occupy.

## [0.13.2] - 2026-05-05

### Changed
- Feed cards now snap instantly on release — no animation, no glide, the next card is just there. A fast flick advances even on a tiny swipe.
- Active feed view goes full-screen with no top bar — back now sits at the bottom of each card's action rail, beneath Details and Add.

### Fixed
- Feed no longer wedges on "Loading more…" once TMDB returns a page of titles you've already seen. Duplicates are now skipped and the next page is fetched automatically.

## [0.13.1] - 2026-05-05

### Fixed
- Feed resume now lands you back on the right card after a deep scroll. Previously, returning from a detail page would silently snap you to the top of the feed if your last-viewed card was past the first hundred items.

## [0.13.0] - 2026-05-05

### Added
- New "Feed" browse mode under Discover — full-screen, swipe-up scroll through TV shows or movies. Pick kind, sort, genre, and hide-added filters on the setup screen, then thumb through cards with a top backdrop, status-bordered poster, title, rating, genres, and overview. Pagination loads in the background as you scroll, and titles you add stay in place instead of vanishing from the queue.
- TikTok-style action rail on each feed card — circular Details and Add / Change-status buttons pinned to the right edge.
- The feed remembers where you left off — re-entering with the same filters (after opening details, reopening the app, or using "Resume where you left off" on the setup screen) snaps you back to that card with a "Where you left off" marker.

## [0.12.0] - 2026-05-05

### Added
- Network and studio chips on show info pages, and a studios chip row on movie info pages — logo + name surfaced right under the overview.
- Filter watchlist by title — search input above the library list narrows by title (and notes). Synced to the URL so filtered views are shareable.

### Changed
- Person page rails ("Known for", "As Producer", etc.) now show the status dot + tinted border on titles already in your library, matching the rest of the app.
- Search results scroll to the top automatically after each query so the first row stays visible above the soft keyboard.
- Quick actions status grid renders consistently as plan / watching / tuned / dropped / completed (last row spans both columns).

### Fixed
- Status buttons inside the swipe-opened add picker register on the first tap instead of needing a second one (was an iOS sticky-hover quirk on the picker chips).

## [0.11.1] - 2026-05-05

### Changed
- The "update available" prompt is now a full-screen modal with a single Update now button instead of a dismissable toast. Once a new version is detected there's no way to defer it, so you always pick up the latest build on next interaction.

## [0.11.0] - 2026-05-04

### Added
- Activity log on `/activity/` — a chronological feed of recent library changes (adds, removes, status flips, progress, ratings, season completions) grouped by day with relative timestamps. Linked from Settings → Activity.

## [0.10.1] - 2026-05-04

### Fixed
- Swipe-to-add on discover cards now opens the status picker docked correctly to the viewport, matching the +Add button. Previously the swipe-triggered picker could render offset or overflow the screen, and the surrounding list could visibly shift while the sheet was opening.

## [0.10.0] - 2026-05-04

### Added
- Mark titles as **Rewatchable** from the show or movie page. Rewatchable entries are weighted ~2× in the picker's bracket pool, get a dedicated filter chip in the watchlist sort/view sheet, and surface as a poster shelf in your profile.
- Per-episode toggling on the season tracker — tapping the small circle indicator on an episode row flips just that episode, so you can mark non-contiguous watches (e.g. E1 and E3 but not E2). Tapping the rest of the row keeps the original "mark watched up through here" flow.
- "Show bracket" button on the picker's result screen reveals every match the bracket played, grouped by round (Final / Semifinal / …) with the winner highlighted and losers struck through.
- Share button on movie and show pages — uses your device's system share sheet to send the title's TMDB link.
- The PWA now appears in the system share sheet as a destination. Sharing a TMDB URL (or any link containing `themoviedb.org/tv/{id}` or `…/movie/{id}`) into Series Tracker opens the matching title; on miss, you get a one-tap search for the shared text.

### Changed
- Applying an update now opens a non-dismissable full-screen overlay that shows the version transition (vA → vB) and steps through "Installing", "Clearing cache", and "Restarting" so it's clear what's happening while the app reloads itself.
- Bottom sheets across the app (watchlist sort/view, card actions, status picker, diary log, random picker, episode actions) now dismiss with a swipe-down on the handle. Same gesture everywhere.
- Recommendation rails ("Watch next" / "More like this") on movie and show info pages now show a status dot on titles already in your library, so you can spot what's already tracked at a glance.
- Picker no longer offers titles that haven't aired yet — entries dated to a future year are excluded from the bracket pool and the status counts.
- Search debounce bumped slightly so quick typing doesn't fire a request per keystroke.
- Locale row in Settings no longer wraps to several lines on narrow screens.

### Fixed
- Poster cards no longer show a status badge above the year. The labelled pill under the title was a duplicate of the soft border + dot the card already carried; library state is now signalled by the border colour and a small dot overlay on the poster, with the year and metadata back on a single line.
- After completing a season, the rating picker centres in the viewport instead of getting pinned just under the page header.

## [0.9.0] - 2026-05-04

### Added
- Dedicated season tracker page — tap any season on a show to open a full-screen view with the episode list, season rating, and a floating control island at the bottom for fast +/- adjustments. Each episode shows runtime, air date, description, and (for watched ones) the TMDB community rating.
- Tapping any episode in the tracker marks watched up to and including that episode; tapping a watched episode unmarks it.
- "Catch up" pill on the season tracker — jumps progress to the latest aired episode in one tap, so when a show resumes airing you don't have to walk through the gap manually.
- Season info page — open from the show's More info → Seasons grid. Has a hero, season cast, and a card per episode with the still, air date, runtime, TMDB rating, overview, director, writer, and a horizontal rail of guest stars. Each guest star links to their person page.
- Region picker built into the "Where to Watch" section on movie and show info pages — switch country inline to see what's streaming where you are without going to Settings.
- Locale preference in Settings — controls the language of titles, overviews, and provider names from TMDB, and supplies the default region for Where to Watch.
- Tagline, IMDb link, and TMDB rating chip now sit above the title on movie and show info pages.

### Changed
- Movie and show info pages got a hero redesign — full-bleed backdrop fades into the page with the centered poster + title block in front of it. Library posters wear a status-coloured border and the title tints to match, so a glance at the hero tells you the entry's state. Action bar replaced with a row of round icon buttons (✓ watched, 🔖 plan, 📓 log a viewing, ▶ trailer, ⋯ more).
- Show info page seasons grid redesigned as larger, clickable cards — each surfaces the season's poster, episode count, year, TMDB rating, and overview. Cards started or completed get a subtle status-coloured border tint, and tapping any card opens the new season info page.
- Season cards on the show page slimmed to a single row with a status-tinted progress bar and inline +/- and Mark all / Reset buttons. The whole row taps through to the season tracker page.
- "Mark complete" relabeled to "Mark all" — the action only marks every episode in a season as watched, so the new label matches what it does.
- The season tracker page has an "ⓘ More info" button next to the season title so you can jump from progress tracking to the full episode info view.
- Rating pickers, season counters, season-rating chips, and the season tracker controls all adopt the show's status colour, so each show stays in one colour family across the app.
- "Where to Watch region" preference renamed "Locale" with a clearer description that it controls TMDB content language as well as the default region.

### Fixed
- Region picker now displays country names in your chosen UI language instead of always English.
- Marking the last episode of a season smoothly scrolls the rating picker into view so you can rate without hunting for it.

## [0.8.1] - 2026-05-04

### Changed
- Watchlist status filter reworked into a two-state picker. The active filter renders as a full-width colour-filled bar with a chevron-down trigger on the right; tapping the bar expands a horizontally-scrollable strip of every status, with the selected one bg-filled and the others as soft status-tinted badges. Tapping a status applies it and collapses the bar back. The transition between the two states animates the resize end-to-end (active eases between full-row and compact size; inactives slide in/out; the chevron collapses).
- Kind row (All / TV / Movies) now mirrors the status bar pattern — the selected kind takes the full remaining width, inactives stay content-sized. "All" no longer carries a coloured dot since it's a catch-all.
- Sort & view trigger restyled to match the chevron-down trigger visually (same border, padding, height) so both filter rows share one control vocabulary.

## [0.8.0] - 2026-05-03

### Added
- Leaderboard page — full TV and Movies rankings by your rating, with podium colour-coding on the top three. Linked from Profile.
- Pagination on the watchlist — 24 entries per page; the current page is part of the URL so it survives reloads and back-navigation.
- Sort by release date in the watchlist — orders by year newest-first; entries without a year sort to the end.

### Changed
- Mobile floating nav now slides away when you scroll, and animates back in when you return to the top of the page.
- Watchlist filter rows redesigned. The active status / kind tab now stretches to ~80% of the screen width on mobile, fully colour-filled with the label on the left and count on the right, so a glance at the row tells you which subset you're viewing. Inactive tabs sit beside it as compact bordered badges, each tinted with its status colour and the count rendered in the same colour. The strip scroll-snaps so the active tab always lines up with the page gutter, and a smooth transition animates between active and inactive states.
- Kind filter (All / TV / Movies) now uses three distinct colour families — primary, secondary, and tertiary — so the categories read as visually separate rather than three slots of the same chip.
- Sort and view (list / grid) options moved into a single bottom sheet behind a filter icon, freeing up the filter row on narrow screens. Selecting a sort or view applies and closes the sheet immediately.

### Fixed
- Opening a show no longer pushes it to the top of "Recently updated". Background TMDB sync that runs on every detail-page visit no longer counts as an edit; only your own changes (status, rating, progress, notes) move an entry up the list.

## [0.7.0] - 2026-05-03

### Added
- Pagination redesigned: First / Prev / [editable page input] of N / Next / Last on a single row. The numbered page buttons are gone — type the page you want or use the chevrons. Single-row layout that never wraps on narrow screens.
- Specials are tracked in their own section at the bottom of the show page and excluded from completion by default. A per-show "Count toward completion" toggle flips them back on.
- Library status pill now shows the status label (Watching, Plan, etc.) under the title on every poster card, replacing the bare colored dot.
- Settings shows current IndexedDB storage usage with a refresh button.
- Picker (both the bracket picker and the random-pick surprise sheet) shows your saved notes alongside the title — useful when picking, since the note is often the deciding factor.
- Image galleries on info pages start collapsed at 8 thumbnails with a "Show all" expansion. The fullscreen preview now supports prev/next arrows and arrow-key navigation.

### Changed
- "Mark complete" and "+1 episode" walk only the seasons that count toward this show — specials no longer block a show from being marked complete.

### Fixed
- Tapping the start of a list scroll no longer flashes a shrink animation on the card the finger landed on.
- Bulk search status chip and "+ Add" button now line up when stacked across a results rail.
- Scroll position is restored when navigating back from a detail page to a list, even when the list loads its content asynchronously.

## [0.6.0] - 2026-05-02

### Added
- New "Tuned in" status for titles you've passively caught a few episodes of without tracking specifics — handy when you sat through someone else's binge. Available everywhere status is set: the picker, segmented control, quick actions, watchlist filter, stats breakdown, and the home History rail.

## [0.5.0] - 2026-05-01

### Added
- Type label (TV / Movie) on every card so the kind is visible at a glance.
- Status-tinted soft border on cards that are in your library; cards not yet added keep a neutral border, and dropped titles fade so they recede in mixed lists.
- Backdrop bleed behind watchlist list rows and discover/browse/search result cards for visual context. New library adds capture the backdrop automatically; existing entries lazy-fill on the next detail-page visit.
- Swipe right on a discover, browse, or search-result card to open the status picker — no need to aim for the small "+ Add" button. The card follows your finger with rubber-banding past the trigger threshold.
- Drag the status picker sheet down to dismiss it.

### Changed
- Card design refresh: progress bars now adopt the status color (purple when completed, green when watching, grey when dropped), and status appears inline in the meta line as a coloured dot + label across grid and list views.
- Search-result and discover cards show your library status inline in the meta line instead of a separate chip at the bottom.

### Fixed
- Bulk search now keeps your pasted list and results when you open a result and come back, instead of resetting to an empty textarea.
- Opening the status picker no longer scrolls the page underneath or causes a horizontal layout shift.
- The status picker locks page scroll while it's open so the content behind doesn't scroll independently.

## [0.4.0] - 2026-05-01

### Added
- Diary — a per-viewing journal independent of episode progress. Tap the 📓 button on any show or movie info page to log when you watched, an optional rating and note, and (for TV) the episode range covered. Entries live in the new Profile → Diary feed.
- "Watched on" section on movie and show info pages, listing every diary entry for that title with date, rating, and any note you wrote.
- One-time backfill prompt on first Diary visit — synthesize one diary entry per completed library title so your history doesn't start empty.
- "Surprise" button on Discover — opens a sheet that picks something at random from your plan-list and what's trending, with TV/Movies chips and a re-roll that doesn't repeat the last few picks.

### Changed
- Logging a viewing can optionally bump TV episode progress or mark a movie as completed — diary writes are decoupled by default but the form offers the side-effect when it makes sense.
- Backups now include diary entries, and JSON imports merge diary by id without creating duplicates.

### Added
- Picker — a tournament-style "what should I watch?" tool. Filter by status (any combination of Watching, Plan, Completed, Dropped) and type (TV / Movies / both), and pair things head-to-head until one's left. The winner gets a "More like this" rail powered by TMDB recommendations so you can keep going.

### Changed
- Cleaner iconography across the app — every page now uses the same set of crisp line icons, replacing the previous mix of emoji and unicode characters.
- Page headers are unified across Watchlist, Upcoming, Discover, Search, Settings, and Stats for a consistent title + actions pattern.
- Watchlist's "+ Add" header button has been replaced by a "Pick" button that opens the new picker. Use Search or Discover to add new titles.
- Back-arrow navigation now follows your actual in-app history when possible — tapping back from a show you opened via Upcoming returns to Upcoming instead of jumping straight to Home.

### Fixed
- Press feedback is now applied to every button in Settings — Save, Test connection, Forget key, Clear cache, Export, and Import all behave like the rest of the app.

## [0.2.0] - 2026-05-01

### Added
- Mobile-first tactile feel. Buttons, cards, tabs, and chips now press down with a quick scale-and-spring on tap, and fire haptics on press-down (not click) so the vibration lines up with what you see.
- Long-press any library card to open a quick-actions sheet — change status, mark next episode watched (TV), or remove from library without navigating to the detail page. A three-dot button on each card opens the same sheet for discoverability.
- Status menu and card actions slide up from the bottom edge as a sheet on mobile, with a centered pop-in on desktop.
- Bottom navigation now has a sliding pill that animates between tabs as you switch routes.
- Reduced-motion users get instant state changes — scale and spring animations are skipped automatically when the OS preference is set.

### Changed
- Hover styles only apply on devices that actually have a hover capability, fixing the sticky-hover-after-tap glitch on phones.
- Tap delay is gone — every button now has `touch-action: manipulation` so taps register without the 300ms double-tap-zoom wait.
- The gray iOS tap highlight no longer flashes on every press; press feedback is the scale animation instead.

## [0.1.0] - 2026-05-01

### Added
- Person pages — tap any cast member, director, or creator to see their full filmography, biography, and group-by-job credits.
- Quick "Watched S__ E__" button on TV info pages for shows already in your library — bumps the next unwatched episode without leaving the page.
- Search suggestions: previous queries that match what you're typing appear as chips above the input.
- Calendar export on the Upcoming page — downloads an `.ics` file you can drop into any calendar app.
- Settings → Preferences: haptics on/off, default add status (skip the picker), and a region picker for Where to Watch.
- Settings → API: a "Clear cache" button to drop the in-memory TMDB cache when results look stale.
- In-app update detection. The Settings page now shows the running version, build time, and a "Check for updates" button. When a new version ships, a toast surfaces with a one-click update.
- This changelog, viewable in Settings → About.

### Changed
- Settings page reorganized into API / Backup / Preferences / About / Danger zone sections.
- Movie and show pages now show more at-a-glance detail before you add to your library — runtime/episode count, genres, TMDB rating, tagline, original title for foreign-language picks, and release status for upcoming titles. The full info page stays the deep dive.

### Fixed
- The "Update to vX.Y.Z" button now reliably hard-refreshes the app even when the service worker hasn't finished installing the new build — previously it could silently keep serving the old version.
