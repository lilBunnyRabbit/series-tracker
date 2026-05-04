<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import StatusMenu from "$lib/components/StatusMenu.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { entryFromSearchResult, popularMovies, popularTv, posterUrl, searchMulti } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import { STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { SearchMultiPage, SearchMultiResult, Status } from "$lib/types";

  type KindFilter = "all" | "tv" | "movie";

  let query = $state(page.url.searchParams.get("q") ?? "");
  let kindFilter = $state<KindFilter>("all");
  let results = $state<SearchMultiPage | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  let popular = $state<RecommendationItem[]>([]);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeController: AbortController | null = null;

  // Typed-search suggestions: history filtered by what's in the input. Hidden
  // on blur so taps elsewhere don't suppress the click — the blur handler uses
  // a short timeout to let the chip's click event fire first.
  let inputFocused = $state(false);
  let blurTimer: ReturnType<typeof setTimeout> | null = null;

  function onInputFocus(): void {
    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = null;
    }
    inputFocused = true;
  }
  function onInputBlur(): void {
    blurTimer = setTimeout(() => {
      inputFocused = false;
      blurTimer = null;
    }, 150);
  }
  function pickSuggestion(q: string): void {
    query = q;
    inputFocused = false;
  }

  // Per-card add state — keyed by `${kind}:${id}` so multiple cards can run in parallel
  // without stomping each other's spinner.
  let busyKey = $state<string | null>(null);

  function syncUrl(q: string): void {
    const url = new URL(page.url);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    if (url.search !== page.url.search) {
      void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
    }
  }

  $effect(() => {
    const q = query.trim();
    if (timer) clearTimeout(timer);
    if (activeController) activeController.abort();

    if (!q) {
      results = null;
      error = null;
      loading = false;
      syncUrl("");
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
          syncUrl(q);
        })
        .catch((e) => {
          if (e instanceof Error && e.name === "AbortError") return;
          error = e instanceof Error ? e.message : String(e);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) loading = false;
        });
    }, 350);

    return () => {
      if (timer) clearTimeout(timer);
      if (activeController) activeController.abort();
    };
  });

  // Lazy-load popular for the empty state — only when the user lands on /search/ with no query.
  $effect(() => {
    if (query.trim() || !store.apiKey || popular.length > 0) return;
    const apiKey = store.apiKey;
    const ctrl = new AbortController();
    void Promise.all([
      popularTv(apiKey, ctrl.signal).catch(() => [] as RecommendationItem[]),
      popularMovies(apiKey, ctrl.signal).catch(() => [] as RecommendationItem[]),
    ]).then(([tv, mv]) => {
      if (ctrl.signal.aborted) return;
      // Interleave so the grid mixes TV and movies instead of TV-first.
      const merged: RecommendationItem[] = [];
      const max = Math.max(tv.length, mv.length);
      for (let i = 0; i < max; i++) {
        if (tv[i]) merged.push(tv[i]);
        if (mv[i]) merged.push(mv[i]);
      }
      popular = merged.slice(0, 18);
    });
    return () => ctrl.abort();
  });

  async function handleAdd(r: SearchMultiResult, status: Status): Promise<void> {
    if (r.media_type === "person" || !store.apiKey) return;
    const key = `${r.media_type}:${r.id}`;
    busyKey = key;
    try {
      const entry = await entryFromSearchResult(r, store.apiKey, status);
      if (entry) store.addToLibrary(entry);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busyKey = null;
    }
  }

  const filtered = $derived.by(() => {
    const all = results?.results.filter((r) => r.media_type !== "person") ?? [];
    if (kindFilter === "all") return all;
    return all.filter((r) => r.media_type === kindFilter);
  });

  const visiblePopular = $derived(
    kindFilter === "all" ? popular : popular.filter((r) => r.media_type === kindFilter)
  );

  const isQueryEmpty = $derived(!query.trim());

  const matchingHistory = $derived.by<string[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return store.searchHistory.filter((h) => {
      const lh = h.toLowerCase();
      return lh !== q && lh.includes(q);
    });
  });

  function titleOf(r: SearchMultiResult): string {
    if (r.media_type === "movie") return r.title;
    if (r.media_type === "tv") return r.name;
    return r.name;
  }
  function yearOf(r: SearchMultiResult): string | undefined {
    if (r.media_type === "movie") return r.release_date?.slice(0, 4);
    if (r.media_type === "tv") return r.first_air_date?.slice(0, 4);
    return undefined;
  }
</script>

<PageHeader title="Search" srOnly />

<section class="space-y-4 pb-28">
  {#if !store.apiKey}
    <p class="text-sm text-muted">Set your TMDB API key in settings first.</p>
  {/if}

  {#if isQueryEmpty}
    <!-- TOP SEARCHES (empty state) -->
    {#if store.searchHistory.length > 0}
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Recent searches</h2>
          <button
            type="button"
            use:tactile={{ haptic: "warn" }}
            onclick={() => store.clearSearchHistory()}
            class="tap-target rounded-md px-2 py-1 text-xs text-muted hover-text-text"
          >
            Clear
          </button>
        </div>
        <div class="flex flex-wrap gap-1.5 text-xs">
          {#each store.searchHistory as q (q)}
            <button
              type="button"
              use:tactile
              onclick={() => (query = q)}
              class="tap-target tap-target--chip rounded-full border border-border px-3 py-1.5 hover-border-accent"
            >
              {q}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if visiblePopular.length > 0}
      <div class="space-y-3">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Top picks</h2>
        <div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6">
          {#each visiblePopular as r (r.media_type + ":" + r.id)}
            {@const existing = store.get(r.media_type, r.id)}
            {@const k = `${r.media_type}:${r.id}`}
            {@const c = existing ? STATUS_COLOR[existing.status] : null}
            <div class="flex h-full flex-col gap-2">
              <PosterCard
                kind={r.media_type}
                id={r.id}
                title={r.media_type === "movie" ? r.title : r.name}
                poster={posterUrl(r.poster_path, "w342")}
                year={r.media_type === "movie" ? r.release_date?.slice(0, 4) : r.first_air_date?.slice(0, 4)}
                voteAverage={r.vote_average}
                status={existing?.status}
                width="auto"
              />
              <!-- mt-auto pins the footer to the bottom of the (stretched) grid cell so
                   the +Add buttons line up regardless of title-line count. -->
              <div class="mt-auto">
                {#if existing && c}
                  <span
                    class="flex items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium {c.chip}"
                  >
                    <span class="h-1.5 w-1.5 rounded-full {c.dot}" aria-hidden="true"></span>
                    <span class="truncate">{STATUS_LABEL[existing.status]}</span>
                  </span>
                {:else}
                  <StatusMenu
                    label="+ Add"
                    size="sm"
                    variant="primary"
                    class="w-full"
                    busy={busyKey === k}
                    onSelect={(s) => handleAdd(r as SearchMultiResult, s)}
                    title={`Add "${r.media_type === "movie" ? r.title : r.name}" as...`}
                  />
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {:else if loading}
    <p class="text-sm text-muted">Searching...</p>
  {:else if error}
    <p class="rounded-md border border-error bg-error/15 p-3 text-sm text-error">
      {error}
    </p>
  {:else if results && filtered.length === 0}
    <p class="text-sm text-muted">No results for "{query}".</p>
  {:else if filtered.length > 0}
    <div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6">
      {#each filtered as r (r.media_type + ":" + r.id)}
        {@const existing = store.get(r.media_type, r.id)}
        {@const k = `${r.media_type}:${r.id}`}
        {@const c = existing ? STATUS_COLOR[existing.status] : null}
        <div class="flex h-full flex-col gap-2">
          <PosterCard
            kind={r.media_type}
            id={r.id}
            title={titleOf(r)}
            poster={posterUrl(r.poster_path, "w342")}
            year={yearOf(r)}
            status={existing?.status}
            width="auto"
          />
          <div class="mt-auto">
            {#if existing && c}
              <span
                class="flex items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium {c.chip}"
              >
                <span class="h-1.5 w-1.5 rounded-full {c.dot}" aria-hidden="true"></span>
                <span class="truncate">{STATUS_LABEL[existing.status]}</span>
              </span>
            {:else}
              <StatusMenu
                label="+ Add"
                size="sm"
                variant="primary"
                class="w-full"
                busy={busyKey === k}
                onSelect={(s) => handleAdd(r, s)}
                title={`Add "${titleOf(r)}" as...`}
              />
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<!-- Bottom-sticky search bar: sits just above the floating nav on mobile,
     and as a regular block on desktop. -->
<div class="search-dock">
  <div class="search-dock-inner">
    <!-- Suggestion list — typed history matches that aren't exact. Hidden when
         input loses focus or no matches exist. -->
    {#if inputFocused && matchingHistory.length > 0}
      <div class="-mx-1 mb-2 flex flex-wrap gap-1.5 px-1 text-xs">
        {#each matchingHistory.slice(0, 5) as q (q)}
          <button
            type="button"
            use:tactile
            onmousedown={(e) => e.preventDefault()}
            onclick={() => pickSuggestion(q)}
            class="tap-target tap-target--chip flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-muted hover-border-accent hover-text-text"
          >
            <Icon name="search" size={11} class="text-muted/60" />
            <span class="truncate">{q}</span>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Filter chips above input -->
    <div class="-mx-1 mb-2 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 text-xs">
      {#each [["all", "Media"], ["tv", "TV"], ["movie", "Movies"]] as const as [k, label] (k)}
        <button
          type="button"
          use:tactile
          onclick={() => (kindFilter = k)}
          class="tap-target tap-target--chip shrink-0 rounded-full border px-3 py-1.5 transition-colors duration-150 {kindFilter === k
            ? 'border-primary bg-primary text-bg'
            : 'border-border text-muted hover-border-primary'}"
        >
          {label}
        </button>
      {/each}
      <a
        href="{base}/search/bulk/"
        use:tactile={{ haptic: false }}
        class="tap-target tap-target--chip ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted hover-border-primary hover-text-primary"
      >
        <span>Bulk</span>
        <Icon name="arrow-right" size={12} />
      </a>
    </div>

    <label class="relative block">
      <span class="sr-only">Search</span>
      <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        <Icon name="search" size={16} />
      </span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="search"
        bind:value={query}
        onfocus={onInputFocus}
        onblur={onInputBlur}
        placeholder="Search movies & TV..."
        autofocus
        autocomplete="off"
        spellcheck="false"
        class="w-full rounded-full border border-border bg-surface py-3 pl-10 pr-4 text-sm outline-none transition-colors duration-150 focus:border-primary"
      />
    </label>
  </div>
</div>

<style>
  /* Bottom-dock pattern: fixed on mobile, sitting near the bottom edge with
     just safe-area padding (the floating footer is hidden on /search, so we
     don't need to clear it). Above sm: switch to a sticky bar at top of page. */
  .search-dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom) + 0.5rem);
    z-index: 25;
    padding: 0 0.75rem;
    pointer-events: none;
  }
  .search-dock-inner {
    pointer-events: auto;
    margin: 0 auto;
    max-width: 32rem;
    border-radius: 1.25rem;
    /* Mirror the floating-nav fallback chain for Samsung Internet etc. */
    background: rgba(26, 31, 38, 0.85);
    background: color-mix(in oklab, var(--color-bg) 88%, transparent);
    border: 1px solid var(--color-border);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    padding: 0.625rem 0.75rem 0.625rem;
    box-shadow: 0 12px 32px -12px rgb(0 0 0 / 0.55);
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .search-dock-inner {
      background: rgba(26, 31, 38, 0.96);
    }
  }
  @media (min-width: 640px) {
    .search-dock {
      position: sticky;
      top: 4.25rem;
      bottom: auto;
      padding: 0;
    }
    .search-dock-inner {
      max-width: none;
      background: var(--color-bg);
    }
  }
</style>
