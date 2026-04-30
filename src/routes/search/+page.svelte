<script lang="ts">
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import { store } from "$lib/store.svelte";
  import { movieDetail, posterUrl, searchMulti, tvDetail } from "$lib/tmdb";
  import type { MovieEntry, SearchMultiPage, SearchMultiResult, TvEntry } from "$lib/types";

  let query = $state("");
  let results = $state<SearchMultiPage | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const q = query.trim();
    if (timer) clearTimeout(timer);
    if (!q) {
      results = null;
      error = null;
      loading = false;
      return;
    }
    if (!store.apiKey) return;
    loading = true;
    error = null;
    timer = setTimeout(async () => {
      try {
        const r = await searchMulti(q, store.apiKey!);
        if (query.trim() === q) results = r;
      } catch (e) {
        if (query.trim() === q) error = e instanceof Error ? e.message : String(e);
      } finally {
        if (query.trim() === q) loading = false;
      }
    }, 250);
  });

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
        watched: false,
        status: "plan",
        addedAt: now,
        updatedAt: now,
      };
      store.addToLibrary(entry);
    }
  }

  const filtered = $derived(results?.results.filter((r) => r.media_type !== "person") ?? []);
</script>

<section class="space-y-4">
  <h1 class="text-xl font-semibold">Search</h1>
  <!-- svelte-ignore a11y_autofocus -->
  <input
    type="search"
    bind:value={query}
    placeholder="Search for movies and TV shows..."
    autofocus
    class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 outline-none focus:border-[var(--color-accent)]"
  />

  {#if !store.apiKey}
    <p class="text-sm text-[var(--color-muted)]">Set your TMDB API key in settings first.</p>
  {:else if loading}
    <p class="text-sm text-[var(--color-muted)]">Searching...</p>
  {:else if error}
    <p class="rounded-md border border-red-700 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>
  {:else if results && filtered.length === 0 && query.trim()}
    <p class="text-sm text-[var(--color-muted)]">No results for "{query}".</p>
  {:else if filtered.length > 0}
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      {#each filtered as r (r.media_type + ":" + r.id)}
        <SearchResultCard result={r} onAdd={handleAdd} />
      {/each}
    </div>
  {/if}
</section>
