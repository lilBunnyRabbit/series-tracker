<script lang="ts">
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import { store } from "$lib/store.svelte";
  import {
    entryFromSearchResult,
    popularMovies,
    popularTv,
    recommendations,
    trending,
  } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import type { SearchMultiResult, Status } from "$lib/types";
  import { untrack } from "svelte";

  let trendingWindow = $state<"day" | "week">("day");

  let trendingItems = $state<SearchMultiResult[]>([]);
  let recItems = $state<RecommendationItem[]>([]);
  let popularMovieItems = $state<RecommendationItem[]>([]);
  let popularTvItems = $state<RecommendationItem[]>([]);

  let loading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    void trendingWindow;
    if (!store.apiKey) return;
    const apiKey = store.apiKey;
    // Avoid retriggering this effect when the user adds/removes library items.
    const seeds = untrack(() =>
      store.entries
        .filter((e) => e.status !== "dropped")
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
        .slice(0, 5)
    );

    loading = true;
    error = null;
    const ctrl = new AbortController();

    void Promise.allSettled([
      trending(trendingWindow, apiKey, ctrl.signal).then(
        (r) => (trendingItems = r.results.filter((x) => x.media_type !== "person"))
      ),
      popularTv(apiKey, ctrl.signal).then((r) => (popularTvItems = r)),
      popularMovies(apiKey, ctrl.signal).then((r) => (popularMovieItems = r)),
      buildRecs(seeds, apiKey, ctrl.signal).then((r) => (recItems = r)),
    ])
      .then((settled) => {
        const firstReason = settled
          .filter((s): s is PromiseRejectedResult => s.status === "rejected")
          .map((s) => s.reason)
          .find((r) => !(r instanceof Error && r.name === "AbortError"));
        if (firstReason) {
          error = firstReason instanceof Error ? firstReason.message : String(firstReason);
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) loading = false;
      });

    return () => ctrl.abort();
  });

  async function buildRecs(
    seeds: ReturnType<typeof store.entries.slice>,
    apiKey: string,
    signal: AbortSignal
  ): Promise<RecommendationItem[]> {
    if (seeds.length === 0) return [];
    const results = await Promise.all(
      seeds.map((s) => recommendations(s.kind, s.id, apiKey, signal).catch(() => [] as RecommendationItem[]))
    );
    const counts = new Map<string, { item: RecommendationItem; count: number }>();
    for (const list of results) {
      for (const r of list) {
        const k = `${r.media_type}:${r.id}`;
        if (store.has(r.media_type, r.id)) continue;
        const existing = counts.get(k);
        if (existing) existing.count++;
        else counts.set(k, { item: r, count: 1 });
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || (b.item.vote_average ?? 0) - (a.item.vote_average ?? 0))
      .slice(0, 18)
      .map((c) => c.item);
  }

  async function handleAdd(r: SearchMultiResult, status: Status): Promise<void> {
    if (!store.apiKey) throw new Error("API key not set");
    const entry = await entryFromSearchResult(r, store.apiKey, status);
    if (entry) store.addToLibrary(entry);
  }
</script>

<section class="space-y-8">
  <h1 class="text-xl font-semibold">Discover</h1>

  {#if error}
    <p class="rounded-md border border-danger bg-danger/15 p-3 text-sm text-danger">
      {error}
    </p>
  {/if}

  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Trending</h2>
      <div class="flex gap-1 text-xs">
        {#each ["day", "week"] as const as w (w)}
          <button
            type="button"
            onclick={() => (trendingWindow = w)}
            class="rounded-full border px-3 py-1 transition {trendingWindow === w
              ? 'border-primary bg-primary text-bg'
              : 'border-border text-muted'}"
          >
            {w === "day" ? "Today" : "This week"}
          </button>
        {/each}
      </div>
    </div>
    {#if trendingItems.length === 0 && loading}
      <p class="text-sm text-muted">Loading...</p>
    {:else if trendingItems.length > 0}
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {#each trendingItems.slice(0, 12) as r (r.media_type + ":" + r.id)}
          <SearchResultCard result={r} onAdd={handleAdd} />
        {/each}
      </div>
    {/if}
  </div>

  {#if recItems.length > 0}
    <div class="space-y-3">
      <h2 class="text-sm font-medium uppercase tracking-wider text-muted">
        Recommended for you
        <span class="ml-2 font-normal normal-case text-muted/70">based on your library</span>
      </h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {#each recItems as r (r.media_type + ":" + r.id)}
          <SearchResultCard result={r as SearchMultiResult} onAdd={handleAdd} />
        {/each}
      </div>
    </div>
  {:else if store.entries.length === 0 && !loading}
    <div class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
      Add a few things to your library and we'll generate recommendations here.
    </div>
  {/if}

  {#if popularTvItems.length > 0}
    <div class="space-y-3">
      <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Popular TV</h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {#each popularTvItems.slice(0, 8) as r (r.media_type + ":" + r.id)}
          <SearchResultCard result={r as SearchMultiResult} onAdd={handleAdd} />
        {/each}
      </div>
    </div>
  {/if}

  {#if popularMovieItems.length > 0}
    <div class="space-y-3">
      <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Popular movies</h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {#each popularMovieItems.slice(0, 8) as r (r.media_type + ":" + r.id)}
          <SearchResultCard result={r as SearchMultiResult} onAdd={handleAdd} />
        {/each}
      </div>
    </div>
  {/if}
</section>
