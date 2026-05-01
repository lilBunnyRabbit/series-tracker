<script lang="ts">
  import "./layout.css";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import ApiKeyGate from "$lib/components/ApiKeyGate.svelte";
  import { vibrate } from "$lib/haptics";
  import { onMount } from "svelte";

  let { children } = $props();

  onMount(async () => {
    try {
      const { registerSW } = await import("virtual:pwa-register");
      registerSW({ immediate: true });
    } catch (e) {
      console.warn("[pwa] service worker registration failed", e);
    }
  });

  const relPath = $derived(page.url.pathname.replace(base, ""));
  const isSettings = $derived(relPath.startsWith("/settings"));
  // Hide the floating nav on /search — the bottom-docked search input would
  // otherwise crowd it; users get a back button instead.
  const hideFloatingNav = $derived(relPath.startsWith("/search"));

  // Order per design TODO: Home, Discover, Watchlist, Search, Profile.
  // Profile slot reuses settings until the dedicated stats page lands.
  const items: { href: string; label: string; path: string; icon: string }[] = [
    { href: `${base}/`, label: "Home", path: "/", icon: "⌂" },
    { href: `${base}/discover/`, label: "Discover", path: "/discover/", icon: "✨" },
    { href: `${base}/watchlist/`, label: "Watchlist", path: "/watchlist/", icon: "☰" },
    { href: `${base}/search/`, label: "Search", path: "/search/", icon: "⌕" },
    { href: `${base}/settings/`, label: "Profile", path: "/settings/", icon: "◉" },
  ];

  function isActive(path: string): boolean {
    const p = page.url.pathname;
    if (path === "/") return p === `${base}/` || p === base;
    return p.startsWith(`${base}${path}`);
  }

  const pageTitle = $derived.by(() => {
    if (relPath === "/" || relPath === "") return "Home";
    if (relPath.startsWith("/watchlist")) return "Watchlist";
    if (relPath.startsWith("/search")) return "Search";
    if (relPath.startsWith("/discover/browse")) return "Browse";
    if (relPath.startsWith("/discover")) return "Discover";
    if (relPath.startsWith("/settings")) return "Profile";
    if (relPath.includes("/info")) return "Info";
    if (relPath.startsWith("/show/")) return "Show";
    if (relPath.startsWith("/movie/")) return "Movie";
    return "Series Tracker";
  });

  const backHref = $derived.by(() => {
    const info = relPath.match(/^\/(show|movie)\/(\d+)\/info\/?$/);
    if (info) return `${base}/${info[1]}/${info[2]}/`;
    const detail = relPath.match(/^\/(show|movie)\/\d+\/?$/);
    if (detail) return `${base}/`;
    if (relPath.startsWith("/discover/browse")) return `${base}/discover/`;
    // Search hides the floating footer, so give it a back button to return home.
    if (relPath.startsWith("/search/bulk")) return `${base}/search/`;
    if (relPath.startsWith("/search")) return `${base}/`;
    return null;
  });

  const documentTitle = $derived(pageTitle === "Home" ? "Series Tracker" : `${pageTitle} · Series Tracker`);
</script>

<svelte:head>
  <title>{documentTitle}</title>
</svelte:head>

<div class="flex min-h-[100dvh] flex-col">
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
          aria-label="Back"
          class="flex h-9 w-9 items-center justify-center rounded-md border border-border text-lg"
        >
          ←
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
            class="rounded-md px-3 py-2 transition hover:bg-surface {isActive(item.path)
              ? 'bg-surface text-primary'
              : 'text-muted'}"
          >
            {item.label}
          </a>
        {/each}
      </div>
    </nav>
  </header>

  <main class="mx-auto w-full max-w-5xl flex-1 px-3 py-4 pb-32 sm:px-4 sm:py-6 sm:pb-6">
    {#if isSettings}
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
  <nav
    class="floating-nav sm:hidden"
    style="padding-bottom: max(env(safe-area-inset-bottom), 0.5rem)"
    aria-label="Primary"
  >
    <div class="floating-nav-pill">
      {#each items as item (item.path)}
        {@const active = isActive(item.path)}
        <a
          href={item.href}
          onclick={() => vibrate("tick")}
          class="flex flex-1 flex-col items-center justify-center gap-1 rounded-full px-1 py-1.5 text-[10px] transition {active
            ? 'text-primary'
            : 'text-muted'}"
          aria-current={active ? "page" : undefined}
        >
          <span class="text-base leading-none" aria-hidden="true">{item.icon}</span>
          <span class="leading-none">{item.label}</span>
        </a>
      {/each}
    </div>
  </nav>
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

  .floating-nav-pill {
    pointer-events: auto;
    display: flex;
    align-items: stretch;
    gap: 0;
    width: 100%;
    max-width: 28rem;
    padding: 0.25rem;
    border-radius: 9999px;
    background: color-mix(in oklab, var(--color-surface) 88%, transparent);
    border: 1px solid var(--color-border);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow:
      0 12px 32px -12px rgb(0 0 0 / 0.55),
      0 2px 6px -2px rgb(0 0 0 / 0.4);
  }
</style>
