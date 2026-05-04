<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
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

  const hideAdded = $derived.by<boolean>(() => page.url.searchParams.get("hidden") === "1");

  // Person filter (cast + crew) — set when user navigates from a CastList entry
  // or "directed by"/"created by" link. Honors both `with_people` (preferred,
  // cast+crew) and the legacy `with_cast` form.
  const withPeople = $derived.by<number[]>(() => {
    const raw = page.url.searchParams.get("with_people") ?? page.url.searchParams.get("with_cast");
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
  });

  function clearPeople(): void {
    updateParams({ with_people: null, with_cast: null, page: null });
  }

  function toggleHideAdded(): void {
    const url = new URL(page.url);
    if (hideAdded) url.searchParams.delete("hidden");
    else url.searchParams.set("hidden", "1");
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

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
    // Force instant scroll-to-top so the user lands on a fresh top of grid;
    // smooth scroll competed with content swap and sometimes left mid-page.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
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
      withPeople,
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

  // TMDB has no API param to exclude items already in library, so we filter client-side.
  // The page count from TMDB is unaffected — this just hides items on the rendered page.
  const visibleResults = $derived(
    result
      ? hideAdded
        ? result.results.filter((r) => !store.has(r.media_type as "tv" | "movie", r.id))
        : result.results
      : []
  );
  const hiddenCount = $derived(result ? result.results.length - visibleResults.length : 0);
</script>

<svelte:head>
  <title>Browse · Series Tracker</title>
</svelte:head>

{#snippet headerActions()}
  <button
    type="button"
    use:tactile
    onclick={toggleHideAdded}
    aria-pressed={hideAdded}
    class="tap-target tap-target--btn rounded-md border px-3 py-1.5 text-xs transition-colors duration-150 {hideAdded
      ? 'border-primary bg-primary text-bg'
      : 'border-border text-muted hover-border-primary'}"
  >
    {hideAdded ? "✓ Hiding added" : "Hide added"}
  </button>
  <a
    href="{base}/discover/{hideAdded ? '?hidden=1' : ''}"
    use:tactile={{ haptic: false }}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover-border-primary"
  >
    <Icon name="arrow-left" size={12} />
    <span>Curated</span>
  </a>
{/snippet}

<PageHeader title="Browse" actions={headerActions} />

<section class="space-y-5">

  <div class="flex flex-wrap items-center gap-2">
    <div class="flex gap-1 text-xs" role="tablist" aria-label="Media kind">
      {#each VALID_KIND as k (k)}
        <button
          type="button"
          role="tab"
          aria-selected={kind === k}
          use:tactile
          onclick={() => setKind(k)}
          class="tap-target tap-target--chip rounded-full border px-3 py-1.5 transition-colors duration-150 {kind === k
            ? 'border-primary bg-primary text-bg'
            : 'border-border text-muted hover-text-text'}"
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

  {#if withPeople.length > 0}
    <div class="flex flex-wrap items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
      <span class="font-medium text-accent">Filtered by person</span>
      <span class="text-muted">·</span>
      <span class="font-mono text-text">#{withPeople.join(", #")}</span>
      {#if kind === "tv"}
        <span class="text-muted">·</span>
        <button
          type="button"
          use:tactile
          onclick={() => setKind("movie")}
          class="tap-target tap-target--chip rounded-full border border-accent px-2 py-1 text-[11px] font-medium text-accent transition-colors duration-150 active:bg-accent active:text-bg"
        >
          Switch to Movies
        </button>
        <span class="text-[11px] italic text-muted">(person filter only applies to movies)</span>
      {/if}
      <button
        type="button"
        use:tactile={{ haptic: "warn" }}
        onclick={clearPeople}
        class="tap-target tap-target--chip ml-auto rounded-full border border-border px-2 py-1 text-[11px] text-muted hover-border-error hover-text-error"
      >
        × Clear
      </button>
    </div>
  {/if}

  {#if availableGenres.length > 0}
    <div class="space-y-1.5">
      <div class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
        Genres
        {#if selectedGenres.size > 0}
          <button
            type="button"
            use:tactile={{ haptic: "warn" }}
            onclick={clearGenres}
            class="tap-target rounded px-1 text-muted hover-text-error"
          >
            Clear · {selectedGenres.size}
          </button>
        {/if}
      </div>
      <div class="flex flex-wrap gap-1.5 text-xs">
        {#each availableGenres as g (g.id)}
          {@const on = selectedGenres.has(g.id)}
          <button
            type="button"
            use:tactile
            onclick={() => toggleGenre(g.id)}
            aria-pressed={on}
            class="tap-target tap-target--chip rounded-full border px-3 py-1.5 transition-colors duration-150 {on
              ? 'border-primary bg-primary text-bg'
              : 'border-border text-muted hover-text-text'}"
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
      {#if hideAdded && hiddenCount > 0}<span class="ml-2">· {hiddenCount} hidden on this page</span>{/if}
      {#if loading}<span class="ml-2">· Refreshing...</span>{/if}
    </p>
  {/if}

  {#if error}
    <p class="rounded-md border border-error bg-error/15 p-3 text-sm text-error">{error}</p>
  {/if}

  {#if !result && loading}
    <Skeleton variant="results" count={8} />
  {:else if result && result.results.length === 0}
    <p class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
      No results match these filters.
    </p>
  {:else if result && visibleResults.length === 0}
    <p class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
      Every result on this page is already in your library. Try the next page.
    </p>
  {:else if result}
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      {#each visibleResults as r (r.media_type + ":" + r.id)}
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
      <div class="space-y-2">
        <Pagination current={pageNum} total={totalPages} onGoTo={goToPage} />
        <p class="text-center text-xs tabular-nums text-muted">
          Page {pageNum} of {totalPages.toLocaleString()}
        </p>
      </div>
    {/if}
  {/if}
</section>
