<script lang="ts">
  import "./layout.css";
  import { afterNavigate, beforeNavigate } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { initBackTracker, smartBack } from "$lib/back.svelte";
  import ApiKeyGate from "$lib/components/ApiKeyGate.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import UpdateToast from "$lib/components/UpdateToast.svelte";
  import { tactile } from "$lib/tactile";

  type IconName = "home" | "compass" | "bookmark" | "search" | "user";
  import * as versionModule from "$lib/version.svelte";
  import { onMount } from "svelte";

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
  // Hide the floating nav on /search — the bottom-docked search input would
  // otherwise crowd it; users get a back button instead. Season pages also
  // hide it: they own the bottom edge with their own progress island.
  const isSeasonRoute = $derived(/^\/show\/\d+\/season\/\d+/.test(relPath));
  const hideFloatingNav = $derived(relPath.startsWith("/search") || isSeasonRoute);

  // Routes that lock body scroll and let an internal flex column own scrolling
  // (so the bottom island reaches the viewport edge). Layout.css picks up the
  // .scroll-locked class on <html> and constrains body / main accordingly.
  $effect(() => {
    if (!isSeasonRoute) return;
    document.documentElement.classList.add("scroll-locked");
    return () => document.documentElement.classList.remove("scroll-locked");
  });

  // Mobile-only: the floating nav slides away once the user has scrolled past
  // the top so the content owns the screen, and reappears when they're back
  // at the top. Threshold is small enough that iOS rubber-banding doesn't
  // flicker the state but big enough to feel intentional.
  let scrolled = $state(false);

  $effect(() => {
    const onScroll = () => {
      scrolled = window.scrollY > 16;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const pageTitle = $derived.by(() => {
    if (relPath === "/" || relPath === "") return "Home";
    if (relPath.startsWith("/watchlist")) return "Watchlist";
    if (relPath.startsWith("/picker")) return "Picker";
    if (relPath.startsWith("/upcoming")) return "Upcoming";
    if (relPath.startsWith("/search")) return "Search";
    if (relPath.startsWith("/discover/browse")) return "Browse";
    if (relPath.startsWith("/discover")) return "Discover";
    if (relPath.startsWith("/stats")) return "Profile";
    if (relPath.startsWith("/leaderboard")) return "Leaderboard";
    if (relPath.startsWith("/diary")) return "Diary";
    if (relPath.startsWith("/settings")) return "Settings";
    if (relPath.startsWith("/style-guide")) return "Style Guide";
    if (relPath.includes("/info")) return "Info";
    if (/^\/show\/\d+\/season\/\d+/.test(relPath)) return "Season";
    if (relPath.startsWith("/show/")) return "Show";
    if (relPath.startsWith("/movie/")) return "Movie";
    if (relPath.startsWith("/person/")) return "Person";
    return "Series Tracker";
  });

  const backHref = $derived.by(() => {
    const seasonMatch = relPath.match(/^\/show\/(\d+)\/season\/\d+\/?$/);
    if (seasonMatch) return `${base}/show/${seasonMatch[1]}/`;
    const info = relPath.match(/^\/(show|movie)\/(\d+)\/info\/?$/);
    if (info) return `${base}/${info[1]}/${info[2]}/`;
    const detail = relPath.match(/^\/(show|movie)\/\d+\/?$/);
    if (detail) return `${base}/`;
    if (relPath.startsWith("/discover/browse")) return `${base}/discover/`;
    // Search hides the floating footer, so give it a back button to return home.
    if (relPath.startsWith("/search/bulk")) return `${base}/search/`;
    if (relPath.startsWith("/search")) return `${base}/`;
    if (relPath.startsWith("/settings")) return `${base}/stats/`;
    if (relPath.startsWith("/leaderboard")) return `${base}/stats/`;
    if (relPath.startsWith("/diary")) return `${base}/stats/`;
    if (relPath.startsWith("/style-guide")) return `${base}/settings/`;
    if (relPath.startsWith("/upcoming")) return `${base}/watchlist/?status=watching`;
    if (relPath.startsWith("/picker")) return `${base}/watchlist/`;
    if (relPath.startsWith("/person/")) return `${base}/`;
    return null;
  });

  const documentTitle = $derived(pageTitle === "Home" ? "Series Tracker" : `${pageTitle} · Series Tracker`);
</script>

<svelte:head>
  <title>{documentTitle}</title>
</svelte:head>

<div class="app-shell flex min-h-[100dvh] flex-col">
  <!-- Mobile: only show the header when there's a back affordance to render —
       the floating island already covers primary nav, so the top bar would
       otherwise just be a logo + redundant page title. Desktop always shows
       the header since there's no island. -->
  {#if backHref}
    <header
      class="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur sm:hidden"
      style="padding-top: env(safe-area-inset-top)"
    >
      <nav class="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5">
        <a
          href={backHref}
          onclick={onBack}
          use:tactile
          aria-label="Back"
          class="tap-target tap-target--icon flex h-10 w-10 items-center justify-center rounded-md border border-border"
        >
          <Icon name="arrow-left" size={18} />
        </a>
        <span class="text-sm font-medium">{pageTitle}</span>
      </nav>
    </header>
  {/if}

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

  <main class="mx-auto w-full max-w-5xl flex-1 px-3 py-4 pb-32 sm:px-4 sm:py-6 sm:pb-6">
    {#if skipApiKeyGate}
      {@render children()}
    {:else}
      <ApiKeyGate>
        {@render children()}
      </ApiKeyGate>
    {/if}
  </main>

  <!-- Floating pill nav: hovers above content with safe-area padding,
       blur backdrop matches header. Hidden ≥ sm where the top nav has all tabs.
       Also hidden on /search where the bottom search dock owns the footer space. -->
  {#if !hideFloatingNav}
    {@const activeIndex = items.findIndex((i) => isActive(i.path))}
    <nav
      class="floating-nav sm:hidden"
      class:is-hidden={scrolled}
      style="padding-bottom: max(env(safe-area-inset-bottom), 0.5rem)"
      aria-label="Primary"
      aria-hidden={scrolled}
      inert={scrolled}
    >
      <div class="floating-nav-pill">
        <!-- Sliding active-tab indicator. Width = 1/items, translateX = index. -->
        {#if activeIndex >= 0}
          <span
            class="floating-nav-indicator"
            style="width: calc((100% - 0.5rem) / {items.length}); transform: translateX(calc(100% * {activeIndex}));"
            aria-hidden="true"
          ></span>
        {/if}
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
    </nav>
  {/if}

  <UpdateToast />
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

  .floating-nav-pill {
    pointer-events: auto;
    display: flex;
    align-items: stretch;
    gap: 0;
    width: 100%;
    max-width: 28rem;
    padding: 0.25rem;
    border-radius: 9999px;
    position: relative;
    /* Layered fallbacks so older Samsung Internet (no color-mix / no oklch)
       still gets a visible translucent fill. Newer engines pick the
       color-mix line; older engines fall back to the rgba above. */
    background: rgba(36, 43, 51, 0.85);
    background: color-mix(in oklab, var(--color-surface) 88%, transparent);
    border: 1px solid var(--color-border);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    box-shadow:
      0 12px 32px -12px rgb(0 0 0 / 0.55),
      0 2px 6px -2px rgb(0 0 0 / 0.4);
    transform-origin: 50% 100%;
    transition:
      transform var(--dur-release) var(--ease-spring),
      opacity var(--dur-base) var(--ease-out),
      filter var(--dur-base) var(--ease-out);
    will-change: transform, opacity;
  }

  /* Slide the pill off the bottom edge with a soft scale + blur so the exit
     reads as "settling away" rather than a hard cut. Spring ease on transform
     gives the return a subtle overshoot when scrolling back to the top. */
  .floating-nav.is-hidden .floating-nav-pill {
    transform: translateY(calc(100% + 1.5rem)) scale(0.92);
    opacity: 0;
    filter: blur(4px);
    pointer-events: none;
  }
  /* When backdrop-filter isn't supported (or is gated), bump the rgba alpha
     up so the pill stays readable as a solid translucent shape. */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .floating-nav-pill {
      background: rgba(36, 43, 51, 0.96);
    }
  }

  /* Sliding active-tab indicator. Width matches one tab; translateX by N×100%
     moves it across. Inset matches the pill's 0.25rem padding so the indicator
     aligns with the visible tab area. */
  .floating-nav-indicator {
    position: absolute;
    top: 0.25rem;
    bottom: 0.25rem;
    left: 0.25rem;
    border-radius: 9999px;
    background: color-mix(in oklab, var(--color-primary) 16%, transparent);
    border: 1px solid color-mix(in oklab, var(--color-primary) 35%, transparent);
    transition: transform var(--dur-base) var(--ease-spring);
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .floating-nav-indicator {
      transition: none;
    }
    .floating-nav-pill {
      transition: opacity var(--dur-fast) linear;
    }
    .floating-nav.is-hidden .floating-nav-pill {
      transform: none;
      filter: none;
    }
  }
</style>
