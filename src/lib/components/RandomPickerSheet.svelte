<script lang="ts">
  import { base } from "$app/paths";
  import { vibrate } from "$lib/haptics";
  import { portal } from "$lib/portal";
  import { store } from "$lib/store.svelte";
  import { swipeToDismiss, tactile } from "$lib/tactile";
  import { posterUrl } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";

  type Props = {
    open: boolean;
    onClose: () => void;
    /** TMDB items to mix into the pool — typically trending / popular from
     *  Discover. The picker also pulls "plan" status entries from the user's
     *  library so the result mixes saved-for-later with discoverable content. */
    discoverPool: RecommendationItem[];
  };

  let { open, onClose, discoverPool }: Props = $props();

  type KindFilter = "all" | "tv" | "movie";

  type PickerItem = {
    source: "library" | "discover";
    kind: "tv" | "movie";
    id: number;
    title: string;
    poster: string | null;
    year?: string;
    voteAverage?: number;
    overview?: string;
    /** User's library note — only ever set for library-sourced picks. Carried
     *  through so the result UI can surface "the reason you saved this" alongside
     *  the title, since that note is often the deciding factor when re-rolling. */
    notes?: string;
  };

  let dialog = $state<HTMLDialogElement>();
  let kind = $state<KindFilter>("all");
  // No-repeat memory for re-rolls within a single session. Reset when the sheet
  // closes. Keys are `${kind}:${id}`.
  let recent = $state<string[]>([]);
  let pick = $state<PickerItem | null>(null);
  let rolling = $state(false);
  // Drives the crossfade between picks: bumped on each new pick so the {#key}
  // block resets and the in: transition replays.
  let pickGen = $state(0);

  // Dialog mounts on demand (see `{#if open}`), so when `dialog` becomes set
  // the parent has just flipped open=true. Reset state, showModal, and roll.
  $effect(() => {
    if (!dialog || dialog.open) return;
    recent = [];
    pick = null;
    kind = "all";
    dialog.showModal();
    queueMicrotask(() => roll());
  });

  function libraryPlanItems(): PickerItem[] {
    return store.entries
      .filter((e) => e.status === "plan")
      .map<PickerItem>((e) => ({
        source: "library",
        kind: e.kind,
        id: e.id,
        title: e.title,
        poster: e.poster ?? null,
        year: e.year,
        voteAverage: e.voteAverage,
        notes: e.notes,
      }));
  }

  function discoverItems(): PickerItem[] {
    const lib = new Set(store.entries.map((e) => `${e.kind}:${e.id}`));
    return discoverPool
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .filter((r) => !lib.has(`${r.media_type}:${r.id}`))
      .map<PickerItem>((r) => {
        const isMovie = r.media_type === "movie";
        return {
          source: "discover",
          kind: r.media_type as "tv" | "movie",
          id: r.id,
          title: isMovie ? (r as { title: string }).title : (r as { name: string }).name,
          poster: posterUrl(r.poster_path, "w342"),
          year: isMovie
            ? (r as { release_date?: string }).release_date?.slice(0, 4)
            : (r as { first_air_date?: string }).first_air_date?.slice(0, 4),
          voteAverage: (r as { vote_average?: number }).vote_average,
          overview: (r as { overview?: string }).overview,
        };
      });
  }

  const pool = $derived.by<PickerItem[]>(() => {
    const all = [...libraryPlanItems(), ...discoverItems()];
    // Dedupe by kind:id; library wins.
    const seen = new Map<string, PickerItem>();
    for (const item of all) {
      const key = `${item.kind}:${item.id}`;
      if (!seen.has(key)) seen.set(key, item);
    }
    return [...seen.values()].filter((item) => kind === "all" || item.kind === kind);
  });

  function counts(): Record<KindFilter, number> {
    const all = [...libraryPlanItems(), ...discoverItems()];
    const seen = new Set<string>();
    let tv = 0;
    let movie = 0;
    for (const item of all) {
      const key = `${item.kind}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (item.kind === "tv") tv++;
      else movie++;
    }
    return { all: tv + movie, tv, movie };
  }

  function roll(): void {
    if (rolling) return;
    rolling = true;
    vibrate("tap");
    const candidates = pool.filter((p) => !recent.includes(`${p.kind}:${p.id}`));
    // If the no-repeat window swallowed all candidates, drop it and try again.
    const list = candidates.length > 0 ? candidates : pool;
    if (list.length === 0) {
      pick = null;
      rolling = false;
      return;
    }
    const next = list[Math.floor(Math.random() * list.length)];
    recent = [`${next.kind}:${next.id}`, ...recent].slice(0, 5);
    pick = next;
    pickGen += 1;
    // Quick reset of "rolling" so the spinner doesn't linger past the crossfade.
    setTimeout(() => (rolling = false), 220);
  }

  function setKind(k: KindFilter): void {
    if (kind === k) return;
    kind = k;
    // Re-pick when filter changes, but only if the current pick wouldn't match
    // the new filter. Otherwise keep showing what's there.
    if (pick && k !== "all" && pick.kind !== k) {
      roll();
    }
  }

  function close(): void {
    onClose();
  }

  function onBackdropClick(e: MouseEvent): void {
    if (e.target === dialog) close();
  }

  function pickHref(p: PickerItem): string {
    return p.kind === "tv" ? `${base}/show/${p.id}/` : `${base}/movie/${p.id}/`;
  }

  function watchIt(p: PickerItem): void {
    // Library plan-status → switch to watching. Discover items → just navigate;
    // the user can add from the title page.
    if (p.source === "library") {
      store.setStatus(p.kind, p.id, "watching");
      vibrate("success");
    }
    close();
    location.assign(pickHref(p));
  }

  const c = $derived(counts());
</script>

{#if open}
<dialog
  bind:this={dialog}
  use:portal
  onclick={onBackdropClick}
  onclose={close}
  class="picker-sheet w-[min(28rem,94vw)] max-w-[94vw] overflow-hidden border-border bg-surface p-0 text-text shadow-2xl"
>
  <div
    class="picker-sheet-drag sm:hidden"
    use:swipeToDismiss={{ target: dialog, onDismiss: close }}
    aria-hidden="true"
  >
    <span class="picker-sheet-handle"></span>
  </div>
  <div class="w-full p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:pb-5">
    <header class="mb-4 text-center">
      <p class="text-[10px] uppercase tracking-[0.2em] text-accent">Surprise</p>
      <h2 class="mt-0.5 text-lg font-semibold">Pick something for me</h2>
      <p class="mt-1 text-xs text-muted">
        Mixes your plan-list with what's trending — re-roll until something clicks.
      </p>
    </header>

    <!-- Kind chips -->
    <div class="mb-4 flex gap-1.5 text-xs">
      {#each [["all", "All"], ["tv", "TV"], ["movie", "Movies"]] as const as [k, label] (k)}
        <button
          type="button"
          use:tactile
          onclick={() => setKind(k)}
          aria-pressed={kind === k}
          class="tap-target tap-target--chip flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 transition-colors duration-150 {kind === k
            ? 'border-primary bg-primary text-bg'
            : 'border-border text-muted hover-text-text'}"
        >
          <span>{label}</span>
          <span class="tabular-nums {kind === k ? 'opacity-80' : 'opacity-60'}">{c[k]}</span>
        </button>
      {/each}
    </div>

    {#if pool.length === 0}
      <div class="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted">
        Nothing in the pool. Add plan-list items or wait for the discover feed to load.
      </div>
    {:else if pick}
      {#key pickGen}
        <div class="picker-result space-y-3">
          <a
            href={pickHref(pick)}
            use:tactile={{ haptic: false }}
            class="tap-target tap-target--card mx-auto block w-[180px] sm:w-[200px]"
            aria-label="Open {pick.title}"
          >
            <div class="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-accent/40 bg-surface-2 shadow-2xl">
              {#if pick.poster}
                <img src={pick.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
              {/if}
              {#if typeof pick.voteAverage === "number" && pick.voteAverage > 0}
                <div class="absolute right-2 top-2 rounded-md bg-overlay px-1.5 py-0.5 text-xs font-medium tabular-nums text-on-overlay backdrop-blur-sm">
                  ★ {pick.voteAverage.toFixed(1)}
                </div>
              {/if}
              <div class="absolute bottom-2 left-2 rounded-md bg-overlay px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-on-overlay backdrop-blur-sm">
                {pick.source === "library" ? "From your plan" : "Trending"}
              </div>
            </div>
          </a>
          <div class="text-center">
            <h3 class="text-base font-semibold leading-tight">{pick.title}</h3>
            <p class="mt-0.5 text-xs text-muted">
              {#if pick.year}<span class="tabular-nums">{pick.year}</span>{/if}
              {#if pick.year}<span aria-hidden="true"> · </span>{/if}
              <span class="uppercase tracking-wider">{pick.kind === "tv" ? "TV" : "Movie"}</span>
            </p>
            {#if pick.notes && pick.notes.trim()}
              <!-- User's saved note appears above the TMDB overview — it's
                   their own framing of why they saved the title and is the
                   most likely thing to break a re-roll tie. -->
              <p class="mt-2 line-clamp-3 text-xs italic text-muted">"{pick.notes.trim()}"</p>
            {/if}
            {#if pick.overview}
              <p class="mt-2 line-clamp-3 text-xs text-muted">{pick.overview}</p>
            {/if}
          </div>
        </div>
      {/key}
    {/if}

    <div class="mt-5 flex items-center gap-2">
      <button
        type="button"
        use:tactile={{ haptic: false }}
        onclick={close}
        class="tap-target tap-target--btn flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-muted hover-text-text"
      >
        Skip
      </button>
      <button
        type="button"
        use:tactile
        onclick={roll}
        disabled={pool.length <= 1 || rolling}
        class="tap-target tap-target--btn flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover-border-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        Re-roll
      </button>
      {#if pick}
        <button
          type="button"
          use:tactile={{ haptic: "success" }}
          onclick={() => watchIt(pick!)}
          class="tap-target tap-target--btn flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-bg"
        >
          Watch it
        </button>
      {/if}
    </div>
  </div>
</dialog>
{/if}

<style>
  .picker-sheet {
    margin: auto;
    border-radius: 1rem 1rem 0 0;
    border: 1px solid var(--color-border);
  }
  .picker-sheet[open] {
    animation: sheet-in 280ms var(--ease-spring);
  }
  .picker-sheet::backdrop {
    background: var(--color-backdrop);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }
  .picker-sheet[open]::backdrop {
    animation: backdrop-in 200ms ease-out;
  }

  @media (max-width: 639.98px) {
    .picker-sheet {
      margin: 0;
      max-width: 100%;
      width: 100%;
      max-height: 95vh;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: auto;
    }
  }

  @media (min-width: 640px) {
    .picker-sheet {
      border-radius: 0.75rem;
    }
    .picker-sheet[open] {
      animation: pop-in 180ms var(--ease-out);
    }
  }

  .picker-sheet-drag {
    padding: 0.625rem 0 0.5rem;
    display: block;
    touch-action: none;
    cursor: grab;
  }
  .picker-sheet-drag:active {
    cursor: grabbing;
  }
  .picker-sheet-handle {
    display: block;
    margin: 0 auto;
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 9999px;
    background: var(--color-border);
  }

  /* Re-roll crossfade — keyed on pickGen so each pick fades in fresh. */
  .picker-result {
    animation: pick-in 220ms ease-out;
  }
  @keyframes pick-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .picker-sheet[open],
    .picker-sheet[open]::backdrop,
    .picker-result {
      animation: none;
    }
  }
</style>
