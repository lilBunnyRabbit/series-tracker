import type {
  Entry,
  MovieDetail,
  MovieDetailFull,
  MovieEntry,
  SearchMultiPage,
  SearchMultiResult,
  SeasonDetail,
  Status,
  TvDetail,
  TvDetailFull,
  TvEntry,
} from "./types";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

export type ImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";

export const posterUrl = (path: string | null, size: ImageSize = "w185"): string | null =>
  path ? `${IMG}/${size}${path}` : null;

type CacheEntry = { data: unknown; expiresAt: number };

const CACHE_MAX = 200;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function cacheKey(path: string, params: Record<string, string>): string {
  const keys = Object.keys(params)
    .filter((k) => k !== "api_key")
    .sort();
  return keys.length ? `${path}?${keys.map((k) => `${k}=${params[k]}`).join("&")}` : path;
}

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // LRU bump: re-insert to mark as most-recent
  cache.delete(key);
  cache.set(key, hit);
  return hit.data as T;
}

function cacheSet(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  if (cache.size > CACHE_MAX) {
    // Map iteration is insertion order; first key is least-recent.
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
}

type GetOptions = {
  signal?: AbortSignal;
  ttlMs?: number;
  noCache?: boolean;
};

async function get<T>(
  path: string,
  key: string,
  params: Record<string, string> = {},
  opts: GetOptions = {}
): Promise<T> {
  const { signal, ttlMs = DEFAULT_TTL_MS, noCache = false } = opts;
  const ckey = cacheKey(path, params);

  if (!noCache) {
    const hit = cacheGet<T>(ckey);
    if (hit !== undefined) return hit;
    const pending = inflight.get(ckey);
    if (pending) return (await pending) as T;
  }

  const u = new URL(BASE + path);
  u.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);

  const promise = (async () => {
    const res = await fetch(u, { signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`TMDB ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`);
    }
    const data = (await res.json()) as T;
    if (!noCache) cacheSet(ckey, data, ttlMs);
    return data;
  })();

  if (!noCache) inflight.set(ckey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(ckey);
  }
}

export const searchMulti = (q: string, key: string, signal?: AbortSignal) =>
  get<SearchMultiPage>("/search/multi", key, { query: q, include_adult: "false" }, { signal, ttlMs: 60 * 1000 });

export const tvDetail = (id: number, key: string, signal?: AbortSignal) =>
  get<TvDetail>(`/tv/${id}`, key, {}, { signal });

export const movieDetail = (id: number, key: string, signal?: AbortSignal) =>
  get<MovieDetail>(`/movie/${id}`, key, {}, { signal });

export const tvDetailFull = (id: number, key: string, signal?: AbortSignal) =>
  get<TvDetailFull>(
    `/tv/${id}`,
    key,
    { append_to_response: "credits,external_ids,images,videos", include_image_language: "en,null" },
    { signal }
  );

export const movieDetailFull = (id: number, key: string, signal?: AbortSignal) =>
  get<MovieDetailFull>(
    `/movie/${id}`,
    key,
    { append_to_response: "credits,external_ids,images,videos", include_image_language: "en,null" },
    { signal }
  );

export const seasonDetail = (seriesId: number, seasonNumber: number, key: string, signal?: AbortSignal) =>
  get<SeasonDetail>(`/tv/${seriesId}/season/${seasonNumber}`, key, {}, { signal, ttlMs: 60 * 60 * 1000 });

export type RecommendationItem =
  | (Extract<SearchMultiResult, { media_type: "movie" }> & { vote_average?: number })
  | (Extract<SearchMultiResult, { media_type: "tv" }> & { vote_average?: number });

type RecommendationPage<K extends "movie" | "tv"> = {
  page: number;
  total_pages: number;
  total_results: number;
  results: (K extends "movie"
    ? { id: number; title: string; poster_path: string | null; release_date?: string; overview?: string; vote_average?: number }
    : { id: number; name: string; poster_path: string | null; first_air_date?: string; overview?: string; vote_average?: number })[];
};

export async function recommendations(
  kind: "tv" | "movie",
  id: number,
  key: string,
  signal?: AbortSignal
): Promise<RecommendationItem[]> {
  const data = await get<RecommendationPage<typeof kind>>(`/${kind}/${id}/recommendations`, key, {}, { signal });
  return data.results.map((r) => ({ ...r, media_type: kind }) as RecommendationItem);
}

type TrendingPage = {
  page: number;
  total_pages: number;
  total_results: number;
  results: SearchMultiResult[];
};

export const trending = (window: "day" | "week", key: string, signal?: AbortSignal) =>
  get<TrendingPage>(`/trending/all/${window}`, key, {}, { signal });

type PopularMoviesPage = {
  results: { id: number; title: string; poster_path: string | null; release_date?: string; overview?: string; vote_average?: number }[];
};
type PopularTvPage = {
  results: { id: number; name: string; poster_path: string | null; first_air_date?: string; overview?: string; vote_average?: number }[];
};

export async function popularMovies(key: string, signal?: AbortSignal): Promise<RecommendationItem[]> {
  const data = await get<PopularMoviesPage>("/movie/popular", key, {}, { signal });
  return data.results.map((r) => ({ ...r, media_type: "movie" }) as RecommendationItem);
}

export async function popularTv(key: string, signal?: AbortSignal): Promise<RecommendationItem[]> {
  const data = await get<PopularTvPage>("/tv/popular", key, {}, { signal });
  return data.results.map((r) => ({ ...r, media_type: "tv" }) as RecommendationItem);
}

export const ping = (key: string) => get<{ images: unknown }>("/configuration", key, {}, { noCache: true });

export function clearCache(): void {
  cache.clear();
  inflight.clear();
}

// ---- Entry constructors (single source of truth for SearchResult → library Entry conversion) ----

export function entryFromTvDetail(detail: TvDetail, status: Status = "plan"): TvEntry {
  const now = new Date().toISOString();
  return {
    kind: "tv",
    id: detail.id,
    title: detail.name,
    poster: posterUrl(detail.poster_path, "w342"),
    year: detail.first_air_date ? detail.first_air_date.slice(0, 4) : undefined,
    voteAverage: detail.vote_average,
    seasons: detail.seasons
      .filter((s) => s.season_number > 0 || s.episode_count > 0)
      .map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count })),
    progress: {},
    status,
    addedAt: now,
    updatedAt: now,
  };
}

export function entryFromMovieDetail(detail: MovieDetail, status: Status = "plan"): MovieEntry {
  const now = new Date().toISOString();
  return {
    kind: "movie",
    id: detail.id,
    title: detail.title,
    poster: posterUrl(detail.poster_path, "w342"),
    year: detail.release_date ? detail.release_date.slice(0, 4) : undefined,
    voteAverage: detail.vote_average,
    watched: status === "completed",
    status,
    addedAt: now,
    updatedAt: now,
  };
}

// Fetches detail then constructs an Entry. Used by Search/Discover "Add" handlers.
export async function entryFromSearchResult(
  r: SearchMultiResult,
  apiKey: string,
  status: Status = "plan",
  signal?: AbortSignal
): Promise<Entry | null> {
  if (r.media_type === "tv") {
    const detail = await tvDetail(r.id, apiKey, signal);
    return entryFromTvDetail(detail, status);
  }
  if (r.media_type === "movie") {
    const detail = await movieDetail(r.id, apiKey, signal);
    return entryFromMovieDetail(detail, status);
  }
  return null;
}
