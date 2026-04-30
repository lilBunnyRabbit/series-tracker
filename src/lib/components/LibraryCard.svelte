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
</script>

<a
  {href}
  class="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-accent)]"
>
  <div class="aspect-[2/3] w-full bg-[var(--color-surface-2)]">
    {#if entry.poster}
      <img src={entry.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
    {/if}
  </div>
  <div class="flex flex-1 flex-col gap-1 p-2.5">
    <div class="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</div>
    <div class="mt-auto flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
      <span>{STATUS_LABEL[entry.status]}</span>
      {#if entry.kind === "tv"}
        <span>{watchedEpisodes}/{totalEpisodes}</span>
      {:else}
        <span>{entry.watched ? "Watched" : "Unwatched"}</span>
      {/if}
    </div>
    {#if entry.kind === "tv" && totalEpisodes > 0}
      <div class="h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div class="h-full bg-[var(--color-accent)] transition-all" style="width: {pct}%"></div>
      </div>
    {/if}
  </div>
</a>
