<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import LibraryCard from "$lib/components/LibraryCard.svelte";
  import { store } from "$lib/store.svelte";
  import { STATUSES, STATUS_LABEL } from "$lib/types";
  import type { Entry, Status } from "$lib/types";

  type Filter = "all" | Status;
  type KindFilter = "all" | "tv" | "movie";
  type Sort = "updated" | "added" | "title" | "progress";

  const VALID_FILTER: Filter[] = ["all", ...STATUSES];
  const VALID_KIND: KindFilter[] = ["all", "tv", "movie"];
  const VALID_SORT: Sort[] = ["updated", "added", "title", "progress"];

  const filter = $derived.by<Filter>(() => {
    const v = page.url.searchParams.get("status");
    return VALID_FILTER.includes(v as Filter) ? (v as Filter) : "all";
  });
  const kindFilter = $derived.by<KindFilter>(() => {
    const v = page.url.searchParams.get("kind");
    return VALID_KIND.includes(v as KindFilter) ? (v as KindFilter) : "all";
  });
  const sort = $derived.by<Sort>(() => {
    const v = page.url.searchParams.get("sort");
    return VALID_SORT.includes(v as Sort) ? (v as Sort) : "updated";
  });

  function updateParams(patch: Record<string, string | null>): void {
    const url = new URL(page.url);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function setFilter(f: Filter): void {
    updateParams({ status: f === "all" ? null : f });
  }
  function setKind(k: KindFilter): void {
    updateParams({ kind: k === "all" ? null : k });
  }
  function setSort(s: Sort): void {
    updateParams({ sort: s === "updated" ? null : s });
  }

  function progressPct(e: Entry): number {
    if (e.kind !== "tv") return e.watched ? 1 : 0;
    const total = e.seasons.reduce((a, s) => a + s.episodeCount, 0);
    if (total === 0) return 0;
    const watched = e.seasons.reduce((a, s) => a + Math.min(e.progress[s.number] ?? 0, s.episodeCount), 0);
    return watched / total;
  }

  const filtered = $derived.by(() => {
    const list = store.entries
      .filter((e) => (filter === "all" ? true : e.status === filter))
      .filter((e) => (kindFilter === "all" ? true : e.kind === kindFilter));
    return [...list].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "added":
          return (b.addedAt ?? "").localeCompare(a.addedAt ?? "");
        case "progress":
          return progressPct(b) - progressPct(a);
        case "updated":
        default:
          return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
      }
    });
  });

  const counts = $derived.by(() => {
    const c: Record<Filter, number> = { all: store.entries.length, watching: 0, completed: 0, plan: 0, dropped: 0 };
    for (const e of store.entries) c[e.status]++;
    return c;
  });
</script>

<section class="space-y-4">
  <div class="flex flex-wrap items-center gap-2">
    <h1 class="mr-auto text-xl font-semibold">My library</h1>
    <a
      href="{base}/discover/"
      class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent"
    >
      Discover
    </a>
    <a
      href="{base}/search/"
      class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-bg"
    >
      + Add
    </a>
  </div>

  {#if store.entries.length === 0}
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-muted">
      <p class="mb-4">Your library is empty.</p>
      <div class="flex justify-center gap-2">
        <a
          href="{base}/discover/"
          class="rounded-md border border-border px-4 py-2 text-sm hover:border-accent"
        >
          Browse discover
        </a>
        <a
          href="{base}/search/"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
        >
          Search TMDB
        </a>
      </div>
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-1.5 text-xs">
      {#each VALID_FILTER as f (f)}
        <button
          type="button"
          onclick={() => setFilter(f)}
          class="rounded-full border px-3 py-1 transition {filter === f
            ? 'border-primary bg-primary text-bg'
            : 'border-border text-muted hover:text-text'}"
        >
          {f === "all" ? "All" : STATUS_LABEL[f as Status]} · {counts[f]}
        </button>
      {/each}
      <span class="mx-2 hidden h-4 w-px bg-border sm:inline"></span>
      {#each [["all", "All"], ["tv", "TV"], ["movie", "Movies"]] as const as [k, label] (k)}
        <button
          type="button"
          onclick={() => setKind(k)}
          class="rounded-full border px-3 py-1 transition {kindFilter === k
            ? 'border-primary bg-primary text-bg'
            : 'border-border text-muted hover:text-text'}"
        >
          {label}
        </button>
      {/each}
      <label class="ml-auto flex items-center gap-1.5 text-muted">
        Sort
        <select
          value={sort}
          onchange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as Sort)}
          class="rounded-md border border-border bg-surface px-2 py-1"
        >
          <option value="updated">Recently updated</option>
          <option value="added">Recently added</option>
          <option value="title">Title A–Z</option>
          <option value="progress">Progress</option>
        </select>
      </label>
    </div>

    {#if filtered.length === 0}
      <p class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        No items match this filter.
      </p>
    {:else}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each filtered as entry (entry.kind + ":" + entry.id)}
          <LibraryCard {entry} />
        {/each}
      </div>
    {/if}
  {/if}
</section>
