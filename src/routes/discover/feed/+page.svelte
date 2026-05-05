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
  import { flushSync, untrack } from "svelte";

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

  // Filters used by the active feed are snapshotted once on phase entry and
  // never re-read from the URL. The setup UI still drives URL state so users
  // can edit it freely; once Start is clicked the locals below are the
  // single source of truth for the in-flight fetch, the resume target, and
  // the persisted session record. This decouples the feed from any URL
  // flicker (popstate, late hydration, manual edits) that would otherwise
  // race against the saved session and silently break resume.
  let feedKind = $state<Kind>("tv");
  let feedSort = $state<DiscoverSort>("popularity.desc");
  let feedGenres = $state<number[]>([]);
  let feedHideAdded = $state(false);

  // Captured snapshot of the resume target — read once when we enter feed
  // phase, IF the saved session's filters match. Auto-resume covers both
  // back-from-details navigation AND the explicit Resume button; the Start
  // button clears the session first, so a "fresh start" doesn't snap back
  // to the last-seen card.
  let resumeTargetKey = $state<string | null>(null);
  // How many TMDB pages the user had fetched when they left. Resume uses
  // this to load enough pages up front before searching for the key —
  // otherwise a deep-scrolled session can't be found in the first couple of
  // pages and we silently land them at scroll 0.
  let resumeTargetPages = $state(0);
  // Monotonic floor for save: persist a new lastSeenKey ONLY when the user
  // has reached an idx STRICTLY greater than this floor. Initialised from
  // the saved session's lastSeenIndex on entry, then pinned to the resumed
  // position after a successful runResume. The invariant is "the saved
  // feedSession represents the deepest item ever reached" — without this,
  // a remount whose resume silently fails would let the next stray scroll
  // event (idx 0 from the initial mount, or a tiny user nudge) overwrite
  // genuine deep progress with a shallow position. -1 means no floor yet.
  let mountFloorIdx = $state(-1);
  // Keys the user has added to their library DURING this feed session.
  // Loadnext bypasses the hideAdded filter for these — without it, an
  // item the user adds then taps "Details" → back disappears on remount
  // (re-fetched, then immediately filtered out because it's now in
  // store.library). Persisted into feedSession.addedDuringSession so the
  // bypass survives the unmount.
  let addedKeys = $state<string[]>([]);
  let captured = false;

  let items = $state<RecommendationItem[]>([]);
  // Parallel to `items`: the TMDB page each item came from. We need this so
  // the save records the page the user is actually on (not just the deepest
  // page we'd fetched), and resume can jump straight to the right one.
  // Non-reactive — only read inside event handlers, never in templates.
  let itemPages: number[] = [];
  // First/last TMDB pages currently held in `items`. 0 = nothing loaded yet.
  // Scrolling forward pulls `lastLoadedPage + 1` and appends; scrolling
  // backward pulls `firstLoadedPage - 1` and prepends. This sparse-window
  // model means resume can jump straight to the saved page (one fetch)
  // instead of loading every preceding page just to find the marker.
  let firstLoadedPage = $state(0);
  let lastLoadedPage = $state(0);
  // Two different "totals" from TMDB. `totalPages` is what we can actually
  // paginate through — TMDB's discover endpoint 422s past page 500, so the
  // cap is what bounds loadNext. `totalResults` is the size of the matching
  // universe regardless of pagination — that's what the position counter
  // displays so users see the real feed size, not the artificial 10000 cap.
  let totalPages = $state(1);
  let totalResults = $state(0);
  let loading = $state(false);
  let feedError = $state<string | null>(null);
  let scroller = $state<HTMLDivElement>();
  let currentIndex = $state(0);

  // How many items either side of `currentIndex` are mounted as full
  // <FeedCard>s. Items outside this window render as empty placeholder divs
  // of the same snap-height so the scroll geometry is preserved without
  // building 600+ heavy components for a deep session.
  const RENDER_WINDOW = 2;

  // Flash-on-scroll position counter. Toggles to true when currentIndex
  // changes, then back to false ~1.5s later. CSS does the fade.
  let counterVisible = $state(false);
  let counterHideTimer: ReturnType<typeof setTimeout> | null = null;
  function flashCounter(): void {
    counterVisible = true;
    if (counterHideTimer !== null) clearTimeout(counterHideTimer);
    counterHideTimer = setTimeout(() => {
      counterVisible = false;
      counterHideTimer = null;
    }, 1500);
  }

  // Single AC for the whole feed session — aborted whenever filters change so
  // any in-flight TMDB request bails before its results race in late.
  let dataCtrl: AbortController | null = null;

  // Cap on consecutive empty/dup-only pages we'll chew through inside one
  // loadNext call. TMDB sometimes returns near-identical results across adjacent
  // pages (popular titles drift between pages as scores update); without a cap
  // we'd spin, but giving up too early leaves the user stuck on the last card
  // with no further fetches. 5 covers realistic dup runs without hanging.
  const MAX_EMPTY_ATTEMPTS = 5;

  /** Fetch a single TMDB page and place its items into `items` according to
   *  `position`. Caller is responsible for `loading` and the dup-skip retry
   *  loop — this just does one network round-trip and one mutation. Returns
   *  the count of fresh (post-filter, post-dedup) items added. */
  async function fetchPage(
    pageNum: number,
    position: "append" | "prepend" | "replace"
  ): Promise<number> {
    if (!store.apiKey) return 0;
    if (pageNum < 1) return 0;
    const ctrl = dataCtrl;
    if (!ctrl || ctrl.signal.aborted) return 0;
    try {
      const r = await discover(
        feedKind,
        store.apiKey,
        { sort: feedSort, genres: feedGenres, page: pageNum, withPeople: [] },
        ctrl.signal
      );
      if (ctrl.signal.aborted) return 0;
      totalPages = Math.min(r.total_pages, 500);
      totalResults = r.total_results;

      // Filter at fetch-time so items added later in this session stay
      // visible — we don't re-filter on render. Items the user added FROM
      // this feed (tracked in `addedKeys`) bypass the filter so a remount
      // doesn't make them vanish.
      const filtered = feedHideAdded
        ? r.results.filter((x) => {
            if (!store.has(x.media_type as Kind, x.id)) return true;
            return addedKeys.includes(`${x.media_type}:${x.id}`);
          })
        : r.results;

      // Dedup against currently-loaded items. `replace` blows away the list
      // so seen-set is empty there.
      const seen =
        position === "replace" ? new Set<string>() : new Set(items.map((i) => `${i.media_type}:${i.id}`));
      const fresh = filtered.filter((x) => {
        const key = `${x.media_type}:${x.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const pageTags = new Array<number>(fresh.length).fill(pageNum);
      if (position === "replace") {
        items = fresh;
        itemPages = pageTags;
        firstLoadedPage = pageNum;
        lastLoadedPage = pageNum;
      } else if (position === "append") {
        items.push(...fresh);
        itemPages.push(...pageTags);
        if (firstLoadedPage === 0) firstLoadedPage = pageNum;
        lastLoadedPage = pageNum;
      } else {
        // Prepend. Default behaviour: leave scrollTop and currentIndex
        // alone. The user reached the top of the loaded window and
        // triggered this fetch by scrolling backward — what they want is
        // to ENTER the freshly-prepended page, not be pinned to their
        // previous card. With `overflow-anchor: none` on the scroller the
        // browser keeps scrollTop at its current pixel value, which now
        // points at the new items at the front of the list, so the user
        // simply sees earlier content appear under their finger.
        //
        // Auto-prefetch (the one-shot loadPrev right after tryResumeScroll)
        // DOES need the opposite — pin the user to the saved card across
        // the prepend so resume doesn't shuffle them onto an earlier
        // page. That adjustment lives in the entry effect after awaiting
        // loadPrev, where it has the context to do it.
        if (fresh.length > 0) {
          const shift = fresh.length;
          // mountFloorIdx tracks an item by index; advance it in lockstep
          // so the saved-progress floor still points at the same card.
          if (mountFloorIdx >= 0) mountFloorIdx += shift;
          flushSync(() => {
            items = [...fresh, ...items];
            itemPages = [...pageTags, ...itemPages];
          });
        }
        firstLoadedPage = pageNum;
      }
      return fresh.length;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return 0;
      if (ctrl.signal.aborted) return 0;
      feedError = e instanceof Error ? e.message : String(e);
      return 0;
    }
  }

  async function loadNext(): Promise<void> {
    if (loading) return;
    if (!store.apiKey) return;
    if (lastLoadedPage > 0 && lastLoadedPage >= totalPages) return;
    const ctrl = dataCtrl;
    if (!ctrl || ctrl.signal.aborted) return;
    loading = true;
    feedError = null;
    try {
      // Empty/dup-only retry loop: TMDB sometimes returns near-identical
      // results on adjacent pages, and `hideAdded` can leave a page entirely
      // filtered out. Walk forward up to MAX_EMPTY_ATTEMPTS pages until we
      // get something fresh, so the user never lands on a stale stuck card.
      let attempts = 0;
      while (attempts < MAX_EMPTY_ATTEMPTS) {
        const target = lastLoadedPage + 1;
        if (lastLoadedPage > 0 && target > totalPages) break;
        if (ctrl.signal.aborted) break;
        const added = await fetchPage(target, "append");
        if (ctrl.signal.aborted) break;
        if (added > 0) break;
        attempts++;
      }
    } finally {
      if (!ctrl.signal.aborted) loading = false;
    }
  }

  async function loadPrev(): Promise<void> {
    if (loading) return;
    if (!store.apiKey) return;
    if (firstLoadedPage <= 1) return;
    const ctrl = dataCtrl;
    if (!ctrl || ctrl.signal.aborted) return;
    loading = true;
    feedError = null;
    try {
      let attempts = 0;
      while (attempts < MAX_EMPTY_ATTEMPTS) {
        const target = firstLoadedPage - 1;
        if (target < 1) break;
        if (ctrl.signal.aborted) break;
        const added = await fetchPage(target, "prepend");
        if (ctrl.signal.aborted) break;
        if (added > 0) break;
        attempts++;
      }
    } finally {
      if (!ctrl.signal.aborted) loading = false;
    }
  }

  /** First fetch on entering feed phase. Loads only the resume target page
   *  (or 1 for a fresh session) — no walking through every preceding page.
   *  If that page came back empty after filtering, fall back to page 1 so
   *  a stale session can't strand the user on an empty feed. */
  async function loadInitial(targetPage: number): Promise<void> {
    if (loading) return;
    if (!store.apiKey) return;
    const ctrl = dataCtrl;
    if (!ctrl || ctrl.signal.aborted) return;
    loading = true;
    feedError = null;
    try {
      const startPage = Math.max(1, targetPage);
      const added = await fetchPage(startPage, "replace");
      if (ctrl.signal.aborted) return;
      // Saved page is no longer producing results (TMDB drift, total_pages
      // shrunk, or all items now filtered). Restart cleanly at page 1.
      if (added === 0 && startPage > 1) {
        await fetchPage(1, "replace");
      }
    } finally {
      if (!ctrl.signal.aborted) loading = false;
    }
  }

  async function tryResumeScroll(ctrl: AbortController): Promise<void> {
    if (!resumeTargetKey) return;
    if (ctrl.signal.aborted) return;
    const idx = items.findIndex((i) => `${i.media_type}:${i.id}` === resumeTargetKey);
    if (idx < 0) return;
    // Wait for layout to settle before measuring clientHeight. On first
    // mount the scroll-locked layout may not have sized the flex chain in
    // the same flush as our items assignment, so clientHeight reads as 0.
    // The RAF loop covers up to ~8 frames of slow paint without silently
    // dropping the user back at idx 0.
    let h = 0;
    let s: HTMLDivElement | undefined = scroller;
    if (s && s.clientHeight > 0) {
      h = s.clientHeight;
    } else {
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (ctrl.signal.aborted) return;
        s = scroller;
        if (s && s.clientHeight > 0) {
          h = s.clientHeight;
          break;
        }
      }
    }
    if (!s || h <= 0) return;
    // Update window state synchronously with the scroll. Without flushSync,
    // there'd be a frame where currentIndex points at the resumed item but
    // the render still has the window centred at 0 — the user would briefly
    // see a placeholder where the card belongs.
    flushSync(() => {
      currentIndex = idx;
      mountFloorIdx = idx;
    });
    s.scrollTo({ top: idx * h, behavior: "instant" as ScrollBehavior });
  }

  // Reset and reload whenever we enter feed phase. Filters are snapshotted
  // into local state on entry so URL flicker mid-flight can't desync the
  // fetch from the saved session — once captured, the data effect ignores
  // URL changes (the user has to go back to setup, which exits feed phase
  // and resets `captured`, to change filters).
  //
  // Reactive deps (phase, URL filters, store.apiKey, store.loaded) are read
  // at the top of the effect to register subscriptions; the actual reset
  // and load run inside `untrack` so writes to `items`, `loading`, etc.
  // — and the reads of those same fields inside loadNext — don't loop back.
  $effect(() => {
    const ph = phase;
    const apiKey = store.apiKey;
    const loaded = store.loaded;
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
        captured = false;
        resumeTargetKey = null;
        resumeTargetPages = 0;
        mountFloorIdx = -1;
        addedKeys = [];
        items = [];
        itemPages = [];
        firstLoadedPage = 0;
        lastLoadedPage = 0;
        totalPages = 1;
        totalResults = 0;
        currentIndex = 0;
        feedError = null;
        loading = false;
        return;
      }
      if (captured) return;
      if (!loaded) return;
      if (!apiKey) return;

      // Snapshot URL filters → feed-phase locals. From this point on the
      // feed runs against these values, regardless of what the URL does.
      feedKind = kind;
      feedSort = sort;
      feedGenres = [...genres];
      feedHideAdded = hideAdded;

      // Resolve the resume target from feedSession.
      const s = store.feedSession;
      if (feedSessionMatches(s, feedKind, feedSort, feedGenres, feedHideAdded)) {
        resumeTargetKey = s!.lastSeenKey;
        // `lastSeenPage` is the page actually containing the saved item
        // (new field). Legacy sessions only have `lastSeenPagesLoaded`,
        // which was the deepest page reached at save time — usually NOT
        // where the saved item lives, so we estimate the page from the
        // index instead. Math.floor(idx / 20) + 1 is exact for unfiltered
        // sessions (TMDB pages are 20 items) and slightly underestimates
        // when `hideAdded` was on; tryResumeScroll silently no-ops if the
        // key isn't on the chosen page, so an off-by-one falls through
        // to "land at top of fetched page" rather than crashing.
        const legacyIdx = s!.lastSeenIndex ?? 0;
        resumeTargetPages =
          s!.lastSeenPage ?? Math.max(1, Math.floor(legacyIdx / 20) + 1);
        // Initialise the floor from the saved index. Legacy sessions with
        // no index get 0 — tryResumeScroll's post-scroll bump will then
        // pin the floor to the actual resumed idx, restoring the regression
        // protection. While the resume is in flight the saved item itself
        // is still protected: the only items above the floor (= 0) in the
        // typical flow are loaded but not scrolled to.
        mountFloorIdx = legacyIdx;
        // Keys added during the previous mount of this session — the
        // hideAdded filter bypasses these so re-fetch produces the same
        // items list and resume can find its target.
        addedKeys = [...(s!.addedDuringSession ?? [])];
      } else {
        resumeTargetKey = null;
        resumeTargetPages = 0;
        mountFloorIdx = -1;
        addedKeys = [];
      }
      captured = true;

      if (dataCtrl) dataCtrl.abort();
      dataCtrl = new AbortController();
      items = [];
      itemPages = [];
      firstLoadedPage = 0;
      lastLoadedPage = 0;
      totalPages = 1;
      totalResults = 0;
      currentIndex = 0;
      feedError = null;
      loading = false;

      const ctrl = dataCtrl;
      void (async () => {
        // Resume target = the saved page directly. No paging through 1..N
        // just to find a marker; if the saved page is now stale, loadInitial
        // falls back to page 1 internally.
        await loadInitial(resumeTargetKey ? resumeTargetPages || 1 : 1);
        if (!ctrl.signal.aborted) await tryResumeScroll(ctrl);
        // Resumed mid-feed (firstLoadedPage > 1)? The user can't scroll up
        // until earlier items are loaded — and if their saved card was at
        // idx 0 of the fetched page they can't even nudge to trigger the
        // in-scroll prev-prefetch. Pull the previous page in proactively
        // so the upward swipe just works. Unlike user-triggered loadPrev,
        // this one happens while the user sits on the saved card, so we
        // have to pin them there across the prepend — otherwise the
        // browser would keep scrollTop at the old (smaller) pixel value
        // and the user would suddenly be looking at page X-1 item K
        // instead of their saved page-X item.
        if (!ctrl.signal.aborted && firstLoadedPage > 1) {
          const before = items.length;
          await loadPrev();
          if (ctrl.signal.aborted) return;
          const shift = items.length - before;
          const s = scroller;
          const h = s ? s.clientHeight : 0;
          if (shift > 0 && s && h > 0) {
            currentIndex += shift;
            s.scrollTop = currentIndex * h;
          }
        }
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
    flashCounter();
    // Pre-fetch the next page well before the user reaches the end so the
    // scroll never stalls. This is independent of save gating below — we
    // want fetches to keep flowing even on shallow scrolls.
    if (idx >= items.length - 3) {
      void loadNext();
    }
    // Mirror prefetch in the other direction. When the user resumed mid-feed
    // (firstLoadedPage > 1), scrolling toward the top should pull the
    // previous TMDB page in so they can keep going backward without hitting
    // a wall. loadPrev handles the scroll-position adjustment for the
    // prepended items so the user stays on the card they were viewing.
    if (idx <= 2 && firstLoadedPage > 1) {
      void loadPrev();
    }
    // Monotonic save: persist a new lastSeenKey ONLY when we've reached a
    // strictly NEW high water mark. Without this gate, any scroll event
    // fired before the resume could land (initial mount, layout reflow,
    // user nudging a card after a silent resume failure) would overwrite
    // genuine deep progress with a shallow position. The user's invariant:
    // "track last max one — never replace 'left off' with an earlier item".
    if (idx <= mountFloorIdx) return;
    mountFloorIdx = idx;
    const item = items[idx];
    if (!item) return;
    // Filters come from the feed-phase snapshot, not the URL — so the
    // saved session's filters always match the data the user was scrolling
    // through, regardless of what the URL says when the save fires.
    // `lastSeenPagesLoaded` is how many pages we'd fetched at this point;
    // resume re-fetches that many to guarantee the item is in scope.
    store.setFeedSession({
      kind: feedKind,
      sort: feedSort,
      genres: [...feedGenres],
      hideAdded: feedHideAdded,
      lastSeenKey: `${item.media_type}:${item.id}`,
      lastSeenIndex: idx,
      // The actual TMDB page containing this item — NOT the deepest page
      // we've fetched. Saving the deepest page would mislead resume into
      // loading a page that doesn't contain the saved item (e.g. user
      // scrolled to page 25, then back to item 200 on page 11, then quit;
      // resume would load page 25 and never find the marker).
      lastSeenPage: itemPages[idx] ?? lastLoadedPage,
      // Preserve the session-added bypass list so a scroll save doesn't
      // wipe it out from under handleAdd.
      addedDuringSession: addedKeys.length > 0 ? [...addedKeys] : undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  // ---- Snappy snap (JS-driven) ----
  // Native touch scroll handles the in-gesture follow. On release we INSTANTLY
  // jump scrollTop to the target card — no animation, just a hard cut. The
  // visible "swipe" is the user's own finger drag; the post-release transition
  // is a discrete page flip. Wheel events use the same instant snap with a
  // short cooldown so trackpad scrolls don't fire faster than one card per
  // gesture.
  //
  // Thresholds are tuned aggressively so the feed reads as "page flip" rather
  // than "scroll": small flicks advance, low velocity counts as intent.
  // Combined with `-webkit-overflow-scrolling: auto` on the scroller (kills
  // iOS momentum) and `scroll-snap-stop: always` (one card per gesture), the
  // gesture-to-commit window is as tight as native scroll allows.
  const WHEEL_LOCK_MS = 100;
  // Px traveled before a swipe is treated as an intent to advance. Velocity
  // threshold below picks up confident flicks below this distance.
  const SWIPE_DISTANCE_PX = 14;
  // px/ms — even a casual finger flick clears this. We want intent over
  // accident, but we want intent to commit easily.
  const SWIPE_VELOCITY_PX_MS = 0.22;

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
    if (!entry) return;
    store.addToLibrary(entry);
    // When hideAdded is on, the item would be filtered out of any subsequent
    // fetch (incl. the one that runs after a remount when the user taps
    // Details → back). Track the key so loadNext bypasses the filter for it,
    // and patch feedSession so the bypass survives the unmount. This is the
    // ONLY save that doesn't go through onScroll's monotonic gate — adds are
    // a content event, not a position event, and shouldn't move the floor.
    if (!feedHideAdded) return;
    const key = `${item.media_type}:${item.id}`;
    if (addedKeys.includes(key)) return;
    addedKeys.push(key);
    const cur = store.feedSession;
    const idx = currentIndex;
    const at = items[idx];
    const anchorKey = at ? `${at.media_type}:${at.id}` : key;
    // Patch an existing session record to keep its lastSeen* untouched (so
    // the resume target doesn't drift just because the user added without
    // scrolling). If no session exists yet — user added before the first
    // scroll fired a save — anchor it at the current card so a remount can
    // still resolve addedKeys via feedSessionMatches.
    store.setFeedSession({
      kind: feedKind,
      sort: feedSort,
      genres: [...feedGenres],
      hideAdded: feedHideAdded,
      lastSeenKey: cur?.lastSeenKey ?? anchorKey,
      lastSeenIndex: cur?.lastSeenIndex ?? idx,
      // Match onScroll: store the page of the actual saved item, not the
      // deepest page. Falls back to the current item's page if we don't
      // have a `cur` to preserve (i.e. add fired before any scroll).
      lastSeenPage: cur?.lastSeenPage ?? itemPages[idx] ?? lastLoadedPage,
      addedDuringSession: [...addedKeys],
      updatedAt: new Date().toISOString(),
    });
  }

  const savedSession = $derived<FeedSession | null>(store.feedSession ?? null);
  const isFreshlyLoaded = $derived(items.length > 0);

  // Position counter ("3142 / 11921") in absolute-feed terms, not relative to
  // whatever sparse window we currently have loaded. Using `currentIndex /
  // items.length` would jump from "201 / 482" before resume to "1 / 20"
  // after, which misrepresents how far into the feed the user actually is.
  // Numerator is computed from TMDB's nominal 20-items-per-page (exact for
  // unfiltered sessions, off by the per-page filter count when `hideAdded`
  // is on); denominator is `total_results` straight from TMDB so it matches
  // what the API says is in the matching universe. Note: TMDB's discover
  // pagination caps at page 500, so the user can only realistically reach
  // ~10000 items — but we display the full universe size since that's
  // what the user expects (they don't think about API quirks).
  const TMDB_PAGE_SIZE = 20;
  const counterText = $derived.by(() => {
    if (items.length === 0) return "";
    const page = itemPages[currentIndex];
    // No page tag (shouldn't happen post-load) or out-of-bounds: fall back
    // to the relative counter so we still show *something* truthy.
    if (!page || currentIndex < 0 || currentIndex >= items.length) {
      return `${currentIndex + 1} / ${items.length}`;
    }
    // Walk back through itemPages to find where this page started in the
    // loaded list — gives us the user's index within their current TMDB
    // page (0..19), which combines with page number for the absolute idx.
    let pageStart = currentIndex;
    while (pageStart > 0 && itemPages[pageStart - 1] === page) pageStart--;
    const positionInPage = currentIndex - pageStart;
    const numerator = (page - 1) * TMDB_PAGE_SIZE + positionInPage + 1;
    if (totalResults <= 0) return `${numerator}`;
    return `${numerator} / ${totalResults}`;
  });
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
        {#each items as item, index (item.media_type + ":" + item.id)}
          {#if Math.abs(index - currentIndex) <= RENDER_WINDOW}
            <FeedCard
              {item}
              {genreById}
              isLastViewed={resumeTargetKey === `${item.media_type}:${item.id}`}
              onAdd={handleAdd}
              backHref="{base}/discover/feed/"
              {onBack}
            />
          {:else}
            <!-- Off-window slot. Same height + snap rules as a real card so
                 the scroll geometry is identical, but no images, no event
                 handlers, no children — keeps the DOM small even at 600+
                 items in a deep session. -->
            <div class="feed-item-placeholder" aria-hidden="true"></div>
          {/if}
        {/each}
        {#if loading}
          <div class="feed-tail">
            <span class="text-xs text-muted">Loading more…</span>
          </div>
        {:else if lastLoadedPage >= totalPages && lastLoadedPage > 0 && items.length > 0}
          <div class="feed-tail">
            <span class="text-xs text-muted">You've reached the end of the feed.</span>
          </div>
        {/if}
      </div>

      <!-- Position counter — flashes top-right when the active card changes,
           fades out 1.5s after the last index change. Tabular nums so the
           digits don't jiggle as the count grows. -->
      <div
        class="feed-counter"
        class:feed-counter--visible={counterVisible}
        aria-live="polite"
        aria-atomic="true"
      >
        {counterText}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* The shell takes whatever vertical space the locked layout gives it.
     `position: relative` is the anchor for the counter pill overlay. */
  .feed-shell {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    position: relative;
  }

  /* Top-right position counter. Hidden by default, fades in for ~1.5s
     after each index change. Tabular nums + small letter spacing so
     "5 / 47" reads as a unit, not three separate things. */
  .feed-counter {
    position: absolute;
    top: max(env(safe-area-inset-top), 0.875rem);
    right: 0.875rem;
    z-index: 6;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    border: 1px solid var(--color-border);
    background: color-mix(in oklab, var(--color-surface) 85%, transparent);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    opacity: 0;
    transform: translateY(-4px);
    transition:
      opacity 200ms ease-out,
      transform 200ms ease-out;
  }
  .feed-counter--visible {
    opacity: 1;
    transform: translateY(0);
  }

  .feed-scroller {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-snap-type: y mandatory;
    overscroll-behavior-y: contain;
    /* Disable the browser's auto scroll-anchoring. When loadPrev prepends
       items, the browser would otherwise "helpfully" bump scrollTop to keep
       visible content stable — but we already adjust scrollTop ourselves
       with the exact shift, and a double-adjust lands the user near the
       bottom (or, after clamp, near the top), which retriggers prev-prefetch
       and runs away through every page. Owning the adjustment ourselves is
       deterministic. */
    overflow-anchor: none;
    /* iOS: `auto` kills momentum scrolling on this element. Without it,
       releasing the finger lets the scroll glide before snap kicks in —
       that's the "feels like normal scrolling" sensation. With momentum
       off, release is crisp: scroll stops where the finger lifted, then
       our pointerup handler sets scrollTop to the target instantly. The
       property is technically deprecated but Safari still honours it. */
    -webkit-overflow-scrolling: auto;
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

  /* Empty stand-in for off-window items. Matches `.feed-item`'s box so the
     scroller's content geometry is identical whether the item is mounted as
     a full card or rendered as a placeholder — switching back and forth as
     the user scrolls produces no jumps. */
  .feed-item-placeholder {
    height: 100%;
    width: 100%;
    flex-shrink: 0;
    scroll-snap-align: start;
    scroll-snap-stop: always;
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
