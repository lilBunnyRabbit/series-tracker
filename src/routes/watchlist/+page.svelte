<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import LibraryCard from "$lib/components/LibraryCard.svelte";
  import ListCard from "$lib/components/ListCard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import { store } from "$lib/store.svelte";
  import { swipeToDismiss, tactile } from "$lib/tactile";
  import { effectiveSeasons, STATUS_COLOR, STATUS_LABEL, STATUSES } from "$lib/types";
  import type { Entry, Status } from "$lib/types";

  type Filter = "all" | Status;
  type KindFilter = "all" | "tv" | "movie";
  type Sort = "updated" | "added" | "title" | "progress" | "rating" | "release";
  type View = "list" | "grid";

  const VALID_FILTER: Filter[] = ["all", ...STATUSES];
  const VALID_KIND: KindFilter[] = ["all", "tv", "movie"];
  const VALID_SORT: Sort[] = ["updated", "added", "title", "progress", "rating", "release"];
  const VALID_VIEW: View[] = ["list", "grid"];

  const SORT_LABEL: Record<Sort, string> = {
    updated: "Recently updated",
    added: "Recently added",
    title: "Title A–Z",
    progress: "Progress",
    rating: "Your rating",
    release: "Release date",
  };
  const VIEW_LABEL: Record<View, string> = {
    list: "List",
    grid: "Grid",
  };
  // Kind tabs each get their own colour family so the row reads as three
  // distinct categories rather than three slots of the same chip. Mirrors the
  // STATUS_COLOR pattern (bg/border for active, /60 borderSoft for inactive,
  // dot for the leading marker).
  const KIND_COLOR: Record<KindFilter, { bg: string; border: string; borderSoft: string; dot: string }> = {
    all: { bg: "bg-primary", border: "border-primary", borderSoft: "border-primary/60", dot: "bg-primary" },
    tv: { bg: "bg-secondary", border: "border-secondary", borderSoft: "border-secondary/60", dot: "bg-secondary" },
    movie: { bg: "bg-tertiary", border: "border-tertiary", borderSoft: "border-tertiary/60", dot: "bg-tertiary" },
  };
  // Page size for the library list. 24 covers a few rows on grid view (3-5
  // cols) and ~24 list rows — large enough to feel substantial, small enough
  // that re-renders on sort/filter stay snappy.
  const PAGE_SIZE = 24;

  const filter = $derived.by<Filter>(() => {
    const v = page.url.searchParams.get("status");
    return VALID_FILTER.includes(v as Filter) ? (v as Filter) : "all";
  });
  const kindFilter = $derived.by<KindFilter>(() => {
    const v = page.url.searchParams.get("kind");
    return VALID_KIND.includes(v as KindFilter) ? (v as KindFilter) : "all";
  });
  const sort = $derived.by<Sort>(() => {
    const v = page.url.searchParams.get("sort");
    return VALID_SORT.includes(v as Sort) ? (v as Sort) : "updated";
  });
  const view = $derived.by<View>(() => {
    const v = page.url.searchParams.get("view");
    return VALID_VIEW.includes(v as View) ? (v as View) : "list";
  });
  const pageNum = $derived.by<number>(() => {
    const n = Number(page.url.searchParams.get("page"));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  });
  const rewatchableOnly = $derived(page.url.searchParams.get("rewatch") === "1");
  const titleQuery = $derived(page.url.searchParams.get("q") ?? "");
  // Local state mirrors the URL but doesn't push every keystroke through goto —
  // typing into a URL-synced input round-trips through navigation and loses the
  // input focus on iOS. We keep the URL in sync via a debounced effect below.
  let queryDraft = $state(page.url.searchParams.get("q") ?? "");
  let queryDebounce: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const next = queryDraft;
    if (queryDebounce) clearTimeout(queryDebounce);
    queryDebounce = setTimeout(() => {
      if (next !== titleQuery) updateParams({ q: next.trim() || null, page: null });
    }, 200);
    return () => {
      if (queryDebounce) clearTimeout(queryDebounce);
    };
  });

  function updateParams(patch: Record<string, string | null>): void {
    const url = new URL(page.url);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // Filter / sort / kind changes can shrink the list past the current page
  // index; reset to page 1 so the user doesn't land on an empty trailing page.
  // View toggles between list/grid are pure layout, so page is preserved.
  function setFilter(f: Filter): void {
    updateParams({ status: f === "all" ? null : f, page: null });
  }
  function setKind(k: KindFilter): void {
    updateParams({ kind: k === "all" ? null : k, page: null });
  }
  function setSort(s: Sort): void {
    updateParams({ sort: s === "updated" ? null : s, page: null });
  }
  function setView(v: View): void {
    updateParams({ view: v === "list" ? null : v });
  }
  function toggleRewatchable(): void {
    updateParams({ rewatch: rewatchableOnly ? null : "1", page: null });
  }
  function goToPage(n: number): void {
    updateParams({ page: n === 1 ? null : String(n) });
    // Match discover/browse: instant scroll-to-top so the new page lands at
    // the top of the grid — smooth scroll competes with the content swap.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }

  function progressPct(e: Entry): number {
    if (e.kind !== "tv") return e.status === "completed" ? 1 : 0;
    const counted = effectiveSeasons(e);
    const total = counted.reduce((a, s) => a + s.episodeCount, 0);
    if (total === 0) return 0;
    const watched = counted.reduce((a, s) => a + Math.min(e.progress[s.number] ?? 0, s.episodeCount), 0);
    return watched / total;
  }

  const filtered = $derived.by(() => {
    const q = titleQuery.trim().toLowerCase();
    const list = store.entries
      .filter((e) => (filter === "all" ? true : e.status === filter))
      .filter((e) => (kindFilter === "all" ? true : e.kind === kindFilter))
      .filter((e) => (rewatchableOnly ? e.rewatchable === true : true))
      .filter((e) => {
        if (!q) return true;
        if (e.title.toLowerCase().includes(q)) return true;
        if (e.notes && e.notes.toLowerCase().includes(q)) return true;
        return false;
      });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "added":
          return (b.addedAt ?? "").localeCompare(a.addedAt ?? "");
        case "progress":
          return progressPct(b) - progressPct(a);
        case "rating":
          return (b.rating ?? -1) - (a.rating ?? -1);
        case "release":
          // year is the 4-char "YYYY" we extract from TMDB's first_air_date /
          // release_date at add time; entries without a year sort to the end.
          return (b.year ?? "0").localeCompare(a.year ?? "0");
        case "updated":
        default:
          return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
      }
    });
  });

  const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  // Clamp the requested page against the current total — if filters shrank the
  // list below the URL page, we still render the highest valid page rather
  // than an empty one. The URL stays as-is; the user's next interaction will
  // normalize it via setFilter / setSort / goToPage.
  const safePage = $derived(Math.min(pageNum, totalPages));
  const pageStart = $derived((safePage - 1) * PAGE_SIZE);
  const paged = $derived(filtered.slice(pageStart, pageStart + PAGE_SIZE));

  const counts = $derived.by(() => {
    const c: Record<Filter, number> = {
      all: store.entries.length,
      watching: 0,
      completed: 0,
      plan: 0,
      dropped: 0,
      tuned: 0,
    };
    for (const e of store.entries) c[e.status]++;
    return c;
  });

  // Status filter UI is a two-state component:
  //   • closed (default): the active filter renders as a full-width bar with
  //     a "+" trigger on the right.
  //   • open: the bar is replaced by a horizontal scroll-strip showing every
  //     status (compact, all the same size) so the user can pick a different
  //     one. Tapping any tab applies it and collapses back to the closed bar.
  //
  // Why two states instead of always-visible chips: on a phone six chips never
  // fit comfortably and either wrap or scroll, both of which felt cluttered.
  // Hiding inactive options behind one tap keeps the filter row to a single
  // dominant slot.
  let pickerOpen = $state(false);
  // Strip ref so we can scroll the active tab into view when the picker opens
  // — saves a manual swipe to find your current selection in a long list.
  const STRIP_GUTTER_PX = 12; // matches the page's px-3 content gutter
  // Hard cap in case the flex-grow transition doesn't fire (e.g. active
  // already in its open-state position) — without it the scroll would
  // never run.
  const RESIZE_FALLBACK_MS = 400;
  let statusStrip = $state<HTMLDivElement>();
  $effect(() => {
    if (!pickerOpen || !statusStrip) return;
    const strip = statusStrip;

    const doScroll = () => {
      const active = strip.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      const stripRect = strip.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const target = activeRect.left - stripRect.left + strip.scrollLeft - STRIP_GUTTER_PX;
      // No-op when active is already at (or near) the gutter — saves a
      // pointless tiny smooth-scroll on every open.
      if (Math.abs(target - strip.scrollLeft) < 4) return;
      strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    };

    // Wait specifically for the active tab's flex-grow transition to land —
    // that's the one driving the active's resize from full-row to compact.
    // Other transitions on the strip (colour, padding, max-width on the
    // collapsed siblings) bubble through this listener too, so we filter on
    // propertyName to avoid scrolling halfway through the resize.
    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "flex-grow") return;
      cleanup();
      doScroll();
    };

    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      strip.removeEventListener("transitionend", onTransitionEnd);
      clearTimeout(timer);
    };

    strip.addEventListener("transitionend", onTransitionEnd);
    timer = setTimeout(() => {
      cleanup();
      doScroll();
    }, RESIZE_FALLBACK_MS);

    return cleanup;
  });
  function pickStatus(f: Filter): void {
    setFilter(f);
    pickerOpen = false;
  }

  // Bottom sheet for sort + view. Inline (not a shared component) because it's
  // used only here. Uses <dialog>.showModal so it composes with the existing
  // sheet styling already proven in CardActionsSheet.
  let sheetOpen = $state(false);
  let sheetDialog = $state<HTMLDialogElement>();
  $effect(() => {
    if (!sheetDialog) return;
    if (sheetOpen && !sheetDialog.open) sheetDialog.showModal();
    else if (!sheetOpen && sheetDialog.open) sheetDialog.close();
  });
  function openSheet(): void {
    sheetOpen = true;
  }
  function closeSheet(): void {
    sheetOpen = false;
  }
  function onSheetBackdropClick(e: MouseEvent): void {
    if (e.target === sheetDialog) closeSheet();
  }
  function pickSort(s: Sort): void {
    setSort(s);
    closeSheet();
  }
  function pickView(v: View): void {
    setView(v);
    closeSheet();
  }
</script>

{#snippet headerActions()}
  <a
    href="{base}/upcoming/"
    use:tactile={{ haptic: false }}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted hover-border-accent hover-text-text"
  >
    <Icon name="calendar" size={14} />
    <span>Upcoming</span>
  </a>
  <a
    href="{base}/picker/"
    use:tactile={{ haptic: false }}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-bg"
  >
    <Icon name="trophy" size={14} />
    <span>Pick</span>
  </a>
{/snippet}

<PageHeader title="Watchlist" actions={headerActions} />

<section class="space-y-4">
  {#if store.entries.length === 0}
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-muted">
      <p class="mb-4">Your library is empty.</p>
      <div class="flex justify-center gap-2">
        <a
          href="{base}/discover/"
          class="rounded-md border border-border px-4 py-2 text-sm hover:border-primary"
        >
          Browse discover
        </a>
        <a
          href="{base}/search/"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
        >
          Search TMDB
        </a>
      </div>
    </div>
  {:else}
      <!-- Status row, single structure with two visual states.
           All six tabs + the chevron-down trigger are always rendered; CSS
           on `.status-row.is-open / .is-closed` drives the visibility:
           CLOSED — active gets `flex-1` and the bigger `hero-tab-active`
                    treatment, every other tab collapses to `max-width: 0`,
                    the chevron sits at the right.
           OPEN   — every tab is content-sized, the active one becomes a
                    bg-filled compact tab with no visible border, and the
                    chevron itself collapses to `max-width: 0`.
           CSS transitions on flex-grow, max-width, padding, border-width,
           and opacity make the swap animate as a single resize gesture
           rather than a hard DOM swap. -->
      <div
        bind:this={statusStrip}
        class="status-row mb-2.5 -mx-3 flex items-stretch overflow-x-auto px-3 sm:mx-0 sm:overflow-visible {pickerOpen
          ? 'is-open'
          : 'is-closed'}"
        role="tablist"
        aria-label="Status filter"
      >
        {#each VALID_FILTER as f (f)}
          {@const active = filter === f}
          {@const c = f === "all" ? null : STATUS_COLOR[f as Status]}
          <button
            type="button"
            role="tab"
            aria-selected={active}
            aria-hidden={!pickerOpen && !active}
            tabindex={!pickerOpen && !active ? -1 : 0}
            use:tactile
            onclick={() => {
              if (pickerOpen) pickStatus(f);
              else pickerOpen = true;
            }}
            class="status-tab hero-tab {active ? 'is-active' : 'is-inactive'} {active && !pickerOpen
              ? 'hero-tab-active'
              : ''} {active
              ? `${c ? c.bg : 'bg-primary'} ${pickerOpen ? 'border-transparent' : c ? c.border : 'border-primary'} text-bg`
              : `bg-transparent ${c ? c.borderSoft : 'border-border/60'} text-muted hover-text-text`}"
          >
            {#if c}
              <span class="h-1.5 w-1.5 shrink-0 rounded-full {active ? 'bg-bg' : c.dot}" aria-hidden="true"></span>
            {/if}
            <span class="hero-tab-label">{f === "all" ? "All" : STATUS_LABEL[f as Status]}</span>
            <span
              class="status-tab-count tabular-nums {active && !pickerOpen
                ? 'ml-auto text-sm font-semibold text-bg/85'
                : `text-[10px] ${active ? 'text-bg/85 font-semibold' : c ? c.text : 'text-muted'}`}"
            >
              {counts[f]}
            </span>
          </button>
        {/each}
        <button
          type="button"
          use:tactile={{ haptic: false }}
          onclick={() => (pickerOpen = true)}
          aria-label="Open status picker"
          aria-hidden={pickerOpen}
          tabindex={pickerOpen ? -1 : 0}
          class="status-chevron flex shrink-0 items-center justify-center rounded-md border border-border px-3 text-muted hover-border-primary"
        >
          <Icon name="chevron-down" size={18} />
        </button>
      </div>

      <!-- Kind row. Mirrors the closed-state status bar pattern: the active
           kind takes flex-1 to fill the row, inactives stay content-sized,
           and the sort/view trigger on the right is styled to match the
           chevron-down trigger's visual (same padding, border, height) so
           the two filter rows feel like the same control family. -->
      <div class="flex items-stretch gap-2">
        <div class="flex flex-1 items-stretch gap-1 text-xs" role="tablist" aria-label="Media kind filter">
          {#each [["all", "All"], ["tv", "TV"], ["movie", "Movies"]] as const as [k, label] (k)}
            {@const active = kindFilter === k}
            {@const c = KIND_COLOR[k]}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              use:tactile
              onclick={() => setKind(k)}
              class="hero-tab {active ? 'flex-1' : 'shrink-0'} {active
                ? `hero-tab-active ${c.border} ${c.bg} text-bg`
                : `bg-transparent ${c.borderSoft} text-muted hover-text-text`}"
            >
              {#if k !== "all"}
                <span class="h-1.5 w-1.5 shrink-0 rounded-full {active ? 'bg-bg' : c.dot}" aria-hidden="true"></span>
              {/if}
              <span class="hero-tab-label">{label}</span>
            </button>
          {/each}
        </div>

        <!-- Sort & view trigger. Same outer styling as the chevron-down on
             the closed status bar — px-3, plain bordered box, stretches to
             match the row height — so both filter rows share one visual
             vocabulary for "open more controls". The corner dot lights up
             when an "extra" filter is on (currently just rewatchable) so the
             user knows to peek at the sheet without opening it. -->
        <button
          type="button"
          use:tactile={{ haptic: false }}
          onclick={openSheet}
          aria-label="Sort and view options"
          aria-haspopup="dialog"
          class="relative flex shrink-0 items-center justify-center rounded-md border px-3 text-muted hover-border-primary {rewatchableOnly
            ? 'border-secondary text-secondary'
            : 'border-border'}"
        >
          <Icon name="filter" size={18} />
          {#if rewatchableOnly}
            <span
              class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-secondary"
              aria-hidden="true"
            ></span>
          {/if}
        </button>
      </div>

      <!-- Title filter — narrows the visible list by title or notes. Debounced
           through the URL so deep links stay shareable. -->
      <label class="relative block">
        <span class="sr-only">Filter library by title</span>
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <Icon name="search" size={14} />
        </span>
        <input
          type="search"
          bind:value={queryDraft}
          placeholder="Filter by title..."
          autocomplete="off"
          spellcheck="false"
          class="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-9 text-sm outline-none transition-colors duration-150 focus:border-primary"
        />
        {#if queryDraft}
          <button
            type="button"
            use:tactile={{ haptic: false }}
            onclick={() => (queryDraft = "")}
            aria-label="Clear filter"
            class="tap-target tap-target--icon absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover-text-text"
          >
            ✕
          </button>
        {/if}
      </label>

    {#if filtered.length === 0}
      <p class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        {titleQuery.trim() ? `No items match "${titleQuery.trim()}".` : "No items match this filter."}
      </p>
    {:else if view === "list"}
      <div class="space-y-1.5">
        {#each paged as entry (entry.kind + ":" + entry.id)}
          <div class="cv-row">
            <ListCard {entry} backdrop={entry.backdrop ?? null} />
          </div>
        {/each}
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each paged as entry (entry.kind + ":" + entry.id)}
          <div class="cv-card">
            <LibraryCard {entry} />
          </div>
        {/each}
      </div>
    {/if}

    {#if totalPages > 1}
      <div class="space-y-2 pt-2">
        <Pagination current={safePage} total={totalPages} onGoTo={goToPage} />
        <p class="text-center text-xs tabular-nums text-muted">
          {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}
          of {filtered.length.toLocaleString()}
        </p>
      </div>
    {/if}
  {/if}
</section>

<dialog
  bind:this={sheetDialog}
  onclick={onSheetBackdropClick}
  onclose={closeSheet}
  class="actions-sheet w-[min(22rem,92vw)] max-w-[92vw] overflow-hidden border-border bg-surface p-0 text-text shadow-2xl"
>
  <div
    class="actions-sheet-drag sm:hidden"
    use:swipeToDismiss={{ target: sheetDialog, onDismiss: closeSheet }}
    aria-hidden="true"
  >
    <span class="actions-sheet-handle"></span>
  </div>
  <div class="w-full p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:pb-5">
    <header class="mb-4 min-w-0">
      <p class="text-xs uppercase tracking-wider text-muted">Library</p>
      <h2 class="mt-0.5 truncate text-base font-semibold">Sort &amp; view</h2>
    </header>

    <p class="mb-2 text-xs uppercase tracking-wider text-muted">Sort by</p>
    <div class="grid grid-cols-2 gap-2">
      {#each VALID_SORT as s (s)}
        {@const active = sort === s}
        <button
          type="button"
          use:tactile
          onclick={() => pickSort(s)}
          class="tap-target tap-target--btn flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors duration-150 [&:nth-child(odd):last-child]:col-span-2 [&:nth-child(odd):last-child]:justify-center {active
            ? 'border-primary bg-primary text-bg'
            : 'border-border text-muted hover-text-text'}"
        >
          <span class="h-2 w-2 rounded-full {active ? 'bg-bg' : 'bg-border'}" aria-hidden="true"></span>
          {SORT_LABEL[s]}
        </button>
      {/each}
    </div>

    <hr class="my-4 border-border" />

    <p class="mb-2 text-xs uppercase tracking-wider text-muted">Filter</p>
    <button
      type="button"
      use:tactile
      onclick={toggleRewatchable}
      aria-pressed={rewatchableOnly}
      class="tap-target tap-target--btn flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors duration-150 {rewatchableOnly
        ? 'border-secondary bg-secondary text-bg'
        : 'border-border text-muted hover-text-text'}"
    >
      <span class="flex items-center gap-2">
        <span aria-hidden="true">♻</span>
        <span>Rewatchable only</span>
      </span>
      <span class="text-xs tabular-nums {rewatchableOnly ? 'opacity-80' : 'opacity-60'}">
        {store.entries.filter((e) => e.rewatchable).length}
      </span>
    </button>

    <hr class="my-4 border-border" />

    <p class="mb-2 text-xs uppercase tracking-wider text-muted">View</p>
    <div class="grid grid-cols-2 gap-2">
      {#each VALID_VIEW as v (v)}
        {@const active = view === v}
        <button
          type="button"
          use:tactile
          onclick={() => pickView(v)}
          aria-pressed={active}
          class="tap-target tap-target--btn flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors duration-150 {active
            ? 'border-primary bg-primary text-bg'
            : 'border-border text-muted hover-text-text'}"
        >
          <Icon name={v} size={16} />
          {VIEW_LABEL[v]}
        </button>
      {/each}
    </div>

    <button
      type="button"
      use:tactile={{ haptic: false }}
      onclick={closeSheet}
      class="tap-target tap-target--btn mt-4 w-full rounded-md px-4 py-2.5 text-xs text-muted hover-text-text"
    >
      Cancel
    </button>
  </div>
</dialog>

<style>
  .cv-card {
    content-visibility: auto;
    contain-intrinsic-size: 320px 380px;
  }
  .cv-row {
    content-visibility: auto;
    contain-intrinsic-size: 100% 100px;
  }

  /* Hero-tab base. Used by:
       - the closed-state status bar (active filter rendered as a full-width
         bar — combined with `.hero-tab-active` for big padding + shadow)
       - the open-state status picker (every status as a compact tab — base
         only, no `.hero-tab-active`; bg/border come from per-tab Tailwind
         utilities so the picker can show the selected one as bg-filled
         without a competing border)
       - the kind row (compact bordered tabs with `.hero-tab-active` reserved
         for the currently-selected category) */
  /* Status row, two-state with animated resize.
     The same flex container holds every status tab + the chevron trigger;
     `.is-closed` / `.is-open` swaps the geometry by toggling flex-grow on
     the active tab and max-width / padding / border-width / opacity on the
     elements that need to disappear. Each of those properties is in
     `.hero-tab`'s transition list, so the swap reads as a single resize
     gesture instead of a hard DOM swap. */
  .status-row {
    /* Hide the horizontal scrollbar — its vertical footprint (a few px on
       macOS / Windows) made the row taller than the closed bar, so opening
       the picker pushed the rest of the page down. Touch devices swipe by
       default; on desktop mouse-wheel scrolls the strip. */
    scrollbar-width: none;
    -ms-overflow-style: none;
    /* Column-gap is the only spacing between flex children. In open mode it
       provides breathing room between visible tabs; in closed mode it drops
       to 0 so the collapsed inactive tabs don't accumulate gap-pixels and
       offset the active bar. The active tab adds its own margin-right in
       closed to space itself from the chevron. Both column-gap and margin
       are in the transition list, so the swap stays smooth. */
    column-gap: 0.375rem;
    transition: column-gap 280ms var(--ease-spring);
  }
  .status-row::-webkit-scrollbar {
    display: none;
  }
  .status-row.is-closed {
    column-gap: 0;
  }
  .status-row.is-closed .status-tab.is-active {
    margin-right: 0.375rem;
  }

  /* Closed state ─────────────────────────────────────────────────────── */
  /* Active tab fills the row */
  .status-row.is-closed .status-tab.is-active {
    flex-grow: 1;
    flex-basis: 0;
  }
  /* Inactives collapse to nothing — width, padding, border, dot all
     shrink to zero; opacity hides the residual outline during the
     transition. pointer-events: none keeps them un-clickable in case
     a finger lands on the slim residual. */
  .status-row.is-closed .status-tab.is-inactive {
    flex-grow: 0;
    flex-basis: 0;
    max-width: 0;
    min-width: 0;
    padding-left: 0;
    padding-right: 0;
    border-width: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
  }

  /* Open state ───────────────────────────────────────────────────────── */
  /* All tabs sized to their content; user can swipe to scroll when total
     overflows the viewport. */
  .status-row.is-open .status-tab {
    flex-grow: 0;
    flex-shrink: 0;
    flex-basis: auto;
  }
  /* Chevron collapses the same way inactives do in closed state — it's
     a visual toggle that doesn't need to live in both states. */
  .status-row.is-open .status-chevron {
    max-width: 0;
    min-width: 0;
    padding-left: 0;
    padding-right: 0;
    border-width: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
  }

  /* The chevron piggy-backs on the .hero-tab transition list so its
     collapse animates in sync with the surrounding tabs. */
  .status-chevron {
    transition:
      max-width 280ms var(--ease-spring),
      padding 280ms var(--ease-spring),
      border-width 200ms var(--ease-out),
      opacity 200ms var(--ease-out);
  }

  .hero-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border-radius: 0.5rem;
    /* Border-width/style only — border-color is set per-tab via Tailwind
       utility classes (e.g. border-primary, border-primary/60). Setting a
       full `border: ...` here would have higher specificity than the
       Tailwind class (Svelte scopes component styles into the unlayered
       cascade above @layer utilities) and the per-tab tint would silently
       fail to apply. Same for background — only set per-tab. */
    border-width: 1px;
    border-style: solid;
    white-space: nowrap;
    cursor: pointer;
    line-height: 1;
    /* Consistent 40px height across every variant (closed-state hero bar,
       open-state picker tabs, kind row tabs) so the selection never looks
       like it shrank when you opened the picker — only the width differs.
       Horizontal padding still varies by variant for content density. */
    min-height: 2.5rem;
    padding: 0 0.875rem;
    /* Dot + label flow from the left so the eye scans reading order; the
       count gets `ml-auto` on the active bar to push it to the right edge. */
    justify-content: flex-start;
    /* Smooth bg/border/colour swap + flex-grow / max-width / padding /
       border-width / opacity transitions. The flex-grow change drives the
       active tab's resize between content-size (open picker) and flex-1
       (closed bar / kind selection). The max-width + padding + border-width
       + opacity changes drive the open/close picker animation: inactive
       status tabs collapse to nothing in the closed state and ease back to
       full size when the picker opens. */
    transition:
      background-color 200ms var(--ease-out),
      border-color 200ms var(--ease-out),
      color 200ms var(--ease-out),
      flex-grow 280ms var(--ease-spring),
      flex-basis 280ms var(--ease-spring),
      max-width 280ms var(--ease-spring),
      padding 280ms var(--ease-spring),
      margin 280ms var(--ease-spring),
      border-width 200ms var(--ease-out),
      opacity 200ms var(--ease-out);
  }
  .hero-tab-label {
    font-size: 0.75rem;
    font-weight: 500;
  }
  .hero-tab-active {
    /* Used on the closed-state status bar and on the kind row's active tab —
       slightly more horizontal padding + soft shadow so the active selection
       reads as a solid filled block dominant in its row. Height stays the
       same as the picker tabs (via min-height on .hero-tab). */
    padding: 0 1rem;
    box-shadow: 0 4px 12px -6px color-mix(in oklab, currentColor 30%, transparent);
  }
  .hero-tab-active .hero-tab-label {
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  /* Sheet styling — copied from CardActionsSheet so this page-local sheet
     matches the app's established sheet pattern (bottom sheet on mobile,
     centered pop-in on desktop, animated backdrop). */
  .actions-sheet {
    margin: auto;
    border-radius: 1rem 1rem 0 0;
    border: 1px solid var(--color-border);
  }
  .actions-sheet[open] {
    animation: sheet-in 280ms var(--ease-spring);
  }
  .actions-sheet::backdrop {
    background: rgb(0 0 0 / 0.6);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }
  .actions-sheet[open]::backdrop {
    animation: backdrop-in 200ms ease-out;
  }

  @media (max-width: 639.98px) {
    .actions-sheet {
      margin: 0;
      max-width: 100%;
      width: 100%;
      max-height: 90vh;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: auto;
    }
  }

  @media (min-width: 640px) {
    .actions-sheet {
      border-radius: 0.75rem;
    }
    .actions-sheet[open] {
      animation: pop-in 180ms var(--ease-out);
    }
  }

  /* Drag zone — generous touch target around the visual handle so the user
     can grab anywhere near the top of the sheet to start a swipe-down. The
     `touch-action: none` is important: it stops the browser from claiming
     vertical pans (incl. pull-to-refresh) before the swipeToDismiss action
     gets a chance to handle them. */
  .actions-sheet-drag {
    padding: 0.625rem 0 0.5rem;
    display: block;
    touch-action: none;
    cursor: grab;
  }
  .actions-sheet-drag:active {
    cursor: grabbing;
  }
  .actions-sheet-handle {
    display: block;
    margin: 0 auto;
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 9999px;
    background: var(--color-border);
  }

  @media (prefers-reduced-motion: reduce) {
    .actions-sheet[open],
    .actions-sheet[open]::backdrop {
      animation: none;
    }
  }
</style>
