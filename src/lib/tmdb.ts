import type { MovieDetail, SearchMultiPage, TvDetail } from "./types";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

export type ImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";

export const posterUrl = (path: string | null, size: ImageSize = "w185"): string | null =>
  path ? `${IMG}/${size}${path}` : null;

async function get<T>(path: string, key: string, params: Record<string, string> = {}): Promise<T> {
  const u = new URL(BASE + path);
  u.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TMDB ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as T;
}

export const searchMulti = (q: string, key: string) =>
  get<SearchMultiPage>("/search/multi", key, { query: q, include_adult: "false" });

export const tvDetail = (id: number, key: string) => get<TvDetail>(`/tv/${id}`, key);

export const movieDetail = (id: number, key: string) => get<MovieDetail>(`/movie/${id}`, key);

export const ping = (key: string) => get<{ images: unknown }>("/configuration", key);
