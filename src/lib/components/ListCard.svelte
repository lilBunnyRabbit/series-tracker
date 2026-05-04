<script lang="ts">
  import { base } from "$app/paths";
  import CardActionsSheet from "$lib/components/CardActionsSheet.svelte";
  import TypeBadge from "$lib/components/TypeBadge.svelte";
  import { longPress, tactile } from "$lib/tactile";
  import { effectiveSeasons, STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { Entry } from "$lib/types";

  type Props = {
    entry: Entry;
    /** Backdrop URL used for the right-side bleed. */
    backdrop?: string | null;
  };
  let { entry, backdrop = null }: Props = $props();

  const href = $derived(entry.kind === "tv" ? `${base}/show/${entry.id}/` : `${base}/movie/${entry.id}/`);
  const c = $derived(STATUS_COLOR[entry.status]);
  // Soft status-tinted border. Dropped fades the whole card so it visually
  // recedes (mirrors the grid card behavior).
  const cardClass = $derived(
    entry.status === "dropped" ? `${c.borderSoft} opacity-70` : c.borderSoft
  );

  const countedSeasons = $derived(entry.kind === "tv" ? effectiveSeasons(entry) : []);
  const totalEpisodes = $derived(countedSeasons.reduce((a, s) => a + s.episodeCount, 0));
  const watchedEpisodes = $derived(
    entry.kind === "tv"
      ? countedSeasons.reduce((a, s) => a + Math.min(entry.progress[s.number] ?? 0, s.episodeCount), 0)
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
    class="tap-target tap-target--card relative flex items-stretch gap-3 overflow-hidden rounded-lg border bg-surface p-2 {cardClass}"
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
    </div>

    <div class="relative flex min-w-0 flex-1 flex-col py-0.5">
      <!-- pr-28 clears the top-right cluster only on the textual rows; the
           progress bar below sits in the same content column without padding so
           it stretches from the poster's right edge to the card's right edge. -->
      <div class="min-w-0 pr-28">
        <div class="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</div>
        <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
          <span class="inline-flex items-center gap-1 font-medium {c.text}">
            <span class="h-1.5 w-1.5 rounded-full {c.dot}" aria-hidden="true"></span>
            {STATUS_LABEL[entry.status]}
          </span>
          {#if entry.year}<span class="tabular-nums">· {entry.year}</span>{/if}
          {#if entry.kind === "tv" && totalEpisodes > 0}
            <span class="tabular-nums">· {watchedEpisodes}/{totalEpisodes}</span>
          {/if}
        </div>
      </div>

      {#if entry.kind === "tv" && totalEpisodes > 0}
        <div class="mt-auto h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <div class="h-full transition-all {c.bg}" style="width: {pct}%"></div>
        </div>
      {/if}
    </div>
  </a>
  <div class="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5">
    <TypeBadge kind={entry.kind} variant="chip" />
    {#if typeof entry.rating === "number" && entry.rating > 0}
      <span class="rounded-md {c.bgSoft} px-1.5 py-0.5 text-[10px] font-semibold tabular-nums {c.text}">
        ★ {entry.rating}
      </span>
    {/if}
    <button
      type="button"
      use:tactile
      onclick={openActions}
      aria-label="Quick actions for {entry.title}"
      class="tap-target tap-target--icon pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full text-base leading-none text-muted hover-text-text"
    >
      ⋯
    </button>
  </div>
</div>

<CardActionsSheet {entry} open={actionsOpen} onClose={closeActions} />
