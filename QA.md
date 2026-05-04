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

- [ ] `[M]` **Watchlist drawer slide-down not working** — bottom-sheet / drawer affordance on `src/routes/watchlist/+page.svelte` doesn't dismiss via swipe-down. Check `tactile.ts` swipe action vs. CSS `touch-action`; confirm gesture isn't being eaten by the inner scroll container. *Complexity: gesture debugging is unpredictable — could be one CSS line or a real refactor of the touch handler.*
- [x] `[S]` **Search result shows duplicate status badge** — root cause was in `PosterCard.svelte`, not search: the labelled pill under the title pushed the year onto a second row and read as a redundant badge whenever a card had a status. Replaced it with a small dot overlay on the poster image so the soft border + dot are the only library-state signals. See *Recently fixed*.
- [x] `[S]` **Search result status is mispositioned after add** — fixed by the same `PosterCard` change. Year is back on a single line; the action-slot chip in search continues to act as the +Add slot replacement.
- [x] `[XS]` **Settings locale description wraps to multiple lines** — copy tightened to a single line. See *Recently fixed*.
- [x] `[XS]` **Season rating "scroll to top" actually needs scroll-to-middle** — `scrollIntoView` block changed from `start` to `center` in the season page. See *Recently fixed*.

## Friction / UX gaps

- [ ] `[M]` **Manual episode toggle** — user wants to mark individual episodes watched, not just bump the counter. Per CLAUDE-stack reminder, counter is the design intent, but this is a recurring ask. Compromise: keep counter as primary, add a long-press / detail affordance on the season page to toggle a specific episode (jumps `progress` to that episode number). No per-episode boolean array yet — derive from `progress >= episode_number`. *Complexity: interaction + state-derivation logic, but no schema change.*
- [ ] `[L]` **Drop navbar, make the island dynamic** — replace fixed top bar with a Dynamic Island-style chip that morphs into a back button on detail routes and into the page title elsewhere. Likely lives in the layout (`src/routes/+layout.svelte`) and wraps `PageHeader.svelte`. Big visual change — scope as its own commit, ship under a minor bump. *Complexity: layout-level, route-aware, motion design — touches every page.*
- [x] `[S]` **Watch next / More like this should show status dot** — `status={store.get(...)?.status}` now passed to `PosterCard` on both rails, on movie + show info pages. See *Recently fixed*.
- [x] `[S]` **Picker: exclude unaired titles** — `hasAired()` predicate added to `src/routes/picker/+page.svelte`; applied to `filtered` and `counts`. Year-precision (we only store `year`, not full date), so a release later in the same year still passes — that's the conservative call. See *Recently fixed*.
- [x] `[XS]` **Longer search debounce** — bumped from 250 ms to 350 ms. Skipped the "searching…" indicator since `loading` already flips immediately when the request fires.

## Feature ideas

### Small (bundle-able)

- [ ] `[M]` **"Rewatchable" status / flag** — boolean on `Entry` (`rewatchable: boolean`) marking shows likely to rewatch. Surfaces:
  - boost weight in picker
  - filter chip on watchlist
  - section on stats / profile
  Keep it as a **flag layered on top of status**, not a new status — a completed show can be rewatchable; a dropped one usually isn't. *Complexity: tiny IDB schema bump + UI hooks in 3 places; the schema migration is what makes it M, not S.*
- [ ] `[M]` **Picker: tournament tree view after pick** — after a bracket-style pick, optionally reveal the tree (who beat whom). Aesthetic. Behind a settings toggle or a `Show bracket` button on the result screen. *Complexity: needs a tree-layout render + retaining the bracket history during the pick. Not hard, just non-trivial.*
- [ ] `[L]` **Picker: more mechanics** — open question. Current is single-pick. Brainstorm:
  - mood-based ("short / long", "light / heavy", "comfort / challenge")
  - "spin again" with weighted re-roll
  - "two-show coin flip" for when only torn between two
  - genre-locked roll
  - "haven't touched in N months" decay-weighted picker
  Pick one, prototype, see what sticks. Don't ship all at once. *Complexity: each individual mode is S–M, but design + UX + entrypoint integration push the umbrella to L.*

### Medium (own commit)

- [ ] `[L]` **Action history / activity log** — track add/remove/status-change/progress events. Spec:
  - new IDB store `actions` (capped, ring-buffer or trim-on-write at e.g. 200 entries)
  - render in Settings or a dedicated `/activity/` route
  - each row: icon + verb + title + relative time ("Added *Severance* · 2h ago")
  - **undo** button on recent entries (last ~10? last 24h?) — restores prior state
  - clear-all in danger zone
  This is a real feature — promote to `TODO.md` once scoped. Big value: turns the app into a logbook, not just a state store. *Complexity: IDB schema + write hooks in every mutation path + undo correctness. Easy to under-scope; budget a full day.*
- [ ] `[M]` **Browse infinite scroll** — replace pagination on `/discover/browse/` with `IntersectionObserver`-driven append. Keep page param in URL for back-restore. Consider if pagination component (`Pagination.svelte`) stays for keyboard / accessibility fallback. *Complexity: IO is easy, scroll-restore on back-nav and URL-state coherence are the awkward bits.*

### Speculative

- [ ] `[M]` **Share / "Open with"** — Web Share API + share_target manifest entry so the PWA can receive shared links (e.g. share a TMDB URL → app opens to that show). PWA share-target is well-supported on Android, partial elsewhere. Worth a spike to confirm scope. *Complexity: manifest is small; the unknown is parsing inbound URLs and routing them to a show — could escalate if the share payload is messy.*

## Recently fixed

- 2026-05-04 — **Season rating scrolls to centre, not top** — `scrollIntoView` block changed `start` → `center` in `src/routes/show/[id]/season/[season]/+page.svelte`.
- 2026-05-04 — **Settings locale description fits one line** — copy tightened to "Language for TMDB titles & default region. Detected: …" in `src/routes/settings/+page.svelte`.
- 2026-05-04 — **Search debounce bumped to 350 ms** — `src/routes/search/+page.svelte`.
- 2026-05-04 — **Search result status badge no longer doubled** — dropped `status` prop from `PosterCard` in both search grids; the full-width chip in the action slot is the single source of truth.
- 2026-05-04 — **Watch next / More like this rails show status dot** — `status` prop wired on `PosterCard` for both rails on `/show/[id]/info` and `/movie/[id]/info`.
- 2026-05-04 — **Picker excludes unaired titles** — `hasAired()` predicate added to `filtered` and `counts` in `src/routes/picker/+page.svelte`. Year-precision filter (entries dated to a future year are excluded).
