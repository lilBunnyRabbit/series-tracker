<script lang="ts">
  import { base } from "$app/paths";
  import LibraryCard from "$lib/components/LibraryCard.svelte";
  import { store } from "$lib/store.svelte";
  import { STATUSES, STATUS_LABEL } from "$lib/types";
  import type { Entry, Status } from "$lib/types";

  type Filter = "all" | Status;
  type Sort = "updated" | "added" | "title" | "progress";

  let filter = $state<Filter>("all");
  let kindFilter = $state<"all" | "tv" | "movie">("all");
  let sort = $state<Sort>("updated");

  function progressPct(e: Entry): number {
    if (e.kind !== "tv") return e.watched ? 1 : 0;
    const total = e.seasons.reduce((a, s) => a + s.episodeCount, 0);
    if (total === 0) return 0;
    const watched = e.seasons.reduce((a, s) => a + Math.min(e.progress[s.number] ?? 0, s.episodeCount), 0);
    return watched / total;
  }

  const filtered = $derived.by(() => {
    const base = store.entries
      .filter((e) => (filter === "all" ? true : e.status === filter))
      .filter((e) => (kindFilter === "all" ? true : e.kind === kindFilter));
    return [...base].sort((a, b) => {
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
      class="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:border-[var(--color-accent)]"
    >
      Discover
    </a>
    <a
      href="{base}/search/"
      class="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-bg)]"
    >
      + Add
    </a>
  </div>

  {#if store.entries.length === 0}
    <div class="rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center text-[var(--color-muted)]">
      <p class="mb-4">Your library is empty.</p>
      <div class="flex justify-center gap-2">
        <a
          href="{base}/discover/"
          class="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:border-[var(--color-accent)]"
        >
          Browse discover
        </a>
        <a
          href="{base}/search/"
          class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-bg)]"
        >
          Search TMDB
        </a>
      </div>
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-1.5 text-xs">
      {#each ["all", ...STATUSES] as f (f)}
        <button
          type="button"
          onclick={() => (filter = f as Filter)}
          class="rounded-full border px-3 py-1 transition {filter === f
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-bg)]'
            : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}"
        >
          {f === "all" ? "All" : STATUS_LABEL[f as Status]} · {counts[f as Filter]}
        </button>
      {/each}
      <span class="mx-2 hidden h-4 w-px bg-[var(--color-border)] sm:inline"></span>
      {#each [["all", "All"], ["tv", "TV"], ["movie", "Movies"]] as [k, label] (k)}
        <button
          type="button"
          onclick={() => (kindFilter = k as "all" | "tv" | "movie")}
          class="rounded-full border px-3 py-1 transition {kindFilter === k
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-bg)]'
            : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}"
        >
          {label}
        </button>
      {/each}
      <label class="ml-auto flex items-center gap-1.5 text-[var(--color-muted)]">
        Sort
        <select
          bind:value={sort}
          class="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
        >
          <option value="updated">Recently updated</option>
          <option value="added">Recently added</option>
          <option value="title">Title A–Z</option>
          <option value="progress">Progress</option>
        </select>
      </label>
    </div>

    {#if filtered.length === 0}
      <p class="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">
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
