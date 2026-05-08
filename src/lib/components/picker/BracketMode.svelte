<script lang="ts">
  // Bracket / mini-bracket flow. Same head-to-head elimination as the
  // original picker, lifted out so other modes can reuse the match card and
  // winner screen. `cap` controls pool size — 32 for the full bracket, 8 for
  // the mini variant.
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { tactile } from "$lib/tactile";
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import {
    POOL_CAP,
    defaultWeight,
    entryHref,
    filterEntries,
    samplePool,
  } from "$lib/picker";
  import { pickerPrefs } from "$lib/pickerPrefs.svelte";
  import type { Entry } from "$lib/types";
  import Filters from "./Filters.svelte";
  import MatchCard from "./MatchCard.svelte";
  import Winner from "./Winner.svelte";
  import { backOut } from "svelte/easing";
  import { fade, fly, scale } from "svelte/transition";

  type Props = {
    /** Hard cap on pool size. Full bracket is POOL_CAP (32); the mini variant
     *  passes 8. Pool is always clamped to filter length, too. */
    cap?: number;
    pageTitle?: string;
    pageSubtitle?: string;
    startLabel?: string;
    /** Final-screen eyebrow, e.g. "Tonight's pick" / "Top of the eight". */
    winnerEyebrow?: string;
  };
  let {
    cap = POOL_CAP,
    pageTitle = "Bracket",
    pageSubtitle = "Pair things head-to-head until one's left standing.",
    startLabel,
    winnerEyebrow = "Tonight's pick",
  }: Props = $props();

  type Phase = "setup" | "bracket" | "final";
  // Long enough that the win/loss CSS animation lands before we swap matches.
  const PICK_DELAY_MS = 360;

  let phase = $state<Phase>("setup");

  let queue = $state<Entry[]>([]);
  let advanced = $state<Entry[]>([]);
  let currentMatch = $state<{ a: Entry; b: Entry } | null>(null);
  let round = $state(1);
  let totalRounds = $state(1);
  let pickedSide = $state<"a" | "b" | null>(null);
  let picksMade = $state(0);
  let picksTotal = $state(0);

  type Match = { a: Entry; b: Entry; winnerSide: "a" | "b"; round: number };
  let bracketLog = $state<Match[]>([]);
  let showBracket = $state(false);

  let winner = $state<Entry | null>(null);

  const filtered = $derived(
    filterEntries(
      store.entries,
      pickerPrefs.selectedStatuses,
      pickerPrefs.kindFilter,
      pickerPrefs.progressFilter
    )
  );

  const matchKey = $derived(
    currentMatch ? `${currentMatch.a.kind}:${currentMatch.a.id}-${currentMatch.b.kind}:${currentMatch.b.id}` : "none"
  );
  const aliveCount = $derived(picksTotal + 1 - picksMade);
  const progressPct = $derived(picksTotal > 0 ? (picksMade / picksTotal) * 100 : 0);

  function start(): void {
    const pool = samplePool(filtered, cap, (e) =>
      defaultWeight(e, store.preferences.temptationPacing)
    );
    if (pool.length === 0) return;
    if (pool.length === 1) {
      winner = pool[0];
      phase = "final";
      vibrate("success");
      return;
    }
    queue = pool;
    advanced = [];
    round = 1;
    totalRounds = Math.ceil(Math.log2(pool.length));
    picksTotal = pool.length - 1;
    picksMade = 0;
    advance();
    phase = "bracket";
  }

  function advance(): void {
    if (queue.length === 0) {
      if (advanced.length === 1) {
        winner = advanced[0];
        currentMatch = null;
        phase = "final";
        vibrate("success");
        return;
      }
      queue = advanced;
      advanced = [];
      round += 1;
    }
    if (queue.length === 1) {
      // Bye — odd contender skips this round.
      advanced = [...advanced, queue[0]];
      queue = queue.slice(1);
      advance();
      return;
    }
    currentMatch = { a: queue[0], b: queue[1] };
    queue = queue.slice(2);
    pickedSide = null;
  }

  function pick(side: "a" | "b"): void {
    if (!currentMatch || pickedSide) return;
    pickedSide = side;
    picksMade += 1;
    bracketLog = [
      ...bracketLog,
      { a: currentMatch.a, b: currentMatch.b, winnerSide: side, round },
    ];
    const win = side === "a" ? currentMatch.a : currentMatch.b;
    const lose = side === "a" ? currentMatch.b : currentMatch.a;
    store.applyTemptation(win.kind, win.id, "picker-win");
    store.applyTemptation(lose.kind, lose.id, "picker-loss");
    vibrate("tick");
    setTimeout(() => {
      advanced = [...advanced, win];
      advance();
    }, PICK_DELAY_MS);
  }

  function pickAgain(): void {
    winner = null;
    queue = [];
    advanced = [];
    currentMatch = null;
    pickedSide = null;
    picksMade = 0;
    picksTotal = 0;
    bracketLog = [];
    showBracket = false;
    phase = "setup";
  }

  // Group log entries by round, ordered final → first round so the winner's
  // last match reads at the top.
  const bracketByRound = $derived.by<{ round: number; matches: Match[] }[]>(() => {
    const groups = new Map<number, Match[]>();
    for (const m of bracketLog) {
      const list = groups.get(m.round) ?? [];
      list.push(m);
      groups.set(m.round, list);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([r, matches]) => ({ round: r, matches }));
  });

  function roundLabel(r: number, total: number): string {
    if (r === total) return "Final";
    if (r === total - 1) return "Semifinal";
    if (r === total - 2) return "Quarterfinal";
    return `Round ${r}`;
  }

  const effectiveCap = $derived(Math.min(filtered.length, cap));
  const startBtnLabel = $derived(
    startLabel ?? (filtered.length === 1 ? "Reveal pick" : "Start bracket")
  );
</script>

<PageHeader title={pageTitle} subtitle={pageSubtitle} srOnly={phase !== "setup"} />

<section class="space-y-4">
  {#if phase === "setup"}
    <div in:fade={{ duration: 200 }} class="space-y-4">
      <Filters />

      <div class="rounded-lg border border-border bg-surface p-4 text-sm">
        {#if filtered.length === 0}
          <p class="text-muted">No items match. Pick a different status or type.</p>
        {:else if filtered.length === 1}
          <p class="text-muted">Only one match — that one wins by default.</p>
        {:else}
          <p>
            <span class="font-medium tabular-nums">{effectiveCap}</span>
            {#if filtered.length > cap}<span class="text-muted">of {filtered.length}</span>{/if}
            contenders
            <span class="text-muted">·</span>
            <span class="tabular-nums">{Math.ceil(Math.log2(effectiveCap))}</span>
            <span class="text-muted">rounds</span>
            <span class="text-muted">·</span>
            <span class="tabular-nums">{effectiveCap - 1}</span>
            <span class="text-muted">taps</span>
          </p>
        {/if}
      </div>

      <button
        type="button"
        use:tactile
        onclick={start}
        disabled={filtered.length === 0}
        class="tap-target tap-target--btn flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="trophy" size={16} />
        <span>{startBtnLabel}</span>
      </button>
    </div>
  {:else if phase === "bracket" && currentMatch}
    <div
      in:fade={{ duration: 160 }}
      class="bracket-phase flex min-h-[calc(100dvh-10rem)] flex-col sm:min-h-[68vh]"
    >
      <div class="grid flex-1 grid-rows-[1fr_auto_2fr] gap-4">
        <div class="self-start space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span class="text-muted">
              Round
              {#key round}
                <span
                  in:fly={{ y: 6, duration: 240, easing: backOut }}
                  class="inline-block tabular-nums font-medium text-text"
                >
                  {round}
                </span>
              {/key}
              of <span class="tabular-nums">{totalRounds}</span>
            </span>
            <span class="tabular-nums text-muted">
              {#key aliveCount}
                <span in:fly={{ y: -4, duration: 200, easing: backOut }} class="inline-block">
                  {aliveCount}
                </span>
              {/key}
              left
            </span>
          </div>

          <div class="round-progress" aria-hidden="true">
            <span style="width: {progressPct}%"></span>
          </div>
        </div>

        <div>
          {#key matchKey}
            {@const a = currentMatch.a}
            {@const b = currentMatch.b}
            <div
              class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4"
              in:fade={{ duration: 220, delay: 40 }}
            >
              <MatchCard
                entry={a}
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
                entry={b}
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
        {pickedSide ? "Locking in…" : "Tap one — winner advances"}
      </p>
    </div>
  {:else if phase === "final" && winner}
    {@const w = winner}
    <Winner
      winner={w}
      eyebrow={winnerEyebrow}
      onPickAgain={pickAgain}
      extraAction={bracketLog.length > 0
        ? {
            label: showBracket ? "Hide bracket" : "Show bracket",
            pressed: showBracket,
            onclick: () => (showBracket = !showBracket),
          }
        : null}
    />

    {#if showBracket && bracketLog.length > 0}
      <section
        in:fade={{ duration: 220 }}
        class="space-y-4 rounded-lg border border-border bg-surface p-4"
      >
        <header class="space-y-0.5 text-center">
          <h2 class="text-xs font-medium uppercase tracking-[0.2em] text-muted">Bracket</h2>
          <p class="text-[11px] text-muted/80">
            {bracketLog.length} match{bracketLog.length === 1 ? "" : "es"} · winner highlighted
          </p>
        </header>

        <div class="space-y-4">
          {#each bracketByRound as group (group.round)}
            <div class="space-y-2">
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">
                {roundLabel(group.round, totalRounds)}
              </h3>
              <div class="space-y-1.5">
                {#each group.matches as m, i (group.round + ":" + i)}
                  {@const aWins = m.winnerSide === "a"}
                  <div
                    class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border border-border/60 bg-surface-2 p-2"
                  >
                    {@render bracketSide(m.a, aWins)}
                    <span class="text-[10px] font-bold tracking-widest text-muted">VS</span>
                    {@render bracketSide(m.b, !aWins)}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</section>

{#snippet bracketSide(e: Entry, won: boolean)}
  <a
    href={entryHref(e)}
    use:tactile={{ haptic: false }}
    class="tap-target group flex min-w-0 items-center gap-2 rounded p-1 {won
      ? 'opacity-100'
      : 'opacity-50'}"
    aria-label="{won ? 'Winner: ' : 'Eliminated: '}{e.title}"
  >
    <div class="h-10 w-7 shrink-0 overflow-hidden rounded-sm border border-border/60 bg-surface">
      {#if e.poster}
        <img src={e.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
      {/if}
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-[11px] font-medium {won ? 'text-text' : 'text-muted line-through decoration-muted/40'}">
        {e.title}
      </div>
      <div class="text-[9px] uppercase tracking-wider text-muted/70">
        {won ? "Advanced" : "Eliminated"}
      </div>
    </div>
  </a>
{/snippet}

<style>
  .vs {
    text-shadow: 0 1px 0 rgb(0 0 0 / 0.4);
  }
  .round-progress {
    position: relative;
    height: 3px;
    border-radius: 9999px;
    background: color-mix(in oklab, var(--color-border) 60%, transparent);
    overflow: hidden;
  }
  .round-progress > span {
    display: block;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--color-primary),
      color-mix(in oklab, var(--color-primary) 60%, var(--color-accent))
    );
    transition: width 360ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @media (prefers-reduced-motion: reduce) {
    .round-progress > span {
      transition: none;
    }
  }
</style>
