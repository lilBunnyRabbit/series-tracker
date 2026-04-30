<script lang="ts">
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import { store } from "$lib/store.svelte";
  import {
    movieDetail,
    popularMovies,
    popularTv,
    posterUrl,
    recommendations,
    trending,
    tvDetail,
  } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import type { MovieEntry, SearchMultiResult, TvEntry } from "$lib/types";

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
    loading = true;
    error = null;

    const ctrl = new AbortController();
    void Promise.all([
      trending(trendingWindow, store.apiKey, ctrl.signal)
        .then((r) => (trendingItems = r.results.filter((x) => x.media_type !== "person")))
        .catch((e) => {
          if (e instanceof Error && e.name === "AbortError") return;
          throw e;
        }),
      popularTv(store.apiKey, ctrl.signal).then((r) => (popularTvItems = r)),
      popularMovies(store.apiKey, ctrl.signal).then((r) => (popularMovieItems = r)),
      buildRecs(ctrl.signal).then((r) => (recItems = r)),
    ])
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        error = e instanceof Error ? e.message : String(e);
      })
      .finally(() => {
        loading = false;
      });

    return () => ctrl.abort();
  });

  async function buildRecs(signal: AbortSignal): Promise<RecommendationItem[]> {
    if (!store.apiKey) return [];
    const seeds = store.entries
      .filter((e) => e.status !== "dropped")
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, 5);
    if (seeds.length === 0) return [];

    const results = await Promise.all(
      seeds.map((s) => recommendations(s.kind, s.id, store.apiKey!, signal).catch(() => [] as RecommendationItem[]))
    );

    const seen = new Set<string>();
    const counts = new Map<string, { item: RecommendationItem; count: number }>();
    for (const list of results) {
      for (const r of list) {
        const k = `${r.media_type}:${r.id}`;
        if (store.has(r.media_type, r.id)) continue;
        if (seen.has(k)) {
          counts.get(k)!.count++;
        } else {
          seen.add(k);
          counts.set(k, { item: r, count: 1 });
        }
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || (b.item.vote_average ?? 0) - (a.item.vote_average ?? 0))
      .slice(0, 18)
      .map((c) => c.item);
  }

  async function handleAdd(r: SearchMultiResult) {
    if (!store.apiKey) throw new Error("API key not set");
    const now = new Date().toISOString();
    if (r.media_type === "tv") {
      const detail = await tvDetail(r.id, store.apiKey);
      const entry: TvEntry = {
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
        status: "plan",
        addedAt: now,
        updatedAt: now,
      };
      store.addToLibrary(entry);
    } else if (r.media_type === "movie") {
      const detail = await movieDetail(r.id, store.apiKey);
      const entry: MovieEntry = {
        kind: "movie",
        id: detail.id,
        title: detail.title,
        poster: posterUrl(detail.poster_path, "w342"),
        year: detail.release_date ? detail.release_date.slice(0, 4) : undefined,
        voteAverage: detail.vote_average,
        watched: false,
        status: "plan",
        addedAt: now,
        updatedAt: now,
      };
      store.addToLibrary(entry);
    }
  }

  const filteredTrending = $derived(trendingItems.filter((x) => x.media_type !== "person"));
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
        {#each ["day", "week"] as w (w)}
          <button
            type="button"
            onclick={() => (trendingWindow = w as "day" | "week")}
            class="rounded-full border px-3 py-1 transition {trendingWindow === w
              ? 'border-primary bg-primary text-bg'
              : 'border-border text-muted'}"
          >
            {w === "day" ? "Today" : "This week"}
          </button>
        {/each}
      </div>
    </div>
    {#if filteredTrending.length === 0 && loading}
      <p class="text-sm text-muted">Loading...</p>
    {:else}
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {#each filteredTrending.slice(0, 12) as r (r.media_type + ":" + r.id)}
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
  {:else if store.entries.length === 0}
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
