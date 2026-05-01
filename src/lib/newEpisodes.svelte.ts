import { browser } from "$app/environment";
import { seasonDetail } from "./tmdb";
import type { EpisodeBrief, TvEntry } from "./types";

// Used by the Upcoming page to render unaired episodes for shows the user
// is watching. Cached in module state so a single fetch per show, per
// session, is enough — and only triggered when the user explicitly visits
// /upcoming/, not on every home/watchlist render.
type Snapshot = {
  latestSeason: number;
  upcomingEpisodes: EpisodeBrief[];
};

const cache = $state<Record<number, Snapshot>>({});
const inFlight = new Set<number>();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function latestSeasonNumber(entry: TvEntry): number | null {
  if (entry.seasons.length === 0) return null;
  return entry.seasons.reduce((max, s) => Math.max(max, s.number), 0);
}

async function loadOne(entry: TvEntry, apiKey: string): Promise<void> {
  if (!browser) return;
  if (cache[entry.id]) return;
  if (inFlight.has(entry.id)) return;
  const latest = latestSeasonNumber(entry);
  if (latest === null) return;

  inFlight.add(entry.id);
  try {
    const detail = await seasonDetail(entry.id, latest, apiKey);
    const today = todayIso();
    const upcoming: EpisodeBrief[] = [];
    for (const ep of detail.episodes) {
      if (ep.air_date && ep.air_date > today) upcoming.push(ep);
    }
    cache[entry.id] = { latestSeason: latest, upcomingEpisodes: upcoming };
  } catch {
    // ignore — a missing snapshot just means we skip this show in the UI.
  } finally {
    inFlight.delete(entry.id);
  }
}

/** Unaired episodes from the show's latest season, or undefined while loading. */
export function getUpcomingEpisodes(showId: number): EpisodeBrief[] | undefined {
  return cache[showId]?.upcomingEpisodes;
}

/** Latest season number with cached data — used for S/E labels in Upcoming rows. */
export function getLatestSeasonNumber(showId: number): number | undefined {
  return cache[showId]?.latestSeason;
}

/** Warm the cache for every watching TV entry. Idempotent. */
export async function warmUpForWatching(entries: TvEntry[], apiKey: string): Promise<void> {
  await Promise.all(entries.map((e) => loadOne(e, apiKey)));
}
