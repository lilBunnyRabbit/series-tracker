<script lang="ts">
  import "./layout.css";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import ApiKeyGate from "$lib/components/ApiKeyGate.svelte";

  let { children } = $props();

  const isSettings = $derived(page.url.pathname.endsWith("/settings/") || page.url.pathname.endsWith("/settings"));

  const items: { href: string; label: string; path: string; icon: string }[] = [
    { href: `${base}/`, label: "Library", path: "/", icon: "📚" },
    { href: `${base}/search/`, label: "Search", path: "/search/", icon: "🔍" },
    { href: `${base}/settings/`, label: "Settings", path: "/settings/", icon: "⚙" },
  ];

  function isActive(path: string): boolean {
    const p = page.url.pathname;
    if (path === "/") return p === `${base}/` || p === base;
    return p.startsWith(`${base}${path}`);
  }
</script>

<svelte:head>
  <title>Series Tracker</title>
</svelte:head>

<div class="flex min-h-[100dvh] flex-col">
  <header
    class="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur"
    style="padding-top: env(safe-area-inset-top)"
  >
    <nav class="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
      <a href="{base}/" class="flex items-center gap-2 font-semibold tracking-tight">
        <img src="{base}/icon.svg" alt="" class="h-7 w-7" />
        <span class="hidden sm:inline">Series Tracker</span>
      </a>
      <div class="ml-auto hidden items-center gap-1 text-sm sm:flex">
        {#each items as item (item.path)}
          <a
            href={item.href}
            class="rounded-md px-3 py-2 transition hover:bg-[var(--color-surface)] {isActive(item.path)
              ? 'bg-[var(--color-surface)] text-[var(--color-accent)]'
              : 'text-[var(--color-muted)]'}"
          >
            {item.label}
          </a>
        {/each}
      </div>
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
    class="sticky bottom-0 z-10 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur sm:hidden"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <div class="mx-auto flex max-w-5xl items-stretch">
      {#each items as item (item.path)}
        <a
          href={item.href}
          class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] {isActive(item.path)
            ? 'text-[var(--color-accent)]'
            : 'text-[var(--color-muted)]'}"
        >
          <span class="text-lg leading-none" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {/each}
    </div>
  </nav>
</div>
