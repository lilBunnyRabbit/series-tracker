<script lang="ts">
  // Single head-to-head card used by bracket / coin / mini / ranking modes.
  // Owns presentation only — the parent decides what "winner" / "loser"
  // means and feeds the appropriate flags. Side is purely for the loser
  // sweep-out animation direction.
  import { tactile } from "$lib/tactile";
  import { entryYear, entryMeta, entryHint } from "$lib/picker";
  import { STATUS_COLOR } from "$lib/types";
  import type { Entry } from "$lib/types";

  type Props = {
    entry: Entry;
    side: "a" | "b";
    locked: boolean;
    isWinner: boolean;
    isLoser: boolean;
    onpick: () => void;
  };
  let { entry, side, locked, isWinner, isLoser, onpick }: Props = $props();

  const c = $derived(STATUS_COLOR[entry.status]);
</script>

<button
  type="button"
  use:tactile={{ haptic: false }}
  onclick={onpick}
  disabled={locked}
  class="match-card group flex flex-col gap-2 rounded-lg border border-border/60 bg-surface p-2 text-left disabled:cursor-default {isWinner ? 'is-winner' : ''} {isLoser ? `is-loser is-loser-${side}` : ''}"
  aria-label="Pick {entry.title}"
>
  <div class="poster relative aspect-[2/3] w-full overflow-hidden rounded-md border border-border/60 bg-surface-2">
    {#if entry.poster}
      <img src={entry.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
    {/if}
    {#if typeof entry.voteAverage === "number" && entry.voteAverage > 0}
      <div class="absolute right-1.5 top-1.5 rounded-md bg-overlay px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-on-overlay backdrop-blur-sm">
        ★ {entry.voteAverage.toFixed(1)}
      </div>
    {/if}
    <span
      class="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-overlay px-1.5 py-0.5 text-[10px] backdrop-blur-sm"
      aria-hidden="true"
    >
      <span class="h-1.5 w-1.5 rounded-full {c.dot}"></span>
    </span>
    <span class="winner-glow" aria-hidden="true"></span>
  </div>
  <div class="min-w-0 px-1">
    <div class="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</div>
    <div class="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
      {#if entryYear(entry)}<span class="tabular-nums">{entryYear(entry)}</span>{/if}
      {#if entryYear(entry)}<span aria-hidden="true">·</span>{/if}
      <span>{entryMeta(entry)}</span>
    </div>
    {#if entryHint(entry)}
      <!-- Progress + rating + rewatchable hint helps the user weigh
           "have I started this? did I love it?" without leaving the bracket. -->
      <div class="mt-0.5 truncate text-[11px] tabular-nums text-text/70">{entryHint(entry)}</div>
    {/if}
    {#if entry.notes && entry.notes.trim()}
      <p class="mt-1.5 line-clamp-2 text-[11px] italic leading-snug text-muted">"{entry.notes.trim()}"</p>
    {/if}
  </div>
</button>

<style>
  .match-card {
    transition:
      transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity 280ms ease-out,
      border-color 180ms,
      box-shadow 280ms;
    will-change: transform, opacity;
    transform-origin: center bottom;
  }
  .match-card:hover:not(:disabled) {
    transform: translateY(-2px);
  }
  .match-card.is-winner {
    transform: scale(1.06);
    border-color: var(--color-primary);
    box-shadow:
      0 0 0 2px color-mix(in oklab, var(--color-primary) 40%, transparent),
      0 18px 40px -12px color-mix(in oklab, var(--color-primary) 35%, transparent),
      0 4px 12px -4px rgb(var(--shadow-color) / var(--shadow-alpha-2));
  }
  .match-card.is-winner .winner-glow {
    opacity: 1;
  }
  .match-card.is-loser {
    opacity: 0.18;
    transform: scale(0.86);
  }
  .match-card.is-loser-a {
    transform: scale(0.86) translateX(14px);
  }
  .match-card.is-loser-b {
    transform: scale(0.86) translateX(-14px);
  }

  .winner-glow {
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    background: radial-gradient(
      ellipse at center,
      color-mix(in oklab, var(--color-primary) 35%, transparent) 0%,
      transparent 70%
    );
    opacity: 0;
    pointer-events: none;
    transition: opacity 260ms ease-out;
    mix-blend-mode: screen;
  }

  @media (prefers-reduced-motion: reduce) {
    .match-card,
    .match-card:hover:not(:disabled),
    .match-card.is-winner,
    .match-card.is-loser,
    .match-card.is-loser-a,
    .match-card.is-loser-b {
      transition: opacity 120ms;
      transform: none;
      box-shadow: none;
    }
    .match-card.is-loser,
    .match-card.is-loser-a,
    .match-card.is-loser-b {
      opacity: 0.25;
    }
  }
</style>
