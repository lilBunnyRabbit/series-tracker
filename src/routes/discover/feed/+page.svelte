<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import FeedCard from "$lib/components/FeedCard.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { discover, genreList, entryFromSearchResult } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import type { DiscoverSort, FeedSession, Genre, Status } from "$lib/types";
  import { untrack } from "svelte";

  type Kind = "tv" | "movie";

  const VALID_KIND = ["tv", "movie"] as const;
  const VALID_SORT: DiscoverSort[] = [
    "popularity.desc",
    "popularity.asc",
    "vote_average.desc",
    "vote_average.asc",
    "newest",
    "oldest",
    "title.asc",
    "title.desc",
  ];

  // ---- URL-derived state (mirrors /discover/browse so the feed view is shareable) ----

  const phase = $derived<"setup" | "feed">(
    page.url.searchParams.get("start") === "1" ? "feed" : "setup"
  );
  const kind = $derived.by<Kind>(() => {
    const v = page.url.searchParams.get("kind");
    return VALID_KIND.includes(v as Kind) ? (v as Kind) : "tv";
  });

  const sort = $derived.by<DiscoverSort>(() => {
    const v = page.url.searchParams.get("sort");
    return VALID_SORT.includes(v as DiscoverSort) ? (v as DiscoverSort) : "popularity.desc";
  });

  const genres = $derived.by<number[]>(() => {
    const raw = page.url.searchParams.get("g");
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
  });
  const selectedGenresSet = $derived(new Set(genres));

  const hideAdded = $derived(page.url.searchParams.get("hidden") === "1");

  // ---- Setup screen ----

  let availableGenres = $state<Genre[]>([]);

  // Genre list is fetched in both phases — the setup screen renders the chips
  // and the feed cards resolve TMDB genre_ids to names. TMDB caches the call
  // server-side for 24h and our client cache for 24h, so the network cost is
  // a single request per kind per day.
  $effect(() => {
    if (!store.apiKey) return;
    const ctrl = new AbortController();
    genreList(kind, store.apiKey, ctrl.signal)
      .then((g) => {
        if (!ctrl.signal.aborted) availableGenres = g.toSorted((a, b) => a.name.localeCompare(b.name));
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        console.error("[feed] genres failed", e);
      });
    return () => ctrl.abort();
  });

  const genreById = $derived(new Map(availableGenres.map((g) => [g.id, g.name] as const)));

  function updateParams(patch: Record<string, string | null>): void {
    const url = new URL(page.url);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function setKind(k: Kind): void {
    if (k === kind) return;
    // Genre IDs are kind-specific — clear when flipping so we don't carry
    // bogus IDs across (TV id 18 ≠ Movie id 18, etc.).
    updateParams({ kind: k, g: null });
  }

  function setSort(s: DiscoverSort): void {
    updateParams({ sort: s });
  }

  function toggleGenre(id: number): void {
    const next = new Set(genres);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateParams({ g: next.size ? [...next].sort((a, b) => a - b).join(",") : null });
  }

  function clearGenres(): void {
    updateParams({ g: null });
  }

  function toggleHideAdded(): void {
    updateParams({ hidden: hideAdded ? null : "1" });
  }

  function startFeed(): void {
    // "Start" is the user's explicit signal to begin fresh, even if a saved
    // session matches the current filters — wipe it so the auto-resume on
    // mount doesn't snap them back to where they left off last time.
    store.setFeedSession(null);
    // Push not replace — back button should bring the user back to setup
    // rather than to /discover/.
    const url = new URL(page.url);
    url.searchParams.set("start", "1");
    url.searchParams.delete("resume");
    void goto(url, { noScroll: true, keepFocus: true });
  }

  function resumeFromSaved(): void {
    const s = store.feedSession;
    if (!s) return;
    // Don't clear feedSession — auto-resume keys off it. Just rebuild the URL
    // with the saved filters so the data effect runs against the same query
    // space the lastSeenKey was captured in.
    const url = new URL(page.url);
    url.searchParams.set("kind", s.kind);
    url.searchParams.set("sort", s.sort);
    if (s.genres.length > 0) url.searchParams.set("g", s.genres.join(","));
    else url.searchParams.delete("g");
    if (s.hideAdded) url.searchParams.set("hidden", "1");
    else url.searchParams.delete("hidden");
    url.searchParams.set("start", "1");
    url.searchParams.delete("resume");
    void goto(url, { noScroll: true, keepFocus: true });
  }

  // Pretty summary of the saved session shown next to the Resume button so the
  // user knows what they're about to jump back into.
  function describeSession(s: FeedSession): string {
    const parts: string[] = [];
    parts.push(s.kind === "tv" ? "TV shows" : "Movies");
    parts.push(SORT_LABELS[s.sort] ?? s.sort);
    if (s.genres.length > 0) parts.push(`${s.genres.length} genre${s.genres.length === 1 ? "" : "s"}`);
    if (s.hideAdded) parts.push("hide added");
    return parts.join(" · ");
  }

  const SORT_LABELS: Record<DiscoverSort, string> = {
    "popularity.desc": "Popular",
    "popularity.asc": "Least popular",
    "vote_average.desc": "Top rated",
    "vote_average.asc": "Lowest rated",
    newest: "Newest",
    oldest: "Oldest",
    "title.asc": "A–Z",
    "title.desc": "Z–A",
  };

  // ---- Feed phase: data + scroller ----

  /** Pure equality check for whether a saved session was scrolling against the
   *  same query space we're entering now. Genres are normalised to a sorted
   *  array on save, so a positional compare is enough. */
  function feedSessionMatches(
    s: FeedSession | null,
    k: Kind,
    so: DiscoverSort,
    gs: number[],
    ha: boolean
  ): boolean {
    if (!s) return false;
    if (s.kind !== k || s.sort !== so || s.hideAdded !== ha) return false;
    if (s.genres.length !== gs.length) return false;
    for (let i = 0; i < gs.length; i++) {
      if (s.genres[i] !== gs[i]) return false;
    }
    return true;
  }

  // Captured snapshot of the resume target — read once when we enter feed
  // phase, IF the URL filters match the saved session. Auto-resume covers
  // both the explicit Resume button AND back-from-details navigation; the
  // Start button clears the session first, so a "fresh start" doesn't snap
  // back to the last-seen card.
  //
  // We avoid reading store.feedSession reactively here because the scroll
  // handler updates it on every visible item — that would otherwise make the
  // resume marker chase the user as they scroll.
  let resumeTargetKey = $state<string | null>(null);
  let captured = false;

  $effect(() => {
    const ph = phase;
    const k = kind;
    const so = sort;
    const ha = hideAdded;
    const gKey = genres.join(",");
    if (ph !== "feed") {
      captured = false;
      resumeTargetKey = null;
      return;
    }
    if (captured) return;
    if (!store.loaded) return;
    untrack(() => {
      const s = store.feedSession;
      const gs = gKey ? gKey.split(",").map(Number) : [];
      if (feedSessionMatches(s, k, so, gs, ha)) {
        resumeTargetKey = s!.lastSeenKey;
      } else {
        resumeTargetKey = null;
      }
      captured = true;
    });
  });

  let items = $state<RecommendationItem[]>([]);
  let nextPage = $state(1);
  let totalPages = $state(1);
  let loading = $state(false);
  let feedError = $state<string | null>(null);
  let scroller = $state<HTMLDivElement>();
  let currentIndex = $state(0);

  // Single AC for the whole feed session — aborted whenever filters change so
  // any in-flight TMDB request bails before its results race in late.
  let dataCtrl: AbortController | null = null;

  async function loadNext(): Promise<void> {
    if (loading) return;
    if (!store.apiKey) return;
    if (nextPage > 1 && nextPage > totalPages) return;
    const ctrl = dataCtrl;
    if (!ctrl) return;
    loading = true;
    feedError = null;
    try {
      const r = await discover(
        kind,
        store.apiKey,
        { sort, genres, page: nextPage, withPeople: [] },
        ctrl.signal
      );
      if (ctrl.signal.aborted) return;
      // Filter at fetch-time so items added later in this session stay visible
      // — we don't re-filter on render. This matches the "added items don't
      // disappear from the feed" requirement.
      const filtered = hideAdded
        ? r.results.filter((x) => !store.has(x.media_type as Kind, x.id))
        : r.results;
      items.push(...filtered);
      totalPages = Math.min(r.total_pages, 500);
      nextPage++;

      // If the page came back empty (every result was already in the library)
      // and there's still more to fetch, grab the next one so the user isn't
      // staring at an empty feed. Capped to a couple hops so a fully-added
      // library doesn't spin endlessly.
      if (filtered.length === 0 && nextPage <= totalPages && items.length < 6) {
        await loadNext();
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      feedError = e instanceof Error ? e.message : String(e);
    } finally {
      if (ctrl && !ctrl.signal.aborted) loading = false;
    }
  }

  async function runResume(): Promise<void> {
    if (!resumeTargetKey) return;
    let attempts = 0;
    while (attempts < 4) {
      const idx = items.findIndex((i) => `${i.media_type}:${i.id}` === resumeTargetKey);
      if (idx >= 0) {
        // Wait for the layout to settle before measuring clientHeight —
        // immediately after the await, the new items have been pushed into
        // state but may not have painted yet.
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        const s = scroller;
        if (s && s.clientHeight > 0) {
          s.scrollTo({ top: idx * s.clientHeight, behavior: "instant" as ScrollBehavior });
          currentIndex = idx;
        }
        return;
      }
      if (nextPage > totalPages) return;
      attempts++;
      await loadNext();
    }
  }

  // Reset and reload whenever the feed-phase filters change (or we re-enter
  // feed phase). Going back to setup tears the data down too.
  //
  // Reactive deps (phase, kind, sort, hideAdded, genres, store.apiKey) are
  // read at the top of the effect to register subscriptions;
  // the actual reset + load runs inside `untrack` so the writes to `items`,
  // `loading`, `nextPage`, etc. — and the reads of those same fields inside
  // loadNext's synchronous prefix — don't loop back into the effect's deps.
  $effect(() => {
    const ph = phase;
    const apiKey = store.apiKey;
    void kind;
    void sort;
    void hideAdded;
    // Use the joined string as the dep so we re-run on any change to the
    // selected genre set without iterating the array reactively elsewhere.
    void genres.join(",");

    untrack(() => {
      if (ph !== "feed") {
        if (dataCtrl) {
          dataCtrl.abort();
          dataCtrl = null;
        }
        items = [];
        nextPage = 1;
        totalPages = 1;
        currentIndex = 0;
        feedError = null;
        loading = false;
        return;
      }
      if (!apiKey) return;

      if (dataCtrl) dataCtrl.abort();
      dataCtrl = new AbortController();
      items = [];
      nextPage = 1;
      totalPages = 1;
      currentIndex = 0;
      feedError = null;
      loading = false;
      void (async () => {
        await loadNext();
        // runResume early-returns if resumeTargetKey is null, so calling it
        // unconditionally is safe and covers both back-from-details and the
        // explicit Resume click.
        await runResume();
      })();
    });
  });

  function onScroll(): void {
    const s = scroller;
    if (!s) return;
    const h = s.clientHeight;
    if (h <= 0) return;
    const idx = Math.round(s.scrollTop / h);
    if (idx === currentIndex) return;
    if (idx < 0 || idx >= items.length) return;
    currentIndex = idx;
    const item = items[idx];
    if (!item) return;
    // Persist the last-seen item for next-session resume. Filters are
    // snapshotted alongside so resume runs against the same query space.
    store.setFeedSession({
      kind,
      sort,
      genres: [...genres],
      hideAdded,
      lastSeenKey: `${item.media_type}:${item.id}`,
      updatedAt: new Date().toISOString(),
    });
    // Pre-fetch the next page well before the user reaches the end so the
    // scroll never stalls.
    if (idx >= items.length - 3) {
      void loadNext();
    }
  }

  // ---- Snappy snap (JS-driven) ----
  // CSS scroll-snap mandatory works as the fallback / static layout cue, but
  // browsers' native snap animation (especially iOS Safari's) feels sluggish.
  // We override it on touch + wheel: the user lifts → we run a 200 ms eased
  // scrollTop animation to the target card. Always exactly one card per
  // gesture, no half-stops.

  let touchStartY = 0;
  let touchStartScroll = 0;
  let touchActive = false;
  let wheelLockedUntil = 0;
  let scrollAnimId: number | null = null;

  function animateScrollTo(target: number, duration = 200): void {
    const s = scroller;
    if (!s) return;
    if (scrollAnimId !== null) {
      cancelAnimationFrame(scrollAnimId);
      scrollAnimId = null;
    }
    const start = s.scrollTop;
    const dist = target - start;
    if (Math.abs(dist) < 1) return;
    const startTime = performance.now();
    const tick = (t: number): void => {
      if (!scroller) return;
      const elapsed = t - startTime;
      const p = Math.min(elapsed / duration, 1);
      // ease-out quart — quick start, soft landing.
      const eased = 1 - Math.pow(1 - p, 4);
      scroller.scrollTop = start + dist * eased;
      if (p < 1) {
        scrollAnimId = requestAnimationFrame(tick);
      } else {
        scrollAnimId = null;
      }
    };
    scrollAnimId = requestAnimationFrame(tick);
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.pointerType !== "touch") return;
    const s = scroller;
    if (!s) return;
    touchActive = true;
    touchStartY = e.clientY;
    touchStartScroll = s.scrollTop;
  }

  function onPointerUp(e: PointerEvent): void {
    if (!touchActive) return;
    if (e.pointerType !== "touch") return;
    touchActive = false;
    const s = scroller;
    if (!s) return;
    const h = s.clientHeight;
    if (h <= 0) return;
    const dy = touchStartY - e.clientY;
    // Compute the index the user STARTED from so a partial mid-card swipe
    // still resolves to a clean ±1 step rather than landing the user where
    // their inertial scroll happened to stop.
    const startIdx = Math.round(touchStartScroll / h);
    let target = startIdx;
    if (Math.abs(dy) > 30) {
      target = startIdx + (dy > 0 ? 1 : -1);
    }
    target = Math.max(0, Math.min(items.length - 1, target));
    animateScrollTo(target * h);
  }

  function onPointerCancel(): void {
    touchActive = false;
  }

  // Wheel handler is attached imperatively in an effect so we can pass
  // `passive: false` and call preventDefault — Svelte's onwheel attaches
  // passive by default on some setups.
  $effect(() => {
    const s = scroller;
    if (!s) return;
    const handler = (e: WheelEvent): void => {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      const now = performance.now();
      if (now < wheelLockedUntil) return;
      wheelLockedUntil = now + 280;
      const h = s.clientHeight;
      if (h <= 0) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const target = Math.max(0, Math.min(items.length - 1, currentIndex + dir));
      animateScrollTo(target * h);
    };
    s.addEventListener("wheel", handler, { passive: false });
    return () => s.removeEventListener("wheel", handler);
  });

  async function handleAdd(item: RecommendationItem, status: Status): Promise<void> {
    if (!store.apiKey) throw new Error("API key not set");
    const entry = await entryFromSearchResult(item, store.apiKey, status);
    if (entry) store.addToLibrary(entry);
  }

  const savedSession = $derived<FeedSession | null>(store.feedSession ?? null);
  const isFreshlyLoaded = $derived(items.length > 0);
</script>

<svelte:head>
  <title>Feed · Series Tracker</title>
</svelte:head>

{#if phase === "setup"}
  {#snippet headerActions()}
    <a
      href="{base}/discover/"
      use:tactile={{ haptic: false }}
      class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover-border-primary"
    >
      <Icon name="arrow-left" size={12} />
      <span>Discover</span>
    </a>
  {/snippet}

  <PageHeader title="Feed" subtitle="Swipe through new shows and movies." actions={headerActions} />

  <section class="space-y-6">
    {#if savedSession}
      <button
        type="button"
        use:tactile
        onclick={resumeFromSaved}
        class="tap-target tap-target--card flex w-full items-center gap-3 rounded-lg border border-accent/60 bg-accent/10 p-4 text-left hover-border-accent"
      >
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent"
          aria-hidden="true"
        >
          <Icon name="rotate-ccw" size={18} />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-accent">Resume where you left off</span>
          <span class="mt-0.5 block truncate text-xs text-muted">{describeSession(savedSession)}</span>
        </span>
        <Icon name="chevron-right" size={16} class="text-muted" />
      </button>
    {/if}

    <div class="space-y-3">
      <div class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">Show me</div>
      <div class="flex gap-1 text-xs" role="tablist" aria-label="Media kind">
        {#each VALID_KIND as k (k)}
          <button
            type="button"
            role="tab"
            aria-selected={kind === k}
            use:tactile
            onclick={() => setKind(k)}
            class="tap-target tap-target--chip rounded-full border px-3 py-1.5 transition-colors duration-150 {kind === k
              ? 'border-primary bg-primary text-bg'
              : 'border-border text-muted hover-text-text'}"
          >
            {k === "tv" ? "TV shows" : "Movies"}
          </button>
        {/each}
      </div>
    </div>

    <div class="space-y-3">
      <label class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted" for="feed-sort">
        Sort
      </label>
      <select
        id="feed-sort"
        value={sort}
        onchange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as DiscoverSort)}
        class="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
      >
        {#each VALID_SORT as s (s)}
          <option value={s}>{SORT_LABELS[s]}</option>
        {/each}
      </select>
    </div>

    {#if availableGenres.length > 0}
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
          Genres
          {#if selectedGenresSet.size > 0}
            <button
              type="button"
              use:tactile={{ haptic: "warn" }}
              onclick={clearGenres}
              class="tap-target rounded px-1 text-muted hover-text-error"
            >
              Clear · {selectedGenresSet.size}
            </button>
          {/if}
        </div>
        <div class="flex flex-wrap gap-1.5 text-xs">
          {#each availableGenres as g (g.id)}
            {@const on = selectedGenresSet.has(g.id)}
            <button
              type="button"
              use:tactile
              onclick={() => toggleGenre(g.id)}
              aria-pressed={on}
              class="tap-target tap-target--chip rounded-full border px-3 py-1.5 transition-colors duration-150 {on
                ? 'border-primary bg-primary text-bg'
                : 'border-border text-muted hover-text-text'}"
            >
              {g.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div>
      <button
        type="button"
        use:tactile
        onclick={toggleHideAdded}
        aria-pressed={hideAdded}
        class="tap-target tap-target--btn flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-150 {hideAdded
          ? 'border-primary bg-primary/10'
          : 'border-border hover-border-primary'}"
      >
        <span
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded border {hideAdded
            ? 'border-primary bg-primary text-bg'
            : 'border-border'}"
          aria-hidden="true"
        >
          {#if hideAdded}<Icon name="check" size={14} />{/if}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium">Hide already added</span>
          <span class="mt-0.5 block text-xs text-muted">
            Skip titles already in your library when fetching pages.
          </span>
        </span>
      </button>
    </div>

    <button
      type="button"
      use:tactile={{ haptic: "success" }}
      onclick={startFeed}
      class="tap-target tap-target--btn flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-bg"
    >
      <Icon name="play" size={16} />
      Start feed
    </button>
  </section>
{:else}
  <!-- Feed phase. Body scroll is locked by the layout (`isFeedActive`); the
       scroller below owns vertical scroll with snap-to-card, and the floating
       nav is hidden so each card reaches the screen edge. -->
  <div class="feed-shell">
    {#if feedError}
      <div class="feed-error">
        <p class="text-sm text-error">{feedError}</p>
        <button
          type="button"
          use:tactile
          onclick={() => loadNext()}
          class="tap-target tap-target--btn mt-2 rounded-md border border-border px-3 py-1.5 text-xs"
        >
          Retry
        </button>
      </div>
    {/if}

    {#if !isFreshlyLoaded && loading}
      <div class="feed-loading">
        <Skeleton variant="results" count={2} />
      </div>
    {:else if !isFreshlyLoaded && !loading}
      <div class="feed-empty">
        <p class="text-sm text-muted">No results match these filters.</p>
        <a
          href="{base}/discover/feed/"
          use:tactile={{ haptic: false }}
          class="tap-target tap-target--btn mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover-border-primary"
        >
          <Icon name="arrow-left" size={12} />
          Adjust filters
        </a>
      </div>
    {:else}
      <div
        bind:this={scroller}
        class="feed-scroller"
        role="region"
        aria-label="Feed"
        onscroll={onScroll}
        onpointerdown={onPointerDown}
        onpointerup={onPointerUp}
        onpointercancel={onPointerCancel}
      >
        {#each items as item (item.media_type + ":" + item.id)}
          <FeedCard
            {item}
            {genreById}
            isLastViewed={resumeTargetKey === `${item.media_type}:${item.id}`}
            onAdd={handleAdd}
          />
        {/each}
        {#if loading}
          <div class="feed-tail">
            <span class="text-xs text-muted">Loading more…</span>
          </div>
        {:else if nextPage > totalPages && items.length > 0}
          <div class="feed-tail">
            <span class="text-xs text-muted">You've reached the end of the feed.</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* The shell takes whatever vertical space the locked layout gives it. */
  .feed-shell {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
  }

  .feed-scroller {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-snap-type: y mandatory;
    overscroll-behavior-y: contain;
    /* Hide scrollbar visuals so the cards read full-bleed. The track still
       takes pointer events for desktop wheel scrolling. */
    scrollbar-width: none;
  }
  .feed-scroller::-webkit-scrollbar {
    display: none;
  }

  .feed-tail {
    height: 6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    scroll-snap-align: end;
    background: var(--color-bg);
  }

  .feed-loading,
  .feed-empty,
  .feed-error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
  }
</style>
