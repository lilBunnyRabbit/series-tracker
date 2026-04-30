<script lang="ts">
  import { base } from "$app/paths";
  import StatusMenu from "$lib/components/StatusMenu.svelte";
  import { store } from "$lib/store.svelte";
  import { posterUrl } from "$lib/tmdb";
  import type { SearchMultiResult, Status } from "$lib/types";

  type Props = { result: SearchMultiResult; onAdd: (r: SearchMultiResult, status: Status) => Promise<void> | void };
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

  async function handleStatusPick(status: Status): Promise<void> {
    if (result.media_type === "person" || inLibrary) return;
    busy = true;
    error = null;
    try {
      await onAdd(result, status);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex gap-3 rounded-lg border border-border bg-surface p-3">
  <div class="h-32 w-[88px] flex-shrink-0 overflow-hidden rounded bg-surface-2">
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
        <div class="mt-0.5 text-xs text-muted">
          <span class="rounded bg-surface-2 px-1.5 py-0.5 uppercase tracking-wider">{result.media_type}</span>
          {#if date}<span class="ml-2">{date.slice(0, 4)}</span>{/if}
        </div>
      </div>
      {#if result.media_type !== "person"}
        {#if inLibrary}
          <span
            class="shrink-0 rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary"
          >
            Added
          </span>
        {:else}
          <div class="shrink-0">
            <StatusMenu label="Add" {busy} size="sm" onSelect={handleStatusPick} title={`Add "${title}" as...`} />
          </div>
        {/if}
      {/if}
    </div>
    {#if result.media_type !== "person" && result.overview}
      <p class="mt-2 line-clamp-3 text-xs text-muted">{result.overview}</p>
    {/if}
    {#if error}
      <p class="mt-2 text-xs text-danger">{error}</p>
    {/if}
  </div>
</div>
