// User-facing feature guide. Single source of truth for both:
//
//   • the static /settings/guide page (renders every section in one scroll),
//   • the first-launch interactive tour (planned — will render one section at
//     a time with paged transitions, using the same data array).
//
// To make those two surfaces share content, the data here is intentionally
// flat and serialisable: text-only fields plus enumerated keys for the inline
// visual demo. Both the static page and the future tour resolve `visual` to
// the matching Svelte snippet — content lives here, presentation lives there.
//
// When you add or change a user-visible feature, update GUIDE_SECTIONS in the
// same commit as CHANGELOG.md and the version bump (see CLAUDE.md).

// Mirrors `IconName` in src/lib/components/Icon.svelte — kept as a literal
// union so the guide is type-checked against the same set of icon names the
// renderer accepts. Mirror new icons here when they're added there.
type IconName =
  | "home"
  | "compass"
  | "bookmark"
  | "search"
  | "user"
  | "arrow-left"
  | "arrow-right"
  | "chevron-right"
  | "chevron-down"
  | "plus"
  | "calendar"
  | "download"
  | "settings"
  | "filter"
  | "grid"
  | "list"
  | "flame"
  | "sparkles"
  | "trending-up"
  | "trophy"
  | "tv"
  | "film"
  | "check"
  | "x"
  | "trash"
  | "tag"
  | "star"
  | "pencil"
  | "repeat"
  | "play"
  | "rotate-ccw";

export type GuideAccent = "primary" | "secondary" | "tertiary" | "accent";

/** Inline demo blocks. Each key resolves to a Svelte snippet in the guide
 *  page (and, later, the onboarding tour). New visuals are added by extending
 *  this union and adding the matching snippet at the call site. */
export type GuideVisual =
  | "statuses"
  | "discover-modes"
  | "watchlist-filters"
  | "tv-progress"
  | "picker"
  | "temptation"
  | "stats"
  | "mobile-ui";

export type GuideHighlight = {
  label: string;
  description: string;
};

/** One self-contained step. In the static page each is a card; in the
 *  onboarding tour each is one screen. The shape is the same either way so
 *  no transformation is needed between contexts. */
export type GuideSection = {
  /** Stable id for deep links (`#statuses`) and tour step keys. */
  id: string;
  icon: IconName;
  /** Colour family for the section's icon and chip. Maps onto the app's
   *  semantic palette (primary / secondary / tertiary / accent). */
  accent: GuideAccent;
  /** Section heading. Also used as the TOC chip label and the tour heading. */
  title: string;
  /** One-line subhead — shown under the title, in the TOC chip, and as the
   *  step subhead in the tour. Aim for ~110 chars. */
  summary: string;
  /** Body paragraphs. Each entry renders as its own <p>. */
  body: string[];
  /** Optional bulleted callouts for distinct features inside the step. */
  highlights?: GuideHighlight[];
  /** Optional inline demo. Resolved to a snippet by the renderer; absent
   *  when the section is text-only. */
  visual?: GuideVisual;
  /** When false, the section is excluded from the first-launch tour but still
   *  rendered in the static `/settings/guide` page. Used to keep the tour
   *  short and focused on essentials. Defaults to true (in-tour). */
  inTour?: boolean;
  /** Semver of the build that introduced (or last meaningfully changed)
   *  this section's content. Drives the post-update tour: after the user
   *  upgrades, sections newer than their `lastSeenGuideVersion` are
   *  automatically surfaced. Bump this when you rewrite a section's body /
   *  highlights so the change resurfaces; leave alone for typo fixes. */
  version: string;
};

/** Baseline used when migrating users who have `tourSeen: true` but no
 *  `lastSeenGuideVersion` (i.e. saw the original tour before the post-update
 *  flow shipped). Treats them as having seen everything in this version,
 *  so only sections explicitly tagged with a *newer* version trigger an
 *  auto post-update tour for them. */
export const GUIDE_BASELINE_VERSION = "0.17.0";

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "welcome",
    version: "0.17.0",
    icon: "sparkles",
    accent: "accent",
    title: "What Series Tracker is",
    summary: "A browser-only TV + movie tracker. Your data stays on your device.",
    body: [
      "Series Tracker is a personal watchlist for TV shows and movies, backed by TMDB metadata. There's no account, no server, and no signup — every entry, rating, and progress count lives in your browser's IndexedDB on this device.",
      "Treat it like a notes app for what you watch: it's fast, you own the data, and a JSON export is one click away in Settings → Backup.",
    ],
  },
  {
    id: "tmdb-key",
    version: "0.17.0",
    icon: "settings",
    accent: "primary",
    title: "Add a TMDB key",
    summary: "One free key unlocks the whole app — and it never leaves your device.",
    body: [
      "Series Tracker uses the TMDB API for titles, posters, runtimes, cast, and where-to-watch. You'll need a free v3 API key from themoviedb.org/settings/api — paste it into Settings → API and the rest of the app unlocks.",
      "The key is stored in IndexedDB on this device only. It's never logged, never synced, and never sent anywhere except themoviedb.org.",
    ],
  },
  {
    id: "statuses",
    version: "0.17.0",
    icon: "tag",
    accent: "primary",
    title: "Five statuses, five colours",
    summary: "Every entry sits in one of five buckets — and the colour follows it everywhere.",
    body: [
      "Each title has a status. The matching colour shows up on poster borders, status dots, progress bars, rating chips, and filter rails so you can read your library at a glance.",
    ],
    visual: "statuses",
    highlights: [
      { label: "Plan to watch", description: "On the queue but not started." },
      { label: "Watching", description: "In progress — drives the Continue Watching rail on Home." },
      { label: "Tuned in", description: "Caught a few episodes without tracking specifics." },
      { label: "Completed", description: "Finished — eligible for the Leaderboard once you rate it." },
      { label: "Dropped", description: "Started but not finishing. Faded in mixed lists so it recedes." },
    ],
  },
  {
    id: "discover",
    version: "0.17.0",
    icon: "compass",
    accent: "secondary",
    title: "Find new titles",
    summary: "Five different ways to surface things to add — pick the one that fits your mood.",
    body: [
      "Anywhere a title appears, a status dot tells you whether it's already in your library, so you don't add duplicates by accident. Swipe right on a discover, browse, or search-result card to open the status picker without aiming for the small +Add button.",
    ],
    visual: "discover-modes",
    highlights: [
      { label: "Search", description: "Live results across TV, movies, and people. Past queries surface as suggestion chips while you type." },
      { label: "Bulk search", description: "Paste a list of titles, get them resolved in batch." },
      { label: "Discover", description: "Trending today/this week, recommendations seeded by your library, popular and top-rated rails." },
      { label: "Browse", description: "Full grid filtered by kind, genre, sort, and 'hide added'." },
      { label: "Feed", description: "Full-screen vertical swipe through TMDB. Remembers where you left off across sessions." },
      { label: "Surprise", description: "Rolls a single random pick from your plan-list and what's trending. Re-roll until you commit." },
    ],
  },
  {
    id: "watchlist",
    version: "0.17.0",
    icon: "bookmark",
    accent: "primary",
    title: "Your watchlist",
    summary: "The full library, filtered any way you like.",
    body: [
      "Filter by status (Plan / Watching / Tuned / Completed / Dropped) and kind (TV / Movies). Search by title narrows the list. Sort by recently updated, recently added, A–Z, progress, your rating, or release date.",
      "Switch between List view (with backdrop bleed and notes) and Grid view (poster cards). Long-press any card on mobile for quick actions — change status, mark next episode, or remove — without opening the detail page.",
      "Two shortcuts ride along: Pick (the bracket-style decision tool) and Upcoming (next-air dates for everything you're watching, with a calendar export).",
    ],
    visual: "watchlist-filters",
  },
  {
    id: "tracking",
    version: "0.17.0",
    icon: "play",
    accent: "primary",
    title: "Tracking what you watch",
    summary: "Per-season episode counters, per-episode toggles, season ratings, and a Diary.",
    body: [
      "TV shows track per-season progress. The show page lists every season with a counter; the season tracker page shows the full episode list with air dates, runtimes, and the option to mark-watched up to a tapped episode (or toggle individual episodes for non-contiguous watches like 'E1 and E3 but not E2').",
      "Catch up jumps progress to the latest aired episode in one tap. Specials live in their own section and don't block completion unless you opt in per show. Background sync demotes a Completed show back to Watching when new episodes air.",
      "Rate the whole show, individual seasons, or movies on a 0–10 scale. Add notes, mark titles as Rewatchable, and (for everything you watch) log a Diary entry — a date-stamped journal independent of episode progress, with optional rating and per-viewing notes.",
    ],
    visual: "tv-progress",
  },
  {
    id: "detail-pages",
    version: "0.17.0",
    icon: "film",
    accent: "tertiary",
    inTour: false,
    title: "Show & movie pages",
    summary: "TMDB metadata, your status, and quick actions on one page.",
    body: [
      "Each show or movie page has a full-bleed backdrop hero, status-coloured poster border, cast & crew, where-to-watch by region, trailers, an image gallery, recommendations, and (for TV) a season grid leading to the season tracker and per-episode info pages.",
      "Tap any cast member to open their person page with full filmography. The share button uses your device's system share sheet — and Series Tracker is itself a registered share target, so sharing a TMDB link from any other app opens it directly here.",
    ],
  },
  {
    id: "picker",
    version: "0.17.0",
    icon: "trophy",
    accent: "accent",
    title: "Can't decide?",
    summary: "A bracket-style picker (and a quick Surprise sheet) for indecisive nights.",
    body: [
      "Filter your library by status and kind, then go head-to-head matchup by matchup until one title is left. The winner gets a 'More like this' rail powered by TMDB recommendations, and you can review the bracket round-by-round to see which titles you knocked out.",
      "For something faster, the Surprise sheet on Discover rolls a single random pick from your plan-list mixed with what's trending. Re-roll until you commit — recent picks won't repeat back-to-back.",
    ],
    visual: "picker",
  },
  {
    id: "temptation",
    version: "0.18.0",
    icon: "flame",
    accent: "accent",
    title: "Temptation",
    summary: "An ambient 0–100% score per title that surfaces what you're in and what's pulling at you next.",
    body: [
      "Every title in your library carries a Temptation score that builds up as you engage — watching episodes, opening the show or movie page, picking it in the picker, rating it highly — and fades naturally over time when you don't.",
      "Sort the watchlist by Temptation to surface what you're actively in (the highest scores) plus the candidates pulling at you for what's next (mid-band). Cards in the Hot or Burning bands wear a subtle warm halo so a quick glance picks them out without studying the list.",
    ],
    visual: "temptation",
    highlights: [
      {
        label: "Bands",
        description: "Cold → Drifting → Warming → Hot → Burning, with the warm halo lighting up from Hot upward.",
      },
      {
        label: "Pacing",
        description: "Settings → Preferences → Temptation pacing picks how fast scores fade — Lingering (~70d), Balanced (~34d), Reactive (~17d), Restless (~10d).",
      },
      {
        label: "Resets",
        description: "Marking a title Completed or Dropped resets its score to zero. Other actions (rating, rewatchable, picker) keep adding from there.",
      },
    ],
  },
  {
    id: "profile",
    version: "0.17.0",
    icon: "user",
    accent: "secondary",
    title: "Profile, stats & Leaderboard",
    summary: "Hours watched, top genres, your highest-rated titles, and a Diary feed.",
    body: [
      "Profile is the hub for your read-only insights. Stats show totals, hours watched, episodes watched, average rating, status breakdown, and your top genres.",
      "Leaderboard ranks your TV and movies by your rating with podium colour-coding on the top three. Top-rated and Rewatchable shelves surface a curated snapshot. Diary is a chronological feed of everything you've logged.",
    ],
    visual: "stats",
  },
  {
    id: "mobile",
    version: "0.17.0",
    icon: "grid",
    accent: "tertiary",
    inTour: false,
    title: "Mobile-first interaction",
    summary: "Floating bottom island, page-actions rail, swipes, long-press, haptics.",
    body: [
      "On mobile, the bottom floating island carries either the five primary tabs (Home / Discover / Watchlist / Search / Profile on hub pages) or a back arrow + page title (on detail pages). A page-actions rail rises above it on hub pages with shortcuts like Upcoming, Pick, Surprise, Feed, Browse, and Settings.",
      "Swipe right on any discover, browse, or search-result card to open the status picker. Long-press any library card for quick actions. Drag any bottom sheet down to dismiss it. Buttons press down with a quick scale-and-spring; haptics fire on press-down (toggleable in Settings → Preferences).",
    ],
    visual: "mobile-ui",
  },
  {
    id: "activity",
    version: "0.17.0",
    icon: "list",
    accent: "secondary",
    inTour: false,
    title: "Activity log",
    summary: "Every library change, grouped by day.",
    body: [
      "The Activity page is a chronological feed of recent library mutations: adds, removes, status flips, progress, ratings, season completions, episode toggles. Grouped by day with relative timestamps. Useful for retracing 'wait, when did I drop that show?' moments. Linked from Settings → Activity.",
    ],
  },
  {
    id: "backup",
    version: "0.17.0",
    icon: "download",
    accent: "primary",
    inTour: false,
    title: "Backups & preferences",
    summary: "Export to JSON, import to merge or replace, and tune the app to your taste.",
    body: [
      "Settings → Backup exports your full library, diary, search history, and preferences as a JSON file you can stash anywhere. Import in Merge mode (max progress wins, newer metadata wins) to combine with another device, or in Replace mode to overwrite. The API key is left out of exports by default — opt in if you're moving between devices.",
      "Preferences cover Haptics on/off, a Default add status (skips the picker if set), and a Locale that controls the language of TMDB titles and the default Where-to-Watch region. Storage usage is shown so you can keep an eye on the IndexedDB footprint.",
    ],
  },
  {
    id: "roadmap",
    version: "0.19.0",
    icon: "trending-up",
    accent: "accent",
    inTour: false,
    title: "Roadmap",
    summary: "What's planned for v1.0, what already shipped, and what's been ruled out.",
    body: [
      "Settings → Roadmap renders the public plan: every milestone, the items inside it, and their status. Each shipped item is stamped with the version that landed it, so you can trace anything you remember seeing back to its release notes.",
      "The 'After v1.0' and 'Won't ship' sections are intentionally honest about what's deferred or off the table — so you don't end up waiting for something that isn't coming.",
    ],
  },
  {
    id: "updates",
    version: "0.17.0",
    icon: "rotate-ccw",
    accent: "accent",
    inTour: false,
    title: "Updates & changelog",
    summary: "New builds surface as a full-screen prompt — never silent.",
    body: [
      "Series Tracker checks for updates every 30 minutes (and on tab focus, throttled to once a minute). When a new version ships, a modal blocks the view with a single 'Update now' button — there's no defer. After applying, a brief 'Installing → Clearing cache → Restarting' overlay shows what's happening.",
      "The full version history is rendered in Settings → About → View changelog. Every user-visible change since v0.1 is in there.",
    ],
  },
];
