export type Status = "watching" | "completed" | "plan" | "dropped";

export const STATUSES: Status[] = ["watching", "completed", "plan", "dropped"];

export const STATUS_LABEL: Record<Status, string> = {
  watching: "Watching",
  completed: "Completed",
  plan: "Plan to watch",
  dropped: "Dropped",
};

export const STATUS_DESCRIPTION: Record<Status, string> = {
  watching: "Currently watching",
  completed: "Finished — already watched it",
  plan: "Plan to watch later",
  dropped: "Started but won't finish",
};

// Tailwind class fragments mapping each status to a colour family.
// Kept as a single source of truth so cards, dots, and the picker stay in sync.
export const STATUS_COLOR: Record<
  Status,
  { dot: string; text: string; border: string; bg: string; chip: string; hoverBorder: string }
> = {
  watching: {
    dot: "bg-primary",
    text: "text-primary",
    border: "border-primary",
    bg: "bg-primary",
    chip: "border-primary text-primary",
    hoverBorder: "hover:border-primary",
  },
  completed: {
    dot: "bg-secondary",
    text: "text-secondary",
    border: "border-secondary",
    bg: "bg-secondary",
    chip: "border-secondary text-secondary",
    hoverBorder: "hover:border-secondary",
  },
  plan: {
    dot: "bg-accent",
    text: "text-accent",
    border: "border-accent",
    bg: "bg-accent",
    chip: "border-accent text-accent",
    hoverBorder: "hover:border-accent",
  },
  dropped: {
    dot: "bg-muted",
    text: "text-muted",
    border: "border-muted",
    bg: "bg-muted",
    chip: "border-border text-muted",
    hoverBorder: "hover:border-muted",
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
  addedAt: string;
  updatedAt: string;
};

export type MovieEntry = {
  kind: "movie";
  id: number;
  title: string;
  poster: string | null;
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
};

export type Store = {
  apiKey: string | null;
  library: Record<string, Entry>;
  searchHistory: string[];
  preferences: Preferences;
  version: number;
};

export type SearchMultiResult =
  | {
      media_type: "movie";
      id: number;
      title: string;
      poster_path: string | null;
      release_date?: string;
      overview?: string;
    }
  | {
      media_type: "tv";
      id: number;
      name: string;
      poster_path: string | null;
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
    season_number: number;
    name: string;
    episode_count: number;
    poster_path: string | null;
    air_date: string | null;
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
  backdrop_path: string | null;
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

export type EpisodeBrief = {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
  vote_average?: number;
};

export type SeasonDetail = {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  poster_path: string | null;
  episodes: EpisodeBrief[];
};
