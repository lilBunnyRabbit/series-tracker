# Changelog

All notable user-visible changes to Series Tracker. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
