export type Status = "watching" | "completed" | "plan" | "dropped";

export const STATUSES: Status[] = ["watching", "completed", "plan", "dropped"];

export const STATUS_LABEL: Record<Status, string> = {
  watching: "Watching",
  completed: "Completed",
  plan: "Plan to watch",
  dropped: "Dropped",
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
  addedAt: string;
  updatedAt: string;
};

export type Entry = TvEntry | MovieEntry;

export type Store = {
  apiKey: string | null;
  library: Record<string, Entry>;
  searchHistory: string[];
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
  poster_path: string | null;
  overview: string;
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  first_air_date: string;
  vote_average?: number;
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
  tagline?: string;
  vote_count?: number;
  genres?: { id: number; name: string }[];
  networks?: { id: number; name: string; logo_path: string | null }[];
  episode_run_time?: number[];
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
