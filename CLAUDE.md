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

## In-app feature guide

`/settings/guide/` is a user-facing tour of every feature in the app. Its content lives in `src/lib/guide.ts` as a typed `GUIDE_SECTIONS` array. The same array is the planned source for a first-launch interactive tour, so it's the single source of truth for both surfaces.

### When you add or change a user-visible feature

Update `src/lib/guide.ts` in the **same commit** as `CHANGELOG.md` and the version bump. Concretely:

- **New feature** → add a new `GuideSection` (or extend the relevant existing one's `body` / `highlights`). Pick an `id`, `icon`, and `accent` consistent with the section's home in the app. Set `version` to the build that ships it — this is what triggers the post-update auto-tour for existing users.
- **Renamed / removed feature** → update or delete the matching section so the guide doesn't promise something that no longer exists. When you meaningfully rewrite the `body` / `highlights` of an existing section, **bump its `version`** so the post-update tour resurfaces it. Leave alone for typo fixes.
- **New visual demo** → extend the `GuideVisual` union in `guide.ts`, then add the matching `{:else if}` block in `src/lib/components/GuideVisual.svelte` (used by both the static page and the tour).

### Guide section conventions

- `summary` is one line (~110 chars) — shown in the TOC chip and as the step subhead.
- `body` paragraphs are short. The whole section should read in under a minute.
- `highlights` are for distinct sub-features within the section. Skip them when prose is enough.
- `inTour` defaults to true; set `inTour: false` for sections that should appear in the static guide but be skipped in the first-launch tour (advanced / post-use features). Keep the tour at ~8 essentials max.
- No file paths, no implementation details — users read this. Same rule as `CHANGELOG.md`.

### First-launch & post-update tour

The tour is mounted by `src/routes/+layout.svelte` via `{#if tour.open}` from `$lib/tour.svelte.ts`. Three trigger paths:

- **First-launch** — new user, empty library, `tourSeen` unset → full tour.
- **Post-update** — `tourSeen: true` but at least one section has a `version` newer than `lastSeenGuideVersion` → filtered tour showing only the new/updated sections, with a "What's new in vX.Y.Z" banner.
- **Manual replay** — `tour.show()` from Settings → Guide → "Take the tour" → full tour.

`tour.close()` stamps both `tourSeen: true` and `lastSeenGuideVersion = current build version`, so the post-update path won't re-fire until something newer ships.

The visual demos in both surfaces are rendered by `<GuideVisual>` (`src/lib/components/GuideVisual.svelte`). To add a new demo: extend the `GuideVisual` union in `guide.ts`, add the matching block in `GuideVisual.svelte`, and reference it from a section's `visual` field.

### Don't

- Don't put guide content directly in the page Svelte file; it belongs in `guide.ts` so the future tour can consume it.
- Don't add a guide section for internal-only changes (refactors, build tooling). Those don't ship to users.

## Stack reminders

- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`). No legacy stores, no `<script>` without `lang="ts"`.
- SvelteKit `adapter-static` + `ssr=false` + `prerender=true`. No server code; all state is client-side (IDB via `src/lib/idb.ts`).
- All in-app links must use `${base}` from `$app/paths` — site is served under `/series-tracker/` on Pages.
- TMDB key lives in IDB only; never log it, never include it in error reports, never put it in URLs that aren't TMDB requests.
