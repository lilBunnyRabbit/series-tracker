<script lang="ts">
  import { base } from "$app/paths";
  import LibraryCard from "$lib/components/LibraryCard.svelte";
  import { store } from "$lib/store.svelte";
  import { STATUSES, STATUS_LABEL } from "$lib/types";
  import type { Status } from "$lib/types";

  type Filter = "all" | Status;
  let filter = $state<Filter>("all");
  let kindFilter = $state<"all" | "tv" | "movie">("all");

  const filtered = $derived.by(() => {
    return store.entries
      .filter((e) => (filter === "all" ? true : e.status === filter))
      .filter((e) => (kindFilter === "all" ? true : e.kind === kindFilter))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
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
      href="{base}/search/"
      class="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-fg)]"
    >
      + Find something
    </a>
  </div>

  {#if store.entries.length === 0}
    <div class="rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center text-[var(--color-muted)]">
      <p class="mb-4">Your library is empty.</p>
      <a
        href="{base}/search/"
        class="inline-block rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)]"
      >
        Search TMDB
      </a>
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-1.5 text-xs">
      {#each ["all", ...STATUSES] as f (f)}
        <button
          type="button"
          onclick={() => (filter = f as Filter)}
          class="rounded-full border px-3 py-1 transition {filter === f
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
            : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}"
        >
          {f === "all" ? "All" : STATUS_LABEL[f as Status]} · {counts[f as Filter]}
        </button>
      {/each}
      <span class="mx-2 h-4 w-px bg-[var(--color-border)]"></span>
      {#each [["all", "All"], ["tv", "TV"], ["movie", "Movies"]] as [k, label] (k)}
        <button
          type="button"
          onclick={() => (kindFilter = k as "all" | "tv" | "movie")}
          class="rounded-full border px-3 py-1 transition {kindFilter === k
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
            : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}"
        >
          {label}
        </button>
      {/each}
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
