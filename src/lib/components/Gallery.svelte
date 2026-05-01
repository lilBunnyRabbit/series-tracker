<script lang="ts">
  import { tactile } from "$lib/tactile";
  import type { ImageItem } from "$lib/types";

  type Props = { title: string; images: ImageItem[]; aspect: "16/9" | "2/3"; size: "w300" | "w185" };
  let { title, images, aspect, size }: Props = $props();

  let zoomed = $state<string | null>(null);

  const items = $derived(images.slice(0, 12));
</script>

{#if items.length > 0}
  <div class="space-y-2">
    <h2 class="text-sm font-medium uppercase tracking-wider text-muted">{title}</h2>
    <div
      class="grid gap-2 {aspect === '16/9'
        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
        : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'}"
    >
      {#each items as img (img.file_path)}
        <button
          type="button"
          use:tactile={{ haptic: "tick" }}
          onclick={() => (zoomed = img.file_path)}
          class="tap-target tap-target--card overflow-hidden rounded-md bg-surface-2"
          style="aspect-ratio: {aspect}"
        >
          <img
            src="https://image.tmdb.org/t/p/{size}{img.file_path}"
            alt=""
            class="h-full w-full object-cover"
            loading="lazy"
          />
        </button>
      {/each}
    </div>
  </div>

  {#if zoomed}
    <button
      type="button"
      onclick={() => (zoomed = null)}
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      aria-label="Close"
    >
      <img
        src="https://image.tmdb.org/t/p/original{zoomed}"
        alt=""
        class="max-h-full max-w-full rounded-lg object-contain"
      />
    </button>
  {/if}
{/if}
