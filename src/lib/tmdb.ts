import type {
  DiscoverSort,
  Entry,
  Genre,
  MovieDetail,
  MovieDetailFull,
  MovieEntry,
  PersonCombinedCredits,
  PersonCredit,
  PersonDetail,
  SearchMultiPage,
  SearchMultiResult,
  SeasonDetail,
  SeasonDetailFull,
  Status,
  TvDetail,
  TvDetailFull,
  TvEntry,
  WatchProvidersResponse,
} from "./types";

export type { DiscoverSort } from "./types";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

export type ImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";

export const posterUrl = (path: string | null, size: ImageSize = "w185"): string | null =>
  path ? `${IMG}/${size}${path}` : null;

// TMDB backdrop sizes: w300, w780, w1280, original. ImageSize includes w780 so
// we reuse it; other ImageSize values fall back to the closest TMDB backdrop on
// the CDN side.
export const backdropUrl = (path: string | null | undefined, size: ImageSize = "w780"): string | null =>
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

export const seasonDetailFull = (seriesId: number, seasonNumber: number, key: string, signal?: AbortSignal) =>
  get<SeasonDetailFull>(
    `/tv/${seriesId}/season/${seasonNumber}`,
    key,
    { append_to_response: "credits,images,videos", include_image_language: "en,null" },
    { signal, ttlMs: 60 * 60 * 1000 }
  );

export type RecommendationItem =
  | (Extract<SearchMultiResult, { media_type: "movie" }> & {
      vote_average?: number;
      vote_count?: number;
      genre_ids?: number[];
      original_language?: string;
    })
  | (Extract<SearchMultiResult, { media_type: "tv" }> & {
      vote_average?: number;
      vote_count?: number;
      genre_ids?: number[];
      original_language?: string;
    });

type RecommendationPage<K extends "movie" | "tv"> = {
  page: number;
  total_pages: number;
  total_results: number;
  results: (K extends "movie"
    ? { id: number; title: string; poster_path: string | null; backdrop_path: string | null; release_date?: string; overview?: string; vote_average?: number }
    : { id: number; name: string; poster_path: string | null; backdrop_path: string | null; first_air_date?: string; overview?: string; vote_average?: number })[];
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

export async function similar(
  kind: "tv" | "movie",
  id: number,
  key: string,
  signal?: AbortSignal
): Promise<RecommendationItem[]> {
  const data = await get<RecommendationPage<typeof kind>>(`/${kind}/${id}/similar`, key, {}, { signal });
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
  results: { id: number; title: string; poster_path: string | null; backdrop_path: string | null; release_date?: string; overview?: string; vote_average?: number }[];
};
type PopularTvPage = {
  results: { id: number; name: string; poster_path: string | null; backdrop_path: string | null; first_air_date?: string; overview?: string; vote_average?: number }[];
};

export async function popularMovies(key: string, signal?: AbortSignal): Promise<RecommendationItem[]> {
  const data = await get<PopularMoviesPage>("/movie/popular", key, {}, { signal });
  return data.results.map((r) => ({ ...r, media_type: "movie" }) as RecommendationItem);
}

export async function popularTv(key: string, signal?: AbortSignal): Promise<RecommendationItem[]> {
  const data = await get<PopularTvPage>("/tv/popular", key, {}, { signal });
  return data.results.map((r) => ({ ...r, media_type: "tv" }) as RecommendationItem);
}

export async function topRatedMovies(key: string, signal?: AbortSignal): Promise<RecommendationItem[]> {
  const data = await get<PopularMoviesPage>("/movie/top_rated", key, {}, { signal });
  return data.results.map((r) => ({ ...r, media_type: "movie" }) as RecommendationItem);
}

export async function topRatedTv(key: string, signal?: AbortSignal): Promise<RecommendationItem[]> {
  const data = await get<PopularTvPage>("/tv/top_rated", key, {}, { signal });
  return data.results.map((r) => ({ ...r, media_type: "tv" }) as RecommendationItem);
}

export const ping = (key: string) => get<{ images: unknown }>("/configuration", key, {}, { noCache: true });

// ---- Discover (filterable browse) ----

export type DiscoverPage = {
  page: number;
  total_pages: number;
  total_results: number;
  results: RecommendationItem[];
};

export type DiscoverFilters = {
  sort: DiscoverSort;
  /** TMDB genre IDs to AND-filter on (movie + tv have separate ID spaces). */
  genres: number[];
  page: number;
  /** Minimum vote count to suppress junk (default 20). Set to 0 to disable. */
  minVotes?: number;
  /** Filter by person (cast or crew). Movie-only — TMDB TV discover ignores it. */
  withPeople?: number[];
};

const SORT_TV: Record<DiscoverSort, string> = {
  "popularity.desc": "popularity.desc",
  "popularity.asc": "popularity.asc",
  "vote_average.desc": "vote_average.desc",
  "vote_average.asc": "vote_average.asc",
  newest: "first_air_date.desc",
  oldest: "first_air_date.asc",
  "title.asc": "name.asc",
  "title.desc": "name.desc",
};

const SORT_MOVIE: Record<DiscoverSort, string> = {
  "popularity.desc": "popularity.desc",
  "popularity.asc": "popularity.asc",
  "vote_average.desc": "vote_average.desc",
  "vote_average.asc": "vote_average.asc",
  newest: "primary_release_date.desc",
  oldest: "primary_release_date.asc",
  "title.asc": "original_title.asc",
  "title.desc": "original_title.desc",
};

export async function discover(
  kind: "tv" | "movie",
  apiKey: string,
  filters: DiscoverFilters,
  signal?: AbortSignal
): Promise<DiscoverPage> {
  const sortMap = kind === "tv" ? SORT_TV : SORT_MOVIE;
  const minVotes = filters.minVotes ?? 20;
  const params: Record<string, string> = {
    sort_by: sortMap[filters.sort],
    page: String(filters.page),
    include_adult: "false",
  };
  if (filters.genres.length > 0) params.with_genres = filters.genres.join(",");
  if (minVotes > 0) params["vote_count.gte"] = String(minVotes);
  // with_people is a movie-only TMDB param. For TV, TMDB silently ignores it
  // (the param has no equivalent on /discover/tv) — callers should switch to
  // kind="movie" when filtering by person.
  if (kind === "movie" && filters.withPeople && filters.withPeople.length > 0) {
    params.with_people = filters.withPeople.join(",");
  }

  type RawTv = {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
    first_air_date?: string;
    overview?: string;
    vote_average?: number;
    vote_count?: number;
    genre_ids?: number[];
    original_language?: string;
  };
  type RawMovie = {
    id: number;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string;
    overview?: string;
    vote_average?: number;
    vote_count?: number;
    genre_ids?: number[];
    original_language?: string;
  };
  type Raw = { page: number; total_pages: number; total_results: number; results: (RawTv | RawMovie)[] };

  const data = await get<Raw>(`/discover/${kind}`, apiKey, params, { signal, ttlMs: 5 * 60 * 1000 });
  const results = data.results.map((r) => ({ ...r, media_type: kind }) as RecommendationItem);
  return {
    page: data.page,
    total_pages: data.total_pages,
    total_results: data.total_results,
    results,
  };
}

export async function genreList(kind: "tv" | "movie", apiKey: string, signal?: AbortSignal): Promise<Genre[]> {
  const data = await get<{ genres: Genre[] }>(`/genre/${kind}/list`, apiKey, {}, { signal, ttlMs: 24 * 60 * 60 * 1000 });
  return data.genres;
}

// ---- Person ----

export const personDetail = (id: number, key: string, signal?: AbortSignal) =>
  get<PersonDetail>(`/person/${id}`, key, {}, { signal, ttlMs: 60 * 60 * 1000 });

type PersonCombinedCreditsRaw = {
  id: number;
  cast: ({
    id: number;
    media_type: "movie" | "tv";
    title?: string;
    name?: string;
    poster_path: string | null;
    release_date?: string;
    first_air_date?: string;
    character?: string;
    episode_count?: number;
    vote_average?: number;
    popularity?: number;
  })[];
  crew: ({
    id: number;
    media_type: "movie" | "tv";
    title?: string;
    name?: string;
    poster_path: string | null;
    release_date?: string;
    first_air_date?: string;
    job?: string;
    department?: string;
    episode_count?: number;
    vote_average?: number;
    popularity?: number;
  })[];
};

function normalisePersonCredit<T extends PersonCombinedCreditsRaw["cast"][number] | PersonCombinedCreditsRaw["crew"][number]>(c: T): PersonCredit | null {
  if (c.media_type === "movie") {
    return {
      id: c.id,
      media_type: "movie",
      title: c.title ?? "",
      poster_path: c.poster_path,
      release_date: c.release_date,
      character: "character" in c ? c.character : undefined,
      job: "job" in c ? c.job : undefined,
      department: "department" in c ? c.department : undefined,
      vote_average: c.vote_average,
      popularity: c.popularity,
    };
  }
  if (c.media_type === "tv") {
    return {
      id: c.id,
      media_type: "tv",
      name: c.name ?? "",
      poster_path: c.poster_path,
      first_air_date: c.first_air_date,
      character: "character" in c ? c.character : undefined,
      job: "job" in c ? c.job : undefined,
      department: "department" in c ? c.department : undefined,
      episode_count: c.episode_count,
      vote_average: c.vote_average,
      popularity: c.popularity,
    };
  }
  return null;
}

export async function personCombinedCredits(id: number, key: string, signal?: AbortSignal): Promise<PersonCombinedCredits> {
  const data = await get<PersonCombinedCreditsRaw>(`/person/${id}/combined_credits`, key, {}, { signal, ttlMs: 60 * 60 * 1000 });
  return {
    id: data.id,
    cast: data.cast.map(normalisePersonCredit).filter((x): x is PersonCredit => x !== null),
    crew: data.crew.map(normalisePersonCredit).filter((x): x is PersonCredit => x !== null),
  };
}

// ---- Watch providers (JustWatch data via TMDB) ----

export const watchProviders = (
  kind: "tv" | "movie",
  id: number,
  apiKey: string,
  language: string = defaultLanguage(),
  signal?: AbortSignal
) =>
  get<WatchProvidersResponse>(
    `/${kind}/${id}/watch/providers`,
    apiKey,
    { language },
    { signal, ttlMs: 12 * 60 * 60 * 1000 }
  );

/** Best-effort country code derived from navigator.language ("en-US" → "US"). Falls back to "US". */
export function defaultRegion(): string {
  return regionFromLocale(defaultLanguage()) ?? "US";
}

/** Browser locale in TMDB's expected `xx-YY` form. Falls back to "en-US". */
export function defaultLanguage(): string {
  if (typeof navigator === "undefined") return "en-US";
  return navigator.language || "en-US";
}

/** Country part of a BCP-47 locale, uppercased ("sl-SI" → "SI"). null when absent or malformed. */
export function regionFromLocale(locale: string | null | undefined): string | null {
  if (!locale) return null;
  const region = locale.split("-")[1]?.toUpperCase();
  return region && region.length === 2 ? region : null;
}

/** BCP-47 locale codes TMDB accepts for the `language` query parameter (curated subset). */
export const LANGUAGE_OPTIONS: string[] = [
  "ar-SA",
  "cs-CZ",
  "da-DK",
  "de-DE",
  "el-GR",
  "en-GB",
  "en-US",
  "es-ES",
  "es-MX",
  "fi-FI",
  "fr-CA",
  "fr-FR",
  "he-IL",
  "hi-IN",
  "hu-HU",
  "id-ID",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "nb-NO",
  "nl-NL",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "ro-RO",
  "ru-RU",
  "sk-SK",
  "sl-SI",
  "sv-SE",
  "th-TH",
  "tr-TR",
  "uk-UA",
  "vi-VN",
  "zh-CN",
  "zh-HK",
  "zh-TW",
];

export function clearCache(): void {
  cache.clear();
  inflight.clear();
}

// ---- Entry constructors (single source of truth for SearchResult → library Entry conversion) ----

export function entryFromTvDetail(detail: TvDetail, status: Status = "plan"): TvEntry {
  const now = new Date().toISOString();
  // Sort with specials (season 0) last so library order matches what the show
  // page renders; downstream consumers (incrementCurrent, library card meta)
  // can iterate in display order.
  const seasons = detail.seasons
    .filter((s) => s.season_number > 0 || s.episode_count > 0)
    .map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count }))
    .sort((a, b) => {
      if (a.number === 0 && b.number !== 0) return 1;
      if (b.number === 0 && a.number !== 0) return -1;
      return a.number - b.number;
    });
  // Adding as "completed" means the user has already finished it — pre-fill
  // every non-special season's progress. Specials stay at zero unless the user
  // explicitly opts into tracking them later.
  const progress: Record<number, number> =
    status === "completed"
      ? Object.fromEntries(seasons.filter((s) => s.number !== 0).map((s) => [s.number, s.episodeCount]))
      : {};
  return {
    kind: "tv",
    id: detail.id,
    title: detail.name,
    poster: posterUrl(detail.poster_path, "w342"),
    backdrop: backdropUrl(detail.backdrop_path, "w780"),
    year: detail.first_air_date ? detail.first_air_date.slice(0, 4) : undefined,
    voteAverage: detail.vote_average,
    runtime: detail.episode_run_time && detail.episode_run_time.length > 0 ? detail.episode_run_time[0] : undefined,
    genres: detail.genres,
    seasons,
    progress,
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
    backdrop: backdropUrl(detail.backdrop_path, "w780"),
    year: detail.release_date ? detail.release_date.slice(0, 4) : undefined,
    voteAverage: detail.vote_average,
    runtime: detail.runtime || undefined,
    genres: detail.genres,
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
