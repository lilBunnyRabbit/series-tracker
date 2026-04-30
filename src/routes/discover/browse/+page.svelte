<script lang="ts">
  import { base } from "$app/paths";
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import { store } from "$lib/store.svelte";
  import { discover, entryFromSearchResult, genreList } from "$lib/tmdb";
  import type { DiscoverPage, DiscoverSort } from "$lib/tmdb";
  import type { Genre, SearchMultiResult, Status } from "$lib/types";

  type Kind = "tv" | "movie";

  let kind = $state<Kind>("tv");
  let selectedGenres = $state<Set<number>>(new Set());
  let sort = $state<DiscoverSort>("popularity.desc");
  let page = $state(1);

  let availableGenres = $state<Genre[]>([]);
  let result = $state<DiscoverPage | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Load genres when kind changes; clear selection (genre IDs differ between TV/movie).
  $effect(() => {
    void kind;
    if (!store.apiKey) return;
    const ctrl = new AbortController();
    genreList(kind, store.apiKey, ctrl.signal)
      .then((g) => {
        if (!ctrl.signal.aborted) availableGenres = g.sort((a, b) => a.name.localeCompare(b.name));
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        console.error("[browse] genres failed", e);
      });
    return () => ctrl.abort();
  });

  // Fetch discover results when any filter changes.
  $effect(() => {
    if (!store.apiKey) return;
    const apiKey = store.apiKey;
    const filters = {
      sort,
      genres: [...selectedGenres],
      page,
    };
    loading = true;
    error = null;
    const ctrl = new AbortController();
    discover(kind, apiKey, filters, ctrl.signal)
      .then((r) => {
        if (!ctrl.signal.aborted) result = r;
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        error = e instanceof Error ? e.message : String(e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) loading = false;
      });
    return () => ctrl.abort();
  });

  function setKind(k: Kind): void {
    if (k === kind) return;
    kind = k;
    selectedGenres = new Set();
    page = 1;
  }

  function toggleGenre(id: number): void {
    const next = new Set(selectedGenres);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedGenres = next;
    page = 1;
  }

  function clearGenres(): void {
    selectedGenres = new Set();
    page = 1;
  }

  function setSort(s: DiscoverSort): void {
    sort = s;
    page = 1;
  }

  function prevPage(): void {
    if (page > 1) {
      page--;
      window.scrollTo({ top: 0 });
    }
  }
  function nextPage(): void {
    if (canGoNext) {
      page++;
      window.scrollTo({ top: 0 });
    }
  }

  // TMDB caps discover pagination at 500.
  const totalPages = $derived(Math.min(result?.total_pages ?? 1, 500));
  const canGoNext = $derived(!!result && page < totalPages);
  const totalResults = $derived(result?.total_results ?? 0);
</script>

<svelte:head>
  <title>Browse · Series Tracker</title>
</svelte:head>

<section class="space-y-5">
  <div class="flex flex-wrap items-center gap-2">
    <h1 class="mr-auto text-xl font-semibold">Browse</h1>
    <a
      href="{base}/discover/"
      class="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent"
    >
      ← Curated
    </a>
  </div>

  <!-- KIND + SORT -->
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex gap-1 text-xs" role="tablist" aria-label="Media kind">
      {#each ["tv", "movie"] as const as k (k)}
        <button
          type="button"
          role="tab"
          aria-selected={kind === k}
          onclick={() => setKind(k)}
          class="rounded-full border px-3 py-1 transition {kind === k
            ? 'border-primary bg-primary text-bg'
            : 'border-border text-muted hover:text-text'}"
        >
          {k === "tv" ? "TV shows" : "Movies"}
        </button>
      {/each}
    </div>

    <label class="ml-auto flex items-center gap-1.5 text-xs text-muted">
      Sort
      <select
        value={sort}
        onchange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as DiscoverSort)}
        class="rounded-md border border-border bg-surface px-2 py-1 text-text"
      >
        <option value="popularity.desc">Popularity</option>
        <option value="vote_average.desc">Rating</option>
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="title.asc">Title A–Z</option>
        <option value="title.desc">Title Z–A</option>
      </select>
    </label>
  </div>

  <!-- GENRES -->
  {#if availableGenres.length > 0}
    <div class="space-y-1.5">
      <div class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
        Genres
        {#if selectedGenres.size > 0}
          <button type="button" onclick={clearGenres} class="rounded px-1 text-muted hover:text-danger">
            Clear · {selectedGenres.size}
          </button>
        {/if}
      </div>
      <div class="flex flex-wrap gap-1.5 text-xs">
        {#each availableGenres as g (g.id)}
          {@const on = selectedGenres.has(g.id)}
          <button
            type="button"
            onclick={() => toggleGenre(g.id)}
            aria-pressed={on}
            class="rounded-full border px-3 py-1 transition {on
              ? 'border-primary bg-primary text-bg'
              : 'border-border text-muted hover:text-text'}"
          >
            {g.name}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- RESULT META -->
  {#if result}
    <p class="text-xs text-muted">
      {totalResults.toLocaleString()} result{totalResults === 1 ? "" : "s"}
      {#if loading}<span class="ml-2">· Refreshing...</span>{/if}
    </p>
  {/if}

  {#if error}
    <p class="rounded-md border border-danger bg-danger/15 p-3 text-sm text-danger">{error}</p>
  {/if}

  <!-- RESULTS -->
  {#if !result && loading}
    <p class="text-sm text-muted">Loading...</p>
  {:else if result && result.results.length === 0}
    <p class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
      No results match these filters.
    </p>
  {:else if result}
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      {#each result.results as r (r.media_type + ":" + r.id)}
        <SearchResultCard
          result={r as SearchMultiResult}
          onAdd={async (item, status: Status) => {
            if (!store.apiKey) throw new Error("API key not set");
            const entry = await entryFromSearchResult(item, store.apiKey, status);
            if (entry) store.addToLibrary(entry);
          }}
        />
      {/each}
    </div>

    <!-- PAGINATION -->
    {#if totalPages > 1}
      <nav class="flex items-center justify-between gap-2 pt-2" aria-label="Pagination">
        <button
          type="button"
          onclick={prevPage}
          disabled={page <= 1}
          class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Prev
        </button>
        <span class="text-xs tabular-nums text-muted">Page {page} of {totalPages.toLocaleString()}</span>
        <button
          type="button"
          onclick={nextPage}
          disabled={!canGoNext}
          class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </nav>
    {/if}
  {/if}
</section>
