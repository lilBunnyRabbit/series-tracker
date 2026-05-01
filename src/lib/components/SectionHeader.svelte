<script lang="ts">
  import { tactile } from "$lib/tactile";
  import type { Snippet } from "svelte";

  type Props = {
    title: string;
    subtitle?: string;
    /** Optional href for the chevron "see all" link. */
    seeAllHref?: string;
    seeAllLabel?: string;
    /** Optional ⊕ quick-action click handler — appears as a small icon button on the far right. */
    onAction?: () => void;
    actionIcon?: string;
    actionLabel?: string;
    children?: Snippet;
  };

  let {
    title,
    subtitle,
    seeAllHref,
    seeAllLabel = "See all",
    onAction,
    actionIcon = "+",
    actionLabel = "Quick add",
    children,
  }: Props = $props();
</script>

<div class="flex items-center gap-2">
  {#if seeAllHref}
    <a
      href={seeAllHref}
      use:tactile={{ haptic: false }}
      class="tap-target group flex min-w-0 items-baseline gap-1.5 rounded-md py-1 -my-1 -ml-1 pl-1 pr-2 active:bg-surface/60"
      aria-label="{title} — {seeAllLabel.toLowerCase()}"
    >
      <h2 class="truncate text-base font-semibold tracking-tight text-text">{title}</h2>
      <span class="text-base text-muted transition-transform duration-200 group-active:translate-x-0.5">›</span>
      {#if subtitle}
        <span class="truncate text-xs font-normal text-muted">{subtitle}</span>
      {/if}
    </a>
  {:else}
    <h2 class="truncate text-base font-semibold tracking-tight text-text">{title}</h2>
    {#if subtitle}
      <span class="truncate text-xs font-normal text-muted">{subtitle}</span>
    {/if}
  {/if}

  <div class="ml-auto flex items-center gap-1.5">
    {#if children}
      {@render children()}
    {/if}
    {#if onAction}
      <button
        type="button"
        use:tactile
        onclick={onAction}
        aria-label={actionLabel}
        class="tap-target tap-target--icon flex h-9 w-9 items-center justify-center rounded-full border border-border text-base text-muted hover-border-primary hover-text-primary"
      >
        {actionIcon}
      </button>
    {/if}
  </div>
</div>
