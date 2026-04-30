<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import { store } from "$lib/store.svelte";
  import { entryFromSearchResult, searchMulti } from "$lib/tmdb";
  import type { SearchMultiPage, SearchMultiResult, Status } from "$lib/types";

  // Local state for typing UX; URL syncs on debounce settle so back/forward + share work.
  let query = $state(page.url.searchParams.get("q") ?? "");
  let results = $state<SearchMultiPage | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeController: AbortController | null = null;

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
    }, 250);

    return () => {
      if (timer) clearTimeout(timer);
      if (activeController) activeController.abort();
    };
  });

  async function handleAdd(r: SearchMultiResult, status: Status): Promise<void> {
    if (!store.apiKey) throw new Error("API key not set");
    const entry = await entryFromSearchResult(r, store.apiKey, status);
    if (entry) store.addToLibrary(entry);
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
    autocomplete="off"
    spellcheck="false"
    class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 outline-none focus:border-accent"
  />

  {#if !store.apiKey}
    <p class="text-sm text-muted">Set your TMDB API key in settings first.</p>
  {:else if showHistory}
    <div class="flex flex-wrap items-center gap-1.5 text-xs">
      <span class="mr-1 text-muted">Recent:</span>
      {#each store.searchHistory as q (q)}
        <button
          type="button"
          onclick={() => (query = q)}
          class="rounded-full border border-border px-3 py-1 hover:border-accent"
        >
          {q}
        </button>
      {/each}
      <button
        type="button"
        onclick={() => store.clearSearchHistory()}
        class="ml-auto rounded-full border border-border px-3 py-1 text-muted"
      >
        Clear
      </button>
    </div>
  {/if}

  {#if loading}
    <p class="text-sm text-muted">Searching...</p>
  {:else if error}
    <p class="rounded-md border border-danger bg-danger/15 p-3 text-sm text-danger">
      {error}
    </p>
  {:else if results && filtered.length === 0 && query.trim()}
    <p class="text-sm text-muted">No results for "{query}".</p>
  {:else if filtered.length > 0}
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      {#each filtered as r (r.media_type + ":" + r.id)}
        <SearchResultCard result={r} onAdd={handleAdd} />
      {/each}
    </div>
  {/if}
</section>
