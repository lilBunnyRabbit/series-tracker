# Claude instructions

Project-specific guidance for working in this repo. See also: existing TODOs in `TODO.md` / `DESIGN_TODO.md`.

## Version & update detection system

This project surfaces an in-app "update available" toast and renders `CHANGELOG.md` in the Settings page. Three pieces work together:

- `package.json` `version` — manually bumped, source of truth.
- `scripts/gen-version.ts` — prebuild script, emits `static/version.json` with `{ version, commit, branch, buildTime, buildTimestamp }` and copies `CHANGELOG.md` into `static/`.
- `src/lib/version.svelte.ts` — polls `${base}/version.json` every 30 min + on `visibilitychange` (60s throttle), coordinates with `vite-plugin-pwa`'s `registerSW` (`registerType: "prompt"`).

### Bumping the version

Bump `version` in `package.json` **on the commit that ships to `master`**, not on intermediate work. Loose semver:

- **patch** — bug fix, copy tweak, dep-only change
- **minor** — new feature, new page, new TMDB integration
- **major** — breaking IDB schema change or full UI overhaul

If a commit is internal-only (refactor, build tooling, types), don't bump.

### CHANGELOG.md

- Keep-a-Changelog format, at repo root.
- New entries go under `## [Unreleased]`. On version bump, promote it to `## [X.Y.Z] - YYYY-MM-DD` and start a fresh `[Unreleased]`.
- Sections: `Added`, `Changed`, `Fixed`, `Removed`. Skip empty ones.
- One bullet per **user-visible** change. Refactors, internal-only changes, and build tooling don't get a line — those belong in commit messages, not the user-facing changelog.
- No file paths, PR numbers, or implementation details. Users read this in-app.

### When the user asks to "ship", "release", or "deploy"

Deploy is automatic on push to `master`. Before pushing:

1. Bump `package.json` version.
2. Promote `[Unreleased]` to a dated section in `CHANGELOG.md`.
3. Run `bun run check`.
4. Commit both changes together, push.

Don't push without the version bump — users won't see that anything changed.

### Don't

- Don't commit `static/version.json` or `static/CHANGELOG.md` — they're build-generated and gitignored.
- Don't edit `version.json` by hand — the prebuild script regenerates it.
- Don't fetch `version.json` or `CHANGELOG.md` without `cache: "no-store"` + a `?t=${Date.now()}` cache buster.
- Don't add `version.json` to workbox `globPatterns` — it must always hit the network.
- Don't switch `registerType` back to `"autoUpdate"` — the prompt-based flow is intentional so users see what changed.

## Stack reminders

- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`). No legacy stores, no `<script>` without `lang="ts"`.
- SvelteKit `adapter-static` + `ssr=false` + `prerender=true`. No server code; all state is client-side (IDB via `src/lib/idb.ts`).
- All in-app links must use `${base}` from `$app/paths` — site is served under `/series-tracker/` on Pages.
- TMDB key lives in IDB only; never log it, never include it in error reports, never put it in URLs that aren't TMDB requests.
