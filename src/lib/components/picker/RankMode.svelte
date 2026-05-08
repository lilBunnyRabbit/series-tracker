<script lang="ts">
  // Either/Or — endless A vs B coin flips that aggregate into a personal
  // Top-N. Each pair-up applies picker-win/picker-loss temptation kicks
  // (consistent with the bracket) and increments rank counters on each
  // entry. Skip is a softer signal: no temptation kick, but a skip count
  // on both entries that suppresses the same pair from re-appearing
  // immediately.
  //
  // Ranking math: score = wins - losses (with skips ignored). Cheap, fully
  // additive, and intuitive: every commit is +1 for the winner, -1 for the
  // loser. Two entries with only one game played each won't dominate the
  // top of the list because we hide entries with fewer than RANK_FLOOR
  // total games from the leaderboard until they've earned enough samples.
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { tactile } from "$lib/tactile";
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import {
    defaultWeight,
    entryHref,
    entryKey,
    filterEntries,
    samplePair,
  } from "$lib/picker";
  import { pickerPrefs } from "$lib/pickerPrefs.svelte";
  import { currentTemptation } from "$lib/temptation";
  import type { Entry } from "$lib/types";
  import Filters from "./Filters.svelte";
  import MatchCard from "./MatchCard.svelte";
  import { backOut } from "svelte/easing";
  import { fade, fly, scale } from "svelte/transition";

  /** Minimum games (wins + losses) before an entry is eligible for the
   *  Top-10 leaderboard. Below the floor the entry shows up in the "Played"
   *  totals but doesn't take a leaderboard slot. */
  const RANK_FLOOR = 2;
  const TOP_N = 10;
  const PICK_DELAY_MS = 360;
  /** Cap on the recently-shown pair memory. Smaller than the bracket's
   *  exclusion ring because Either/Or is endless — over-strict exclusion
   *  starves the sampler in tight pools. */
  const RECENT_LIMIT = 4;

  type Phase = "setup" | "play";

  let phase = $state<Phase>("setup");
  let pair = $state<{ a: Entry; b: Entry } | null>(null);
  let pickedSide = $state<"a" | "b" | null>(null);
  let recent = $state<string[]>([]);
  let session = $state({ played: 0, skipped: 0 });

  const filtered = $derived(
    filterEntries(
      store.entries,
      pickerPrefs.selectedStatuses,
      pickerPrefs.kindFilter,
      pickerPrefs.progressFilter
    )
  );

  function rankWeight(e: Entry): number {
    let w = defaultWeight(e, store.preferences.temptationPacing);
    // Skipping nudges the entry's weight down so just-skipped titles surface
    // less often without being permanently buried.
    const skips = e.rankSkips ?? 0;
    if (skips > 0) w *= Math.max(0.5, 1 - skips * 0.05);
    return w;
  }

  function rollPair(): { a: Entry; b: Entry } | null {
    if (filtered.length < 2) return null;
    const exclude = new Set(recent);
    const sampled = samplePair(filtered, rankWeight, exclude);
    if (!sampled) {
      // Recent ring exhausted the pool — relax it.
      const fallback = samplePair(filtered, rankWeight);
      if (!fallback) return null;
      return { a: fallback[0], b: fallback[1] };
    }
    return { a: sampled[0], b: sampled[1] };
  }

  function pushRecent(p: { a: Entry; b: Entry }): void {
    const next = [entryKey(p.a), entryKey(p.b), ...recent].filter(
      (v, i, arr) => arr.indexOf(v) === i
    );
    recent = next.slice(0, RECENT_LIMIT);
  }

  function start(): void {
    if (filtered.length < 2) return;
    pair = rollPair();
    if (!pair) return;
    pushRecent(pair);
    pickedSide = null;
    phase = "play";
    vibrate("tick");
  }

  function pick(side: "a" | "b"): void {
    if (!pair || pickedSide) return;
    pickedSide = side;
    const win = side === "a" ? pair.a : pair.b;
    const lose = side === "a" ? pair.b : pair.a;
    store.recordRank(win.kind, win.id, lose.kind, lose.id);
    session.played += 1;
    vibrate("tick");
    setTimeout(() => {
      const next = rollPair();
      if (next) {
        pushRecent(next);
        pair = next;
        pickedSide = null;
      } else {
        // Filtered pool dried up — back to setup.
        phase = "setup";
        pair = null;
        pickedSide = null;
      }
    }, PICK_DELAY_MS);
  }

  function skip(): void {
    if (!pair || pickedSide) return;
    store.recordRankSkip(pair.a.kind, pair.a.id, pair.b.kind, pair.b.id);
    session.skipped += 1;
    const next = rollPair();
    if (next) {
      pushRecent(next);
      pair = next;
    } else {
      phase = "setup";
      pair = null;
    }
  }

  // Derived leaderboard: sort all library entries by (wins - losses) desc.
  // Tiebreak by total games played (more games = more confident ranking).
  // Hidden until RANK_FLOOR games so single-game entries don't game the list.
  const leaderboard = $derived.by(() => {
    const ranked: { entry: Entry; wins: number; losses: number; net: number }[] = [];
    for (const e of store.entries) {
      const wins = e.rankWins ?? 0;
      const losses = e.rankLosses ?? 0;
      const total = wins + losses;
      if (total < RANK_FLOOR) continue;
      ranked.push({ entry: e, wins, losses, net: wins - losses });
    }
    ranked.sort((a, b) => {
      if (b.net !== a.net) return b.net - a.net;
      return (b.wins + b.losses) - (a.wins + a.losses);
    });
    return ranked.slice(0, TOP_N);
  });

  const totalGames = $derived(
    store.entries.reduce((acc, e) => acc + (e.rankWins ?? 0) + (e.rankLosses ?? 0), 0)
  );

  function tempLabel(e: Entry): string {
    const t = currentTemptation(e, store.preferences.temptationPacing);
    return `${Math.round(t * 100)}%`;
  }

  function resetRanking(): void {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Reset the Either/Or leaderboard? This clears every entry's win/loss/skip counts. Temptation scores are not affected."
    );
    if (!ok) return;
    for (const e of store.entries) {
      delete e.rankWins;
      delete e.rankLosses;
      delete e.rankSkips;
    }
    session = { played: 0, skipped: 0 };
  }
</script>

{#snippet playActions()}
  <button
    type="button"
    use:tactile
    onclick={skip}
    disabled={pickedSide !== null}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover-border-accent disabled:opacity-40"
  >
    <Icon name="x" size={14} />
    <span>Skip pair</span>
  </button>
{/snippet}

<PageHeader
  title="Either / Or"
  subtitle="Pick by pick — your personal Top 10 emerges over time."
  actions={phase === "play" ? playActions : undefined}
  srOnly={phase !== "setup"}
/>

<section class="space-y-4">
  {#if phase === "setup"}
    <div in:fade={{ duration: 200 }} class="space-y-4">
      <p class="text-sm text-muted">
        Endless A-vs-B coin flips. Every pick adds ±1 to the running ranking —
        play long enough and your personal Top {TOP_N} emerges.
      </p>

      <Filters />

      <div class="rounded-lg border border-border bg-surface p-4 text-sm">
        {#if filtered.length < 2}
          <p class="text-muted">Need at least two candidates. Loosen the filters.</p>
        {:else}
          <p>
            <span class="font-medium tabular-nums">{filtered.length}</span>
            <span class="text-muted">candidate{filtered.length === 1 ? "" : "s"}</span>
            <span class="text-muted">·</span>
            <span class="tabular-nums">{totalGames}</span>
            <span class="text-muted">total games played</span>
          </p>
        {/if}
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          use:tactile
          onclick={start}
          disabled={filtered.length < 2}
          class="tap-target tap-target--btn flex grow items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="trending-up" size={16} />
          <span>{totalGames > 0 ? "Keep ranking" : "Start ranking"}</span>
        </button>
        {#if totalGames > 0}
          <button
            type="button"
            use:tactile
            onclick={resetRanking}
            class="tap-target tap-target--btn rounded-md border border-border px-3 py-3 text-xs text-muted hover-border-accent hover-text-text"
          >
            Reset
          </button>
        {/if}
      </div>

      {#if leaderboard.length > 0}
        <section class="space-y-3">
          <header class="flex items-baseline justify-between">
            <h2 class="text-xs font-medium uppercase tracking-[0.2em] text-accent">Your Top {leaderboard.length}</h2>
            <span class="text-[11px] text-muted/70">After {totalGames} games · score = wins − losses</span>
          </header>
          <ol class="space-y-1.5">
            {#each leaderboard as row, i (entryKey(row.entry))}
              {@const e = row.entry}
              <li
                in:fly={{ y: 8, duration: 240, easing: backOut, delay: i * 30 }}
              >
                <a
                  href={entryHref(e)}
                  use:tactile={{ haptic: false }}
                  class="tap-target group flex items-center gap-3 rounded-md border border-border/60 bg-surface p-2 transition-colors duration-150 hover-border-accent"
                >
                  <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 bg-surface-2 text-[11px] font-medium tabular-nums text-muted group-hover:text-text">
                    {i + 1}
                  </span>
                  <div class="h-12 w-8 shrink-0 overflow-hidden rounded-sm border border-border/60 bg-surface-2">
                    {#if e.poster}
                      <img src={e.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
                    {/if}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium leading-tight">{e.title}</div>
                    <div class="text-[11px] text-muted">
                      <span class="tabular-nums text-primary">{row.wins}</span>
                      <span class="text-muted">w</span>
                      <span aria-hidden="true">·</span>
                      <span class="tabular-nums">{row.losses}</span>
                      <span class="text-muted">l</span>
                      <span aria-hidden="true">·</span>
                      <span class="tabular-nums">temp {tempLabel(e)}</span>
                    </div>
                  </div>
                  <span class="shrink-0 text-base font-semibold tabular-nums {row.net > 0 ? 'text-primary' : (row.net < 0 ? 'text-muted' : 'text-text')}">
                    {row.net > 0 ? "+" : ""}{row.net}
                  </span>
                </a>
              </li>
            {/each}
          </ol>
        </section>
      {/if}
    </div>
  {:else if phase === "play" && pair}
    <div
      in:fade={{ duration: 160 }}
      class="flex min-h-[calc(100dvh-12rem)] flex-col sm:min-h-[64vh]"
    >
      <div class="grid flex-1 grid-rows-[1fr_auto_2fr] gap-4">
        <div class="self-start">
          <div class="flex items-center justify-between text-xs">
            <span class="uppercase tracking-[0.18em] text-accent">Either / Or</span>
            <span class="tabular-nums text-muted">
              {session.played} pick{session.played === 1 ? "" : "s"}
              {#if session.skipped > 0}
                <span aria-hidden="true">·</span>
                {session.skipped} skip{session.skipped === 1 ? "" : "s"}
              {/if}
            </span>
          </div>
        </div>

        <div>
          {#key `${pair.a.kind}:${pair.a.id}-${pair.b.kind}:${pair.b.id}`}
            <div
              class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4"
              in:fade={{ duration: 220, delay: 40 }}
            >
              <MatchCard
                entry={pair.a}
                side="a"
                locked={pickedSide !== null}
                isWinner={pickedSide === "a"}
                isLoser={pickedSide !== null && pickedSide !== "a"}
                onpick={() => pick("a")}
              />
              <span
                class="vs select-none text-center text-base font-bold tracking-widest text-muted"
                in:scale={{ start: 0.6, duration: 320, easing: backOut, delay: 60 }}
              >
                VS
              </span>
              <MatchCard
                entry={pair.b}
                side="b"
                locked={pickedSide !== null}
                isWinner={pickedSide === "b"}
                isLoser={pickedSide !== null && pickedSide !== "b"}
                onpick={() => pick("b")}
              />
            </div>
          {/key}
        </div>

        <div aria-hidden="true"></div>
      </div>

      <p class="pt-4 text-center text-xs text-muted">
        {pickedSide ? "Locked — next pair…" : "Pick one. Skip / Stop in the bottom rail."}
      </p>
    </div>
  {/if}
</section>

<style>
  .vs {
    text-shadow: 0 1px 0 rgb(var(--shadow-color) / var(--shadow-alpha-3));
  }
</style>
