<script lang="ts">
  import { tactile } from "$lib/tactile";
  import type { ImageItem } from "$lib/types";

  type Props = {
    title: string;
    images: ImageItem[];
    aspect: "16/9" | "2/3";
    size: "w300" | "w185";
    /** Number of images visible before the user taps "Show all". Default 8.
     *  Pass `Infinity` for galleries that should always render the full set. */
    initialCount?: number;
  };

  let { title, images, aspect, size, initialCount = 8 }: Props = $props();

  let zoomed = $state<string | null>(null);
  let zoomIndex = $state(0);
  let expanded = $state(false);

  // Capped on first render so the page doesn't ship 40+ thumbnails ahead of
  // the user actually wanting them. Tapping "Show all" flips expanded and the
  // remaining images come in via the same lazy-loaded grid.
  const items = $derived(expanded ? images : images.slice(0, initialCount));
  const remaining = $derived(Math.max(0, images.length - initialCount));

  function openZoom(filePath: string): void {
    zoomIndex = images.findIndex((img) => img.file_path === filePath);
    zoomed = filePath;
  }

  function closeZoom(): void {
    zoomed = null;
  }

  function step(delta: number): void {
    if (images.length === 0) return;
    zoomIndex = (zoomIndex + delta + images.length) % images.length;
    zoomed = images[zoomIndex].file_path;
  }

  function onZoomKey(e: KeyboardEvent): void {
    if (zoomed === null) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeZoom();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  }
</script>

<svelte:window onkeydown={onZoomKey} />

{#if items.length > 0}
  <div class="space-y-2">
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="text-sm font-medium uppercase tracking-wider text-muted">
        {title}
        <span class="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-muted">
          {images.length}
        </span>
      </h2>
      {#if remaining > 0}
        <button
          type="button"
          use:tactile
          onclick={() => (expanded = !expanded)}
          class="tap-target tap-target--btn rounded-md border border-border px-2.5 py-1 text-[11px] text-muted hover-border-accent hover-text-text"
        >
          {expanded ? "Show fewer" : `Show all (${images.length})`}
        </button>
      {/if}
    </div>
    <div
      class="grid gap-2 {aspect === '16/9'
        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
        : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'}"
    >
      {#each items as img (img.file_path)}
        <button
          type="button"
          use:tactile={{ haptic: "tick" }}
          onclick={() => openZoom(img.file_path)}
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
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <!-- Backdrop button covers the whole modal so any click — empty space
           OR through the image (which has pointer-events: none) — dismisses.
           Prev/next sit on z-10 above this layer so they intercept clicks
           before bubbling to the close handler. -->
      <button
        type="button"
        onclick={closeZoom}
        class="absolute inset-0 cursor-zoom-out"
        aria-label="Close"
      ></button>
      <img
        src="https://image.tmdb.org/t/p/original{zoomed}"
        alt=""
        class="pointer-events-none relative max-h-full max-w-full rounded-lg object-contain"
      />
      {#if images.length > 1}
        <button
          type="button"
          use:tactile={{ haptic: "tick" }}
          onclick={() => step(-1)}
          aria-label="Previous image"
          class="tap-target tap-target--icon absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl text-text backdrop-blur-sm"
        >
          ‹
        </button>
        <button
          type="button"
          use:tactile={{ haptic: "tick" }}
          onclick={() => step(1)}
          aria-label="Next image"
          class="tap-target tap-target--icon absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl text-text backdrop-blur-sm"
        >
          ›
        </button>
        <span class="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs tabular-nums text-text backdrop-blur-sm">
          {zoomIndex + 1} / {images.length}
        </span>
      {/if}
    </div>
  {/if}
{/if}
