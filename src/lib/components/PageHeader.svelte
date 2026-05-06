<script lang="ts">
  import { pageActions } from "$lib/page-actions.svelte";
  import type { Snippet } from "svelte";

  type Props = {
    title: string;
    /** Optional small line under the title — kept light so it doesn't compete with section headers below. */
    subtitle?: string;
    /** Page-level action cluster — links/buttons that point *away* from the
     * current page (e.g. "Upcoming" on watchlist, "Settings" on profile).
     * On mobile these render in a rail above the floating island (an
     * extension of the bottom navigation). On desktop they render inline at
     * the top of the page since the desktop top nav already owns that
     * space pattern. */
    actions?: Snippet;
    /** Page-specific controls that belong NEXT TO the title — e.g. an export
     * button on a list page. Distinct from `actions`, which is for redirects
     * and renders in the bottom-rail tray. */
    titleActions?: Snippet;
    /** When true, render the title visually-hidden (kept for a11y / page title). */
    srOnly?: boolean;
  };

  let { title, subtitle, actions, titleActions, srOnly = false }: Props = $props();

  // Register this page's actions snippet for the layout's mobile bottom rail.
  // The `=== mine` guard ensures we only clear our own slot on unmount —
  // protects against the race where the next page's PageHeader mounts and
  // sets its snippet before the old one's cleanup runs.
  $effect(() => {
    const mine = actions ?? null;
    pageActions.current = mine;
    return () => {
      if (pageActions.current === mine) pageActions.current = null;
    };
  });
</script>

{#if !srOnly}
  <header class="mb-3 flex min-w-0 items-center gap-2">
    <div class="mr-auto min-w-0">
      <h1 class="truncate text-xl font-semibold tracking-tight">{title}</h1>
      {#if subtitle}
        <p class="mt-0.5 text-xs text-muted">{subtitle}</p>
      {/if}
    </div>
    {#if titleActions}
      <div class="flex shrink-0 items-center gap-1.5">
        {@render titleActions()}
      </div>
    {/if}
  </header>
{:else}
  <h1 class="sr-only">{title}</h1>
  {#if titleActions}
    <div class="mb-3 flex justify-end gap-1.5">
      {@render titleActions()}
    </div>
  {/if}
{/if}

{#if actions}
  <!-- Desktop only: actions rail at top. Mobile picks them up from the
       layout's bottom rail (extension of the floating island) instead. -->
  <nav class="page-actions-desktop mb-4 hidden sm:block" aria-label="Page actions">
    <div class="page-actions-desktop-track">
      {@render actions()}
    </div>
  </nav>
{/if}

<style>
  .page-actions-desktop {
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    border-radius: 0.75rem;
    border: 1px solid var(--color-border);
    background: rgba(26, 31, 38, 0.85);
    background: color-mix(in oklab, var(--color-bg) 88%, transparent);
  }
  .page-actions-desktop::-webkit-scrollbar {
    display: none;
  }
  .page-actions-desktop-track {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem;
    width: max-content;
    min-width: 100%;
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .page-actions-desktop {
      background: rgba(26, 31, 38, 0.96);
    }
  }
</style>
