<script lang="ts">
  import { base } from "$app/paths";
  import { store } from "$lib/store.svelte";
  import { STATUS_LABEL } from "$lib/types";
  import type { Entry } from "$lib/types";

  type Props = { entry: Entry };
  let { entry }: Props = $props();

  const href = $derived(entry.kind === "tv" ? `${base}/show/${entry.id}/` : `${base}/movie/${entry.id}/`);

  const totalEpisodes = $derived(entry.kind === "tv" ? entry.seasons.reduce((a, s) => a + s.episodeCount, 0) : 0);
  const watchedEpisodes = $derived(
    entry.kind === "tv" ? entry.seasons.reduce((a, s) => a + Math.min(entry.progress[s.number] ?? 0, s.episodeCount), 0) : 0
  );
  const pct = $derived(entry.kind === "tv" && totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0);
  const canIncrement = $derived(entry.kind === "tv" && watchedEpisodes < totalEpisodes);

  const currentSeasonHint = $derived.by(() => {
    if (entry.kind !== "tv") return "";
    for (const s of entry.seasons) {
      const cur = entry.progress[s.number] ?? 0;
      if (cur < s.episodeCount) return `S${s.number} ${cur}/${s.episodeCount}`;
    }
    return "Done";
  });

  function handleQuickAdd(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (entry.kind !== "tv") return;
    store.incrementCurrent(entry.id);
  }
</script>

<a
  {href}
  class="group relative flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-accent)]"
>
  <div class="relative aspect-[2/3] w-full bg-[var(--color-surface-2)]">
    {#if entry.poster}
      <img src={entry.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
    {/if}
    {#if typeof entry.voteAverage === "number" && entry.voteAverage > 0}
      <div
        class="absolute right-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--color-text)] backdrop-blur-sm"
      >
        ★ {entry.voteAverage.toFixed(1)}
      </div>
    {/if}
    {#if canIncrement}
      <button
        type="button"
        onclick={handleQuickAdd}
        aria-label="Mark next episode watched"
        title="+1 episode ({currentSeasonHint})"
        class="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-accent-fg)] opacity-0 shadow-lg transition group-hover:opacity-100 focus:opacity-100 active:opacity-100"
      >
        +
      </button>
    {/if}
  </div>
  <div class="flex flex-1 flex-col gap-1 p-2.5">
    <div class="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</div>
    <div class="mt-auto flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
      <span class="truncate">{STATUS_LABEL[entry.status]}{entry.year ? ` · ${entry.year}` : ""}</span>
      {#if entry.kind === "tv"}
        <span class="tabular-nums">{watchedEpisodes}/{totalEpisodes}</span>
      {:else}
        <span>{entry.watched ? "Watched" : "—"}</span>
      {/if}
    </div>
    {#if entry.kind === "tv" && totalEpisodes > 0}
      <div class="h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div class="h-full bg-[var(--color-accent)] transition-all" style="width: {pct}%"></div>
      </div>
    {/if}
  </div>
</a>
