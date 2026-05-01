<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    title: string;
    /** Optional small line under the title — kept light so it doesn't compete with section headers below. */
    subtitle?: string;
    /** Right-aligned action cluster — buttons, links, etc. */
    actions?: Snippet;
    /** When true, render the title visually-hidden (kept for a11y / page title). */
    srOnly?: boolean;
  };

  let { title, subtitle, actions, srOnly = false }: Props = $props();
</script>

<header class="mb-5 flex flex-wrap items-center gap-2">
  {#if srOnly}
    <h1 class="sr-only">{title}</h1>
  {:else}
    <div class="mr-auto min-w-0">
      <h1 class="truncate text-xl font-semibold tracking-tight">{title}</h1>
      {#if subtitle}
        <p class="mt-0.5 text-xs text-muted">{subtitle}</p>
      {/if}
    </div>
  {/if}
  {#if actions}
    <div class="flex flex-wrap items-center gap-1.5 {srOnly ? 'ml-auto' : ''}">
      {@render actions()}
    </div>
  {/if}
</header>
