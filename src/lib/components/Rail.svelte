<script lang="ts">
  import type { Snippet } from "svelte";
  import SectionHeader from "./SectionHeader.svelte";

  type Props = {
    title: string;
    subtitle?: string;
    seeAllHref?: string;
    onAction?: () => void;
    actionIcon?: string;
    actionLabel?: string;
    /** Hide entirely if true (so callers don't have to wrap in {#if}). */
    hidden?: boolean;
    /** Page-load stagger slot. When set, the rail fades-and-rises with
     *  delay = index × 40ms. Omit to skip the animation. */
    index?: number;
    /** Optional empty-state hint snippet — rendered inline when no children. */
    empty?: Snippet;
    children: Snippet;
  };

  let {
    title,
    subtitle,
    seeAllHref,
    onAction,
    actionIcon,
    actionLabel,
    hidden = false,
    index,
    empty,
    children,
  }: Props = $props();
</script>

{#if !hidden}
  <section
    class="space-y-2.5"
    class:stagger-rise={index !== undefined}
    style:--i={index ?? 0}
  >
    <SectionHeader {title} {subtitle} {seeAllHref} {onAction} {actionIcon} {actionLabel} />
    <!-- Negative inline margin so cards bleed to the screen edge on mobile,
         but keep their padding inside the scroll track. Snap-x makes flicks
         settle on a card boundary. -->
    <div class="-mx-3 sm:-mx-4">
      <div
        class="rail-track flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-3 px-3 pb-2 sm:scroll-px-4 sm:px-4"
      >
        {@render children()}
      </div>
    </div>
    {#if empty}
      {@render empty()}
    {/if}
  </section>
{/if}

<style>
  .rail-track {
    scrollbar-width: none;
  }
  .rail-track::-webkit-scrollbar {
    display: none;
  }
  .rail-track > :global(*) {
    scroll-snap-align: start;
    flex: 0 0 auto;
  }
</style>
