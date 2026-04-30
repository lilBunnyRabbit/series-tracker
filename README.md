# series-tracker

A backendless TMDB series + movie tracker. MyAnimeList-style per-season episode counters. State lives in your browser's `localStorage`. Your TMDB API key never leaves your device.

Live: <https://lilbunnyrabbit.github.io/series-tracker/>

## Stack

SvelteKit + Svelte 5 runes · TypeScript · Tailwind CSS v4 · `@sveltejs/adapter-static` · GitHub Pages · Bun.

## Develop

```bash
bun install
bun run dev
```

Open <http://localhost:5173/>, then go to Settings and paste a TMDB v3 API key (get one at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)).

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

## How tracking works

TMDB has no native episode-level tracking and any account write requires OAuth. To stay backendless and authless, this app uses your TMDB key purely for read-only metadata, and stores all watch state in `localStorage`. Use Settings → Export JSON for backups.
