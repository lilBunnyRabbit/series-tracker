<script lang="ts">
  type Props = {
    /** What to render. Defaults to a single line. */
    variant?: "line" | "poster" | "posterGrid" | "rail" | "infoPage" | "results";
    /** For posterGrid/rail/results variants — number of placeholder cards. */
    count?: number;
    /** ARIA label for screen readers. */
    label?: string;
  };

  let { variant = "line", count = 8, label = "Loading" }: Props = $props();
</script>

{#if variant === "line"}
  <div class="skel h-4 w-32 rounded" aria-label={label} role="status"></div>
{:else if variant === "poster"}
  <div class="flex w-[132px] flex-col gap-1.5 sm:w-[148px]" aria-label={label} role="status">
    <div class="skel aspect-[2/3] w-full rounded-lg"></div>
    <div class="skel h-3 w-3/4 rounded"></div>
    <div class="skel h-2.5 w-1/2 rounded"></div>
  </div>
{:else if variant === "posterGrid"}
  <div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6" aria-label={label} role="status">
    {#each Array.from({ length: count }, (_, i) => i) as i (i)}
      <div class="flex flex-col gap-1.5">
        <div class="skel aspect-[2/3] w-full rounded-lg"></div>
        <div class="skel h-3 w-3/4 rounded"></div>
        <div class="skel h-2.5 w-1/2 rounded"></div>
      </div>
    {/each}
  </div>
{:else if variant === "rail"}
  <div class="-mx-3 sm:-mx-4" aria-label={label} role="status">
    <div class="flex gap-3 overflow-x-hidden px-3 pb-2 sm:px-4">
      {#each Array.from({ length: count }, (_, i) => i) as i (i)}
        <div class="flex w-[132px] flex-shrink-0 flex-col gap-1.5 sm:w-[148px]">
          <div class="skel aspect-[2/3] w-full rounded-lg"></div>
          <div class="skel h-3 w-3/4 rounded"></div>
          <div class="skel h-2.5 w-1/2 rounded"></div>
        </div>
      {/each}
    </div>
  </div>
{:else if variant === "results"}
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label={label} role="status">
    {#each Array.from({ length: count }, (_, i) => i) as i (i)}
      <div class="flex gap-3 rounded-lg border border-border bg-surface p-3">
        <div class="skel h-24 w-16 flex-shrink-0 rounded"></div>
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div class="skel h-4 w-3/4 rounded"></div>
          <div class="skel h-3 w-1/3 rounded"></div>
          <div class="skel h-3 w-full rounded"></div>
          <div class="skel h-3 w-5/6 rounded"></div>
          <div class="skel mt-auto h-7 w-20 rounded"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if variant === "infoPage"}
  <div class="space-y-8" aria-label={label} role="status">
    <section class="flex flex-col items-center gap-4 pt-2">
      <div class="w-44 sm:w-52 md:w-60">
        <div class="skel aspect-[2/3] w-full rounded-xl"></div>
      </div>
      <div class="skel h-5 w-24 rounded-full"></div>
      <div class="flex flex-col items-center gap-2">
        <div class="skel h-7 w-64 rounded"></div>
        <div class="skel h-3 w-40 rounded"></div>
        <div class="skel h-3 w-48 rounded"></div>
      </div>
      <div class="flex items-center gap-2">
        {#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
          <div class="skel h-12 w-12 rounded-full"></div>
        {/each}
      </div>
    </section>
    <section class="space-y-2">
      <div class="skel h-3 w-20 rounded"></div>
      <div class="skel h-3 w-full rounded"></div>
      <div class="skel h-3 w-5/6 rounded"></div>
      <div class="skel h-3 w-4/6 rounded"></div>
    </section>
  </div>
{/if}

<style>
  .skel {
    background: linear-gradient(
      90deg,
      color-mix(in oklab, var(--color-surface-2) 100%, transparent) 0%,
      color-mix(in oklab, var(--color-surface-2) 60%, var(--color-surface) 40%) 50%,
      color-mix(in oklab, var(--color-surface-2) 100%, transparent) 100%
    );
    background-size: 200% 100%;
    animation: skel-shimmer 1.4s linear infinite;
  }
  @keyframes skel-shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .skel {
      animation: none;
    }
  }
</style>
