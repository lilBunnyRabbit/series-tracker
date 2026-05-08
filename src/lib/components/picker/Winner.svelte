<script lang="ts">
  // "Tonight's pick" final-screen card — used by bracket / coin / mini /
  // spin / stalled / mood. Owns the winner's hero presentation and the
  // TMDB recommendations rail, so every mode that produces a winner ends
  // with the same surface. Modes pass their own action labels via slots
  // for the secondary buttons (e.g. "Pick again" vs "Re-roll").
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import Rail from "$lib/components/Rail.svelte";
  import { tactile } from "$lib/tactile";
  import { recommendations, posterUrl } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import { entryHref, entryYear, entryMeta, entryHint } from "$lib/picker";
  import { store } from "$lib/store.svelte";
  import type { Entry } from "$lib/types";
  import { backOut } from "svelte/easing";
  import { fade, fly, scale } from "svelte/transition";

  type Props = {
    winner: Entry;
    /** Label above the title — defaults to "Tonight's pick", but coin / spin
     *  modes can override (e.g. "Heads or tails", "Locked in"). */
    eyebrow?: string;
    /** Label for the secondary "play again" button. Defaults vary per mode. */
    pickAgainLabel?: string;
    onPickAgain?: () => void;
    /** Optional extra action surfaced to the right of "Pick again", typically
     *  used by bracket / mini for "Show bracket". */
    extraAction?: { label: string; pressed: boolean; onclick: () => void } | null;
  };

  let {
    winner,
    eyebrow = "Tonight's pick",
    pickAgainLabel = "Pick again",
    onPickAgain,
    extraAction = null,
  }: Props = $props();

  let recs = $state<RecommendationItem[]>([]);
  let recsLoading = $state(false);

  $effect(() => {
    void loadRecs(winner);
  });

  async function loadRecs(w: Entry): Promise<void> {
    recs = [];
    if (!store.apiKey) return;
    recsLoading = true;
    try {
      const items = await recommendations(w.kind, w.id, store.apiKey);
      const lib = new Set(store.entries.map((e) => `${e.kind}:${e.id}`));
      recs = items.filter((r) => !lib.has(`${r.media_type}:${r.id}`)).slice(0, 16);
    } catch {
      recs = [];
    } finally {
      recsLoading = false;
    }
  }
</script>

<div in:fade={{ duration: 220 }} class="space-y-5">
  <header class="space-y-1 text-center">
    <div
      class="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-accent"
      in:fly={{ y: -8, duration: 320, easing: backOut, delay: 80 }}
    >
      <Icon name="trophy" size={14} />
      <span>{eyebrow}</span>
    </div>
    <h1
      class="text-2xl font-semibold leading-tight"
      in:fly={{ y: 12, duration: 360, easing: backOut, delay: 160 }}
    >
      {winner.title}
    </h1>
    {#if entryYear(winner)}
      <p
        class="text-sm text-muted"
        in:fly={{ y: 8, duration: 320, easing: backOut, delay: 240 }}
      >
        <span class="tabular-nums">{entryYear(winner)}</span>
        <span aria-hidden="true">·</span>
        <span>{entryMeta(winner)}</span>
      </p>
    {/if}
    {#if entryHint(winner)}
      <p
        class="text-xs tabular-nums text-text/70"
        in:fly={{ y: 8, duration: 320, easing: backOut, delay: 280 }}
      >
        {entryHint(winner)}
      </p>
    {/if}
    {#if winner.notes && winner.notes.trim()}
      <p
        class="mx-auto max-w-prose text-sm italic text-muted/90"
        in:fly={{ y: 8, duration: 320, easing: backOut, delay: 320 }}
      >
        "{winner.notes.trim()}"
      </p>
    {/if}
  </header>

  <a
    href={entryHref(winner)}
    use:tactile={{ haptic: false }}
    class="tap-target tap-target--card mx-auto block w-[220px] sm:w-[260px]"
    aria-label="Open {winner.title}"
    in:scale={{ start: 0.7, duration: 480, easing: backOut, delay: 80 }}
  >
    <div class="winner-poster relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-accent/40 bg-surface-2 shadow-2xl">
      {#if winner.poster}
        <img src={winner.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
      {/if}
      {#if typeof winner.voteAverage === "number" && winner.voteAverage > 0}
        <div class="absolute right-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-medium tabular-nums text-text backdrop-blur-sm">
          ★ {winner.voteAverage.toFixed(1)}
        </div>
      {/if}
    </div>
  </a>

  <div
    class="flex flex-wrap items-center justify-center gap-2"
    in:fly={{ y: 12, duration: 320, easing: backOut, delay: 320 }}
  >
    <a
      href={entryHref(winner)}
      use:tactile
      class="tap-target tap-target--btn rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
    >
      Open
    </a>
    {#if onPickAgain}
      <button
        type="button"
        use:tactile
        onclick={onPickAgain}
        class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-primary"
      >
        {pickAgainLabel}
      </button>
    {/if}
    {#if extraAction}
      <button
        type="button"
        use:tactile={{ haptic: false }}
        onclick={extraAction.onclick}
        aria-pressed={extraAction.pressed}
        class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-accent"
      >
        {extraAction.label}
      </button>
    {/if}
  </div>

  {#if recsLoading}
    <p class="text-center text-xs text-muted">Finding more like this…</p>
  {:else if recs.length > 0}
    <div in:fade={{ duration: 240, delay: 200 }}>
      <Rail title="More like {winner.title}" subtitle="From TMDB recommendations">
        {#each recs as r (r.media_type + ":" + r.id)}
          {#if r.media_type === "tv"}
            <PosterCard
              kind="tv"
              id={r.id}
              title={r.name}
              poster={posterUrl(r.poster_path, "w342")}
              year={r.first_air_date ? r.first_air_date.slice(0, 4) : undefined}
              voteAverage={r.vote_average}
            />
          {:else if r.media_type === "movie"}
            <PosterCard
              kind="movie"
              id={r.id}
              title={r.title}
              poster={posterUrl(r.poster_path, "w342")}
              year={r.release_date ? r.release_date.slice(0, 4) : undefined}
              voteAverage={r.vote_average}
            />
          {/if}
        {/each}
      </Rail>
    </div>
  {/if}
</div>

<style>
  .winner-poster::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    background: radial-gradient(
      ellipse at center,
      color-mix(in oklab, var(--color-accent) 28%, transparent) 0%,
      transparent 70%
    );
    pointer-events: none;
    z-index: -1;
    animation: trophy-pulse 2400ms ease-in-out infinite;
  }
  @keyframes trophy-pulse {
    0%,
    100% {
      opacity: 0.6;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.04);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .winner-poster::after {
      animation: none;
      opacity: 0.7;
    }
  }
</style>
