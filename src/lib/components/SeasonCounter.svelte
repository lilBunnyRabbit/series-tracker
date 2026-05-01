<script lang="ts">
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import { seasonDetail } from "$lib/tmdb";
  import type { EpisodeBrief, TvEntry } from "$lib/types";
  import RatingPicker from "./RatingPicker.svelte";

  type Props = { showId: number; season: number; name: string; total: number };
  let { showId, season, name, total }: Props = $props();

  let expanded = $state(false);
  let episodes = $state<EpisodeBrief[] | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const entry = $derived(store.get("tv", showId) as TvEntry | undefined);
  const current = $derived(entry?.progress[season] ?? 0);
  const seasonRating = $derived(entry?.seasonRatings?.[season] ?? null);
  const currentEpisode = $derived(episodes && current > 0 ? (episodes.find((e) => e.episode_number === current) ?? null) : null);
  const isComplete = $derived(current === total && total > 0);

  const todayIso = new Date().toISOString().slice(0, 10);
  // How many episodes have aired so far in this season — derived only when
  // episode data is loaded (i.e. the season was expanded). Drives the
  // "Catch up" button which fast-forwards progress to the latest aired ep.
  const airedCount = $derived.by<number | null>(() => {
    if (!episodes) return null;
    let n = 0;
    for (const ep of episodes) {
      if (ep.air_date && ep.air_date <= todayIso) n++;
    }
    return n;
  });
  const canCatchUp = $derived(airedCount !== null && airedCount > current && airedCount < total);

  function dec() {
    vibrate("tick");
    store.updateProgress(showId, season, -1);
  }
  function inc() {
    vibrate("tick");
    store.updateProgress(showId, season, +1);
  }
  function complete() {
    vibrate("success");
    store.completeSeason(showId, season);
  }
  function reset() {
    vibrate("warn");
    store.resetSeason(showId, season);
  }
  function catchUp() {
    if (airedCount === null) return;
    vibrate("success");
    store.setProgress(showId, season, airedCount);
  }


  async function toggleExpand() {
    expanded = !expanded;
    if (expanded && !episodes && !loading && store.apiKey) {
      loading = true;
      error = null;
      try {
        const detail = await seasonDetail(showId, season, store.apiKey);
        episodes = detail.episodes;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      } finally {
        loading = false;
      }
    }
  }
</script>

<div class="rounded-md border border-border bg-surface">
  <div class="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
    <button
      type="button"
      onclick={toggleExpand}
      class="flex min-w-0 flex-1 items-center gap-2 text-left"
      aria-expanded={expanded}
    >
      <span class="text-xs text-muted transition-transform" style={expanded ? "transform: rotate(90deg)" : ""}>▶</span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-sm font-medium">{name}</span>
          {#if isComplete}<span class="shrink-0 text-xs text-primary" aria-label="Season complete">✓</span>{/if}
        </div>
        <div class="truncate text-xs text-muted">
          Season {season} · {total} ep{total === 1 ? "" : "s"}{currentEpisode ? ` · E${current} ${currentEpisode.name}` : ""}
        </div>
      </div>
    </button>
    <div class="flex flex-shrink-0 items-center gap-2">
      <button
        type="button"
        class="h-9 w-9 rounded-md border border-border bg-surface-2 text-lg leading-none disabled:opacity-40"
        onclick={dec}
        disabled={current === 0}
        aria-label="Decrement"
      >
        −
      </button>
      <input
        type="number"
        min="0"
        max={total}
        value={current}
        oninput={(e) => store.setProgress(showId, season, +(e.currentTarget as HTMLInputElement).value)}
        class="w-12 rounded-md border border-border bg-surface-2 px-1 py-1 text-center text-sm tabular-nums"
      />
      <span class="inline-block w-10 text-left text-sm tabular-nums text-muted">/ {total}</span>
      <button
        type="button"
        class="h-9 w-9 rounded-md border border-border bg-primary text-lg leading-none text-bg disabled:opacity-40"
        onclick={inc}
        disabled={current >= total}
        aria-label="Increment"
      >
        +
      </button>
    </div>
    <div class="flex w-full items-center justify-end gap-1.5 sm:w-auto">
      {#if canCatchUp}
        <button
          type="button"
          onclick={catchUp}
          title="Set progress to the latest aired episode ({airedCount} of {total})"
          class="rounded-md border border-accent px-2.5 py-1 text-[11px] text-accent hover:bg-accent hover:text-bg"
        >
          Catch up · E{airedCount}
        </button>
      {/if}
      {#if isComplete}
        <button
          type="button"
          onclick={reset}
          class="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted hover:border-danger hover:text-danger"
        >
          Reset
        </button>
      {:else}
        <button
          type="button"
          onclick={complete}
          class="rounded-md border border-primary px-2.5 py-1 text-[11px] text-primary hover:bg-primary hover:text-bg"
        >
          Mark complete
        </button>
      {/if}
    </div>
  </div>

  {#if expanded}
    <div class="space-y-3 border-t border-border px-3 py-2">
      <RatingPicker
        value={seasonRating}
        onChange={(v) => store.setSeasonRating(showId, season, v)}
        label="Season rating"
      />

      {#if loading}
        <p class="text-xs text-muted">Loading episodes...</p>
      {:else if error}
        <p class="text-xs text-danger">{error}</p>
      {:else if episodes && episodes.length > 0}
        <ol class="space-y-1">
          {#each episodes as ep (ep.id)}
            {@const watched = ep.episode_number <= current}
            {@const isCurrent = ep.episode_number === current}
            <li
              class="flex items-baseline gap-2 rounded px-2 py-1 text-xs {isCurrent
                ? 'bg-accent/15 text-text'
                : watched
                  ? 'text-text'
                  : 'text-muted'}"
            >
              <span class="w-8 shrink-0 tabular-nums {watched ? 'text-accent' : ''}">
                {watched ? "✓" : ""}E{ep.episode_number}
              </span>
              <span class="min-w-0 flex-1 truncate">{ep.name}</span>
              {#if ep.air_date}
                <span class="shrink-0 text-[10px] text-muted">{ep.air_date}</span>
              {/if}
            </li>
          {/each}
        </ol>
      {:else if episodes}
        <p class="text-xs text-muted">No episodes listed.</p>
      {/if}
    </div>
  {/if}
</div>
