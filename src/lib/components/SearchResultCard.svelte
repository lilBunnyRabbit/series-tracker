<script lang="ts">
  import { base } from "$app/paths";
  import StatusMenu from "$lib/components/StatusMenu.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { posterUrl } from "$lib/tmdb";
  import { STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { SearchMultiResult, Status } from "$lib/types";

  type Props = { result: SearchMultiResult; onAdd: (r: SearchMultiResult, status: Status) => Promise<void> | void };
  let { result, onAdd }: Props = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);

  const existing = $derived(
    result.media_type !== "person" ? store.get(result.media_type, result.id) : undefined
  );
  const inLibrary = $derived(!!existing);
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

<!-- Card-link pattern: the title <a> grows a ::before that overlays the whole
     card, so clicking the poster, overview, or empty space follows the link.
     Interactive children (buttons, status chip) get position:relative + z-10
     so their clicks land on them instead of the overlay. -->
<article
  use:tactile={{ haptic: false }}
  class="tap-target tap-target--card relative flex gap-3 rounded-lg border border-border bg-surface p-3 hover-border-primary focus-within:border-primary"
>
  <div class="h-32 w-[88px] flex-shrink-0 overflow-hidden rounded bg-surface-2">
    {#if poster}
      <img src={poster} alt="" class="h-full w-full object-cover" loading="lazy" />
    {/if}
  </div>
  <div class="flex min-w-0 flex-1 flex-col">
    <div class="min-w-0">
      {#if detailHref}
        <a href={detailHref} class="card-link block line-clamp-3 font-medium leading-snug">{title}</a>
      {:else}
        <span class="block line-clamp-3 font-medium leading-snug">{title}</span>
      {/if}
      <div class="mt-1 text-xs text-muted">
        <span class="rounded bg-surface-2 px-1.5 py-0.5 uppercase tracking-wider">{result.media_type}</span>
        {#if date}<span class="ml-2">{date.slice(0, 4)}</span>{/if}
      </div>
    </div>
    {#if result.media_type !== "person" && result.overview}
      <p class="mt-2 line-clamp-2 text-xs text-muted">{result.overview}</p>
    {/if}
    {#if result.media_type !== "person"}
      <div class="relative z-10 mt-auto flex justify-end pt-2">
        {#if existing}
          {@const c = STATUS_COLOR[existing.status]}
          <span
            class="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium {c.chip}"
          >
            <span class="h-2 w-2 rounded-full {c.dot}" aria-hidden="true"></span>
            {STATUS_LABEL[existing.status]}
          </span>
        {:else}
          <StatusMenu label="+ Add" {busy} size="sm" onSelect={handleStatusPick} title={`Add "${title}" as...`} />
        {/if}
      </div>
    {/if}
    {#if error}
      <p class="relative z-10 mt-2 text-xs text-danger">{error}</p>
    {/if}
  </div>
</article>

<style>
  .card-link::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
</style>
