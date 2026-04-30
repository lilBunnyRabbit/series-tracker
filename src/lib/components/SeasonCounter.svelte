<script lang="ts">
  import { store } from "$lib/store.svelte";

  type Props = { showId: number; season: number; name: string; total: number };
  let { showId, season, name, total }: Props = $props();

  const current = $derived(store.get("tv", showId)?.kind === "tv" ? ((store.get("tv", showId) as { progress: Record<number, number> }).progress[season] ?? 0) : 0);
</script>

<div class="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
  <div class="min-w-0 flex-1">
    <div class="truncate text-sm font-medium">{name}</div>
    <div class="text-xs text-[var(--color-muted)]">Season {season} · {total} episodes</div>
  </div>
  <div class="flex items-center gap-2">
    <button
      type="button"
      class="h-8 w-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-lg leading-none disabled:opacity-40"
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
      class="w-12 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1 py-1 text-center text-sm tabular-nums"
    />
    <span class="text-sm tabular-nums text-[var(--color-muted)]">/ {total}</span>
    <button
      type="button"
      class="h-8 w-8 rounded-md border border-[var(--color-border)] bg-[var(--color-accent)] text-lg leading-none text-[var(--color-accent-fg)] disabled:opacity-40"
      onclick={() => store.updateProgress(showId, season, +1)}
      disabled={current >= total}
      aria-label="Increment"
    >
      +
    </button>
  </div>
</div>
