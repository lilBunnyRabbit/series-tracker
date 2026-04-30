import type {
  MovieDetail,
  MovieDetailFull,
  SearchMultiPage,
  SearchMultiResult,
  SeasonDetail,
  TvDetail,
  TvDetailFull,
} from "./types";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

export type ImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";

export const posterUrl = (path: string | null, size: ImageSize = "w185"): string | null =>
  path ? `${IMG}/${size}${path}` : null;

type CacheEntry = { data: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function cacheKey(path: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "api_key")
    .sort();
  const qs = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  return `${path}?${qs}`;
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
    const hit = cache.get(ckey);
    if (hit && hit.expiresAt > Date.now()) return hit.data as T;
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
    if (!noCache) cache.set(ckey, { data, expiresAt: Date.now() + ttlMs });
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
  get<SearchMultiPage>(
    "/search/multi",
    key,
    { query: q, include_adult: "false" },
    { signal, ttlMs: 60 * 1000 }
  );

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

export function clearCache() {
  cache.clear();
  inflight.clear();
}
