export type Status = "watching" | "completed" | "plan" | "dropped" | "tuned";

// Order matches the StatusMenu add-flow drawer (plan → watching → tuned →
// dropped → completed) so every list-style picker reads identically. In 2-col
// grids the 5th item ("completed") sits alone in row 3 with col-span-2.
export const STATUSES: Status[] = ["plan", "watching", "tuned", "dropped", "completed"];

export const STATUS_LABEL: Record<Status, string> = {
  watching: "Watching",
  completed: "Completed",
  plan: "Plan to watch",
  dropped: "Dropped",
  tuned: "Tuned in",
};

export const STATUS_DESCRIPTION: Record<Status, string> = {
  watching: "Currently watching",
  completed: "Finished — already watched it",
  plan: "Plan to watch later",
  dropped: "Started but won't finish",
  tuned: "Caught a few episodes — not really tracking",
};

// Tailwind class fragments mapping each status to a colour family.
// Kept as a single source of truth so cards, dots, and the picker stay in sync.
// `bgSoft` is the /15-tinted background (rating chips); kept as a literal
// string so Tailwind's content scanner can see every variant.
export const STATUS_COLOR: Record<
  Status,
  {
    dot: string;
    text: string;
    border: string;
    borderSoft: string;
    bg: string;
    bgSoft: string;
    chip: string;
    hoverBorder: string;
  }
> = {
  watching: {
    dot: "bg-primary",
    text: "text-primary",
    border: "border-primary",
    borderSoft: "border-primary/60",
    bg: "bg-primary",
    bgSoft: "bg-primary/15",
    chip: "border-primary text-primary",
    hoverBorder: "hover-border-primary",
  },
  completed: {
    dot: "bg-secondary",
    text: "text-secondary",
    border: "border-secondary",
    borderSoft: "border-secondary/60",
    bg: "bg-secondary",
    bgSoft: "bg-secondary/15",
    chip: "border-secondary text-secondary",
    hoverBorder: "hover-border-secondary",
  },
  plan: {
    dot: "bg-accent",
    text: "text-accent",
    border: "border-accent",
    borderSoft: "border-accent/60",
    bg: "bg-accent",
    bgSoft: "bg-accent/15",
    chip: "border-accent text-accent",
    hoverBorder: "hover-border-accent",
  },
  dropped: {
    dot: "bg-muted",
    text: "text-muted",
    border: "border-muted",
    borderSoft: "border-muted/60",
    // `bg-text`, not `bg-muted`. `.bg` is the only field painted as an opaque
    // fill over poster artwork (the rating badge) and as a progress-bar fill,
    // and `muted` is a 65% alpha on the foreground — over a photo that makes
    // the badge's contrast depend on whatever pixels are behind it. The
    // opaque foreground is the same neutral, bounded at 6.92 dark / 7.05
    // light against the `text-bg` ink. Everything else here stays muted, so
    // Dropped still recedes in mixed lists.
    bg: "bg-text",
    bgSoft: "bg-muted/15",
    chip: "border-border text-muted",
    hoverBorder: "hover-border-muted",
  },
  // `info`, not `tertiary`. Tertiary is the brand's rank-1 rail at 1× the
  // seed chroma, which puts it within a just-noticeable difference of the
  // foreground in both modes (ΔE 1.8 dark, 1.2 light) — deliberate as the
  // quietest brand colour, unusable as one of five statuses you're meant to
  // tell apart at a glance. `info` is the furthest in-palette hue from the
  // other four and the only state token this app wasn't already using.
  tuned: {
    dot: "bg-info",
    text: "text-info",
    border: "border-info",
    borderSoft: "border-info/60",
    bg: "bg-info",
    bgSoft: "bg-info/15",
    chip: "border-info text-info",
    hoverBorder: "hover-border-info",
  },
};

export type Season = {
  number: number;
  name: string;
  episodeCount: number;
};

// Temptation — bounded engagement score in [0, 1], updated by activity
// (episodes watched, picker outcomes, detail-page opens, etc.) and faded by
// time decay according to the user's pacing preference. Drives the watchlist
// Temptation sort and a refined glow on high-temptation cards.
export type TemptationAction =
  | "episode-watched"
  | "season-completed"
  | "picker-win"
  | "picker-loss"
  | "detail-opened"
  | "episode-page-opened"
  | "rated-high"
  | "rewatchable-on"
  | "marked-finished"
  | "movie-progress";

export type TemptationEvent = {
  /** ISO timestamp of when the kick was applied. */
  at: string;
  /** Signed delta applied to the bounded score. The stored value is always
   *  clamped to [0, 1] before persist; this records the raw nudge. */
  delta: number;
  action: TemptationAction;
  /** Human-readable hint for the last-bump caption (e.g. "S2E5"). */
  meta?: string;
};

/** Pacing presets — map onto a per-day decay constant in temptation.ts.
 *  "Lingering" fades slowly (~70d half-life); "Restless" fades fast (~10d). */
export type TemptationPacing = "lingering" | "balanced" | "reactive" | "restless";

export type TvEntry = {
  kind: "tv";
  id: number;
  title: string;
  poster: string | null;
  /** Wide backdrop URL captured at add time; absent on entries added before
   *  the field existed — those backfill lazily on detail-page visits. */
  backdrop?: string | null;
  seasons: Season[];
  progress: Record<number, number>;
  status: Status;
  year?: string;
  voteAverage?: number;
  rating?: number;
  notes?: string;
  seasonRatings?: Record<number, number>;
  /** Per-episode runtime in minutes (TMDB episode_run_time[0]). Stats use it
   *  to compute total time watched from `runtime × watchedEpisodes`. */
  runtime?: number;
  /** Captured at add time so stats can compute top genres locally. */
  genres?: { id: number; name: string }[];
  /** Per-season explicit watched-episode set, only present when the user has
   *  tracked episodes non-contiguously (e.g. watched E1 and E3 but not E2).
   *  When absent for a season, episodes are derived contiguously from
   *  `progress[season]` (E1..E{progress} are watched). The store keeps
   *  `progress[season]` equal to the count either way, so display code that
   *  reads progress as a number is still correct. */
  watchedEpisodes?: Record<number, number[]>;
  /** When false / absent, season 0 (specials) is excluded from completion
   *  calculations and Mark complete — users can finish a show without ticking
   *  specials. Flip on per-show via the show page toggle to track them. */
  includeSpecials?: boolean;
  /** When true, marks the title as something the user is happy to revisit.
   *  Layered on top of `status` (a completed show can be rewatchable; a
   *  dropped one usually isn't). Surfaces: 2× weight in the picker pool,
   *  watchlist filter chip, profile shelf. */
  rewatchable?: boolean;
  /** Engagement score in [0, 1] — built up by activity (watching, picker
   *  wins, opening detail page) and faded by time decay. Drives the
   *  Temptation watchlist sort and a refined glow on high-temptation cards. */
  temptation?: number;
  /** ISO timestamp of the last temptation update. Decay is computed lazily
   *  from this on read so the persisted value only changes when an action
   *  fires, not on every render. */
  temptationUpdatedAt?: string;
  /** Bounded log of recent temptation kicks. Powers the trend arrow and the
   *  last-bump caption on the temptation bar. Trimmed to LOG_LIMIT entries. */
  temptationLog?: TemptationEvent[];
  /** Times this entry has won an Either/Or pair-up. Used by the picker's
   *  ranking-stream mode to derive a personal Top-N. */
  rankWins?: number;
  /** Times this entry has lost an Either/Or pair-up. */
  rankLosses?: number;
  /** Times this entry has been skipped in Either/Or — softer than a loss,
   *  no temptation kick, but counts against the entry's eligibility for the
   *  next pair so skips don't immediately repeat. */
  rankSkips?: number;
  addedAt: string;
  updatedAt: string;
};

/** Season-zero is TMDB's convention for specials. Centralised so everything
 *  agrees on the cutoff. */
export function isSpecialSeason(seasonNumber: number): boolean {
  return seasonNumber === 0;
}

/** Seasons that count toward "complete" / progress totals for a given entry.
 *  Honors the per-show `includeSpecials` flag. */
export function effectiveSeasons(entry: TvEntry): Season[] {
  if (entry.includeSpecials) return entry.seasons;
  return entry.seasons.filter((s) => !isSpecialSeason(s.number));
}

/** Whether the user has any meaningful engagement with an entry — TV: at
 *  least one watched episode in a counted season (specials excluded unless
 *  opted in, matching the card-level counter); Movie: `watched === true`.
 *  Powers the watchlist + picker "Started / Untouched" filter so a plan-status
 *  show with progress (parked / paused) can be split from a truly fresh one. */
export function hasProgress(entry: Entry): boolean {
  if (entry.kind === "movie") return entry.watched;
  return effectiveSeasons(entry).some((s) => (entry.progress[s.number] ?? 0) > 0);
}

/** Whether a specific episode is watched. Honors the explicit
 *  `watchedEpisodes` set when present (non-contiguous), otherwise falls back
 *  to the contiguous interpretation of `progress[season]`. */
export function isEpisodeWatched(entry: TvEntry, season: number, episodeNumber: number): boolean {
  const explicit = entry.watchedEpisodes?.[season];
  if (explicit && explicit.length > 0) return explicit.includes(episodeNumber);
  return (entry.progress[season] ?? 0) >= episodeNumber;
}

/** Returns the explicit watched-episode set for a season, or undefined if the
 *  season is in contiguous (counter) mode. Useful when callers need to decide
 *  between counter UI vs explicit set UI. */
export function explicitWatched(entry: TvEntry, season: number): number[] | undefined {
  const list = entry.watchedEpisodes?.[season];
  return list && list.length > 0 ? list : undefined;
}

/** Sort seasons for display so specials (season 0) always render last. */
export function sortSeasonsForDisplay<T extends { number: number }>(seasons: T[]): T[] {
  return [...seasons].sort((a, b) => {
    if (a.number === 0 && b.number !== 0) return 1;
    if (b.number === 0 && a.number !== 0) return -1;
    return a.number - b.number;
  });
}

export type MovieEntry = {
  kind: "movie";
  id: number;
  title: string;
  poster: string | null;
  /** Wide backdrop URL captured at add time; same lazy backfill story as TvEntry. */
  backdrop?: string | null;
  watched: boolean;
  status: Status;
  year?: string;
  voteAverage?: number;
  rating?: number;
  notes?: string;
  /** Movie length in minutes. */
  runtime?: number;
  /** Minutes watched, clamped to [0, runtime]. Optional — only persisted once
   *  the user uses the inline scrubber on the movie info page. Status remains
   *  the source of truth for "completed"; `progress` is a checkpoint within
   *  `status === "watching"` (and is preserved across plan/dropped/tuned
   *  transitions so the user can resume). Auto-promotes to "completed" when
   *  progress reaches runtime. */
  progress?: number;
  genres?: { id: number; name: string }[];
  /** See TvEntry — same flag, same surfaces. */
  rewatchable?: boolean;
  /** See TvEntry — same field, same semantics. */
  temptation?: number;
  /** See TvEntry. */
  temptationUpdatedAt?: string;
  /** See TvEntry. */
  temptationLog?: TemptationEvent[];
  /** See TvEntry — Either/Or pair-up wins. */
  rankWins?: number;
  /** See TvEntry — Either/Or pair-up losses. */
  rankLosses?: number;
  /** See TvEntry — Either/Or skips. */
  rankSkips?: number;
  addedAt: string;
  updatedAt: string;
};

export type Entry = TvEntry | MovieEntry;

/** Default upper bound when a movie has no recorded runtime — matches the
 *  fallback used by stats so partial-progress and stats math agree. */
export const FALLBACK_MOVIE_RUNTIME = 110;

/** Effective runtime for a movie — TMDB-reported when present, otherwise the
 *  shared fallback. Used as the slider's upper bound and the stats divisor. */
export function movieRuntime(e: MovieEntry): number {
  return e.runtime && e.runtime > 0 ? e.runtime : FALLBACK_MOVIE_RUNTIME;
}

/** Clamped minutes watched on a movie, treating an absent field as 0. */
export function movieProgress(e: MovieEntry): number {
  return Math.max(0, Math.min(e.progress ?? 0, movieRuntime(e)));
}

/** Progress fraction in [0, 1]. 0 when no runtime is known. */
export function movieProgressFraction(e: MovieEntry): number {
  return movieProgress(e) / movieRuntime(e);
}

/** True when the movie has a non-zero checkpoint and is in the watching
 *  bucket — the surface trigger for Continue Watching and the live scrubber. */
export function isMovieInProgress(e: MovieEntry): boolean {
  return e.status === "watching" && (e.progress ?? 0) > 0;
}

export type Preferences = {
  /** When true, vibration patterns are suppressed. */
  hapticsMuted?: boolean;
  /** Default status pre-selected when adding via "+ Add" — null means show the picker. */
  defaultAddStatus?: Status | null;
  /** Override for navigator.language-derived region used by Where to Watch. */
  region?: string | null;
  /** Override for navigator.language-derived locale sent to TMDB (provider names, etc.). */
  language?: string | null;
  /** Has the diary backfill prompt been answered (yes or dismissed)? Set after first /diary/ visit. */
  diaryBackfilled?: boolean;
  /** Has the user finished or skipped the first-launch guide tour? Set on
   *  finish/skip so the tour doesn't auto-open on subsequent visits. Manual
   *  replay (via Settings → Guide → Take the tour) toggles a separate flag in
   *  $lib/tour.svelte.ts and bypasses this field. */
  tourSeen?: boolean;
  /** Last app version whose guide content the user has seen — set when they
   *  close any tour run (full or update). Drives the post-update auto-tour
   *  in $lib/tour.svelte.ts: after an upgrade, sections tagged with a
   *  version newer than this open in a filtered tour showing only the
   *  changes. Undefined for users predating the post-update flow; the tour
   *  module migrates them lazily based on `tourSeen`. */
  lastSeenGuideVersion?: string;
  /** Pacing for the temptation score's time decay. Maps to a per-day decay
   *  constant in temptation.ts. Defaults to "balanced" when unset. */
  temptationPacing?: TemptationPacing;
  /** Number of distinct app sessions the user has logged. Bumped once per
   *  session in `+layout.svelte` (sessionStorage-deduped so a tab refresh
   *  doesn't double-count). Drives the long-press hint timing. */
  sessionCount?: number;
  /** Has the user seen and dismissed the "long-press a card for quick actions"
   *  hint? Set on dismiss / auto-dismiss so the toast doesn't reappear. */
  seenLongPressHint?: boolean;
  /** Theme override. "auto" follows the OS via prefers-color-scheme; "light"
   *  / "dark" pin the theme regardless. Defaults to "dark" when unset —
   *  light mode is still experimental, so new users don't get flipped to
   *  it just because their OS is on light. They opt in explicitly via the
   *  Settings → Preferences → Theme picker. The resolved value is mirrored
   *  to localStorage by `$lib/theme.svelte.ts` so the inline boot script
   *  in app.html can stamp the html class before first paint without
   *  waiting on IDB. */
  theme?: "auto" | "light" | "dark";
};

/** All valid values for `Preferences.theme`. Source-of-truth list for the
 *  Settings segmented control and any future theme migration logic. */
export const THEMES = ["auto", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export type ActionType =
  | "add"
  | "remove"
  | "status"
  | "rating"
  | "notes"
  | "rewatchable"
  | "specials"
  | "progress"
  | "season-complete"
  | "season-reset"
  | "episode-toggle"
  | "season-rating"
  | "movie-progress";

/** A single library mutation captured for the activity log. Capped at 200
 *  most-recent entries inside the persisted state. `prev` snapshots the entry
 *  before the mutation so a future Undo (deferred to step 2) can restore it
 *  without per-field plumbing. `undoneAt` is reserved for that step and is
 *  never set by step 1 writers. */
export type ActionEntry = {
  id: string;
  type: ActionType;
  kind: "tv" | "movie";
  refId: number;
  /** Snapshot of title at action time so removed entries still read correctly. */
  title: string;
  poster?: string | null;
  createdAt: string;
  meta?: { season?: number; episode?: number; minutes?: number };
  /** Pre-mutation snapshot of the entry. Absent for "add" (no prior state). */
  prev?: Entry;
  /** Reserved for the step-2 undo flow. */
  undoneAt?: string;
};

export type DiaryEntry = {
  /** Locally-unique id; not a TMDB id. */
  id: string;
  kind: "tv" | "movie";
  /** TMDB id of the show or movie. */
  refId: number;
  /** Snapshot of title at log time so the diary survives library deletes. */
  title: string;
  /** Poster path (TMDB w342) — same reason. */
  poster?: string | null;
  /** ISO date YYYY-MM-DD; date-only is enough for journaling. */
  watchedAt: string;
  /** TV-only: which season the episodes belong to. */
  season?: number;
  /** TV-only: episode-range — fromEp inclusive. */
  fromEp?: number;
  /** TV-only: episode-range — toEp inclusive (== fromEp for single-episode logs). */
  toEp?: number;
  /** Optional 0–10 rating for this viewing. */
  rating?: number;
  /** Free-text note. */
  note?: string;
  /** True if the user marked this as a rewatch. */
  rewatch?: boolean;
  /** ISO datetime when the entry was created in the journal. */
  createdAt: string;
};

export type DiscoverSort =
  | "popularity.desc"
  | "popularity.asc"
  | "vote_average.desc"
  | "vote_average.asc"
  | "newest"
  | "oldest"
  | "title.asc"
  | "title.desc";

/** Persistent state for the vertical Feed browser. Captured on every visible
 *  item change so users can resume where they left off across app restarts.
 *  Filters are snapshotted with the session so resume runs against the same
 *  result space the user was scrolling through. */
export type FeedSession = {
  kind: "tv" | "movie";
  sort: DiscoverSort;
  /** TMDB genre IDs to AND-include. Kind-specific ID space. */
  genres: number[];
  /** TMDB genre IDs to exclude. Maps to TMDB's `without_genres` param.
   *  Optional for back-compat with sessions saved before this field existed —
   *  legacy sessions read it as the empty array. */
  excludedGenres?: number[];
  hideAdded: boolean;
  /** "tv:123" / "movie:456" — deepest item the user has reached. The save is
   *  monotonic: once recorded, only an item at a STRICTLY greater index is
   *  ever written here. This makes the resume safe against shallow remount
   *  scroll events (e.g. landing back at idx 0 if a resume silently fails)
   *  overwriting genuinely-deep progress. */
  lastSeenKey: string;
  /** Items-array index at save time. Used as the floor for subsequent saves
   *  so deeper-only updates win. Optional for back-compat with sessions saved
   *  before this field existed. */
  lastSeenIndex?: number;
  /** TMDB page that contains `lastSeenKey`. Resume uses this to fetch only
   *  the right page directly — no walking pages 1..N to find the marker.
   *  Optional for back-compat with sessions saved before this field existed;
   *  legacy sessions fall back to a heuristic on `lastSeenIndex`. */
  lastSeenPage?: number;
  /** Legacy: highest TMDB page that had been fetched at save time. Older
   *  resume code paged from 1 up to this number to find `lastSeenKey`. We
   *  no longer write this — `lastSeenPage` supersedes it — but old sessions
   *  may still have it set. Read for legacy fallback only. */
  lastSeenPagesLoaded?: number;
  /** Keys (`tv:123` / `movie:456`) the user added to their library WHILE this
   *  feed session was active. Loadnext bypasses the hideAdded filter for
   *  these so items the user adds (then taps back from details) don't
   *  vanish on remount. Only populated when hideAdded was on at add time. */
  addedDuringSession?: string[];
  updatedAt: string;
};

export type Store = {
  apiKey: string | null;
  library: Record<string, Entry>;
  searchHistory: string[];
  preferences: Preferences;
  diary: DiaryEntry[];
  actions: ActionEntry[];
  /** Saved feed-resume state, one per filter set (kind + sort + genres +
   *  hideAdded). Replaced V7's single `feedSession` so users can keep
   *  parallel resume points across multiple feeds. */
  feedSessions: FeedSession[];
  version: number;
};

export type SearchMultiResult =
  | {
      media_type: "movie";
      id: number;
      title: string;
      poster_path: string | null;
      backdrop_path?: string | null;
      release_date?: string;
      overview?: string;
    }
  | {
      media_type: "tv";
      id: number;
      name: string;
      poster_path: string | null;
      backdrop_path?: string | null;
      first_air_date?: string;
      overview?: string;
    }
  | { media_type: "person"; id: number; name: string };

export type SearchMultiPage = {
  page: number;
  total_pages: number;
  total_results: number;
  results: SearchMultiResult[];
};

export type TvDetail = {
  id: number;
  name: string;
  original_name?: string;
  original_language?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  tagline?: string;
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  first_air_date: string;
  vote_average?: number;
  vote_count?: number;
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  seasons: {
    id?: number;
    season_number: number;
    name: string;
    episode_count: number;
    poster_path: string | null;
    air_date: string | null;
    overview?: string;
    vote_average?: number;
  }[];
  production_companies?: { id: number; name: string; logo_path: string | null }[];
};

export type MovieDetail = {
  id: number;
  title: string;
  original_title?: string;
  original_language?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  runtime: number;
  status: string;
  tagline?: string;
  vote_average?: number;
  vote_count?: number;
  genres?: { id: number; name: string }[];
  production_companies?: { id: number; name: string; logo_path: string | null }[];
};

export type CastMember = { id: number; name: string; character: string; profile_path: string | null; order: number };
export type CrewMember = { id: number; name: string; job: string; department: string; profile_path: string | null };
export type Credits = { cast: CastMember[]; crew: CrewMember[] };
export type ExternalIds = { imdb_id?: string | null; instagram_id?: string | null; twitter_id?: string | null };

export type ImageItem = {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_average?: number;
  iso_639_1?: string | null;
};
export type Images = { backdrops: ImageItem[]; posters: ImageItem[]; logos: ImageItem[] };

export type Video = {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at?: string;
  size?: number;
};
export type Videos = { results: Video[] };

/** TV-only "credits aggregated across the whole series." Differs from
 *  `Credits` in that each cast member carries `total_episode_count` (their
 *  involvement across the show) and a `roles` array (since one actor can play
 *  multiple roles across seasons). Used for the Actors rail on the show info
 *  page so each card can show "N eps." at a glance. */
export type AggregateCastRole = {
  credit_id: string;
  character: string;
  episode_count: number;
};

export type AggregateCastMember = {
  id: number;
  name: string;
  profile_path: string | null;
  order: number;
  roles: AggregateCastRole[];
  total_episode_count: number;
  popularity?: number;
};

export type AggregateCredits = {
  cast: AggregateCastMember[];
};

export type TvDetailFull = TvDetail & {
  networks?: { id: number; name: string; logo_path: string | null }[];
  credits?: Credits;
  aggregate_credits?: AggregateCredits;
  external_ids?: ExternalIds;
  images?: Images;
  videos?: Videos;
};

export type MovieDetailFull = MovieDetail & {
  credits?: Credits;
  external_ids?: ExternalIds;
  images?: Images;
  videos?: Videos;
};

export type Genre = { id: number; name: string };

export type PersonDetail = {
  id: number;
  name: string;
  also_known_as?: string[];
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  profile_path: string | null;
  known_for_department?: string;
  homepage?: string | null;
  imdb_id?: string | null;
  popularity?: number;
};

export type PersonCreditMovie = {
  id: number;
  media_type: "movie";
  title: string;
  poster_path: string | null;
  release_date?: string;
  character?: string;
  job?: string;
  department?: string;
  vote_average?: number;
  popularity?: number;
};

export type PersonCreditTv = {
  id: number;
  media_type: "tv";
  name: string;
  poster_path: string | null;
  first_air_date?: string;
  character?: string;
  job?: string;
  department?: string;
  episode_count?: number;
  vote_average?: number;
  popularity?: number;
};

export type PersonCredit = PersonCreditMovie | PersonCreditTv;

export type PersonCombinedCredits = {
  id: number;
  cast: PersonCredit[];
  crew: PersonCredit[];
};

export type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
};

export type WatchProviderRegion = {
  link?: string;
  flatrate?: WatchProvider[];
  free?: WatchProvider[];
  ads?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
};

export type WatchProvidersResponse = {
  id: number;
  results: Record<string, WatchProviderRegion>;
};

export type EpisodeCrew = {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
};

export type EpisodeGuestStar = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
};

export type EpisodeBrief = {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
  vote_average?: number;
  vote_count?: number;
  crew?: EpisodeCrew[];
  guest_stars?: EpisodeGuestStar[];
};

export type SeasonDetail = {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  poster_path: string | null;
  vote_average?: number;
  episodes: EpisodeBrief[];
};

export type SeasonDetailFull = SeasonDetail & {
  credits?: Credits;
  images?: { posters: ImageItem[] };
  videos?: Videos;
};
