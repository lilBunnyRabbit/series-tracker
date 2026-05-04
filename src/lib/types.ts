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
    hoverBorder: "hover:border-primary",
  },
  completed: {
    dot: "bg-secondary",
    text: "text-secondary",
    border: "border-secondary",
    borderSoft: "border-secondary/60",
    bg: "bg-secondary",
    bgSoft: "bg-secondary/15",
    chip: "border-secondary text-secondary",
    hoverBorder: "hover:border-secondary",
  },
  plan: {
    dot: "bg-accent",
    text: "text-accent",
    border: "border-accent",
    borderSoft: "border-accent/60",
    bg: "bg-accent",
    bgSoft: "bg-accent/15",
    chip: "border-accent text-accent",
    hoverBorder: "hover:border-accent",
  },
  dropped: {
    dot: "bg-muted",
    text: "text-muted",
    border: "border-muted",
    borderSoft: "border-muted/60",
    bg: "bg-muted",
    bgSoft: "bg-muted/15",
    chip: "border-border text-muted",
    hoverBorder: "hover:border-muted",
  },
  tuned: {
    dot: "bg-tertiary",
    text: "text-tertiary",
    border: "border-tertiary",
    borderSoft: "border-tertiary/60",
    bg: "bg-tertiary",
    bgSoft: "bg-tertiary/15",
    chip: "border-tertiary text-tertiary",
    hoverBorder: "hover:border-tertiary",
  },
};

export type Season = {
  number: number;
  name: string;
  episodeCount: number;
};

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
  /** When false / absent, season 0 (specials) is excluded from completion
   *  calculations and Mark complete — users can finish a show without ticking
   *  specials. Flip on per-show via the show page toggle to track them. */
  includeSpecials?: boolean;
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
  genres?: { id: number; name: string }[];
  addedAt: string;
  updatedAt: string;
};

export type Entry = TvEntry | MovieEntry;

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

export type Store = {
  apiKey: string | null;
  library: Record<string, Entry>;
  searchHistory: string[];
  preferences: Preferences;
  diary: DiaryEntry[];
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

export type TvDetailFull = TvDetail & {
  networks?: { id: number; name: string; logo_path: string | null }[];
  credits?: Credits;
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
