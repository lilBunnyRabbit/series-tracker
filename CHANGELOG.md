# Changelog

All notable user-visible changes to Series Tracker. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
