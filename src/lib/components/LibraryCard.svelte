<script lang="ts">
  import { base } from "$app/paths";
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

  const borderClass = $derived(
    entry.status === "completed"
      ? "border-primary"
      : entry.status === "dropped"
        ? "border-border opacity-60"
        : "border-border"
  );
</script>

<a
  {href}
  class="flex flex-col overflow-hidden rounded-lg border bg-surface transition hover:border-accent {borderClass}"
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
  </div>
  <div class="flex flex-1 flex-col gap-1 p-2.5">
    <div class="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</div>
    <div class="mt-auto flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
      <span class="truncate {entry.status === 'completed' ? 'text-primary' : ''}"
        >{STATUS_LABEL[entry.status]}{entry.year ? ` · ${entry.year}` : ""}</span
      >
      {#if entry.kind === "tv"}
        <span class="tabular-nums">{watchedEpisodes}/{totalEpisodes}</span>
      {:else}
        <span>{entry.watched ? "Watched" : "—"}</span>
      {/if}
    </div>
    {#if entry.kind === "tv" && totalEpisodes > 0}
      <div class="h-1 w-full overflow-hidden rounded-full bg-surface-2">
        <div class="h-full bg-primary transition-all" style="width: {pct}%"></div>
      </div>
    {/if}
  </div>
</a>
