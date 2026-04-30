<script lang="ts">
  import { store } from "$lib/store.svelte";
  import { seasonDetail } from "$lib/tmdb";
  import type { EpisodeBrief, TvEntry } from "$lib/types";

  type Props = { showId: number; season: number; name: string; total: number };
  let { showId, season, name, total }: Props = $props();

  let expanded = $state(false);
  let episodes = $state<EpisodeBrief[] | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const entry = $derived(store.get("tv", showId) as TvEntry | undefined);
  const current = $derived(entry?.progress[season] ?? 0);
  const currentEpisode = $derived(episodes && current > 0 ? (episodes.find((e) => e.episode_number === current) ?? null) : null);

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
  <div class="flex items-center justify-between gap-3 px-3 py-2">
    <button
      type="button"
      onclick={toggleExpand}
      class="flex min-w-0 flex-1 items-center gap-2 text-left"
      aria-expanded={expanded}
    >
      <span class="text-xs text-muted transition-transform" style={expanded ? "transform: rotate(90deg)" : ""}>▶</span>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium">{name}</div>
        <div class="truncate text-xs text-muted">
          Season {season} · {total} ep{total === 1 ? "" : "s"}{currentEpisode ? ` · E${current} ${currentEpisode.name}` : ""}
        </div>
      </div>
    </button>
    <div class="flex flex-shrink-0 items-center gap-2">
      <button
        type="button"
        class="h-9 w-9 rounded-md border border-border bg-surface-2 text-lg leading-none disabled:opacity-40"
        onclick={() => store.updateProgress(showId, season, -1)}
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
        onclick={() => store.updateProgress(showId, season, +1)}
        disabled={current >= total}
        aria-label="Increment"
      >
        +
      </button>
    </div>
  </div>

  {#if expanded}
    <div class="border-t border-border px-3 py-2">
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
