<script lang="ts">
  import "./layout.css";
  import { afterNavigate, beforeNavigate } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { initBackTracker, smartBack } from "$lib/back.svelte";
  import ApiKeyGate from "$lib/components/ApiKeyGate.svelte";
  import GuideTour from "$lib/components/GuideTour.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import UpdateProgressOverlay from "$lib/components/UpdateProgressOverlay.svelte";
  import { tactile } from "$lib/tactile";
  import { tour } from "$lib/tour.svelte";

  type IconName = "home" | "compass" | "bookmark" | "search" | "user";
  import { pageActions } from "$lib/page-actions.svelte";
  import * as versionModule from "$lib/version.svelte";
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade } from "svelte/transition";

  // Custom rail transition. Translates Y and tweens the backdrop-filter
  // blur amount via a CSS variable so the blur ramps smoothly with the
  // motion instead of "snapping" at the end (browsers tend to skip
  // recomputing backdrop-filter mid-transform). Opacity stays at 1 the
  // whole way so the dark fill stays solid against the page bg.
  function railRise(_node: HTMLElement, { duration = 240, distance = 120 } = {}) {
    return {
      duration,
      easing: cubicOut,
      css: (t: number) => `
        transform: translateY(${(1 - t) * distance}px);
        --rail-blur: ${t * 14}px;
      `,
    };
  }

  let { children } = $props();

  initBackTracker();
  const onBack = smartBack();

  // Scroll restoration on history.back. SvelteKit restores once on popstate,
  // but list pages (watchlist, browse, search) often load their content
  // asynchronously via $effect — by the time the data lands and the page
  // becomes tall enough, the original restore has already clamped scroll to
  // 0 because the DOM was too short. We re-apply the saved position across
  // a few animation frames so the late-arriving content can be scrolled to.
  const scrollByUrl = new Map<string, number>();

  beforeNavigate(({ from }) => {
    if (from) scrollByUrl.set(from.url.href, window.scrollY);
  });

  afterNavigate(({ to, type }) => {
    if (!to) return;
    if (type !== "popstate") return;
    const target = scrollByUrl.get(to.url.href);
    if (!target) return;
    let attempts = 0;
    const tick = () => {
      window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
      // Stop once we land within 4px of the target (close enough — content
      // jitter from images loading can cost a pixel here and there) or after
      // ~30 frames (~500ms) so we don't loop forever on a permanently
      // shortened page.
      if (Math.abs(window.scrollY - target) > 4 && attempts < 30) {
        attempts++;
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });

  onMount(async () => {
    versionModule.init();
    try {
      const { registerSW } = await import("virtual:pwa-register");
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => versionModule.markSWReady(),
      });
      versionModule.wireSW(updateSW);
    } catch (e) {
      console.warn("[pwa] service worker registration failed", e);
    }
  });

  const relPath = $derived(page.url.pathname.replace(base, ""));
  // Routes that don't need a TMDB key — they only read local state. The gate
  // would otherwise block users with imported libraries who haven't set a key.
  const skipApiKeyGate = $derived(
    relPath.startsWith("/settings") ||
      relPath.startsWith("/stats") ||
      relPath.startsWith("/leaderboard") ||
      relPath.startsWith("/diary") ||
      relPath.startsWith("/style-guide")
  );
  // Routes that own the bottom edge with their own UI hide the global island:
  // - season tracker (progress island with its own back arrow)
  // - active feed (TikTok-style, has its own back).
  // The season /info subroute is a regular scrolling page and keeps the island.
  const isSeasonRoute = $derived(/^\/show\/\d+\/season\/\d+\/?$/.test(relPath));
  // The feed route only owns the viewport once the user has tapped Start
  // (?start=1) — its setup screen is a regular scrolling page.
  const isFeedActive = $derived(
    relPath.startsWith("/discover/feed") && page.url.searchParams.get("start") === "1"
  );
  const hideFloatingNav = $derived(isSeasonRoute || isFeedActive);

  // Routes that lock body scroll and let an internal flex column own scrolling
  // (so the bottom island reaches the viewport edge). Layout.css picks up the
  // .scroll-locked class on <html> and constrains body / main accordingly.
  $effect(() => {
    if (!isSeasonRoute && !isFeedActive) return;
    document.documentElement.classList.add("scroll-locked");
    return () => document.documentElement.classList.remove("scroll-locked");
  });

  // Order: Home, Discover, Watchlist, Search, Profile (stats hub, links to settings).
  const items: { href: string; label: string; path: string; icon: IconName }[] = [
    { href: `${base}/`, label: "Home", path: "/", icon: "home" },
    { href: `${base}/discover/`, label: "Discover", path: "/discover/", icon: "compass" },
    { href: `${base}/watchlist/`, label: "Watchlist", path: "/watchlist/", icon: "bookmark" },
    { href: `${base}/search/`, label: "Search", path: "/search/", icon: "search" },
    { href: `${base}/stats/`, label: "Profile", path: "/stats/", icon: "user" },
  ];

  function isActive(path: string): boolean {
    const p = page.url.pathname;
    if (path === "/") return p === `${base}/` || p === base;
    return p.startsWith(`${base}${path}`);
  }

  // Hub mode renders only when we're at the *root* of a hub tab (e.g.
  // /search/, /watchlist/), not at a sub-route (e.g. /search/bulk). This way
  // sub-routes drop into back mode with their own backHref. The desktop top
  // nav still highlights via isActive (startsWith), so descendants stay
  // visually grouped under their parent tab there.
  const isHubRoot = $derived(
    items.some((i) => {
      if (i.path === "/") return relPath === "/" || relPath === "";
      const stripped = i.path.endsWith("/") ? i.path.slice(0, -1) : i.path;
      return relPath === i.path || relPath === stripped;
    })
  );

  const pageTitle = $derived.by(() => {
    if (relPath === "/" || relPath === "") return "Home";
    if (relPath.startsWith("/watchlist")) return "Watchlist";
    if (relPath.startsWith("/picker")) return "Picker";
    if (relPath.startsWith("/upcoming")) return "Upcoming";
    if (relPath.startsWith("/search/bulk")) return "Bulk search";
    if (relPath.startsWith("/search")) return "Search";
    if (relPath.startsWith("/discover/browse")) return "Browse";
    if (relPath.startsWith("/discover/feed")) return "Feed";
    if (relPath.startsWith("/discover")) return "Discover";
    if (relPath.startsWith("/stats")) return "Profile";
    if (relPath.startsWith("/leaderboard")) return "Leaderboard";
    if (relPath.startsWith("/diary")) return "Diary";
    if (relPath.startsWith("/settings/guide")) return "Guide";
    if (relPath.startsWith("/settings/roadmap")) return "Roadmap";
    if (relPath.startsWith("/settings")) return "Settings";
    if (relPath.startsWith("/activity")) return "Activity";
    if (relPath.startsWith("/style-guide")) return "Style Guide";
    if (relPath.startsWith("/share")) return "Open shared link";
    if (relPath.includes("/info")) return "Info";
    if (/^\/show\/\d+\/season\/\d+/.test(relPath)) return "Season";
    if (relPath.startsWith("/show/")) return "Show";
    if (relPath.startsWith("/movie/")) return "Movie";
    if (relPath.startsWith("/person/")) return "Person";
    return "Series Tracker";
  });

  const backHref = $derived.by(() => {
    const seasonInfo = relPath.match(/^\/show\/(\d+)\/season\/\d+\/info\/?$/);
    if (seasonInfo) return `${base}/show/${seasonInfo[1]}/info/`;
    const seasonMatch = relPath.match(/^\/show\/(\d+)\/season\/\d+\/?$/);
    if (seasonMatch) return `${base}/show/${seasonMatch[1]}/`;
    const info = relPath.match(/^\/(show|movie)\/(\d+)\/info\/?$/);
    if (info) return `${base}/${info[1]}/${info[2]}/`;
    const detail = relPath.match(/^\/(show|movie)\/\d+\/?$/);
    if (detail) return `${base}/`;
    if (relPath.startsWith("/discover/browse")) return `${base}/discover/`;
    // While the feed is active, "back" should bring the user to its setup
    // screen rather than all the way to discover — they likely want to tweak
    // filters and start a fresh feed.
    if (relPath.startsWith("/discover/feed") && page.url.searchParams.get("start") === "1")
      return `${base}/discover/feed/`;
    if (relPath.startsWith("/discover/feed")) return `${base}/discover/`;
    // Search hides the floating footer, so give it a back button to return home.
    if (relPath.startsWith("/search/bulk")) return `${base}/search/`;
    if (relPath.startsWith("/search")) return `${base}/`;
    if (relPath.startsWith("/settings/guide")) return `${base}/settings/`;
    if (relPath.startsWith("/settings/roadmap")) return `${base}/settings/`;
    if (relPath.startsWith("/settings")) return `${base}/stats/`;
    if (relPath.startsWith("/leaderboard")) return `${base}/stats/`;
    if (relPath.startsWith("/diary")) return `${base}/stats/`;
    if (relPath.startsWith("/activity")) return `${base}/settings/`;
    if (relPath.startsWith("/style-guide")) return `${base}/settings/`;
    if (relPath.startsWith("/upcoming")) return `${base}/watchlist/?status=watching`;
    if (relPath.startsWith("/picker")) return `${base}/watchlist/`;
    if (relPath.startsWith("/person/")) return `${base}/`;
    if (relPath.startsWith("/share")) return `${base}/`;
    return null;
  });

  const documentTitle = $derived(pageTitle === "Home" ? "Series Tracker" : `${pageTitle} · Series Tracker`);
</script>

<svelte:head>
  <title>{documentTitle}</title>
</svelte:head>

<div class="app-shell flex min-h-[100dvh] flex-col">
  <!-- Mobile has no top bar — the floating island below carries both primary
       nav (hub mode) and back/title (back mode) instead. Desktop keeps the
       full top header since the island is mobile-only. The active feed view
       hides the desktop header too: that mode owns the viewport fully
       (TikTok-style), with its own bottom-anchored back button. -->
  {#if !isFeedActive}
  <header
    class="sticky top-0 z-30 hidden border-b border-border bg-bg/95 backdrop-blur sm:block"
    style="padding-top: env(safe-area-inset-top)"
  >
    <nav class="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
      <a href="{base}/" class="flex items-center gap-2 font-semibold tracking-tight" aria-label="Home">
        <img src="{base}/icon.svg" alt="" class="h-7 w-7" />
        <span>Series Tracker</span>
      </a>

      <div class="ml-auto flex items-center gap-1 text-sm">
        {#each items as item (item.path)}
          <a
            href={item.href}
            use:tactile={{ haptic: false }}
            class="tap-target tap-target--btn flex items-center gap-2 rounded-md px-3 py-2 hover-bg-surface {isActive(item.path)
              ? 'bg-surface text-primary'
              : 'text-muted'}"
          >
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
          </a>
        {/each}
      </div>
    </nav>
  </header>
  {/if}

  <main class="mx-auto w-full max-w-5xl flex-1 px-3 py-4 pb-32 sm:px-4 sm:py-6 sm:pb-6" class:has-page-actions={!!pageActions.current}>
    {#if skipApiKeyGate}
      {@render children()}
    {:else}
      <ApiKeyGate>
        {@render children()}
      </ApiKeyGate>
    {/if}
  </main>

  <!-- Page-actions rail: extension of the floating island. Sits just above
       the island, scrolls horizontally if needed, matches the island's
       translucent dark fill so the two read as a stacked bottom-UI cluster.
       Pages register their actions via PageHeader; the layout pulls from
       the shared store and renders here on mobile only. -->
  {#if pageActions.current && !isFeedActive}
    <!-- Rail pops up out of the island when a page registers actions, and
         retracts back into it on transition. Custom transition tweens the
         backdrop-filter blur in sync with the translate — opacity stays at
         1, blur ramps from 0 to its full 14px so the surface fills in
         alongside the motion instead of snapping at the end. -->
    <nav
      class="page-actions-rail sm:hidden"
      aria-label="Page actions"
      in:railRise={{ duration: 260 }}
      out:railRise={{ duration: 180 }}
    >
      <div class="page-actions-pill">
        <div class="page-actions-track">
          {@render pageActions.current()}
        </div>
      </div>
    </nav>
  {/if}

  <!-- Floating dynamic island: same full-width pill, two render modes.
       Hub mode → 5 tabs (Home/Discover/Watchlist/Search/Profile).
       Back mode → ← arrow + page title (replaces the old top navbar).
       Inner content cross-fades on mode change.
       Hidden ≥ sm where the top nav has all tabs.
       Also hidden on routes that own the bottom edge with their own UI:
       /search (search dock), season tracker (progress island), active feed. -->
  {#if !hideFloatingNav}
    {@const activeIndex = items.findIndex((i) => isActive(i.path))}
    {@const islandMode = isHubRoot ? "hub" : backHref ? "back" : null}
    {#if islandMode}
      <nav
        class="floating-nav sm:hidden"
        style="padding-bottom: max(env(safe-area-inset-bottom), 0.5rem)"
        aria-label="Primary"
      >
        <div class="floating-nav-pill" data-mode={islandMode}>
          {#if islandMode === "hub"}
            <div class="floating-nav-pane floating-nav-pane--hub" transition:fade={{ duration: 140 }}>
              <!-- Sliding active-tab indicator. Width = 1/items, translateX = index. -->
              <span
                class="floating-nav-indicator"
                style="width: calc(100% / {items.length}); transform: translateX(calc(100% * {activeIndex}));"
                aria-hidden="true"
              ></span>
              {#each items as item (item.path)}
                {@const active = isActive(item.path)}
                <a
                  href={item.href}
                  use:tactile={{ haptic: "tick" }}
                  class="tap-target tap-target--icon relative z-10 flex flex-1 flex-col items-center justify-center gap-1 rounded-full px-1 py-1.5 text-[10px] {active ? 'text-primary' : 'text-muted'}"
                  aria-current={active ? "page" : undefined}
                >
                  <Icon name={item.icon} size={20} />
                  <span class="leading-none">{item.label}</span>
                </a>
              {/each}
            </div>
          {:else}
            <div class="floating-nav-pane floating-nav-pane--back" transition:fade={{ duration: 140 }}>
              <a
                href={backHref}
                onclick={onBack}
                use:tactile
                aria-label="Back"
                class="tap-target tap-target--icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text"
              >
                <Icon name="arrow-left" size={18} />
              </a>
              <span class="min-w-0 flex-1 truncate pr-2 text-sm font-medium">{pageTitle}</span>
            </div>
          {/if}
        </div>
      </nav>
    {/if}
  {/if}

  <UpdateProgressOverlay />

  <!-- First-launch tour. Lazy-mounted: the {#if} guard means the overlay's
       DOM only exists when it should be visible (per project rule on
       dialogs). Trigger logic lives in $lib/tour.svelte.ts — auto-opens for
       brand-new users (no library + tourSeen unset) and on manual replay
       from /settings/guide. -->
  {#if tour.open}
    <GuideTour />
  {/if}
</div>

<style>
  .floating-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    display: flex;
    justify-content: center;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    pointer-events: none;
  }

  /* Page-actions rail — visually a "sheet" emerging from inside the island.
     The rail's flat bottom is buried 1.75rem (half the island's pill height)
     inside the island so they connect at the island's vertical middle —
     where the island is at full width and the rail's bottom strip is fully
     covered. z-index puts the rail behind the island so the overlap is
     hidden under the island's blurred surface; the chips sit above the
     island's top edge, pushed up by extra bottom padding. */
  .page-actions-rail {
    position: fixed;
    left: 0;
    right: 0;
    /* Island middle from viewport bottom = max(safe-area, 0.5rem) + 1.75rem
       (= island padding + half of 3.5rem pill). */
    bottom: calc(max(env(safe-area-inset-bottom, 0px), 0.5rem) + 1.75rem);
    z-index: 39;
    display: flex;
    justify-content: center;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    pointer-events: none;
    /* Default blur amount when no transition is running. The custom
       railRise transition tweens this from 0 to 14px during enter/exit. */
    --rail-blur: 14px;
  }
  .page-actions-pill {
    pointer-events: auto;
    width: 100%;
    max-width: 28rem;
    /* Padding lives on the static pill, not on the scrolling track —
       otherwise scrolling slides the padding out of view and the chips
       look like they detach from the rail's edge. Asymmetric: chip area
       sits at the top, the extra bottom padding is the strip that
       disappears behind the island plus visible breathing room above the
       island's top edge. */
    padding: 0.5rem 0.75rem 2.25rem 0.75rem;
    /* Explicit 1.75rem corner radius matches the island's effective curve.
       Using 9999px clamps differently per pill height: rail (~70px tall)
       would clamp to 35px while the island (56px) clamps to 28px — same
       keyword but different rendered radii. Hard-coding 1.75rem (= 28px)
       keeps the curvature consistent. */
    border-radius: 1.75rem 1.75rem 0 0;
    background: rgba(26, 31, 38, 0.85);
    background: color-mix(in oklab, var(--color-bg) 88%, transparent);
    /* No bottom border — the seam vanishes behind the island anyway, and a
       bottom border would draw a faint line right where the two pills meet. */
    border: 1px solid var(--color-border);
    border-bottom: none;
    -webkit-backdrop-filter: blur(var(--rail-blur, 14px));
    backdrop-filter: blur(var(--rail-blur, 14px));
    /* Shadow only above the rail — the bottom would just hit the island. */
    box-shadow:
      0 -12px 24px -12px rgb(0 0 0 / 0.5),
      0 -4px 8px -4px rgb(0 0 0 / 0.3);
  }
  /* Inner scroll track — only the chips scroll horizontally. The pill's
     fill, border, padding, and shape stay put underneath. The track itself
     is fully rounded so when chips overflow the visible width, they get
     clipped along the curved edges instead of a hard vertical line at the
     track's leading/trailing boundary. */
  .page-actions-track {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    overflow-x: auto;
    border-radius: 9999px;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .page-actions-track::-webkit-scrollbar {
    display: none;
  }
  /* Force every chip rendered into the rail to a fully rounded pill shape.
     Pages style their own chips with rounded-md or similar in other
     contexts (page bodies, sheets), but inside the rail they need to
     match the pill's outer roundness so the rail reads as a single cohesive
     shape. Specificity (0,1,1) beats Tailwind's `.rounded-*` (0,1,0) without
     needing !important. */
  .page-actions-track > :global(*) {
    border-radius: 9999px;
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .page-actions-pill {
      background: rgba(26, 31, 38, 0.96);
    }
  }

  /* Pages with an actions rail need extra clearance under the content so
     the last row scrolls fully into view above the rail+island stack.
     pb-32 (8rem) clears the island only; +3rem covers the rail height
     + 0.5rem gap. Mobile only — desktop has no rail. */
  :global(main.has-page-actions) {
    padding-bottom: 11rem;
  }
  @media (min-width: 640px) {
    :global(main.has-page-actions) {
      padding-bottom: 1.5rem;
    }
  }

  .floating-nav-pill {
    pointer-events: auto;
    display: grid;
    grid-template-areas: "stack";
    width: 100%;
    max-width: 28rem;
    /* Lock the pill height so hub mode (icon + label tabs) and back mode
       (single-line back + title) render at exactly the same size — the
       intrinsic content of back mode is shorter, so without this it'd look
       slightly thinner than the hub island. 3.5rem (56px) = 2px border +
       0.5rem pill padding y + 2.875rem hub tab content (py-1.5 + icon-20
       + gap-1 + 10px label). box-sizing: border-box means min-height
       includes the border. */
    min-height: 3.5rem;
    padding: 0.25rem;
    border-radius: 9999px;
    position: relative;
    /* Layered fallbacks so older Samsung Internet (no color-mix / no oklch)
       still gets a visible translucent fill. Newer engines pick the
       color-mix line; older engines fall back to the rgba above. Uses the
       page bg (darker) rather than surface so it reads as a recessed,
       background-tinted chrome — same fill style as the old search dock. */
    background: rgba(26, 31, 38, 0.85);
    background: color-mix(in oklab, var(--color-bg) 88%, transparent);
    border: 1px solid var(--color-border);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    box-shadow:
      0 24px 48px -12px rgb(0 0 0 / 0.7),
      0 12px 20px -6px rgb(0 0 0 / 0.5),
      0 4px 8px -2px rgb(0 0 0 / 0.35);
  }

  /* Stacked panes — both occupy the same grid cell so the cross-fade overlap
     during morph doesn't shift layout. */
  .floating-nav-pane {
    grid-area: stack;
    display: flex;
    align-items: center;
    width: 100%;
  }
  .floating-nav-pane--hub {
    align-items: stretch;
    position: relative;
  }
  .floating-nav-pane--back {
    gap: 0.25rem;
  }

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .floating-nav-pill {
      background: rgba(26, 31, 38, 0.96);
    }
  }

  /* Sliding active-tab indicator. Width matches one tab; translateX by N×100%
     moves it across. Inset matches the pill's 0.25rem padding so the indicator
     aligns with the visible tab area. */
  .floating-nav-indicator {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    border-radius: 9999px;
    background: color-mix(in oklab, var(--color-primary) 16%, transparent);
    border: 1px solid color-mix(in oklab, var(--color-primary) 35%, transparent);
    transition: transform var(--dur-base) var(--ease-spring);
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .floating-nav-indicator,
    .floating-nav-pill {
      transition: none;
    }
  }
</style>
