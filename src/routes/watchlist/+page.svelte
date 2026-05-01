<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import LibraryCard from "$lib/components/LibraryCard.svelte";
  import ListCard from "$lib/components/ListCard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { STATUS_COLOR, STATUS_LABEL, STATUSES } from "$lib/types";
  import type { Entry, Status } from "$lib/types";

  type Filter = "all" | Status;
  type KindFilter = "all" | "tv" | "movie";
  type Sort = "updated" | "added" | "title" | "progress" | "rating";
  type View = "list" | "grid";

  const VALID_FILTER: Filter[] = ["all", ...STATUSES];
  const VALID_KIND: KindFilter[] = ["all", "tv", "movie"];
  const VALID_SORT: Sort[] = ["updated", "added", "title", "progress", "rating"];
  const VALID_VIEW: View[] = ["list", "grid"];

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
  const view = $derived.by<View>(() => {
    const v = page.url.searchParams.get("view");
    return VALID_VIEW.includes(v as View) ? (v as View) : "list";
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
  function setView(v: View): void {
    updateParams({ view: v === "list" ? null : v });
  }

  function progressPct(e: Entry): number {
    if (e.kind !== "tv") return e.status === "completed" ? 1 : 0;
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
        case "rating":
          return (b.rating ?? -1) - (a.rating ?? -1);
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

{#snippet headerActions()}
  <a
    href="{base}/upcoming/"
    use:tactile={{ haptic: false }}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted hover-border-accent hover-text-text"
  >
    <Icon name="calendar" size={14} />
    <span>Upcoming</span>
  </a>
  <a
    href="{base}/picker/"
    use:tactile={{ haptic: false }}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-bg"
  >
    <Icon name="trophy" size={14} />
    <span>Pick</span>
  </a>
{/snippet}

<PageHeader title="Watchlist" actions={headerActions} />

<section class="space-y-4">
  {#if store.entries.length === 0}
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-muted">
      <p class="mb-4">Your library is empty.</p>
      <div class="flex justify-center gap-2">
        <a
          href="{base}/discover/"
          class="rounded-md border border-border px-4 py-2 text-sm hover:border-primary"
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
    <div class="space-y-2.5">
      <div class="-mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:overflow-visible sm:pb-0">
        <div class="flex w-max items-center gap-1.5 text-xs sm:w-auto sm:flex-wrap">
          {#each VALID_FILTER as f (f)}
            {@const active = filter === f}
            {@const c = f === "all" ? null : STATUS_COLOR[f as Status]}
            <button
              type="button"
              use:tactile
              onclick={() => setFilter(f)}
              class="tap-target tap-target--chip flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors duration-150 {active
                ? c
                  ? `${c.border} ${c.bg} text-bg`
                  : 'border-primary bg-primary text-bg'
                : 'border-border text-muted hover-text-text'}"
            >
              {#if c}
                <span class="h-1.5 w-1.5 rounded-full {active ? 'bg-bg' : c.dot}"></span>
              {/if}
              <span>{f === "all" ? "All" : STATUS_LABEL[f as Status]}</span>
              <span class="tabular-nums {active ? 'opacity-80' : 'opacity-60'}">{counts[f]}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex gap-1.5 text-xs">
          {#each [["all", "All"], ["tv", "TV"], ["movie", "Movies"]] as const as [k, label] (k)}
            <button
              type="button"
              use:tactile
              onclick={() => setKind(k)}
              class="tap-target tap-target--chip rounded-full border px-3 py-1.5 transition-colors duration-150 {kindFilter === k
                ? 'border-secondary bg-secondary text-bg'
                : 'border-border text-muted hover-text-text'}"
            >
              {label}
            </button>
          {/each}
        </div>

        <label class="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <span class="hidden sm:inline">Sort</span>
          <select
            value={sort}
            onchange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as Sort)}
            class="rounded-md border border-border bg-surface px-2 py-1.5 text-text"
            aria-label="Sort"
          >
            <option value="updated">Recently updated</option>
            <option value="added">Recently added</option>
            <option value="title">Title A–Z</option>
            <option value="progress">Progress</option>
            <option value="rating">Your rating</option>
          </select>
        </label>

        <div class="flex gap-1 text-xs" role="group" aria-label="View density">
          <button
            type="button"
            use:tactile
            onclick={() => setView("list")}
            aria-pressed={view === "list"}
            aria-label="List view"
            class="tap-target tap-target--icon flex h-9 w-9 items-center justify-center rounded-md border transition-colors duration-150 {view === 'list'
              ? 'border-primary bg-primary text-bg'
              : 'border-border text-muted hover-border-primary'}"
          >
            <Icon name="list" size={16} />
          </button>
          <button
            type="button"
            use:tactile
            onclick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label="Grid view"
            class="tap-target tap-target--icon flex h-9 w-9 items-center justify-center rounded-md border transition-colors duration-150 {view === 'grid'
              ? 'border-primary bg-primary text-bg'
              : 'border-border text-muted hover-border-primary'}"
          >
            <Icon name="grid" size={16} />
          </button>
        </div>
      </div>
    </div>

    {#if filtered.length === 0}
      <p class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        No items match this filter.
      </p>
    {:else if view === "list"}
      <div class="space-y-1.5">
        {#each filtered as entry (entry.kind + ":" + entry.id)}
          <div class="cv-row">
            <ListCard {entry} backdrop={entry.backdrop ?? null} />
          </div>
        {/each}
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each filtered as entry (entry.kind + ":" + entry.id)}
          <div class="cv-card">
            <LibraryCard {entry} />
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  .cv-card {
    content-visibility: auto;
    contain-intrinsic-size: 320px 380px;
  }
  .cv-row {
    content-visibility: auto;
    contain-intrinsic-size: 100% 100px;
  }
</style>
