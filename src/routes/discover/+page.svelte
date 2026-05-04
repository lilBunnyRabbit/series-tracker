<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RandomPickerSheet from "$lib/components/RandomPickerSheet.svelte";
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import {
    entryFromSearchResult,
    popularMovies,
    popularTv,
    recommendations,
    topRatedMovies,
    topRatedTv,
    trending,
  } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import type { SearchMultiResult, Status } from "$lib/types";
  import { untrack } from "svelte";

  type Window = "day" | "week";
  const trendingWindow = $derived.by<Window>(() => (page.url.searchParams.get("w") === "week" ? "week" : "day"));
  const hideAdded = $derived.by<boolean>(() => page.url.searchParams.get("hidden") === "1");

  function setTrendingWindow(w: Window): void {
    const url = new URL(page.url);
    if (w === "day") url.searchParams.delete("w");
    else url.searchParams.set("w", w);
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function toggleHideAdded(): void {
    const url = new URL(page.url);
    if (hideAdded) url.searchParams.delete("hidden");
    else url.searchParams.set("hidden", "1");
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function filterAdded<T extends { media_type: string; id: number }>(items: T[]): T[] {
    if (!hideAdded) return items;
    return items.filter((r) => !store.has(r.media_type as "tv" | "movie", r.id));
  }

  let trendingItems = $state<SearchMultiResult[]>([]);
  let recItems = $state<RecommendationItem[]>([]);
  let popularMovieItems = $state<RecommendationItem[]>([]);
  let popularTvItems = $state<RecommendationItem[]>([]);
  let topRatedTvItems = $state<RecommendationItem[]>([]);
  let topRatedMovieItems = $state<RecommendationItem[]>([]);

  let loading = $state(false);
  let error = $state<string | null>(null);

  const visibleTrending = $derived(filterAdded(trendingItems).slice(0, 12));
  const visibleRecs = $derived(filterAdded(recItems));
  const visiblePopularTv = $derived(filterAdded(popularTvItems).slice(0, 8));
  const visiblePopularMovies = $derived(filterAdded(popularMovieItems).slice(0, 8));
  const visibleTopRatedTv = $derived(filterAdded(topRatedTvItems).slice(0, 8));
  const visibleTopRatedMovies = $derived(filterAdded(topRatedMovieItems).slice(0, 8));

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
      topRatedTv(apiKey, ctrl.signal).then((r) => (topRatedTvItems = r)),
      topRatedMovies(apiKey, ctrl.signal).then((r) => (topRatedMovieItems = r)),
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

  let surpriseOpen = $state(false);

  // Pool for the random picker — combine trending, recommendations, and
  // popular so the user gets variety regardless of which lists loaded.
  const surprisePool = $derived.by<RecommendationItem[]>(() => {
    const out: RecommendationItem[] = [];
    const seen = new Set<string>();
    const push = (items: RecommendationItem[] | SearchMultiResult[]): void => {
      for (const item of items) {
        if (item.media_type !== "tv" && item.media_type !== "movie") continue;
        const key = `${item.media_type}:${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item as RecommendationItem);
      }
    };
    push(trendingItems);
    push(recItems);
    push(popularTvItems);
    push(popularMovieItems);
    push(topRatedTvItems);
    push(topRatedMovieItems);
    return out;
  });
</script>

{#snippet headerActions()}
  <button
    type="button"
    use:tactile
    onclick={() => (surpriseOpen = true)}
    aria-label="Surprise me"
    title="Surprise me"
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-accent hover-border-accent"
  >
    <Icon name="sparkles" size={14} />
    <span>Surprise</span>
  </button>
  <button
    type="button"
    use:tactile
    onclick={toggleHideAdded}
    aria-pressed={hideAdded}
    class="tap-target tap-target--btn rounded-md border px-3 py-1.5 text-sm transition-colors duration-150 {hideAdded
      ? 'border-primary bg-primary text-bg'
      : 'border-border text-muted hover-border-primary'}"
  >
    {hideAdded ? "✓ Hiding added" : "Hide added"}
  </button>
  <a
    href="{base}/discover/browse/{hideAdded ? '?hidden=1' : ''}"
    use:tactile={{ haptic: false }}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover-border-primary"
  >
    <span>Browse all</span>
    <Icon name="arrow-right" size={14} />
  </a>
{/snippet}

<PageHeader title="Discover" actions={headerActions} />

<section class="space-y-7">
  {#if error}
    <p class="rounded-md border border-error bg-error/15 p-3 text-sm text-error">
      {error}
    </p>
  {/if}

  <!-- TRENDING -->
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted">
        <Icon name="flame" size={14} />
        Trending
      </h2>
      <div class="flex gap-1 text-xs">
        {#each ["day", "week"] as const as w (w)}
          <button
            type="button"
            use:tactile
            onclick={() => setTrendingWindow(w)}
            class="tap-target tap-target--chip rounded-full border px-3 py-1.5 transition-colors duration-150 {trendingWindow === w
              ? 'border-primary bg-primary text-bg'
              : 'border-border text-muted'}"
          >
            {w === "day" ? "Today" : "This week"}
          </button>
        {/each}
      </div>
    </div>
    {#if trendingItems.length === 0 && loading}
      <Skeleton variant="results" count={6} />
    {:else if visibleTrending.length > 0}
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {#each visibleTrending as r (r.media_type + ":" + r.id)}
          <SearchResultCard result={r} onAdd={handleAdd} />
        {/each}
      </div>
    {:else if hideAdded && trendingItems.length > 0}
      <p class="text-sm text-muted">Everything trending is already in your library.</p>
    {/if}
  </div>

  {#if visibleRecs.length > 0}
    <!-- RECOMMENDED -->
    <div class="space-y-3">
      <h2 class="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted">
        <Icon name="sparkles" size={14} />
        Recommended
        <span class="ml-1 text-[11px] font-normal normal-case text-muted/70">based on your library</span>
      </h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {#each visibleRecs as r (r.media_type + ":" + r.id)}
          <SearchResultCard result={r as SearchMultiResult} onAdd={handleAdd} />
        {/each}
      </div>
    </div>
  {:else if recItems.length === 0 && store.entries.length === 0 && !loading}
    <div class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
      Add a few things to your library and we'll generate recommendations here.
    </div>
  {/if}

  {#if visiblePopularTv.length > 0 || visiblePopularMovies.length > 0}
    <!-- POPULAR -->
    <div class="space-y-4">
      <h2 class="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted">
        <Icon name="trending-up" size={14} />
        Popular right now
      </h2>
      {#if visiblePopularTv.length > 0}
        <div class="space-y-2">
          <h3 class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted/80">
            <Icon name="tv" size={12} />
            TV
          </h3>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            {#each visiblePopularTv as r (r.media_type + ":" + r.id)}
              <SearchResultCard result={r as SearchMultiResult} onAdd={handleAdd} />
            {/each}
          </div>
        </div>
      {/if}
      {#if visiblePopularMovies.length > 0}
        <div class="space-y-2">
          <h3 class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted/80">
            <Icon name="film" size={12} />
            Movies
          </h3>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            {#each visiblePopularMovies as r (r.media_type + ":" + r.id)}
              <SearchResultCard result={r as SearchMultiResult} onAdd={handleAdd} />
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if visibleTopRatedTv.length > 0 || visibleTopRatedMovies.length > 0}
    <!-- TOP RATED -->
    <div class="space-y-4">
      <h2 class="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted">
        <Icon name="trophy" size={14} />
        Top rated
        <span class="ml-1 text-[11px] font-normal normal-case text-muted/70">all-time on TMDB</span>
      </h2>
      {#if visibleTopRatedTv.length > 0}
        <div class="space-y-2">
          <h3 class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted/80">
            <Icon name="tv" size={12} />
            TV
          </h3>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            {#each visibleTopRatedTv as r (r.media_type + ":" + r.id)}
              <SearchResultCard result={r as SearchMultiResult} onAdd={handleAdd} />
            {/each}
          </div>
        </div>
      {/if}
      {#if visibleTopRatedMovies.length > 0}
        <div class="space-y-2">
          <h3 class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted/80">
            <Icon name="film" size={12} />
            Movies
          </h3>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            {#each visibleTopRatedMovies as r (r.media_type + ":" + r.id)}
              <SearchResultCard result={r as SearchMultiResult} onAdd={handleAdd} />
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</section>

<RandomPickerSheet
  open={surpriseOpen}
  onClose={() => (surpriseOpen = false)}
  discoverPool={surprisePool}
/>
