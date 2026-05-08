<script lang="ts">
  import { base } from "$app/paths";
  import ContinueWatchingCard from "$lib/components/ContinueWatchingCard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import Rail from "$lib/components/Rail.svelte";
  import UpcomingCard from "$lib/components/UpcomingCard.svelte";
  import {
    getLatestSeasonNumber,
    getUpcomingEpisodes,
    warmUpForWatching,
  } from "$lib/newEpisodes.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { effectiveSeasons, movieProgress, movieRuntime } from "$lib/types";
  import type { EpisodeBrief, Entry, MovieEntry, TvEntry } from "$lib/types";
  import { untrack } from "svelte";

  // Continue Watching mixes TV (next-episode driven) and partial-progress
  // movies (minutes-watched driven). Optional props on each side keep the
  // ContinueWatchingCard a single shared component without a tagged union.
  type ContinueItem = {
    entry: TvEntry | MovieEntry;
    season?: number;
    episode?: number;
    remaining?: number;
    minutesWatched?: number;
    minutesTotal?: number;
  };

  type UpcomingItem = {
    entry: TvEntry;
    season: number;
    episode: EpisodeBrief;
    daysOut: number;
  };

  function nextEpisode(e: TvEntry): { season: number; episode: number } | null {
    // Skip past specials by default — Continue Watching shouldn't push the
    // user into bonus content unless they've opted in for this show.
    for (const s of effectiveSeasons(e)) {
      const cur = e.progress[s.number] ?? 0;
      if (cur < s.episodeCount) return { season: s.number, episode: cur + 1 };
    }
    return null;
  }

  function totalRemaining(e: TvEntry): number {
    return effectiveSeasons(e).reduce((a, s) => a + Math.max(0, s.episodeCount - (e.progress[s.number] ?? 0)), 0);
  }

  const continueWatching = $derived.by<ContinueItem[]>(() => {
    const items: ContinueItem[] = [];
    for (const e of store.entries) {
      if (e.status !== "watching") continue;
      if (e.kind === "tv") {
        const next = nextEpisode(e);
        if (!next) continue;
        items.push({
          entry: e,
          season: next.season,
          episode: next.episode,
          remaining: totalRemaining(e),
        });
      } else if ((e.progress ?? 0) > 0) {
        // Only surface movies with a real checkpoint — a "watching" movie at
        // 0m hasn't actually been started yet from the user's perspective.
        items.push({
          entry: e,
          minutesWatched: movieProgress(e),
          minutesTotal: movieRuntime(e),
        });
      }
    }
    return items
      .sort((a, b) => (b.entry.updatedAt ?? "").localeCompare(a.entry.updatedAt ?? ""))
      .slice(0, 12);
  });

  const watchingEntries = $derived.by<TvEntry[]>(() =>
    store.entries.filter((e): e is TvEntry => e.kind === "tv" && e.status === "watching")
  );

  // Track only the *set* of watching show IDs as a primitive so the warm
  // re-fires when shows enter or leave the bucket — but NOT on per-entry
  // mutations (progress, ratings, temptation kicks). The string is
  // Object.is-stable when contents match, so dependents only refire on real
  // membership changes.
  const watchingIds = $derived(
    watchingEntries.map((e) => e.id).sort((a, b) => a - b).join(",")
  );

  // Warm the upcoming-episodes cache for shows the user is watching so the
  // home rail (and the /upcoming page) can render synchronously. Same module
  // cache used by /upcoming, so a session only pays for one fetch per show.
  // The actual warm runs inside `untrack`: loadOne reads `cache[id]`
  // synchronously to dedupe, and without untracking, every successful fetch's
  // cache write would re-fire this effect (cheap on the happy path, but with
  // many watching shows it adds up to N² reactive reads per page load).
  $effect(() => {
    if (!store.apiKey) return;
    const apiKey = store.apiKey;
    void watchingIds;
    untrack(() => {
      const entries = watchingEntries;
      if (entries.length === 0) return;
      void warmUpForWatching(entries, apiKey);
    });
  });

  function startOfDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
  }

  function daysBetween(iso: string): number {
    const today = startOfDay(new Date());
    const air = startOfDay(new Date(iso));
    return Math.round((air.getTime() - today.getTime()) / 86_400_000);
  }

  const upcoming = $derived.by<UpcomingItem[]>(() => {
    const all: UpcomingItem[] = [];
    for (const e of watchingEntries) {
      const ups = getUpcomingEpisodes(e.id);
      const season = getLatestSeasonNumber(e.id);
      if (!ups || season === undefined) continue;
      for (const ep of ups) {
        if (!ep.air_date) continue;
        all.push({ entry: e, season, episode: ep, daysOut: daysBetween(ep.air_date) });
      }
    }
    return all.sort((a, b) => a.daysOut - b.daysOut).slice(0, 12);
  });

  const startWatching = $derived.by<Entry[]>(() => {
    return store.entries
      .filter((e) => e.status === "plan")
      .sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""))
      .slice(0, 12);
  });

  const history = $derived.by<Entry[]>(() => {
    return store.entries
      .filter((e) => e.status === "completed" || e.status === "dropped" || e.status === "tuned")
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, 12);
  });

  function tvMeta(e: TvEntry): string {
    const total = effectiveSeasons(e).reduce((a, s) => a + s.episodeCount, 0);
    return total > 0 ? `${total} ep` : "";
  }
</script>

<PageHeader title="Home" srOnly />

{#if store.entries.length === 0}
  <section class="space-y-4">
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-muted">
      <p class="mb-4">Your library is empty.</p>
      <div class="flex justify-center gap-2">
        <a
          href="{base}/discover/"
          use:tactile={{ haptic: false }}
          class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-primary"
        >
          Browse discover
        </a>
        <a
          href="{base}/search/"
          use:tactile={{ haptic: false }}
          class="tap-target tap-target--btn rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
        >
          Search TMDB
        </a>
      </div>
    </div>
  </section>
{:else}
  <div class="space-y-4">
    {#if continueWatching.length > 0}
      <Rail
        title="Continue Watching"
        seeAllHref="{base}/watchlist/?status=watching"
        index={0}
      >
        {#each continueWatching as item (item.entry.kind + ":" + item.entry.id)}
          <ContinueWatchingCard
            entry={item.entry}
            season={item.season}
            episode={item.episode}
            remaining={item.remaining}
          />
        {/each}
      </Rail>
    {/if}

    {#if upcoming.length > 0}
      <Rail title="Upcoming" subtitle="New episodes airing soon" seeAllHref="{base}/upcoming/" index={1}>
        {#each upcoming as item (item.entry.id + ":" + item.season + ":" + item.episode.id)}
          <UpcomingCard
            entry={item.entry}
            season={item.season}
            episode={item.episode}
            daysOut={item.daysOut}
          />
        {/each}
      </Rail>
    {/if}

    {#if startWatching.length > 0}
      <Rail
        title="Start Watching"
        subtitle="Plan to watch"
        seeAllHref="{base}/watchlist/?status=plan"
        index={2}
      >
        {#each startWatching as e (e.kind + ":" + e.id)}
          <PosterCard
            kind={e.kind}
            id={e.id}
            title={e.title}
            poster={e.poster}
            year={e.year}
            meta={e.kind === "tv" ? tvMeta(e) : ""}
            voteAverage={e.voteAverage}
            rating={e.rating}
            status={e.status}
          />
        {/each}
      </Rail>
    {/if}

    {#if history.length > 0}
      <Rail
        title="History"
        subtitle="Recently watched, dropped, or tuned in"
        seeAllHref="{base}/watchlist/?status=completed"
        index={3}
      >
        {#each history as e (e.kind + ":" + e.id)}
          <PosterCard
            kind={e.kind}
            id={e.id}
            title={e.title}
            poster={e.poster}
            year={e.year}
            meta={e.kind === "tv" ? tvMeta(e) : ""}
            rating={e.rating}
            status={e.status}
            watched={e.status === "completed"}
          />
        {/each}
      </Rail>
    {/if}
  </div>
{/if}
