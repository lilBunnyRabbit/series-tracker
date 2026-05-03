<script lang="ts">
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import Rail from "$lib/components/Rail.svelte";
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { posterUrl, recommendations } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import { effectiveSeasons, STATUS_COLOR, STATUS_LABEL, STATUSES } from "$lib/types";
  import type { Entry, Status } from "$lib/types";
  import { backOut } from "svelte/easing";
  import { fade, fly, scale } from "svelte/transition";

  type KindFilter = "all" | "tv" | "movie";
  type Phase = "setup" | "bracket" | "final";

  const POOL_CAP = 32;
  // Long enough that the win/loss CSS animation lands before we swap matches.
  const PICK_DELAY_MS = 360;

  let selectedStatuses = $state<Status[]>(["plan"]);
  let kindFilter = $state<KindFilter>("all");
  let phase = $state<Phase>("setup");

  let queue = $state<Entry[]>([]);
  let advanced = $state<Entry[]>([]);
  let currentMatch = $state<{ a: Entry; b: Entry } | null>(null);
  let round = $state(1);
  let totalRounds = $state(1);
  let pickedSide = $state<"a" | "b" | null>(null);
  // Track real picks (one per match) so the progress bar fills smoothly from
  // 0 → 100 across the whole bracket — round-based progress would cap before
  // 100% and feel stuck at the final round.
  let picksMade = $state(0);
  let picksTotal = $state(0);

  let winner = $state<Entry | null>(null);
  let recs = $state<RecommendationItem[]>([]);
  let recsLoading = $state(false);

  function toggleStatus(s: Status): void {
    const has = selectedStatuses.includes(s);
    if (has && selectedStatuses.length > 1) {
      selectedStatuses = selectedStatuses.filter((x) => x !== s);
    } else if (!has) {
      selectedStatuses = [...selectedStatuses, s];
    }
  }

  const filtered = $derived(
    store.entries.filter((e) => {
      if (!selectedStatuses.includes(e.status)) return false;
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      return true;
    })
  );

  const counts = $derived.by(() => {
    const c: Record<Status, number> = { watching: 0, completed: 0, plan: 0, dropped: 0, tuned: 0 };
    for (const e of store.entries) {
      if (kindFilter !== "all" && e.kind !== kindFilter) continue;
      c[e.status]++;
    }
    return c;
  });

  const matchKey = $derived(
    currentMatch ? `${currentMatch.a.kind}:${currentMatch.a.id}-${currentMatch.b.kind}:${currentMatch.b.id}` : "none"
  );
  // Alive contenders = total - eliminated. Driven off picksMade so the counter
  // ticks down the moment the user taps, not 360 ms later when the next match
  // loads — otherwise the "X left" number lags behind the visible elimination.
  const aliveCount = $derived(picksTotal + 1 - picksMade);
  const progressPct = $derived(picksTotal > 0 ? (picksMade / picksTotal) * 100 : 0);

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function start(): void {
    const pool = shuffle(filtered).slice(0, POOL_CAP);
    if (pool.length === 0) return;
    if (pool.length === 1) {
      winner = pool[0];
      phase = "final";
      vibrate("success");
      void loadRecs();
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
        void loadRecs();
        return;
      }
      // Next round.
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
    const win = side === "a" ? currentMatch.a : currentMatch.b;
    vibrate("tick");
    setTimeout(() => {
      advanced = [...advanced, win];
      advance();
    }, PICK_DELAY_MS);
  }

  async function loadRecs(): Promise<void> {
    if (!winner || !store.apiKey) return;
    recsLoading = true;
    try {
      const items = await recommendations(winner.kind, winner.id, store.apiKey);
      const lib = new Set(store.entries.map((e) => `${e.kind}:${e.id}`));
      recs = items.filter((r) => !lib.has(`${r.media_type}:${r.id}`)).slice(0, 16);
    } catch {
      recs = [];
    } finally {
      recsLoading = false;
    }
  }

  function pickAgain(): void {
    winner = null;
    recs = [];
    queue = [];
    advanced = [];
    currentMatch = null;
    pickedSide = null;
    picksMade = 0;
    picksTotal = 0;
    phase = "setup";
  }

  function entryYear(e: Entry): string | undefined {
    return e.year;
  }

  function entryMeta(e: Entry): string {
    if (e.kind === "tv") {
      const total = effectiveSeasons(e).reduce((a, s) => a + s.episodeCount, 0);
      return total ? `${total} ep` : "TV";
    }
    if (e.runtime) {
      const h = Math.floor(e.runtime / 60);
      const m = e.runtime % 60;
      if (h && m) return `${h}h ${m}m`;
      if (h) return `${h}h`;
      return `${m}m`;
    }
    return "Movie";
  }

  function entryHref(e: Entry): string {
    return e.kind === "tv" ? `${base}/show/${e.id}/` : `${base}/movie/${e.id}/`;
  }
</script>

{#if phase === "setup"}
  <PageHeader title="Pick something to watch" subtitle="Pair things head-to-head until one's left standing." />
{:else if phase === "final"}
  <PageHeader title="Picker" srOnly />
{/if}

<section class="space-y-4">
  {#if phase === "setup"}
    <div in:fade={{ duration: 200 }} class="space-y-4">

      <div class="space-y-2">
        <h2 class="text-xs font-medium uppercase tracking-wider text-muted">Status</h2>
        <div class="-mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:overflow-visible sm:pb-0">
          <div class="flex w-max gap-1.5 text-xs sm:w-auto sm:flex-wrap">
            {#each STATUSES as s (s)}
              {@const active = selectedStatuses.includes(s)}
              {@const c = STATUS_COLOR[s]}
              <button
                type="button"
                use:tactile
                onclick={() => toggleStatus(s)}
                aria-pressed={active}
                class="tap-target tap-target--chip flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors duration-150 {active
                  ? `${c.border} ${c.bg} text-bg`
                  : 'border-border text-muted hover-text-text'}"
              >
                <span class="h-1.5 w-1.5 rounded-full {active ? 'bg-bg' : c.dot}"></span>
                <span>{STATUS_LABEL[s]}</span>
                <span class="tabular-nums {active ? 'opacity-80' : 'opacity-60'}">{counts[s]}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <h2 class="text-xs font-medium uppercase tracking-wider text-muted">Type</h2>
        <div class="flex gap-1.5 text-xs">
          {#each [["all", "All"], ["tv", "TV"], ["movie", "Movies"]] as const as [k, label] (k)}
            <button
              type="button"
              use:tactile
              onclick={() => (kindFilter = k)}
              aria-pressed={kindFilter === k}
              class="tap-target tap-target--chip rounded-full border px-3 py-1.5 transition-colors duration-150 {kindFilter === k
                ? 'border-secondary bg-secondary text-bg'
                : 'border-border text-muted hover-text-text'}"
            >
              {label}
            </button>
          {/each}
        </div>
      </div>

      <div class="rounded-lg border border-border bg-surface p-4 text-sm">
        {#if filtered.length === 0}
          <p class="text-muted">No items match. Pick a different status or type.</p>
        {:else if filtered.length === 1}
          <p class="text-muted">Only one match — that one wins by default.</p>
        {:else}
          {@const cap = Math.min(filtered.length, POOL_CAP)}
          <p>
            <span class="font-medium tabular-nums">{cap}</span>
            {#if filtered.length > POOL_CAP}<span class="text-muted">of {filtered.length}</span>{/if}
            contenders
            <span class="text-muted">·</span>
            <span class="tabular-nums">{Math.ceil(Math.log2(cap))}</span>
            <span class="text-muted">rounds</span>
            <span class="text-muted">·</span>
            <span class="tabular-nums">{cap - 1}</span>
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
        <span>{filtered.length === 1 ? "Reveal pick" : "Start bracket"}</span>
      </button>
    </div>
  {:else if phase === "bracket" && currentMatch}
    <div
      in:fade={{ duration: 160 }}
      class="bracket-phase flex min-h-[calc(100dvh-10rem)] flex-col sm:min-h-[68vh]"
    >
      <!-- 1fr_auto_2fr grid takes all the available space and distributes
           the cards within it. Top row (1fr) holds meta + progress, middle
           (auto) holds the cards at their natural height, bottom (2fr) is an
           open spacer that puts the cards in the upper-middle reach zone. -->
      <div class="grid flex-1 grid-rows-[1fr_auto_2fr] gap-4">
        <!-- Row 1 (1fr): meta + progress pinned to the top of their row. -->
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

        <!-- Row 2 (auto): cards at their natural size. -->
        <div>
          {#key matchKey}
            {@const a = currentMatch.a}
            {@const b = currentMatch.b}
            <div
              class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4"
              in:fade={{ duration: 220, delay: 40 }}
            >
              {@render matchCard(a, "a")}
              <span
                class="vs select-none text-center text-base font-bold tracking-widest text-muted"
                in:scale={{ start: 0.6, duration: 320, easing: backOut, delay: 60 }}
              >
                VS
              </span>
              {@render matchCard(b, "b")}
            </div>
          {/key}
        </div>

        <!-- Row 3 (2fr): empty bottom spacer. The hint below sits as a
             page-level footer, not part of this distribution. -->
        <div aria-hidden="true"></div>
      </div>

      <!-- Footer hint — sticks to the bottom of the bracket area below the
           grid, so it reads like a fixed status line under the action. -->
      <p class="pt-4 text-center text-xs text-muted">
        {pickedSide ? "Locking in…" : "Tap one — winner advances"}
      </p>
    </div>
  {:else if phase === "final" && winner}
    {@const w = winner}
    <div in:fade={{ duration: 220 }} class="space-y-5">
      <header class="space-y-1 text-center">
        <div
          class="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-accent"
          in:fly={{ y: -8, duration: 320, easing: backOut, delay: 80 }}
        >
          <Icon name="trophy" size={14} />
          <span>Tonight's pick</span>
        </div>
        <h1
          class="text-2xl font-semibold leading-tight"
          in:fly={{ y: 12, duration: 360, easing: backOut, delay: 160 }}
        >
          {w.title}
        </h1>
        {#if entryYear(w)}
          <p
            class="text-sm text-muted"
            in:fly={{ y: 8, duration: 320, easing: backOut, delay: 240 }}
          >
            <span class="tabular-nums">{entryYear(w)}</span>
            <span aria-hidden="true">·</span>
            <span>{entryMeta(w)}</span>
          </p>
        {/if}
        {#if w.notes && w.notes.trim()}
          <p
            class="mx-auto max-w-prose text-sm italic text-muted/90"
            in:fly={{ y: 8, duration: 320, easing: backOut, delay: 320 }}
          >
            "{w.notes.trim()}"
          </p>
        {/if}
      </header>

      <a
        href={entryHref(w)}
        use:tactile={{ haptic: false }}
        class="tap-target tap-target--card mx-auto block w-[220px] sm:w-[260px]"
        aria-label="Open {w.title}"
        in:scale={{ start: 0.7, duration: 480, easing: backOut, delay: 80 }}
      >
        <div class="winner-poster relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-accent/40 bg-surface-2 shadow-2xl">
          {#if w.poster}
            <img src={w.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
          {/if}
          {#if typeof w.voteAverage === "number" && w.voteAverage > 0}
            <div class="absolute right-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-medium tabular-nums text-text backdrop-blur-sm">
              ★ {w.voteAverage.toFixed(1)}
            </div>
          {/if}
        </div>
      </a>

      <div
        class="flex flex-wrap items-center justify-center gap-2"
        in:fly={{ y: 12, duration: 320, easing: backOut, delay: 320 }}
      >
        <a
          href={entryHref(w)}
          use:tactile
          class="tap-target tap-target--btn rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
        >
          Open
        </a>
        <button
          type="button"
          use:tactile
          onclick={pickAgain}
          class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-primary"
        >
          Pick again
        </button>
      </div>

      {#if recsLoading}
        <p class="text-center text-xs text-muted">Finding more like this…</p>
      {:else if recs.length > 0}
        <div in:fade={{ duration: 240, delay: 200 }}>
          <Rail title="More like {w.title}" subtitle="From TMDB recommendations">
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
  {/if}
</section>

{#snippet matchCard(e: Entry, side: "a" | "b")}
  {@const c = STATUS_COLOR[e.status]}
  {@const isWinner = pickedSide === side}
  {@const isLoser = pickedSide !== null && pickedSide !== side}
  <button
    type="button"
    use:tactile={{ haptic: false }}
    onclick={() => pick(side)}
    disabled={pickedSide !== null}
    class="match-card group flex flex-col gap-2 rounded-lg border border-border/60 bg-surface p-2 text-left disabled:cursor-default {isWinner ? 'is-winner' : ''} {isLoser ? `is-loser is-loser-${side}` : ''}"
    aria-label="Pick {e.title}"
  >
    <div class="poster relative aspect-[2/3] w-full overflow-hidden rounded-md border border-border/60 bg-surface-2">
      {#if e.poster}
        <img src={e.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
      {/if}
      {#if typeof e.voteAverage === "number" && e.voteAverage > 0}
        <div class="absolute right-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-text backdrop-blur-sm">
          ★ {e.voteAverage.toFixed(1)}
        </div>
      {/if}
      <span
        class="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] backdrop-blur-sm"
        aria-hidden="true"
      >
        <span class="h-1.5 w-1.5 rounded-full {c.dot}"></span>
      </span>
      <span class="winner-glow" aria-hidden="true"></span>
    </div>
    <div class="min-w-0 px-1">
      <div class="line-clamp-2 text-sm font-medium leading-snug">{e.title}</div>
      <div class="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
        {#if entryYear(e)}<span class="tabular-nums">{entryYear(e)}</span>{/if}
        {#if entryYear(e)}<span aria-hidden="true">·</span>{/if}
        <span>{entryMeta(e)}</span>
      </div>
      {#if e.notes && e.notes.trim()}
        <!-- Surface the user's note here so the bracket pick has the context
             they wrote when adding the title (e.g. who recommended it, why
             they were saving it). Italic + line-clamp keeps it visually
             secondary to the metadata above. -->
        <p class="mt-1.5 line-clamp-2 text-[11px] italic leading-snug text-muted/90">"{e.notes.trim()}"</p>
      {/if}
    </div>
  </button>
{/snippet}

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
      0 4px 12px -4px rgb(0 0 0 / 0.5);
  }
  .match-card.is-winner .winner-glow {
    opacity: 1;
  }
  .match-card.is-loser {
    opacity: 0.18;
    transform: scale(0.86);
  }
  /* Loser slides slightly toward its winner partner — a's loser nudges right
     (toward b on the right), b's loser nudges left. Subtle "swept aside". */
  .match-card.is-loser-a {
    transform: scale(0.86) translateX(14px);
  }
  .match-card.is-loser-b {
    transform: scale(0.86) translateX(-14px);
  }

  /* Soft glow that blooms when a card wins. Sits inside the poster frame. */
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

  .vs {
    /* Slight chromatic feel — reads as a divider, not a label. */
    text-shadow: 0 1px 0 rgb(0 0 0 / 0.4);
  }

  /* Slim track that fills as rounds advance — gives the bracket a sense of
     forward motion without taking real estate. */
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

  /* Winner poster on the final screen — gentle floating glow loop. */
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
    .winner-poster::after {
      animation: none;
      opacity: 0.7;
    }
    .round-progress > span {
      transition: none;
    }
  }
</style>
