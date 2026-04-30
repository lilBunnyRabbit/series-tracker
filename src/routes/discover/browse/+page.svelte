<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import { store } from "$lib/store.svelte";
  import { discover, entryFromSearchResult, genreList } from "$lib/tmdb";
  import type { DiscoverPage, DiscoverSort } from "$lib/tmdb";
  import type { Genre, SearchMultiResult, Status } from "$lib/types";

  type Kind = "tv" | "movie";

  const VALID_KIND = ["tv", "movie"] as const;
  const VALID_SORT: DiscoverSort[] = [
    "popularity.desc",
    "popularity.asc",
    "vote_average.desc",
    "vote_average.asc",
    "newest",
    "oldest",
    "title.asc",
    "title.desc",
  ];

  // ---- URL-derived state (persists across navigation, browser back/forward, refresh, sharing) ----

  const kind = $derived.by<Kind>(() => {
    const v = page.url.searchParams.get("kind");
    return VALID_KIND.includes(v as Kind) ? (v as Kind) : "tv";
  });

  const sort = $derived.by<DiscoverSort>(() => {
    const v = page.url.searchParams.get("sort");
    return VALID_SORT.includes(v as DiscoverSort) ? (v as DiscoverSort) : "popularity.desc";
  });

  const selectedGenres = $derived.by<Set<number>>(() => {
    const raw = page.url.searchParams.get("g");
    if (!raw) return new Set();
    const ids = raw.split(",").map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0);
    return new Set(ids);
  });

  const pageNum = $derived.by(() => {
    const n = Number(page.url.searchParams.get("page"));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  });

  function updateParams(patch: Record<string, string | null>): void {
    const url = new URL(page.url);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function setKind(k: Kind): void {
    if (k === kind) return;
    // Genre IDs differ between TV and movie; clear them when switching.
    updateParams({ kind: k, g: null, page: null });
  }

  function setSort(s: DiscoverSort): void {
    updateParams({ sort: s, page: null });
  }

  function toggleGenre(id: number): void {
    const next = new Set(selectedGenres);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateParams({ g: next.size ? [...next].sort((a, b) => a - b).join(",") : null, page: null });
  }

  function clearGenres(): void {
    updateParams({ g: null, page: null });
  }

  function goToPage(n: number): void {
    updateParams({ page: n === 1 ? null : String(n) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Async data ----

  let availableGenres = $state<Genre[]>([]);
  let result = $state<DiscoverPage | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Genre list per kind. Cached 24h server-side via TMDB cache, so kind switches are instant after first fetch.
  $effect(() => {
    void kind;
    if (!store.apiKey) return;
    const ctrl = new AbortController();
    genreList(kind, store.apiKey, ctrl.signal)
      .then((g) => {
        if (!ctrl.signal.aborted) availableGenres = g.toSorted((a, b) => a.name.localeCompare(b.name));
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        console.error("[browse] genres failed", e);
      });
    return () => ctrl.abort();
  });

  $effect(() => {
    if (!store.apiKey) return;
    const apiKey = store.apiKey;
    const filters = {
      sort,
      genres: [...selectedGenres].sort((a, b) => a - b),
      page: pageNum,
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

  const totalPages = $derived(Math.min(result?.total_pages ?? 1, 500));
  const canGoNext = $derived(!!result && pageNum < totalPages);
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

  <div class="flex flex-wrap items-center gap-2">
    <div class="flex gap-1 text-xs" role="tablist" aria-label="Media kind">
      {#each VALID_KIND as k (k)}
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

  {#if result}
    <p class="text-xs text-muted">
      {totalResults.toLocaleString()} result{totalResults === 1 ? "" : "s"}
      {#if loading}<span class="ml-2">· Refreshing...</span>{/if}
    </p>
  {/if}

  {#if error}
    <p class="rounded-md border border-danger bg-danger/15 p-3 text-sm text-danger">{error}</p>
  {/if}

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

    {#if totalPages > 1}
      <nav class="flex items-center justify-between gap-2 pt-2" aria-label="Pagination">
        <button
          type="button"
          onclick={() => goToPage(pageNum - 1)}
          disabled={pageNum <= 1}
          class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Prev
        </button>
        <span class="text-xs tabular-nums text-muted">Page {pageNum} of {totalPages.toLocaleString()}</span>
        <button
          type="button"
          onclick={() => goToPage(pageNum + 1)}
          disabled={!canGoNext}
          class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </nav>
    {/if}
  {/if}
</section>
