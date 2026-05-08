# series-tracker

A browser-only TV + movie tracker built on TMDB. Per-season episode counters, per-episode toggles, a diary, a bracket-style picker, mood-aware "temptation" scoring, an upcoming schedule, person pages, where-to-watch, and a few other things. Mobile-first, installable as a PWA, no backend — every byte of your data lives in your browser.

**Live:** <https://lilbunnyrabbit.github.io/series-tracker/>

<!-- Drop a hero screenshot or short demo gif here. -->

## What it does

- **Tracking depth** — five statuses (Plan / Watching / Tuned in / Completed / Dropped), per-season counters, non-contiguous per-episode toggles, optional minutes-watched scrubber on movies, ratings on shows, seasons, and movies, a Rewatchable flag, and a date-stamped Diary with optional notes per viewing.
- **Home dashboard** — Continue Watching landscape rail (with episode stills and "N remaining" hints), Upcoming Schedule for shows you're watching, "Start Watching", and "New episodes available" surfacing what aired since you last opened things.
- **Discover** — curated rails (Trending, Top Rated, In Theaters, etc.), a Browse view that hits TMDB's discover endpoint with genre and provider filters, a Surprise random pick, and a full-screen Feed mode you can swipe vertically through.
- **Picker** — bracket-style head-to-head decision tool with status / kind / progress filters; the winner gets a "More like this" rail and you can replay the bracket round-by-round.
- **Temptation** — an ambient 0–100% engagement score per title that builds with watching, opening, picking, and high ratings, and fades over time. Drives a watchlist sort, a warm halo on Hot/Burning cards, and pacing presets.
- **Stats & Leaderboard** — totals, hours watched, completed-this-year, top genres, and full TV/Movies rankings by your own rating.
- **Activity log** — chronological feed of every library mutation grouped by day, with per-row Undo (24h window) and a Clear-all in Danger zone.
- **Person pages** — full filmography, biography, and grouped credits for any cast member, director, or creator.
- **Where to Watch** — TMDB / JustWatch provider logos labelled Stream / Buy / Rent, with an inline region picker.
- **Share + share target** — share titles via the system share sheet, and share a TMDB link from anywhere to open it here.
- **In-app feature guide** — a Settings → Guide page with animated demos, plus a first-launch tour for new users and a post-update tour that resurfaces what's new.
- **iCal export** — drop every upcoming episode of shows you're watching into any calendar app.
- **Roadmap & changelog** — both rendered in-app at Settings → Roadmap and Settings → About → View changelog.

## Stack

SvelteKit 2 + Svelte 5 runes · TypeScript · Tailwind CSS v4 · `@sveltejs/adapter-static` (SSR off, prerendered) · `vite-plugin-pwa` (prompt-based update flow) · GitHub Pages · Bun.

## How tracking works

TMDB has no native episode-level tracking and any account write requires OAuth. To stay backendless and authless, this app uses your TMDB key purely for read-only metadata, and stores all watch state in IndexedDB. The key itself lives in IDB on your device — never in URLs (other than TMDB requests), never logged, never shipped to any server. Series Tracker has no server.

Use **Settings → Backup → Export JSON** for backups; Import JSON to restore.

## Develop

```bash
bun install
bun run dev
```

Open <http://localhost:5173/>, then go to **Settings → API** and paste a TMDB v3 API key (free, get one at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)).

## Build

```bash
bun run build
bun run preview
```

To mirror the GitHub Pages subpath build locally:

```bash
BASE_PATH=/series-tracker bun run build
bun run preview
# visit http://localhost:4173/series-tracker/
```

## Deploy

Push to `master`. The `.github/workflows/deploy.yml` workflow builds with `BASE_PATH=/series-tracker` and publishes via the official GitHub Pages action.

First-time enablement: GitHub repo **Settings → Pages → Source: GitHub Actions**.

See `CLAUDE.md` for the release flow (version bump, changelog promotion, guide and roadmap updates) and `CHANGELOG.md` for the full version history.
