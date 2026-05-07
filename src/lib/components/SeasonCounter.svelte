<script lang="ts">
  import { base } from "$app/paths";
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { STATUS_COLOR } from "$lib/types";
  import type { TvEntry } from "$lib/types";

  type Props = { showId: number; season: number; name: string; total: number };
  let { showId, season, name, total }: Props = $props();

  const entry = $derived(store.get("tv", showId) as TvEntry | undefined);
  const current = $derived(entry?.progress[season] ?? 0);
  const seasonRating = $derived(entry?.seasonRatings?.[season] ?? null);
  const isComplete = $derived(total > 0 && current >= total);
  const sc = $derived(entry ? STATUS_COLOR[entry.status] : null);
  const pct = $derived(total > 0 ? Math.round((current / total) * 100) : 0);

  function dec(): void {
    store.updateProgress(showId, season, -1);
  }
  function inc(): void {
    store.updateProgress(showId, season, +1);
  }
  function markAll(): void {
    store.completeSeason(showId, season);
  }
  function reset(): void {
    store.resetSeason(showId, season);
  }
</script>

<!-- Whole row links to the season page; the +/- cluster on the right has its
     own click handlers and sits next to the link as a sibling so taps on the
     buttons don't navigate. -->
<div class="flex items-stretch gap-3 rounded-md border border-border bg-surface px-3 py-2.5 hover-border-primary">
  <a
    href="{base}/show/{showId}/season/{season}/"
    use:tactile
    class="tap-target tap-target--card flex min-w-0 flex-1 items-stretch gap-2"
    aria-label="Open {name}"
  >
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span class="truncate text-sm font-medium">{name}</span>
        {#if isComplete}<span class="shrink-0 text-xs {sc?.text ?? 'text-primary'}" aria-label="Season complete">✓</span>{/if}
        {#if typeof seasonRating === "number" && seasonRating > 0}
          <span
            class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums {sc
              ? `${sc.bgSoft} ${sc.text}`
              : 'bg-accent/15 text-accent'}"
          >
            ♥ {seasonRating}
          </span>
        {/if}
      </div>
      <div class="mt-0.5 truncate text-xs text-muted">
        Season {season} · {#key current}<span class="inline-block tabular-nums" in:fly={{ y: 4, duration: 180, easing: cubicOut }}>{current}</span>{/key}/{total} ep{total === 1 ? "" : "s"}
      </div>
      {#if total > 0}
        <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <div class="h-full transition-all {sc?.bg ?? 'bg-primary'}" style="width: {pct}%"></div>
        </div>
      {/if}
    </div>
  </a>

  <!-- Quick controls so the user doesn't have to open the season page for
       routine adjustments. Mirrors the season-page island for +/-, with mark
       all / reset added here (the season page island has just +/- + catch up). -->
  <div class="flex shrink-0 items-center gap-1.5">
    <button
      type="button"
      use:tactile={{ haptic: "tick" }}
      onclick={dec}
      disabled={current === 0}
      aria-label="Decrement {name}"
      class="tap-target tap-target--btn h-9 w-9 rounded-md border border-border bg-surface-2 text-base leading-none disabled:opacity-40"
    >
      −
    </button>
    <button
      type="button"
      use:tactile={{ haptic: "tick" }}
      onclick={inc}
      disabled={current >= total}
      aria-label="Increment {name}"
      class="tap-target tap-target--btn h-9 w-9 rounded-md border border-border text-base leading-none text-bg disabled:opacity-40 {sc?.bg ?? 'bg-primary'}"
    >
      +
    </button>
    {#if isComplete}
      <button
        type="button"
        use:tactile={{ haptic: "warn" }}
        onclick={reset}
        aria-label="Reset {name}"
        title="Reset progress"
        class="tap-target tap-target--btn h-9 rounded-md border border-border px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover-border-error hover-text-error"
      >
        Reset
      </button>
    {:else}
      <button
        type="button"
        use:tactile={{ haptic: "success" }}
        onclick={markAll}
        aria-label="Mark all of {name} watched"
        title="Mark all episodes watched"
        class="tap-target tap-target--btn h-9 rounded-md border border-secondary px-2.5 text-[10px] font-semibold uppercase tracking-wider text-secondary transition-colors duration-150 active:bg-secondary active:text-bg"
      >
        Mark all
      </button>
    {/if}
  </div>
</div>
