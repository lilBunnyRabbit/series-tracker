<script lang="ts">
  import { base } from "$app/paths";
  import { STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { Entry } from "$lib/types";

  type Props = { entry: Entry; compact?: boolean };
  let { entry, compact = false }: Props = $props();

  const href = $derived(entry.kind === "tv" ? `${base}/show/${entry.id}/` : `${base}/movie/${entry.id}/`);

  const totalEpisodes = $derived(entry.kind === "tv" ? entry.seasons.reduce((a, s) => a + s.episodeCount, 0) : 0);
  const watchedEpisodes = $derived(
    entry.kind === "tv" ? entry.seasons.reduce((a, s) => a + Math.min(entry.progress[s.number] ?? 0, s.episodeCount), 0) : 0
  );
  const pct = $derived(entry.kind === "tv" && totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0);

  const c = $derived(STATUS_COLOR[entry.status]);
  // Border kept at 1px for layout stability; colour is the signal.
  // Completed gets a coloured border; dropped fades; others stay neutral.
  const borderClass = $derived(
    entry.status === "completed"
      ? c.border
      : entry.status === "dropped"
        ? "border-border opacity-60"
        : "border-border"
  );
</script>

{#if compact}
  <a
    {href}
    class="flex items-center gap-3 rounded-md border bg-surface p-2 transition hover:border-accent {borderClass}"
  >
    <div class="h-16 w-12 shrink-0 overflow-hidden rounded bg-surface-2">
      {#if entry.poster}
        <img src={entry.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
      {/if}
    </div>
    <div class="min-w-0 flex-1">
      <div class="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</div>
      <div class="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
        <span class="h-1.5 w-1.5 rounded-full {c.dot}"></span>
        <span class={c.text}>{STATUS_LABEL[entry.status]}</span>
        {#if entry.year}<span>· {entry.year}</span>{/if}
      </div>
      {#if entry.kind === "tv" && totalEpisodes > 0}
        <div class="mt-1 flex items-center gap-2">
          <div class="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div class="h-full bg-primary transition-all" style="width: {pct}%"></div>
          </div>
          <span class="shrink-0 text-[10px] tabular-nums text-muted">{watchedEpisodes}/{totalEpisodes}</span>
        </div>
      {/if}
    </div>
  </a>
{:else}
  <a
    {href}
    class="flex h-full flex-col overflow-hidden rounded-lg border bg-surface transition hover:border-accent {borderClass}"
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
          <div class="h-full bg-primary transition-all" style="width: {pct}%"></div>
        </div>
      {/if}
    </div>
  </a>
{/if}
