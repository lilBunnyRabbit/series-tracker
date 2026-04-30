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
  addedAt: string;
  updatedAt: string;
};

export type Entry = TvEntry | MovieEntry;

export type Store = {
  apiKey: string | null;
  library: Record<string, Entry>;
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
  overview: string;
  release_date: string;
  runtime: number;
  status: string;
};
