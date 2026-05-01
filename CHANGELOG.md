# Changelog

All notable user-visible changes to Series Tracker. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
