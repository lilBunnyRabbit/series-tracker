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
  | "rotate-ccw"
  | "bug";

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
  /** Semver of the build that introduced this specific highlight. When set
   *  and newer than the user's `lastSeenGuideVersion`, the post-update tour
   *  flags this item with a "New" pill so the user can see *what* changed
   *  inside an updated section, not just that the section as a whole was
   *  bumped. Leave undefined for pre-existing items. */
  addedIn?: string;
};

/** A guide-section body paragraph. The bare-string form is the default; the
 *  object form lets the post-update tour flag specific paragraphs as new
 *  without bumping the whole section's `version` away from when the prose
 *  around it shipped. Render via `bodyText()` / `bodyAddedIn()`. */
export type GuideBodyItem =
  | string
  | {
      text: string;
      /** Semver of the build that introduced this paragraph. Same semantics
       *  as `GuideHighlight.addedIn`. */
      addedIn?: string;
    };

/** Convenience: pull the prose out of a GuideBodyItem. */
export function bodyText(item: GuideBodyItem): string {
  return typeof item === "string" ? item : item.text;
}

/** Convenience: pull the addedIn version (if any) off a GuideBodyItem. */
export function bodyAddedIn(item: GuideBodyItem): string | undefined {
  return typeof item === "string" ? undefined : item.addedIn;
}

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
  /** Body paragraphs. Each entry renders as its own <p>. Plain strings are
   *  the common case; the object form (`{ text, addedIn }`) lets the
   *  post-update tour flag a specific paragraph as new without forcing a
   *  whole-section re-show. */
  body: GuideBodyItem[];
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
    version: "1.5.0",
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
    version: "0.25.0",
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
      {
        label: "Feed: jump to position",
        description: "Tap the position counter (top-right) to type any item number and snap straight there — no more 1000-card scroll back.",
        addedIn: "0.25.0",
      },
      {
        label: "Feed: exclude genres",
        description: "Tap a genre once to include, twice to exclude (red border). Exclusions browse 'everything but Horror' without leaving the setup screen.",
        addedIn: "0.25.0",
      },
      { label: "Surprise", description: "Rolls a single random pick from your plan-list and what's trending. Re-roll until you commit." },
    ],
  },
  {
    id: "watchlist",
    version: "0.22.0",
    icon: "bookmark",
    accent: "primary",
    title: "Your watchlist",
    summary: "The full library, filtered any way you like.",
    body: [
      "Filter by status (Plan / Watching / Tuned / Completed / Dropped) and kind (TV / Movies). Search by title narrows the list. Sort by recently updated, recently added, A–Z, progress, your rating, or release date.",
      "The Sort & view sheet adds two extra filters — Rewatchable only and a Started / Untouched pair — so you can split anything in your library by whether you've actually cracked it open. Pairs especially well with Plan to watch when some entries already have a few episodes ticked off.",
      "Switch between List view (with backdrop bleed and notes) and Grid view (poster cards). Long-press any card on mobile for quick actions — change status, mark next episode, or remove — without opening the detail page.",
      "Two shortcuts ride along: Pick (the bracket-style decision tool) and Upcoming (next-air dates for everything you're watching, with a calendar export).",
    ],
    visual: "watchlist-filters",
  },
  {
    id: "tracking",
    version: "0.21.0",
    icon: "play",
    accent: "primary",
    title: "Tracking what you watch",
    summary: "Per-season counters, per-episode toggles, optional movie scrubber, season ratings, a Diary, and a Home dashboard that knows what's next.",
    body: [
      "Home reads as a dashboard. Continue Watching is a rail of landscape cards — for shows, the next episode with backdrop, runtime, and 'N remaining · Md'; for movies you've started, the minutes-watched checkpoint ('45m of 155m · 3d'). Upcoming sits right under it with cards for unaired episodes, badged 'In Nd' / 'Today' / 'Tomorrow'.",
      "TV shows track per-season progress. The show page lists every season with a counter; the season tracker page shows the full episode list with air dates, runtimes, and the option to mark-watched up to a tapped episode (or toggle individual episodes for non-contiguous watches like 'E1 and E3 but not E2'). Counters flip with a small slide-and-fade whenever you tap +/- so every press registers visually.",
      "Movies are binary by default — one tap on the ✓ marks watched. Want more? Open Track progress on a movie's page and use the tick-ruler scrubber to record where you paused. Drag the strip or tap the chevrons to bump a minute at a time; reaching the runtime auto-marks the movie watched. Partial minutes count toward your stats hours-watched and the movie joins Continue Watching alongside your shows.",
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
    version: "1.2.0",
    icon: "trophy",
    accent: "accent",
    title: "Can't decide?",
    summary: "A family of pickers — bracket, coin flip, spin, mood, ranking — for whatever decision shape you're in.",
    body: [
      "Open Picker and you land on a grid of modes, not a single flow. Pick the one that fits your headspace: deep deliberation, snap decision, or something in between.",
      "Every mode shares your filters (status, kind, progress) and weights its sampling by rewatchable + Temptation, so titles you've marked rewatchable or have been engaging with come up more often. The mode you used last is highlighted on the grid so you can dive straight back in.",
      {
        text: "Six new modes joined the bracket: Top 8 (a quick three-round bracket), Coin Flip (two random titles, one tap), Spin (single random with re-roll), Pick up where you left off (surfaces in-progress titles you've cooled on), Mood (Short / Long, Comfort / Challenge chips), and Either / Or (endless A-vs-B that builds your personal Top 10).",
        addedIn: "1.2.0",
      },
    ],
    visual: "picker",
    highlights: [
      {
        label: "Bracket",
        description: "Up to 32 contenders, head-to-head until one wins. Review the round-by-round bracket on the result screen.",
      },
      {
        label: "Top 8",
        description: "Same bracket flow, capped at eight contenders. Three rounds, seven taps, one winner.",
        addedIn: "1.2.0",
      },
      {
        label: "Coin Flip",
        description: "Two random titles, one decision. Re-roll the pair as many times as you like before committing.",
        addedIn: "1.2.0",
      },
      {
        label: "Spin",
        description: "A single weighted random pick with a re-roll button. Recent spins won't repeat back-to-back.",
        addedIn: "1.2.0",
      },
      {
        label: "Pick up where you left off",
        description: "Inverse-temptation pick from in-progress shows. The coldest active titles rise first.",
        addedIn: "1.2.0",
      },
      {
        label: "Mood",
        description: "Layer Short / Long and Comfort / Challenge chips on top of your filters, then flip a coin.",
        addedIn: "1.2.0",
      },
      {
        label: "Either / Or",
        description: "Endless A-vs-B coin flips. Each pick adjusts a running rank — play long enough and your Top 10 emerges.",
        addedIn: "1.2.0",
      },
    ],
  },
  {
    id: "temptation",
    version: "0.25.0",
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
        description: "Marking a title Completed resets its score to zero. Drop leaves the score where it was — losing interest is its own signal. Rating only nudges active titles, not closed ones.",
        addedIn: "0.25.0",
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
    version: "0.24.0",
    icon: "grid",
    accent: "tertiary",
    inTour: false,
    title: "Mobile-first interaction",
    summary: "Floating bottom island, page-actions rail, swipes, long-press, haptics, page transitions.",
    body: [
      "On mobile, the bottom floating island carries either the five primary tabs (Home / Discover / Watchlist / Search / Profile on hub pages) or a back arrow + page title (on detail pages). A page-actions rail rises above it on hub pages with shortcuts like Upcoming, Pick, Surprise, Feed, Browse, and Settings.",
      "Swipe right on any discover, browse, or search-result card to open the status picker. Long-press any library card for quick actions. Drag any bottom sheet down to dismiss it. Buttons press down with a quick scale-and-spring; haptics fire on press-down (toggleable in Settings → Preferences).",
      "Page navigation flows: jumping between hub tabs slides the new page in from the direction of the tab in the bar (Home → Discover from the right, Watchlist → Discover from the left). Tapping a card to open a show, movie, or person animates the card's poster expanding into the destination page's hero. The floating island stays anchored throughout. All of it respects prefers-reduced-motion.",
    ],
    visual: "mobile-ui",
  },
  {
    id: "activity",
    version: "0.20.0",
    icon: "list",
    accent: "secondary",
    inTour: false,
    title: "Activity log",
    summary: "Every library change, grouped by day — with a 24-hour undo on each entry.",
    body: [
      "The Activity page is a chronological feed of recent library mutations: adds, removes, status flips, progress, ratings, season completions, episode toggles. Grouped by day with relative timestamps. Useful for retracing 'wait, when did I drop that show?' moments. Linked from Settings → Activity.",
      "Each entry from the last 24 hours has an Undo button — tap it to revert that single library change without touching anything else. Undone rows stay visible (greyed out, marked 'undone') so the timeline still tells the full story. Settings → Danger zone has a Clear activity log button when you want to start the timeline fresh; your library, ratings, and progress aren't affected.",
    ],
  },
  {
    id: "backup",
    version: "1.4.0",
    icon: "download",
    accent: "primary",
    inTour: false,
    title: "Backups & preferences",
    summary: "Export to JSON, import to merge or replace, and tune the app to your taste.",
    body: [
      "Settings → Backup exports your full library, diary, search history, and preferences as a JSON file you can stash anywhere. Import in Merge mode (max progress wins, newer metadata wins) to combine with another device, or in Replace mode to overwrite. The API key is left out of exports by default — opt in if you're moving between devices.",
      "Preferences cover the Theme picker (Auto / Light / Dark — Dark is the default and the one the brand is built around; Light is a full warm-cream counterpart, and Auto follows your OS), Haptics on/off, a Default add status (skips the picker if set), and a Locale that controls the language of TMDB titles and the default Where-to-Watch region. Storage usage is shown so you can keep an eye on the IndexedDB footprint.",
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
    id: "known-issues",
    version: "1.1.0",
    icon: "bug",
    accent: "tertiary",
    inTour: false,
    title: "Known issues",
    summary: "Live list of bugs we know about — what's open, what's been ruled won't-fix, and what just got fixed.",
    body: [
      "Settings → Known issues mirrors the Roadmap surface, but for what's broken instead of what's planned. Every entry carries a severity (critical / major / minor / polish) and a rough-fix estimate; open and investigating items sit at the top, won't-fix items below (platform constraints or fixes worse than the symptom), and recently shipped fixes hang around for a release or two so you can confirm the version that resolved them.",
      "Hit something that isn't on the list? Open an issue on GitHub — repro steps and the build version (Settings → About) make the fix faster.",
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
