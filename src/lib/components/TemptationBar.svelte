<script lang="ts">
  // Temptation bar — refined heat-gradient bar plus band label, percent,
  // trend arrow, and last-bump caption. Drives the live "you just bumped it"
  // moment on detail pages: when an action fires while the user's looking at
  // the entry (e.g. they tap "watched"), the entry mutates, $derived
  // re-evaluates, and the CSS width transition animates the new value into
  // place. No animation library, no extra storage — just reactive plumbing.

  import { store } from "$lib/store.svelte";
  import {
    band,
    bumpLabel,
    currentTemptation,
    lastPositiveBump,
    trend,
  } from "$lib/temptation";
  import type { Entry } from "$lib/types";

  type Props = { entry: Entry };
  let { entry }: Props = $props();

  const pacing = $derived(store.preferences.temptationPacing);
  const value = $derived(currentTemptation(entry, pacing));
  const pct = $derived(Math.round(value * 100));
  const label = $derived(band(value));
  const direction = $derived(trend(entry));
  const lastBump = $derived(lastPositiveBump(entry));

  // Coarse time-ago. The caption is a quick read, not a timestamp; minute /
  // hour / day buckets read fast and avoid the cognitive load of a precise
  // duration ("3d ago" beats "73h 12m ago" for a status line).
  function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return "just now";
    const min = Math.round(ms / 60_000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day}d ago`;
    const mo = Math.round(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.round(mo / 12)}y ago`;
  }

  const captionText = $derived.by(() => {
    if (!lastBump) return null;
    const sign = lastBump.delta > 0 ? "+" : "";
    return `${sign}${lastBump.delta.toFixed(2)} · ${bumpLabel(lastBump)} · ${timeAgo(lastBump.at)}`;
  });
</script>

<section class="space-y-1.5" aria-label="Temptation">
  <header class="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider">
    <span class="text-muted">Temptation</span>
    <span class="flex items-center gap-1.5 tabular-nums">
      <span class="font-medium text-text">{label}</span>
      <span class="text-muted">·</span>
      <span class="font-medium text-text">{pct}%</span>
      {#if direction === "up"}
        <span aria-label="Trending up" class="tt-trend tt-trend-up">↑</span>
      {:else if direction === "down"}
        <span aria-label="Trending down" class="tt-trend tt-trend-down">↓</span>
      {:else}
        <span aria-label="Steady" class="tt-trend tt-trend-flat">—</span>
      {/if}
    </span>
  </header>
  <div
    class="tt-track relative h-1.5 w-full overflow-hidden rounded-full"
    role="meter"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={pct}
    aria-valuetext="{pct}% — {label}"
  >
    <span class="heat-ramp absolute inset-0" aria-hidden="true"></span>
    <span class="tt-mask absolute inset-y-0 right-0" style="width: {100 - pct}%" aria-hidden="true"></span>
  </div>
  {#if captionText}
    <p class="text-[11px] text-muted">{captionText}</p>
  {:else}
    <p class="text-[11px] text-muted">No activity yet — watch, rate, or pick to build it up.</p>
  {/if}
</section>

<style>
  .tt-track {
    background: var(--brand-surface-2);
  }
  /* Mask overlay — animates from right to left as the bar grows. The
     spring-y easing makes the live bump (when an action fires while the
     user's looking at the page) feel like a small reward rather than a
     plain CSS transition. */
  .tt-mask {
    background: var(--brand-surface-2);
    transition: width 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .tt-trend {
    display: inline-block;
    width: 1ch;
    text-align: center;
    font-weight: 600;
  }
  .tt-trend-up {
    color: var(--color-error);
  }
  .tt-trend-down {
    color: var(--color-muted);
  }
  /* Quietest of the three. `--brand-fg-disabled` rather than another alpha on
     top of `--color-muted` — muted is already a modifier, and stacking a
     second alpha lands outside the palette's sanctioned set. Safe to run this
     faint because the trend is carried by the glyph and the aria-label, not
     by the colour. */
  .tt-trend-flat {
    color: var(--brand-fg-disabled);
  }

  @media (prefers-reduced-motion: reduce) {
    .tt-mask {
      transition: width 120ms ease-out;
    }
  }
</style>
