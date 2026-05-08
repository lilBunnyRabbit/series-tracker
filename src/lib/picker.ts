// Shared helpers used across picker modes (bracket, coin flip, mini bracket,
// roulette, stalled pickup, mood, ranking). Modes own their own flow state but
// pull pool sampling, candidate filtering, and entry-card metadata from here so
// every surface stays consistent.

import { base } from "$app/paths";
import { effectiveSeasons, hasProgress } from "./types";
import type { Entry, Status } from "./types";
import { currentTemptation } from "./temptation";
import type { TemptationPacing } from "./types";

/** Standard cap on the bracket pool. Kept here so coin-flip / mini variants
 *  can override locally without each mode re-deciding what "full" means. */
export const POOL_CAP = 32;

/** Minimum positive weight applied to entries that would otherwise have a
 *  zero sampling weight — keeps cold candidates eligible for selection while
 *  still letting hotter / rewatchable entries dominate the lottery. */
const MIN_WEIGHT = 0.5;

export type KindFilter = "all" | "tv" | "movie";
export type ProgressFilter = "any" | "started" | "untouched";

/** Don't surface titles that haven't aired yet. `year` is the only date field
 *  we capture, so this is year-precision (a release later this year still
 *  passes). Entries without a year fall through (we don't know). */
export function hasAired(e: Entry): boolean {
  if (!e.year) return true;
  const y = Number(e.year);
  if (!Number.isFinite(y)) return true;
  return y <= new Date().getFullYear();
}

export function passesProgress(e: Entry, progress: ProgressFilter): boolean {
  if (progress === "any") return true;
  const started = hasProgress(e);
  return progress === "started" ? started : !started;
}

export function passesKind(e: Entry, kind: KindFilter): boolean {
  return kind === "all" || e.kind === kind;
}

/** All entries that satisfy the standard picker filter set. Modes that take
 *  user-controlled filters use this; modes with their own scoring (stalled
 *  pickup, ranking) layer on top. */
export function filterEntries(
  entries: Entry[],
  selectedStatuses: Status[],
  kind: KindFilter,
  progress: ProgressFilter
): Entry[] {
  return entries.filter((e) => {
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(e.status)) return false;
    if (!passesKind(e, kind)) return false;
    if (!passesProgress(e, progress)) return false;
    if (!hasAired(e)) return false;
    return true;
  });
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Weighted random sample without replacement. Picks `count` distinct entries
 *  from `pool`, each entry's chance of being drawn proportional to its weight.
 *  Implements Efraimidis–Spirakis (top-k by `r^(1/w)`), which is fast, stable,
 *  and matches the math users intuitively expect from "this should be more
 *  likely to come up". */
export function weightedSample<T>(pool: T[], weights: number[], count: number): T[] {
  if (pool.length === 0 || count <= 0) return [];
  if (count >= pool.length) return shuffle(pool);
  const keyed = pool.map((item, i) => {
    const w = Math.max(MIN_WEIGHT, weights[i] ?? MIN_WEIGHT);
    const r = Math.random();
    // r is (0, 1); take a tiny epsilon to avoid log(0). Higher weight → key
    // closer to 0, so we sort ascending and pick the first `count`.
    const key = Math.log(Math.max(r, 1e-9)) / w;
    return { item, key };
  });
  keyed.sort((a, b) => a.key - b.key);
  return keyed.slice(0, count).map((k) => k.item);
}

/** Default per-entry weight used by the bracket and most random modes:
 *  rewatchable doubles the entry's chance of landing in the pool, current
 *  temptation adds a soft warm-bias on top so freshly-engaged titles surface
 *  more often. The ceiling of 2.5 keeps a single Burning rewatchable entry
 *  from dominating a 32-slot pool. */
export function defaultWeight(e: Entry, pacing?: TemptationPacing): number {
  let w = e.rewatchable ? 2 : 1;
  const t = currentTemptation(e, pacing);
  w += t * 0.5;
  return w;
}

/** Inverse-temptation weight used by stalled-pickup mode: higher score for
 *  active "watching" entries that haven't been touched recently. Weights
 *  collapse to near-zero outside that intent so the surface stays focused. */
export function stalledWeight(e: Entry, pacing?: TemptationPacing): number {
  if (e.status !== "watching") return 0;
  if (!hasProgress(e)) return 0;
  const t = currentTemptation(e, pacing);
  // Inverted: cold things get the highest weight. Floor at 0.1 so even a Hot
  // recently-touched entry can still appear, just rarely.
  return Math.max(0.1, 1 - t);
}

/** Sample a deduplicated pool of up to `cap` entries using the given weighter.
 *  Used by every mode that draws candidates from the library. */
export function samplePool(
  entries: Entry[],
  cap: number,
  weighter: (e: Entry) => number
): Entry[] {
  if (entries.length === 0) return [];
  const weights = entries.map(weighter);
  return weightedSample(entries, weights, Math.min(cap, entries.length));
}

/** Two-card sample for coin-flip and ranking-stream modes. Always returns a
 *  pair from distinct entries (or null if fewer than two candidates). */
export function samplePair(
  entries: Entry[],
  weighter: (e: Entry) => number,
  exclude?: Set<string>
): [Entry, Entry] | null {
  const eligible = exclude && exclude.size > 0
    ? entries.filter((e) => !exclude.has(entryKey(e)))
    : entries;
  if (eligible.length < 2) return null;
  const weights = eligible.map(weighter);
  const picked = weightedSample(eligible, weights, 2);
  return [picked[0], picked[1]];
}

export function entryKey(e: Entry): string {
  return `${e.kind}:${e.id}`;
}

export function entryYear(e: Entry): string | undefined {
  return e.year;
}

export function entryHref(e: Entry): string {
  return e.kind === "tv" ? `${base}/show/${e.id}/` : `${base}/movie/${e.id}/`;
}

export function entryMeta(e: Entry): string {
  if (e.kind === "tv") {
    const total = effectiveSeasons(e).reduce((a, s) => a + s.episodeCount, 0);
    return total ? `${total} ep` : "TV";
  }
  if (e.runtime) {
    const h = Math.floor(e.runtime / 60);
    const m = e.runtime % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }
  return "Movie";
}

/** Per-entry progress + rating + rewatchable hint for the match card.
 *  Returns null when the entry has nothing notable to surface. */
export function entryHint(e: Entry): string | null {
  const parts: string[] = [];
  if (e.kind === "tv") {
    const seasons = effectiveSeasons(e);
    const total = seasons.reduce((a, s) => a + s.episodeCount, 0);
    const watched = seasons.reduce((a, s) => a + (e.progress[s.number] ?? 0), 0);
    if (total > 0 && watched >= total && e.status === "completed") {
      parts.push("Completed");
    } else if (watched > 0) {
      parts.push(`${watched}/${total} watched`);
    }
  } else if (e.kind === "movie") {
    if (e.watched) parts.push("Watched");
    else if (typeof e.progress === "number" && e.progress > 0) parts.push("Started");
  }
  if (typeof e.rating === "number" && e.rating > 0) {
    parts.push(`★ ${e.rating}`);
  }
  if (e.rewatchable) parts.push("↻");
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Total runtime in minutes for short/long mood filters. Falls back on
 *  effectiveSeasons × ~45min for TV when an explicit runtime isn't stored. */
export function entryRuntimeMinutes(e: Entry): number {
  if (e.kind === "movie") return e.runtime ?? 0;
  const total = effectiveSeasons(e).reduce((a, s) => a + s.episodeCount, 0);
  return total * 45;
}
