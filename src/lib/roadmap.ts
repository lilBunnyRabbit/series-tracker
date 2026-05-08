// User-facing roadmap. Single source of truth for both:
//
//   • the in-app /settings/roadmap page (renders every milestone and group),
//   • internal release planning (replaced ROAD_TO_V1.md when the in-app
//     surface shipped — same metadata, typed and live).
//
// When a roadmap item ships, the release flow flips its status to "shipped"
// and stamps `shippedIn` with the version that landed it. See
// `.claude/skills/release.md`.
//
// Items marked `internal: true` are kept in this file for tracking but
// hidden from the in-app surface (e.g. README rewrite — not interesting to
// users of the app).

export type RoadmapStatus =
  /** Has shipped — `shippedIn` carries the version that landed it. */
  | "shipped"
  /** Active work, expected in the next release or two. */
  | "in-progress"
  /** Committed to the milestone but not started yet. */
  | "planned"
  /** Likely after the current milestone — order will shift as priorities settle. */
  | "considering"
  /** Decided against. Kept here so the call doesn't get re-litigated. */
  | "wont-ship";

import type { Complexity } from "./complexity";

/** Rough effort budget. Surfaced as filled-of-four dots in the page render
 *  via `COMPLEXITY_DOTS` — see `complexity.ts`. */
export type RoadmapComplexity = Complexity;

export type RoadmapItem = {
  id: string;
  title: string;
  /** One-line user-facing description. Aim for ~140 chars max. */
  summary: string;
  status: RoadmapStatus;
  complexity?: RoadmapComplexity;
  /** Set when status === "shipped". */
  shippedIn?: string;
  /** Optional one-line note: rationale, blocker, dependency. */
  note?: string;
  /** When true, the item is hidden from the in-app roadmap surface but
   *  kept in the typed config for internal tracking. */
  internal?: boolean;
};

export type RoadmapGroup = {
  id: string;
  title: string;
  description: string;
  items: RoadmapItem[];
};

export type RoadmapMilestone = {
  id: string;
  /** Display label, e.g. "v1.0 — First stable release". */
  title: string;
  /** One-paragraph context shown above the groups. */
  summary: string;
  /** Semver of the release this milestone targets. Optional for parking-lot
   *  milestones like "After v1.0" where there's no committed version. */
  targetVersion?: string;
  groups: RoadmapGroup[];
};

export const ROADMAP_MILESTONES: RoadmapMilestone[] = [
  {
    id: "v1.0",
    title: "v1.0 — First stable release",
    summary:
      "Shipped. Home reads as a real dashboard, the tactile pass has landed, and the in-app feature set feels complete enough to link a friend without caveats. The post-1.0 plan lives below.",
    targetVersion: "1.0.0",
    groups: [
      {
        id: "just-shipped",
        title: "Just shipped",
        description: "Recent v1.0 work that's already in the build you're running.",
        items: [
          {
            id: "card-pulse-status",
            title: "Card border pulse on status change",
            summary:
              "Brief halo in the new status colour when a card flips between Watching / Plan / Completed / Dropped / Tuned in. Renders inside the card's box so it survives paint containment on watchlist rows.",
            status: "shipped",
            shippedIn: "1.0.0",
            complexity: "S",
          },
          {
            id: "feed-jump-to",
            title: "Feed: jump to position",
            summary:
              "Tap the position counter on the feed to type any item number and snap straight there — useful when a long swipe streak got reset and you want to get back to where you were.",
            status: "shipped",
            shippedIn: "0.25.0",
            complexity: "S",
          },
          {
            id: "feed-exclude-genres",
            title: "Feed: exclude genres",
            summary:
              "Genre chips are three-state — tap to include, tap again to exclude, third tap clears. Browse 'everything but Horror' without leaving the setup screen.",
            status: "shipped",
            shippedIn: "0.25.0",
            complexity: "S",
          },
          {
            id: "picker-bracket-hints",
            title: "Picker: bracket hints",
            summary:
              "Bracket and result cards now show your watched-episode count, your rating, and a ↻ for rewatchable picks — easier to weigh head-to-heads without leaving the bracket.",
            status: "shipped",
            shippedIn: "0.25.0",
            complexity: "XS",
          },
          {
            id: "tour-new-pill",
            title: "Tour highlights what changed",
            summary:
              "When a guide section is bumped because a single paragraph or highlight changed, only that item gets a 'New' pill in the post-update tour — no more re-reading the whole section to spot the change.",
            status: "shipped",
            shippedIn: "0.25.0",
            complexity: "XS",
          },
          {
            id: "view-transitions",
            title: "View Transitions for navigation",
            summary:
              "Hub-tab navigation slides between pages in the direction of the tab bar; opening a show, movie, or person from any portrait card animates the card's poster into the destination's hero. The floating island stays anchored throughout. Falls back to a cross-fade for hub→detail and detail→hub.",
            status: "shipped",
            shippedIn: "0.24.0",
            complexity: "M",
          },
          {
            id: "rail-stagger",
            title: "Page-load stagger on rails",
            summary:
              "Home rails and discover sections fade-and-rise on page load with a small per-row stagger so the page reads as content flowing in. Respects prefers-reduced-motion.",
            status: "shipped",
            shippedIn: "0.23.0",
            complexity: "S",
          },
          {
            id: "long-press-hint",
            title: "Long-press hint",
            summary:
              "After a few app sessions, a one-time toast on Watchlist surfaces the long-press gesture for quick actions. Auto-dismisses after a few seconds and never reappears once seen.",
            status: "shipped",
            shippedIn: "0.23.0",
            complexity: "S",
          },
          {
            id: "tap-target-audit",
            title: "44×44 hit-target audit",
            summary:
              "Bumped the small icon and chip buttons that were stragglers (watchlist ⋯ menus, diary edit/delete, IMDb chips, recent-searches pills, diary +/− steppers, watchlist title-search clear) up to a consistent 36px floor.",
            status: "shipped",
            shippedIn: "0.23.0",
            complexity: "S",
          },
          {
            id: "started-untouched-filter",
            title: "Started / Untouched filter",
            summary:
              "Watchlist and Picker can now split anything in your library by whether you've actually cracked open a title — most useful for separating fresh Plan to watch entries from ones you've parked partway through.",
            status: "shipped",
            shippedIn: "0.22.0",
            complexity: "S",
          },
          {
            id: "movie-progress",
            title: "Movie progress tracking",
            summary:
              "Optional minutes-watched scrubber on movies — drag a tick ruler or tap chevrons to record where you paused. Surfaces in Continue Watching alongside TV and counts toward stats hours-watched.",
            status: "shipped",
            shippedIn: "0.21.0",
            complexity: "M",
          },
          {
            id: "continue-watching-episode-card",
            title: "Continue Watching → landscape cards",
            summary:
              "Home rail now uses landscape EpisodeCards with the show's backdrop, runtime, and an 'N remaining · Md' line so the rail reads like a real 'what to play next' dashboard.",
            status: "shipped",
            shippedIn: "0.20.0",
            complexity: "M",
          },
          {
            id: "upcoming-rail-home",
            title: "Upcoming Schedule rail on home",
            summary:
              "A landscape rail of upcoming episodes with 'In Nd' / 'Today' / 'Tomorrow' badges, sitting between Continue Watching and Start Watching.",
            status: "shipped",
            shippedIn: "0.20.0",
            complexity: "S",
          },
          {
            id: "activity-undo",
            title: "Activity log: undo + clear-all",
            summary:
              "Undo individual library changes from the activity feed (24h window) and a clear-all in Settings → Danger zone.",
            status: "shipped",
            shippedIn: "0.20.0",
            complexity: "M",
          },
          {
            id: "season-counter-flip",
            title: "Counter flip animation",
            summary:
              "Season counters flip between values with a small slide-and-fade so every +/- press registers visually alongside the haptic.",
            status: "shipped",
            shippedIn: "0.20.0",
            complexity: "S",
          },
          {
            id: "person-card-episode-count",
            title: "Episode count badge on actor cards",
            summary:
              "Shows 'N eps.' on the actors rail so you can read this actor's involvement in this show at a glance.",
            status: "shipped",
            shippedIn: "0.20.0",
            complexity: "XS",
          },
          {
            id: "haptics-toggle-confirmation",
            title: "Haptic feedback on Settings toggles",
            summary:
              "Settings → Preferences haptics toggle fires a 'success' on enable and a 'warn' on disable so you get immediate device-level feedback.",
            status: "shipped",
            shippedIn: "0.20.0",
            complexity: "XS",
          },
          {
            id: "roadmap-page",
            title: "Roadmap page",
            summary:
              "This page — the public plan. Every milestone, the items inside it, and their status, with shipped items stamped to the version that landed them.",
            status: "shipped",
            shippedIn: "0.19.0",
            complexity: "M",
          },
          {
            id: "temptation",
            title: "Temptation",
            summary:
              "Heat-based engagement score per title that fades over time, with a watchlist sort, a warm halo on Hot/Burning cards, and pacing presets.",
            status: "shipped",
            shippedIn: "0.18.0",
            complexity: "L",
          },
          {
            id: "tour-and-guide",
            title: "First-launch tour & in-app Guide",
            summary:
              "A paged walkthrough of the essentials for new users, plus a full Guide page in Settings with animated demos and a TOC chip rail.",
            status: "shipped",
            shippedIn: "0.17.0",
            complexity: "M",
          },
        ],
      },
      {
        id: "v1-internal",
        title: "Internal",
        description: "Tracked here for completeness — not surfaced in the in-app roadmap.",
        items: [
          {
            id: "readme-rewrite",
            title: "README rewrite",
            summary:
              "Repo README rewritten — leads with the live URL and the actual feature inventory (Diary, Picker, Discover, Feed, Stats, Leaderboard, Activity, Upcoming, Person pages, Where to Watch, Share, Tour, Guide, Temptation). State correctly described as IDB.",
            status: "shipped",
            shippedIn: "1.0.0",
            complexity: "S",
            internal: true,
          },
        ],
      },
    ],
  },
  {
    id: "v1.x",
    title: "v1.x — Post-1.0 polish",
    summary:
      "Small features and rough-edge fixes that didn't need to hold the v1.0 milestone. Each line gets stamped with the version that landed it.",
    targetVersion: "1.1.0",
    groups: [
      {
        id: "just-shipped",
        title: "Just shipped",
        description: "Recent post-1.0 work that's already in the build you're running.",
        items: [
          {
            id: "known-issues-page",
            title: "Known issues page",
            summary:
              "Settings → Known issues lists every bug currently being tracked — open, won't-fix, and recently shipped — with severity and a rough-fix estimate. Same vocabulary as the Roadmap page, pointed at what's broken instead of what's planned.",
            status: "shipped",
            shippedIn: "1.1.0",
            complexity: "M",
          },
          {
            id: "complexity-dots",
            title: "Effort tags now read as dots",
            summary:
              "Roadmap and Known issues complexity chips switched from XS / S / M / L letter codes to filled-of-four dots (●●○○) so the relative effort reads at a glance without a legend.",
            status: "shipped",
            shippedIn: "1.1.0",
            complexity: "XS",
          },
        ],
      },
    ],
  },
  {
    id: "v0.x",
    title: "v0.x — The road so far",
    summary:
      "Major user-visible features that have already shipped on the way to v1.0. Each item is stamped with the release that landed it — open the changelog (Settings → About → View changelog) for the full bullet-by-bullet record.",
    groups: [
      {
        id: "shipped-tracking",
        title: "Tracking depth",
        description: "Features that turn the library from a list into a record of what you've watched.",
        items: [
          {
            id: "shipped-season-tracker",
            title: "Season tracker page",
            summary:
              "Per-show season list opens into a full-screen tracker with episode list, air dates, runtimes, season rating, and a 'Catch up' pill.",
            status: "shipped",
            shippedIn: "0.9.0",
          },
          {
            id: "shipped-per-episode",
            title: "Per-episode toggling",
            summary:
              "Tap an episode's circle to flip just that one episode (non-contiguous like E1+E3 but not E2). Tap the row body for the contiguous mark-up-to-here flow.",
            status: "shipped",
            shippedIn: "0.10.0",
          },
          {
            id: "shipped-rewatchable",
            title: "Rewatchable flag",
            summary:
              "Mark titles as rewatchable from the show or movie page. Boosts them in the picker, gets a watchlist filter, and surfaces a Profile shelf.",
            status: "shipped",
            shippedIn: "0.10.0",
          },
          {
            id: "shipped-tuned-in",
            title: "'Tuned in' status",
            summary:
              "A fifth status for titles you've passively caught a few episodes of without tracking specifics — handy when you sat through someone else's binge.",
            status: "shipped",
            shippedIn: "0.6.0",
          },
          {
            id: "shipped-diary",
            title: "Diary",
            summary:
              "Per-viewing journal independent of episode progress. Log when you watched, an optional rating and note, and (for TV) the episode range covered.",
            status: "shipped",
            shippedIn: "0.4.0",
          },
          {
            id: "shipped-activity-log",
            title: "Activity log",
            summary:
              "Chronological feed of every library mutation — adds, status flips, progress, ratings, season completions, episode toggles — grouped by day.",
            status: "shipped",
            shippedIn: "0.11.0",
          },
          {
            id: "shipped-watchlist-filter",
            title: "Watchlist title filter",
            summary:
              "Search input above the library list narrows by title (and notes). URL-synced so filtered views are shareable.",
            status: "shipped",
            shippedIn: "0.12.0",
          },
        ],
      },
      {
        id: "shipped-discovery",
        title: "Decision tools & discovery",
        description: "Ways to find what to watch when you don't know what to watch.",
        items: [
          {
            id: "shipped-picker",
            title: "Picker (bracket-style decision tool)",
            summary:
              "Filter by status and kind, then go head-to-head matchup by matchup until one title is left. The winner gets a 'More like this' rail.",
            status: "shipped",
            shippedIn: "0.4.0",
          },
          {
            id: "shipped-bracket-reveal",
            title: "Picker bracket reveal",
            summary:
              "After a pick, reveal every match the bracket played, grouped by round (Final / Semifinal / Quarterfinal) with the winner highlighted.",
            status: "shipped",
            shippedIn: "0.10.0",
          },
          {
            id: "shipped-surprise",
            title: "Surprise random pick",
            summary:
              "On Discover, rolls a single random pick from your plan-list mixed with what's trending. Re-roll until you commit.",
            status: "shipped",
            shippedIn: "0.4.0",
          },
          {
            id: "shipped-feed",
            title: "Feed mode",
            summary:
              "Full-screen vertical swipe through TMDB. Resumable across sessions, with multiple saved feeds you can keep in parallel.",
            status: "shipped",
            shippedIn: "0.13.0",
          },
          {
            id: "shipped-leaderboard",
            title: "Leaderboard",
            summary:
              "Full TV and Movies rankings by your rating, with podium colour-coding on the top three. Linked from Profile.",
            status: "shipped",
            shippedIn: "0.8.0",
          },
          {
            id: "shipped-search-kind-tabs",
            title: "Search kind tabs with counts",
            summary:
              "All / TV / Movies tabs above search results show counts of what's on screen — search hits when you've typed, popular titles when empty.",
            status: "shipped",
            shippedIn: "0.16.3",
          },
        ],
      },
      {
        id: "shipped-mobile",
        title: "Mobile-first UX",
        description: "The layout, gestures, and feedback patterns that define how the app feels on a phone.",
        items: [
          {
            id: "shipped-tactile-pass",
            title: "Tactile pass — press feedback + long-press",
            summary:
              "Buttons and cards press down with a quick scale-and-spring; haptics fire on press-down. Long-press any library card for quick actions.",
            status: "shipped",
            shippedIn: "0.2.0",
          },
          {
            id: "shipped-swipe-right-add",
            title: "Swipe right to add",
            summary:
              "Discover, browse, and search-result cards open the status picker on a right-swipe so you don't have to aim for the +Add button.",
            status: "shipped",
            shippedIn: "0.5.0",
          },
          {
            id: "shipped-sheet-dismiss",
            title: "Sheet swipe-down dismiss",
            summary:
              "Bottom sheets across the app — sort/view, status picker, card actions, diary log, random picker — dismiss with a swipe-down on the handle.",
            status: "shipped",
            shippedIn: "0.10.0",
          },
          {
            id: "shipped-mobile-island",
            title: "Floating bottom island + page-actions rail",
            summary:
              "Hub tabs collapse into a single floating pill that doubles as a back button on detail pages, with a page-specific actions rail above it.",
            status: "shipped",
            shippedIn: "0.16.0",
          },
          {
            id: "shipped-tour-guide",
            title: "Guide page + first-launch tour",
            summary:
              "Paged walkthrough of every feature in Settings → Guide, with an auto-opening first-launch tour for new users and a post-update tour when sections change.",
            status: "shipped",
            shippedIn: "0.17.0",
          },
        ],
      },
      {
        id: "shipped-info-pages",
        title: "Info pages, sharing & metadata",
        description: "The depth around individual titles — cast, where to watch, regions, share, calendar.",
        items: [
          {
            id: "shipped-person-pages",
            title: "Person pages",
            summary:
              "Tap any cast member, director, or creator to see their full filmography, biography, and grouped credits.",
            status: "shipped",
            shippedIn: "0.1.0",
          },
          {
            id: "shipped-where-to-watch",
            title: "Where to Watch with inline region picker",
            summary:
              "Provider logos labelled 'Stream' / 'Buy' / 'Rent', with an inline region picker so you can switch country without going to Settings.",
            status: "shipped",
            shippedIn: "0.9.0",
          },
          {
            id: "shipped-locale",
            title: "Locale preference",
            summary:
              "Settings → Preferences → Locale controls the language of TMDB titles and overviews and supplies the default Where-to-Watch region.",
            status: "shipped",
            shippedIn: "0.9.0",
          },
          {
            id: "shipped-share",
            title: "Share + share-target",
            summary:
              "Share button uses your device's system share sheet. Series Tracker is also a share target — share a TMDB link from any app and it opens here.",
            status: "shipped",
            shippedIn: "0.10.0",
          },
          {
            id: "shipped-hero-redesign",
            title: "Info page hero redesign",
            summary:
              "Full-bleed backdrop fades into the page with the centered poster + title block in front. Action bar replaced with a row of icon buttons.",
            status: "shipped",
            shippedIn: "0.9.0",
          },
          {
            id: "shipped-calendar-export",
            title: "Calendar export of Upcoming",
            summary:
              "Downloads an .ics file you can drop into any calendar app — drops every upcoming episode of shows you're watching.",
            status: "shipped",
            shippedIn: "0.1.0",
          },
          {
            id: "shipped-settings-prefs",
            title: "Settings preferences",
            summary:
              "Haptics on/off, default add status (skips the picker), and a region/locale selector for Where to Watch — grouped into API / Backup / Preferences / About / Danger zone.",
            status: "shipped",
            shippedIn: "0.1.0",
          },
          {
            id: "shipped-update-detection",
            title: "Update detection + changelog viewer",
            summary:
              "In-app polling for new builds with a full-screen 'Update now' modal, and the changelog itself rendered in Settings → About.",
            status: "shipped",
            shippedIn: "0.1.0",
          },
        ],
      },
    ],
  },
  {
    id: "later",
    title: "After v1.0",
    summary:
      "Bigger ideas not blocking 1.0. Order here is a prediction, not a contract — items will move as priorities settle.",
    groups: [
      {
        id: "vaults-and-sync",
        title: "Vaults & cloud sync",
        description:
          "Run separate libraries side-by-side and (optionally) back any of them up to your own cloud. Local-first stays local — Series Tracker never holds your data.",
        items: [
          {
            id: "vaults",
            title: "Multiple vaults",
            summary:
              "Keep separate libraries side-by-side (main, kid-safe, experiments) and switch the whole app between them in one tap.",
            status: "planned",
            complexity: "L",
          },
          {
            id: "cloud-sync",
            title: "Cloud sync to your own storage",
            summary:
              "Optional per-vault sync to your own Google Drive (or similar). Your data stays in your account — Series Tracker never runs a server.",
            status: "considering",
            complexity: "L",
            note: "Depends on vaults landing first.",
          },
        ],
      },
      {
        id: "considering",
        title: "Considering",
        description: "Past idea stage but not yet committed to a milestone.",
        items: [
          {
            id: "genre-tag-watchlist",
            title: "Genre tag on watchlist rows",
            summary:
              "Schema change to capture genre IDs per entry (backfilled on detail-page visit). Pairs with the Stats genre breakdown.",
            status: "considering",
            complexity: "L",
          },
          {
            id: "picker-mechanics",
            title: "Picker — more decision modes",
            summary:
              "Mood-based ('short / long', 'comfort / challenge'), spin-again with weighted re-roll, two-show coin flip, genre-locked roll, decay-weighted picker.",
            status: "considering",
            complexity: "L",
          },
          {
            id: "browse-infinite-scroll",
            title: "Browse infinite scroll",
            summary:
              "Replace pagination on /discover/browse with append-on-scroll. Keep the page param in the URL for back-restore.",
            status: "considering",
            complexity: "M",
          },
          {
            id: "keyword-browse",
            title: "Keyword / theme browsing",
            summary:
              "Surface keyword chips on info pages; tapping opens a /keyword/{id} page with related titles.",
            status: "considering",
            complexity: "M",
          },
          {
            id: "streak",
            title: "Watching streak",
            summary: "Lightweight streak card on home with day pips. Cute, not central.",
            status: "considering",
            complexity: "M",
          },
          {
            id: "keyboard-shortcuts",
            title: "Keyboard shortcuts",
            summary: "Mobile-first keeps this low priority, but power users on desktop will want them eventually.",
            status: "considering",
            complexity: "M",
          },
        ],
      },
      {
        id: "wont-ship",
        title: "Won't ship",
        description: "Decisions made — kept here so they don't get re-litigated.",
        items: [
          {
            id: "no-light-theme",
            title: "Light theme",
            summary: "Always deferred. The dark palette IS the design.",
            status: "wont-ship",
          },
          {
            id: "no-ai-sentiment",
            title: "AI sentiment summary",
            summary: "LLM dependency, heavy, low signal for a tracker.",
            status: "wont-ship",
          },
          {
            id: "no-reviews",
            title: "Community reviews",
            summary:
              "Clutters a personal tracker. TMDB has them; Series Tracker doesn't need to surface them.",
            status: "wont-ship",
          },
          {
            id: "no-public-lists",
            title: "Public TMDB lists",
            summary: "Duplicates Browse. The browse + curated rails on Discover already cover this surface.",
            status: "wont-ship",
          },
          {
            id: "no-quick-add-buttons",
            title: "+ quick-add buttons on cards & rails",
            summary:
              "Tried briefly (Start Watching had one). Cards read better when the only library affordance is the status border + dot; rails get to where they need via tap, not a corner button.",
            status: "wont-ship",
          },
          {
            id: "no-vip",
            title: "Paywall / VIP surface",
            summary: "Series Tracker is free. Nothing to sell.",
            status: "wont-ship",
          },
          {
            id: "no-pull-to-refresh",
            title: "Pull-to-refresh",
            summary:
              "Would collide with the browser's native pull-to-refresh on mobile. Better to leave that gesture to the platform.",
            status: "wont-ship",
          },
          {
            id: "no-list-card-status-chip",
            title: "Watchlist status chip under poster",
            summary:
              "The status indicator already reads cleanly in the metadata row alongside the colour-tinted card border. Moving it under the poster wouldn't add clarity.",
            status: "wont-ship",
          },
        ],
      },
    ],
  },
];
