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
  import { tactile } from "$lib/tactile";
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
    const list = store.entries
      .filter((e) => (filter === "all" ? true : e.status === filter))
      .filter((e) => (kindFilter === "all" ? true : e.kind === kindFilter));
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

  // Status tab strip needs a ref so the active tab can be scrolled into the
  // start of the strip on mount and on filter change. With min-width: 80vw
  // on the active hero tab, only one tab fits comfortably at a time on
  // mobile, so we want the active one pinned to the left edge.
  //
  // scrollIntoView walks up the ancestor chain and may end up scrolling the
  // document too if any of the page is below the fold. We avoid that by
  // computing the horizontal offset ourselves and calling scrollTo on the
  // strip alone — page scroll position is left untouched.
  const STRIP_GUTTER_PX = 12; // matches scroll-padding-left: 0.75rem
  let statusStrip = $state<HTMLDivElement>();
  $effect(() => {
    filter; // re-run when filter changes
    if (!statusStrip) return;
    // requestAnimationFrame so the active class swap (which rewidths the
    // tab) lands before we measure positions.
    requestAnimationFrame(() => {
      const strip = statusStrip;
      if (!strip) return;
      const active = strip.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      const stripRect = strip.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const target = activeRect.left - stripRect.left + strip.scrollLeft - STRIP_GUTTER_PX;
      strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    });
  });

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
    <div class="space-y-2.5">
      <!-- Status row. Active tab dominates the row (color-filled, full label
           + count + dot) and is sized to ~80vw on mobile so it visually owns
           the strip; inactive tabs stay as compact bordered badges sitting
           beside it, accessible by horizontal scroll. The strip uses
           scroll-snap so a swipe always lands on a tab boundary, and changing
           filter scrolls the new active tab to the left edge (with the same
           gutter as the page content). -->
      <div
        bind:this={statusStrip}
        class="hero-row hero-row--wide -mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:overflow-visible"
      >
        <div class="flex w-max items-stretch gap-1 text-xs sm:w-auto" role="tablist" aria-label="Status filter">
          {#each VALID_FILTER as f (f)}
            {@const active = filter === f}
            {@const c = f === "all" ? null : STATUS_COLOR[f as Status]}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              use:tactile
              onclick={() => setFilter(f)}
              class="hero-tab shrink-0 {active
                ? `hero-tab-active ${c ? `${c.bg} ${c.border}` : 'border-primary bg-primary'} text-bg`
                : `hero-tab-inactive ${c ? c.borderSoft : 'border-border/60'} text-muted hover-text-text`}"
            >
              {#if c}
                <span class="h-1.5 w-1.5 shrink-0 rounded-full {active ? 'bg-bg' : c.dot}" aria-hidden="true"></span>
              {/if}
              <span class="hero-tab-label">{f === "all" ? "All" : STATUS_LABEL[f as Status]}</span>
              <span
                class="tabular-nums {active
                  ? 'ml-auto text-bg/85 text-sm font-semibold'
                  : `text-[10px] ${c ? c.text : 'text-muted'}`}"
              >
                {counts[f]}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Kind row. Same hero-tab treatment as status, but with one colour
           family per option (primary / secondary / tertiary) so the three
           categories read as visually distinct rather than three slots of
           the same chip. The trigger for the sort/view sheet sits at the
           right edge of this row. -->
      <div class="flex items-center gap-2">
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
              class="hero-tab shrink-0 {active
                ? `hero-tab-active ${c.border} ${c.bg} text-bg`
                : `hero-tab-inactive ${c.borderSoft} text-muted hover-text-text`}"
            >
              <span class="h-1.5 w-1.5 shrink-0 rounded-full {active ? 'bg-bg' : c.dot}" aria-hidden="true"></span>
              <span class="hero-tab-label">{label}</span>
            </button>
          {/each}
        </div>

        <!-- Sort & view trigger. Both controls live in a bottom sheet to keep
             this row uncluttered on narrow screens. The active sort/view live
             in the URL so the trigger doesn't need to surface them; the sheet
             shows the current selection when opened. -->
        <button
          type="button"
          use:tactile={{ haptic: false }}
          onclick={openSheet}
          aria-label="Sort and view options"
          aria-haspopup="dialog"
          class="tap-target tap-target--icon flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted hover-border-primary"
        >
          <Icon name="filter" size={16} />
        </button>
      </div>
    </div>

    {#if filtered.length === 0}
      <p class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        No items match this filter.
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
  <div class="actions-sheet-handle sm:hidden" aria-hidden="true"></div>
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

  /* "Hero tab" pattern. Active tab is intentionally much more prominent than
     the inactives — color-filled background, bigger padding, larger label —
     so a quick glance at the row instantly communicates which subset is being
     viewed. Inactives stay as compact bordered badges so the row still reads
     as a row of selectable items, just visually quieter than the active hero. */
  .hero-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border-radius: 0.5rem;
    /* Border-width/style only — colour is set per-tab via Tailwind utility
       classes (e.g. border-primary, border-primary/60). Setting `border:
       1px solid transparent` here would have higher specificity than the
       Tailwind class (Svelte scopes component styles into the unlayered
       cascade above @layer utilities) and the inactive border-tint would
       silently fail to apply. */
    border-width: 1px;
    border-style: solid;
    white-space: nowrap;
    cursor: pointer;
    line-height: 1;
    /* Dot + label flow from the left so the eye scans reading order; the
       count gets `ml-auto` on the active tab to push it to the right edge. */
    justify-content: flex-start;
    /* Snap each tab to the strip's start edge so manual swipes always land
       on a tab boundary. */
    scroll-snap-align: start;
    /* Inactive→active toggles bg, border, text, padding, min-width, and
       shadow simultaneously — animate all of them so the swap feels like one
       gesture instead of colour-fading while size jumps. */
    transition:
      background-color 220ms var(--ease-out),
      border-color 220ms var(--ease-out),
      color 220ms var(--ease-out),
      padding 220ms var(--ease-out),
      min-width 220ms var(--ease-out),
      box-shadow 220ms var(--ease-out);
  }
  .hero-tab-label {
    transition: font-size 220ms var(--ease-out);
  }
  .hero-tab-active {
    /* Active gets generous padding + bolder type so it sticks out as a
       solid filled block. */
    padding: 0.625rem 1rem;
    box-shadow: 0 4px 12px -6px color-mix(in oklab, currentColor 30%, transparent);
  }
  .hero-tab-active .hero-tab-label {
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .hero-tab-inactive {
    /* Inactive keeps a soft bordered-badge look so the row still reads as a
       set of selectable items — just visually quieter than the active hero.
       Border colour comes from the per-tab Tailwind class (e.g.
       `border-primary/60` for the Watching status), matching the soft tint
       used on library cards so the row visually mirrors the deck below. */
    padding: 0.4rem 0.75rem;
    background: transparent;
  }
  .hero-tab-inactive .hero-tab-label {
    font-size: 0.75rem;
    font-weight: 500;
  }
  .hero-tab-inactive:hover {
    background: var(--color-surface);
  }

  /* Wide variant: the active tab claims ~80% of the viewport width on mobile
     so the strip reads like a single-tab-at-a-time selector. Inactives still
     live in the strip and become accessible by swiping horizontally. The
     scroll-padding matches the page's px-3 gutter so the active tab snaps
     to the visible content edge instead of the negative-margin viewport edge. */
  .hero-row {
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    scroll-padding-left: 0.75rem;
  }
  @media (max-width: 639.98px) {
    .hero-row--wide .hero-tab-active {
      min-width: 80vw;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-row {
      scroll-behavior: auto;
    }
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

  .actions-sheet-handle {
    margin: 0.5rem auto 0;
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
