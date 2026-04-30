<script lang="ts">
  import "./layout.css";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import ApiKeyGate from "$lib/components/ApiKeyGate.svelte";

  let { children } = $props();

  const isSettings = $derived(page.url.pathname.includes("/settings"));

  const items: { href: string; label: string; path: string; icon: string }[] = [
    { href: `${base}/`, label: "Library", path: "/", icon: "📚" },
    { href: `${base}/discover/`, label: "Discover", path: "/discover/", icon: "✨" },
    { href: `${base}/search/`, label: "Search", path: "/search/", icon: "🔍" },
    { href: `${base}/settings/`, label: "Settings", path: "/settings/", icon: "⚙" },
  ];

  function isActive(path: string): boolean {
    const p = page.url.pathname;
    if (path === "/") return p === `${base}/` || p === base;
    return p.startsWith(`${base}${path}`);
  }

  const relPath = $derived(page.url.pathname.replace(base, ""));

  const pageTitle = $derived.by(() => {
    if (relPath === "/" || relPath === "") return "Library";
    if (relPath.startsWith("/search")) return "Search";
    if (relPath.startsWith("/discover")) return "Discover";
    if (relPath.startsWith("/settings")) return "Settings";
    if (relPath.includes("/info")) return "Info";
    if (relPath.startsWith("/show/")) return "Show";
    if (relPath.startsWith("/movie/")) return "Movie";
    return "Series Tracker";
  });

  const backHref = $derived.by(() => {
    const m = relPath.match(/^\/(show|movie)\/(\d+)\/info\/?$/);
    if (m) return `${base}/${m[1]}/${m[2]}/`;
    const d = relPath.match(/^\/(show|movie)\/\d+\/?$/);
    if (d) return `${base}/`;
    return null;
  });
</script>

<svelte:head>
  <title>Series Tracker</title>
</svelte:head>

<div class="flex min-h-[100dvh] flex-col">
  <header
    class="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur"
    style="padding-top: env(safe-area-inset-top)"
  >
    <nav class="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
      <div class="flex items-center gap-2 sm:hidden">
        {#if backHref}
          <a
            href={backHref}
            aria-label="Back"
            class="flex h-9 w-9 items-center justify-center rounded-md border border-border text-lg"
          >
            ←
          </a>
          <span class="text-sm font-medium">{pageTitle}</span>
        {:else}
          <a href="{base}/" class="flex items-center gap-2 font-semibold tracking-tight">
            <img src="{base}/icon.svg" alt="" class="h-7 w-7" />
          </a>
          <span class="text-sm font-medium text-muted">{pageTitle}</span>
        {/if}
      </div>

      <a href="{base}/" class="hidden items-center gap-2 font-semibold tracking-tight sm:flex">
        <img src="{base}/icon.svg" alt="" class="h-7 w-7" />
        <span>Series Tracker</span>
      </a>

      <div class="ml-auto hidden items-center gap-1 text-sm sm:flex">
        {#each items as item (item.path)}
          <a
            href={item.href}
            class="rounded-md px-3 py-2 transition hover:bg-surface {isActive(item.path)
              ? 'bg-surface text-accent'
              : 'text-muted'}"
          >
            {item.label}
          </a>
        {/each}
      </div>

      <a
        href="{base}/settings/"
        aria-label="Settings"
        class="ml-auto flex h-9 w-9 items-center justify-center rounded-md border border-border text-base text-muted sm:hidden"
      >
        ⚙
      </a>
    </nav>
  </header>

  <main class="mx-auto w-full max-w-5xl flex-1 px-3 py-4 pb-24 sm:px-4 sm:py-6 sm:pb-6">
    {#if isSettings}
      {@render children()}
    {:else}
      <ApiKeyGate>
        {@render children()}
      </ApiKeyGate>
    {/if}
  </main>

  <nav
    class="sticky bottom-0 z-10 border-t border-border bg-bg/95 backdrop-blur sm:hidden"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <div class="mx-auto flex max-w-5xl items-stretch">
      {#each items as item (item.path)}
        <a
          href={item.href}
          class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] {isActive(item.path)
            ? 'text-accent'
            : 'text-muted'}"
        >
          <span class="text-lg leading-none" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {/each}
    </div>
  </nav>
</div>
