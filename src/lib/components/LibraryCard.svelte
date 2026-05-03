<script lang="ts">
  import { base } from "$app/paths";
  import CardActionsSheet from "$lib/components/CardActionsSheet.svelte";
  import TypeBadge from "$lib/components/TypeBadge.svelte";
  import { longPress, tactile } from "$lib/tactile";
  import { effectiveSeasons, STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { Entry } from "$lib/types";

  type Props = { entry: Entry; compact?: boolean };
  let { entry, compact = false }: Props = $props();

  const href = $derived(entry.kind === "tv" ? `${base}/show/${entry.id}/` : `${base}/movie/${entry.id}/`);

  // Card progress mirrors the show page: specials are excluded from totals
  // unless the user has opted into them, so the bar fills to 100% the moment
  // the regular run is done.
  const countedSeasons = $derived(entry.kind === "tv" ? effectiveSeasons(entry) : []);
  const totalEpisodes = $derived(countedSeasons.reduce((a, s) => a + s.episodeCount, 0));
  const watchedEpisodes = $derived(
    entry.kind === "tv"
      ? countedSeasons.reduce((a, s) => a + Math.min(entry.progress[s.number] ?? 0, s.episodeCount), 0)
      : 0
  );
  const pct = $derived(entry.kind === "tv" && totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0);

  const c = $derived(STATUS_COLOR[entry.status]);
  // Soft status-tinted border on every in-library item; dropped fades the
  // whole card so it recedes in mixed lists.
  const borderClass = $derived(
    entry.status === "dropped" ? `${c.borderSoft} opacity-60` : c.borderSoft
  );

  let actionsOpen = $state(false);
  function openActions(): void {
    actionsOpen = true;
  }
  function closeActions(): void {
    actionsOpen = false;
  }
</script>

{#if compact}
  <div class="relative">
    <a
      {href}
      use:tactile
      use:longPress={{ onLongPress: openActions }}
      class="tap-target tap-target--card flex items-stretch gap-3 rounded-md border bg-surface p-2 {borderClass}"
    >
      <div class="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-surface-2">
        {#if entry.poster}
          <img src={entry.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
        {/if}
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="min-w-0 pr-28">
          <div class="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</div>
          <div class="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
            <span class="h-1.5 w-1.5 rounded-full {c.dot}"></span>
            <span class={c.text}>{STATUS_LABEL[entry.status]}</span>
            {#if entry.year}<span>· {entry.year}</span>{/if}
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
        <span class="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-accent">
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
{:else}
  <div class="relative h-full">
    <a
      {href}
      use:tactile
      use:longPress={{ onLongPress: openActions }}
      class="tap-target tap-target--card flex h-full flex-col overflow-hidden rounded-lg border bg-surface {borderClass}"
    >
      <div class="relative aspect-[2/3] w-full bg-surface-2">
        {#if entry.poster}
          <img src={entry.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
        {/if}
        {#if typeof entry.voteAverage === "number" && entry.voteAverage > 0}
          <div
            class="absolute right-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-text backdrop-blur-sm"
          >
            ★ {entry.voteAverage.toFixed(1)}
          </div>
        {/if}
        {#if typeof entry.rating === "number" && entry.rating > 0}
          <div
            class="absolute left-1.5 top-1.5 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-bg"
          >
            ♥ {entry.rating}
          </div>
        {/if}
        <span class="absolute bottom-1.5 left-1.5">
          <TypeBadge kind={entry.kind} variant="overlay" />
        </span>
      </div>
      <div class="flex flex-1 flex-col gap-1 p-2.5">
        <div class="line-clamp-3 text-sm font-medium leading-snug">{entry.title}</div>
        <div class="mt-auto flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider">
          <span class="flex min-w-0 items-center gap-1.5">
            <span class="h-1.5 w-1.5 shrink-0 rounded-full {c.dot}"></span>
            <span class="truncate {c.text}">{STATUS_LABEL[entry.status]}{entry.year ? ` · ${entry.year}` : ""}</span>
          </span>
          {#if entry.kind === "tv"}
            <span class="shrink-0 tabular-nums text-muted">{watchedEpisodes}/{totalEpisodes}</span>
          {/if}
        </div>
        {#if entry.kind === "tv" && totalEpisodes > 0}
          <div class="h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div class="h-full transition-all {c.bg}" style="width: {pct}%"></div>
          </div>
        {/if}
      </div>
    </a>
    <button
      type="button"
      use:tactile
      onclick={openActions}
      aria-label="Quick actions for {entry.title}"
      class="tap-target tap-target--icon absolute right-1 top-9 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-base leading-none text-text backdrop-blur-sm"
    >
      ⋯
    </button>
  </div>
{/if}

<CardActionsSheet {entry} open={actionsOpen} onClose={closeActions} />
