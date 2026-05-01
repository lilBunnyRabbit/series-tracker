<script lang="ts">
  import { base } from "$app/paths";
  import CardActionsSheet from "$lib/components/CardActionsSheet.svelte";
  import { longPress, tactile } from "$lib/tactile";
  import { STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { Entry } from "$lib/types";

  type Props = {
    entry: Entry;
    /** Backdrop URL used for the right-side bleed. */
    backdrop?: string | null;
  };
  let { entry, backdrop = null }: Props = $props();

  const href = $derived(entry.kind === "tv" ? `${base}/show/${entry.id}/` : `${base}/movie/${entry.id}/`);
  const c = $derived(STATUS_COLOR[entry.status]);

  const totalEpisodes = $derived(entry.kind === "tv" ? entry.seasons.reduce((a, s) => a + s.episodeCount, 0) : 0);
  const watchedEpisodes = $derived(
    entry.kind === "tv"
      ? entry.seasons.reduce((a, s) => a + Math.min(entry.progress[s.number] ?? 0, s.episodeCount), 0)
      : 0
  );
  const pct = $derived(entry.kind === "tv" && totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0);

  let actionsOpen = $state(false);
  const openActions = (): void => {
    actionsOpen = true;
  };
  const closeActions = (): void => {
    actionsOpen = false;
  };
</script>

<div class="relative">
  <a
    {href}
    use:tactile
    use:longPress={{ onLongPress: openActions }}
    class="tap-target tap-target--card relative flex items-stretch gap-3 overflow-hidden rounded-lg border border-border bg-surface p-2 pr-12 hover-border-primary"
  >
    <!-- Backdrop bleed: faded-from-right wash behind metadata. Subtle, non-loud. -->
    {#if backdrop}
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-0 right-0 w-3/5 bg-cover bg-center opacity-25 [mask-image:linear-gradient(to_left,black,transparent)]"
        style="background-image: url('{backdrop}')"
      ></div>
    {/if}

    <div class="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded bg-surface-2">
      {#if entry.poster}
        <img src={entry.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
      {/if}
      <!-- Tiny status dot under-poster -->
      <span class="absolute bottom-0.5 left-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-bg/80 backdrop-blur">
        <span class="h-1.5 w-1.5 rounded-full {c.dot}" aria-hidden="true"></span>
      </span>
    </div>

    <div class="relative flex min-w-0 flex-1 flex-col justify-between py-0.5">
      <div class="min-w-0">
        <div class="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</div>
        <div class="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
          <span class={c.text}>{STATUS_LABEL[entry.status]}</span>
          {#if entry.year}<span>· {entry.year}</span>{/if}
          {#if entry.kind === "tv" && totalEpisodes > 0}
            <span>· {watchedEpisodes}/{totalEpisodes}</span>
          {/if}
        </div>
      </div>

      {#if entry.kind === "tv" && totalEpisodes > 0}
        <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <div class="h-full bg-primary transition-all" style="width: {pct}%"></div>
        </div>
      {/if}
    </div>

    {#if typeof entry.rating === "number" && entry.rating > 0}
      <div class="relative flex shrink-0 items-center self-center pr-1">
        <span class="rounded-md bg-accent/15 px-2 py-1 text-xs font-semibold tabular-nums text-accent">
          ★ {entry.rating}
        </span>
      </div>
    {/if}
  </a>
  <button
    type="button"
    use:tactile
    onclick={openActions}
    aria-label="Quick actions for {entry.title}"
    class="tap-target tap-target--icon absolute right-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-base leading-none text-muted hover-text-text"
  >
    ⋯
  </button>
</div>

<CardActionsSheet {entry} open={actionsOpen} onClose={closeActions} />
