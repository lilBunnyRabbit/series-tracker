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
  let activeController: AbortController | null = null;

  $effect(() => {
    const q = query.trim();
    if (timer) clearTimeout(timer);
    if (activeController) activeController.abort();

    if (!q) {
      results = null;
      error = null;
      loading = false;
      return;
    }
    if (!store.apiKey) return;

    loading = true;
    error = null;
    timer = setTimeout(() => {
      const ctrl = new AbortController();
      activeController = ctrl;
      searchMulti(q, store.apiKey!, ctrl.signal)
        .then((r) => {
          if (ctrl.signal.aborted) return;
          results = r;
          store.pushSearchHistory(q);
        })
        .catch((e) => {
          if (e instanceof Error && e.name === "AbortError") return;
          error = e instanceof Error ? e.message : String(e);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) loading = false;
        });
    }, 250);

    return () => {
      if (timer) clearTimeout(timer);
      if (activeController) activeController.abort();
    };
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

  const filtered = $derived(results?.results.filter((r) => r.media_type !== "person") ?? []);
  const showHistory = $derived(!query.trim() && store.searchHistory.length > 0);
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
  {:else if showHistory}
    <div class="flex flex-wrap items-center gap-1.5 text-xs">
      <span class="mr-1 text-[var(--color-muted)]">Recent:</span>
      {#each store.searchHistory as q (q)}
        <button
          type="button"
          onclick={() => (query = q)}
          class="rounded-full border border-[var(--color-border)] px-3 py-1 hover:border-[var(--color-accent)]"
        >
          {q}
        </button>
      {/each}
      <button
        type="button"
        onclick={() => store.clearSearchHistory()}
        class="ml-auto rounded-full border border-[var(--color-border)] px-3 py-1 text-[var(--color-muted)]"
      >
        Clear
      </button>
    </div>
  {/if}

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Searching...</p>
  {:else if error}
    <p class="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger)]/15 p-3 text-sm text-[var(--color-danger)]">
      {error}
    </p>
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
