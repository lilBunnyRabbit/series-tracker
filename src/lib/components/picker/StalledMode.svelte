<script lang="ts">
  // Stalled-pickup mode — opinionated about what it surfaces. Only TV/movie
  // entries with status=watching AND non-zero progress are eligible, and
  // among those the *coldest* (lowest current temptation) get the highest
  // weight. Filters from `pickerPrefs` still apply on top, so the user can
  // narrow to TV-only or hide a status, but the core "this is something you
  // started but stopped touching" intent is wired into the weighter.
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { tactile } from "$lib/tactile";
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import {
    entryHref,
    entryHint,
    entryMeta,
    entryYear,
    hasAired,
    passesKind,
    samplePool,
    stalledWeight,
  } from "$lib/picker";
  import { pickerPrefs } from "$lib/pickerPrefs.svelte";
  import { hasProgress } from "$lib/types";
  import { currentTemptation } from "$lib/temptation";
  import type { Entry } from "$lib/types";
  // Status filter doesn't apply here — mode hard-locks to "watching".
  import Filters from "./Filters.svelte";
  import Winner from "./Winner.svelte";
  import { backOut } from "svelte/easing";
  import { fade, fly, scale } from "svelte/transition";

  type Phase = "setup" | "spin" | "final";
  const SHORTLIST_LIMIT = 3;

  let phase = $state<Phase>("setup");
  let shortlist = $state<Entry[]>([]);
  let recent = $state<string[]>([]);
  let winner = $state<Entry | null>(null);

  // Mode-locked candidate pool: anything you're actively watching that has
  // some kind of in-progress signal. Kind filter still applies; aired filter
  // is a baseline. Status filter is intentionally bypassed — the whole point
  // of this mode is "what to come back to", which is always status=watching.
  const eligible = $derived(
    store.entries.filter((e) => {
      if (e.status !== "watching") return false;
      if (!hasProgress(e)) return false;
      if (!passesKind(e, pickerPrefs.kindFilter)) return false;
      if (!hasAired(e)) return false;
      return true;
    })
  );

  function weight(e: Entry): number {
    return stalledWeight(e, store.preferences.temptationPacing);
  }

  function rollShortlist(): Entry[] {
    if (eligible.length === 0) return [];
    const exclude = new Set(recent);
    const pool = eligible.length > exclude.size
      ? eligible.filter((e) => !exclude.has(`${e.kind}:${e.id}`))
      : eligible;
    return samplePool(pool, Math.min(SHORTLIST_LIMIT, pool.length), weight);
  }

  function pushRecent(es: Entry[]): void {
    const keys = es.map((e) => `${e.kind}:${e.id}`);
    const next = [...keys, ...recent.filter((k) => !keys.includes(k))];
    recent = next.slice(0, SHORTLIST_LIMIT * 2);
  }

  function start(): void {
    if (eligible.length === 0) return;
    shortlist = rollShortlist();
    pushRecent(shortlist);
    phase = "spin";
    vibrate("tick");
  }

  function reroll(): void {
    // "Different ones" rejects the entire visible shortlist — fire
    // picker-loss on each so Temptation reflects the user explicitly
    // passing on them. Matches the bracket's loser kick.
    for (const e of shortlist) {
      store.applyTemptation(e.kind, e.id, "picker-loss");
    }
    shortlist = rollShortlist();
    pushRecent(shortlist);
    vibrate("tick");
  }

  function commit(e: Entry): void {
    store.applyTemptation(e.kind, e.id, "picker-win");
    winner = e;
    vibrate("success");
    phase = "final";
  }

  function pickAgain(): void {
    winner = null;
    shortlist = [];
    recent = [];
    phase = "setup";
  }

  function tempLabel(e: Entry): string {
    const t = currentTemptation(e, store.preferences.temptationPacing);
    return `${Math.round(t * 100)}%`;
  }
</script>

{#snippet shortlistActions()}
  <button
    type="button"
    use:tactile
    onclick={reroll}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover-border-accent"
    aria-label="Show different shortlist"
  >
    <Icon name="rotate-ccw" size={14} />
    <span>Different ones</span>
  </button>
{/snippet}

<PageHeader
  title="Pick up where you left off"
  subtitle="Surfaces in-progress titles you haven't engaged with recently."
  actions={phase === "spin" ? shortlistActions : undefined}
  srOnly={phase !== "setup"}
/>

<section class="space-y-4">
  {#if phase === "setup"}
    <div in:fade={{ duration: 200 }} class="space-y-4">
      <p class="text-sm text-muted">
        Surfaces things you're already watching but haven't touched in a while —
        the coldest temptation scores rise to the top.
      </p>

      <Filters showStatus={false} showProgress={false} />

      <div class="rounded-lg border border-border bg-surface p-4 text-sm">
        {#if eligible.length === 0}
          <p class="text-muted">Nothing in progress matches the kind filter — try All.</p>
        {:else}
          <p>
            <span class="font-medium tabular-nums">{eligible.length}</span>
            <span class="text-muted">in-progress {pickerPrefs.kindFilter === "all" ? "title" : (pickerPrefs.kindFilter === "tv" ? "show" : "movie")}{eligible.length === 1 ? "" : "s"}</span>
            <span class="text-muted">·</span>
            <span class="text-muted">coldest weighted highest</span>
          </p>
        {/if}
      </div>

      <button
        type="button"
        use:tactile
        onclick={start}
        disabled={eligible.length === 0}
        class="tap-target tap-target--btn flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="play" size={16} />
        <span>Show me what I started</span>
      </button>
    </div>
  {:else if phase === "spin"}
    <div in:fade={{ duration: 160 }} class="space-y-5">
      <p class="text-center text-xs uppercase tracking-[0.2em] text-primary">Pick up where you left off</p>

      <div class="space-y-3">
        {#each shortlist as e, i (`${e.kind}:${e.id}`)}
          <button
            type="button"
            use:tactile={{ haptic: false }}
            onclick={() => commit(e)}
            in:fly={{ y: 12, duration: 320, easing: backOut, delay: 40 + i * 60 }}
            class="tap-target tap-target--card flex w-full gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors duration-150 hover-border-primary"
            aria-label="Pick {e.title}"
          >
            <div class="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border/60 bg-surface-2">
              {#if e.poster}
                <img src={e.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
              {/if}
            </div>
            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="font-medium leading-tight">{e.title}</div>
              <div class="flex items-center gap-1 text-[11px] text-muted">
                {#if entryYear(e)}<span class="tabular-nums">{entryYear(e)}</span><span aria-hidden="true">·</span>{/if}
                <span>{entryMeta(e)}</span>
              </div>
              {#if entryHint(e)}
                <div class="truncate text-[11px] tabular-nums text-text/70">{entryHint(e)}</div>
              {/if}
              <div class="text-[10px] uppercase tracking-wider text-muted">
                Temptation <span class="tabular-nums text-text">{tempLabel(e)}</span>
              </div>
            </div>
            <span class="shrink-0 self-center text-muted">
              <Icon name="chevron-right" size={16} />
            </span>
          </button>
        {/each}
      </div>

      <p class="text-center text-[11px] text-muted">
        Tap any to lock it in — or pull a new shortlist from the bottom rail.
      </p>
    </div>
  {:else if phase === "final" && winner}
    {@const w = winner}
    <Winner
      winner={w}
      eyebrow="Pick up where you left off"
      pickAgainLabel="Show another"
      onPickAgain={pickAgain}
    />
  {/if}
</section>
