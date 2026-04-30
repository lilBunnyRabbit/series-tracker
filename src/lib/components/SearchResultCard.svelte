<script lang="ts">
  import { base } from "$app/paths";
  import { store } from "$lib/store.svelte";
  import { posterUrl } from "$lib/tmdb";
  import type { SearchMultiResult } from "$lib/types";

  type Props = { result: SearchMultiResult; onAdd: (r: SearchMultiResult) => Promise<void> | void };
  let { result, onAdd }: Props = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);

  const inLibrary = $derived(result.media_type !== "person" && store.has(result.media_type, result.id));
  const title = $derived(result.media_type === "movie" ? result.title : result.media_type === "tv" ? result.name : result.name);
  const date = $derived(
    result.media_type === "movie" ? result.release_date : result.media_type === "tv" ? result.first_air_date : ""
  );
  const poster = $derived(result.media_type === "person" ? null : posterUrl(result.poster_path, "w185"));
  const detailHref = $derived(
    result.media_type === "movie"
      ? `${base}/movie/${result.id}/`
      : result.media_type === "tv"
        ? `${base}/show/${result.id}/`
        : null
  );

  async function handleAdd() {
    if (result.media_type === "person" || inLibrary) return;
    busy = true;
    error = null;
    try {
      await onAdd(result);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
  <div class="h-32 w-[88px] flex-shrink-0 overflow-hidden rounded bg-[var(--color-surface-2)]">
    {#if poster}
      <img src={poster} alt="" class="h-full w-full object-cover" loading="lazy" />
    {/if}
  </div>
  <div class="flex min-w-0 flex-1 flex-col">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        {#if detailHref}
          <a href={detailHref} class="block truncate font-medium hover:underline">{title}</a>
        {:else}
          <span class="block truncate font-medium">{title}</span>
        {/if}
        <div class="mt-0.5 text-xs text-[var(--color-muted)]">
          <span class="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 uppercase tracking-wider">{result.media_type}</span>
          {#if date}<span class="ml-2">{date.slice(0, 4)}</span>{/if}
        </div>
      </div>
      {#if result.media_type !== "person"}
        <button
          type="button"
          onclick={handleAdd}
          disabled={busy || inLibrary}
          class="shrink-0 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {inLibrary ? "Added" : busy ? "Adding..." : "Add"}
        </button>
      {/if}
    </div>
    {#if result.media_type !== "person" && result.overview}
      <p class="mt-2 line-clamp-3 text-xs text-[var(--color-muted)]">{result.overview}</p>
    {/if}
    {#if error}
      <p class="mt-2 text-xs text-red-400">{error}</p>
    {/if}
  </div>
</div>
