<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { smartBack } from "$lib/back.svelte";
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

  const onBack = smartBack();

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

  const phase = $derived<"setup" | "feed">(page.url.searchParams.get("start") === "1" ? "feed" : "setup");
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
  function feedSessionMatches(s: FeedSession | null, k: Kind, so: DiscoverSort, gs: number[], ha: boolean): boolean {
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
  // How many TMDB pages the user had fetched when they left. Resume uses this
  // to load enough pages up front before searching for the key — otherwise a
  // deep-scrolled session can't be found in the first couple of pages and we
  // silently land them at scroll 0.
  let resumeTargetPages = $state(0);
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
      resumeTargetPages = 0;
      return;
    }
    if (captured) return;
    if (!store.loaded) return;
    untrack(() => {
      const s = store.feedSession;
      const gs = gKey ? gKey.split(",").map(Number) : [];
      if (feedSessionMatches(s, k, so, gs, ha)) {
        resumeTargetKey = s!.lastSeenKey;
        // Legacy sessions (saved before pagesLoaded was tracked) fall back to
        // 1, which combined with the safety cap below still tries hard enough
        // for shallow scrolls.
        resumeTargetPages = s!.lastSeenPagesLoaded ?? 1;
      } else {
        resumeTargetKey = null;
        resumeTargetPages = 0;
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

  // Cap on consecutive empty/dup-only pages we'll chew through inside one
  // loadNext call. TMDB sometimes returns near-identical results across adjacent
  // pages (popular titles drift between pages as scores update); without a cap
  // we'd spin, but giving up too early leaves the user stuck on the last card
  // with no further fetches. 5 covers realistic dup runs without hanging.
  const MAX_EMPTY_ATTEMPTS = 5;

  async function loadNext(): Promise<void> {
    if (loading) return;
    if (!store.apiKey) return;
    if (nextPage > 1 && nextPage > totalPages) return;
    const ctrl = dataCtrl;
    if (!ctrl) return;
    loading = true;
    feedError = null;
    try {
      // Build the dedup set once — TMDB discover can repeat items across
      // adjacent pages and we use `${media_type}:${id}` as the keyed-each key,
      // so duplicates would otherwise crash the render with each_key_duplicate.
      const seen = new Set(items.map((i) => `${i.media_type}:${i.id}`));
      let attempts = 0;
      // In-call loop so a page that produces zero NEW items (all dups, or all
      // already-in-library when hideAdded is on) automatically pulls the next
      // page in the same fetch cycle. Replaces the previous recursive
      // `loadNext()` call which was a no-op (it bailed on `if (loading) return`
      // because the outer call hadn't cleared `loading` yet).
      while (attempts < MAX_EMPTY_ATTEMPTS) {
        if (nextPage > 1 && nextPage > totalPages) break;
        const r = await discover(
          kind,
          store.apiKey,
          { sort, genres, page: nextPage, withPeople: [] },
          ctrl.signal
        );
        if (ctrl.signal.aborted) return;
        // Filter at fetch-time so items added later in this session stay
        // visible — we don't re-filter on render. This matches the "added
        // items don't disappear from the feed" requirement.
        const filtered = hideAdded
          ? r.results.filter((x) => !store.has(x.media_type as Kind, x.id))
          : r.results;
        const fresh = filtered.filter((x) => {
          const key = `${x.media_type}:${x.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        items.push(...fresh);
        totalPages = Math.min(r.total_pages, 500);
        nextPage++;
        if (fresh.length > 0) break;
        attempts++;
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
    // Hard ceiling so a stale session whose key has been filtered out of TMDB
    // results doesn't pull down all 500 pages before giving up. 30 pages
    // (~600 items) covers any realistic human scroll.
    const MAX_RESUME_PAGES = 30;
    const target = Math.min(Math.max(resumeTargetPages, 1), MAX_RESUME_PAGES);
    // First catch up to the page count the user had reached — the saved item
    // is guaranteed to be inside this range as long as TMDB pagination is
    // stable (cached for 5 min on our side, plus TMDB's own day-scale stability).
    while (nextPage <= target && nextPage <= totalPages) {
      const before = nextPage;
      await loadNext();
      // loadNext bails (aborted, error) without bumping nextPage — break to
      // avoid spinning.
      if (nextPage === before) break;
    }
    // Then keep paging only if the key still hasn't surfaced (e.g. ordering
    // drift between sessions pushed it just past `target`).
    while (nextPage <= MAX_RESUME_PAGES && nextPage <= totalPages) {
      const idx = items.findIndex((i) => `${i.media_type}:${i.id}` === resumeTargetKey);
      if (idx >= 0) break;
      const before = nextPage;
      await loadNext();
      if (nextPage === before) break;
    }
    const finalIdx = items.findIndex((i) => `${i.media_type}:${i.id}` === resumeTargetKey);
    if (finalIdx < 0) return;
    // Wait for the layout to settle before measuring clientHeight — items
    // were just pushed into state but may not have painted yet.
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const s = scroller;
    if (!s || s.clientHeight <= 0) return;
    s.scrollTo({ top: finalIdx * s.clientHeight, behavior: "instant" as ScrollBehavior });
    currentIndex = finalIdx;
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
    // `lastSeenPagesLoaded` is how many pages we'd fetched at this point —
    // resume re-fetches that many to guarantee the item is in scope, instead
    // of blindly trying the first few pages and giving up.
    store.setFeedSession({
      kind,
      sort,
      genres: [...genres],
      hideAdded,
      lastSeenKey: `${item.media_type}:${item.id}`,
      lastSeenPagesLoaded: Math.max(1, nextPage - 1),
      updatedAt: new Date().toISOString(),
    });
    // Pre-fetch the next page well before the user reaches the end so the
    // scroll never stalls.
    if (idx >= items.length - 3) {
      void loadNext();
    }
  }

  // ---- Snappy snap (JS-driven) ----
  // Native touch scroll handles the in-gesture follow. On release we INSTANTLY
  // jump scrollTop to the target card — no animation, just a hard cut. The
  // visible "swipe" is the user's own finger drag; the post-release transition
  // is a discrete page flip. Wheel events use the same instant snap with a
  // short cooldown so trackpad scrolls don't fire faster than one card per
  // gesture.
  const WHEEL_LOCK_MS = 160;
  // Px traveled before a swipe is treated as an intent to advance. Velocity
  // threshold below picks up confident flicks below this distance.
  const SWIPE_DISTANCE_PX = 22;
  // px/ms — ~"confident phone flick". Lower would advance on accidental slides.
  const SWIPE_VELOCITY_PX_MS = 0.35;

  let touchStartY = 0;
  let touchStartScroll = 0;
  let touchStartTime = 0;
  let touchActive = false;
  let wheelLockedUntil = 0;

  function snapTo(target: number): void {
    const s = scroller;
    if (!s) return;
    s.scrollTop = target;
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.pointerType !== "touch") return;
    const s = scroller;
    if (!s) return;
    touchActive = true;
    touchStartY = e.clientY;
    touchStartScroll = s.scrollTop;
    touchStartTime = performance.now();
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
    const dt = Math.max(1, performance.now() - touchStartTime);
    // px/ms; positive = swipe up. Used so a fast flick always advances even
    // when the finger barely moved — same feel as TikTok's gesture.
    const velocity = dy / dt;
    // Compute the index the user STARTED from so a partial mid-card swipe
    // still resolves to a clean ±1 step rather than landing the user where
    // their drag happened to stop.
    const startIdx = Math.round(touchStartScroll / h);
    let target = startIdx;
    if (Math.abs(dy) > SWIPE_DISTANCE_PX || Math.abs(velocity) > SWIPE_VELOCITY_PX_MS) {
      target = startIdx + (dy > 0 ? 1 : -1);
    }
    target = Math.max(0, Math.min(items.length - 1, target));
    snapTo(target * h);
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
      wheelLockedUntil = now + WHEEL_LOCK_MS;
      const h = s.clientHeight;
      if (h <= 0) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const target = Math.max(0, Math.min(items.length - 1, currentIndex + dir));
      snapTo(target * h);
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
      class="tap-target tap-target--btn hover-border-primary flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs"
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
        class="tap-target tap-target--card hover-border-accent flex w-full items-center gap-3 rounded-lg border border-accent/60 bg-accent/10 p-4 text-left"
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
      <div class="flex items-center gap-2 text-[10px] tracking-wider text-muted uppercase">Show me</div>
      <div class="flex gap-1 text-xs" role="tablist" aria-label="Media kind">
        {#each VALID_KIND as k (k)}
          <button
            type="button"
            role="tab"
            aria-selected={kind === k}
            use:tactile
            onclick={() => setKind(k)}
            class="tap-target tap-target--chip rounded-full border px-3 py-1.5 transition-colors duration-150 {kind ===
            k
              ? 'border-primary bg-primary text-bg'
              : 'hover-text-text border-border text-muted'}"
          >
            {k === "tv" ? "TV shows" : "Movies"}
          </button>
        {/each}
      </div>
    </div>

    <div class="space-y-3">
      <label class="flex items-center gap-2 text-[10px] tracking-wider text-muted uppercase" for="feed-sort">
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
        <div class="flex items-center gap-2 text-[10px] tracking-wider text-muted uppercase">
          Genres
          {#if selectedGenresSet.size > 0}
            <button
              type="button"
              use:tactile={{ haptic: "warn" }}
              onclick={clearGenres}
              class="tap-target hover-text-error rounded px-1 text-muted"
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
                : 'hover-text-text border-border text-muted'}"
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
          : 'hover-border-primary border-border'}"
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
       nav and top header are hidden so each card reaches the screen edge.
       Back lives inside each card's action rail so the viewport has nothing
       on top — TikTok-like. -->
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
          class="tap-target tap-target--btn hover-border-primary mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs"
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
            backHref="{base}/discover/feed/"
            {onBack}
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
