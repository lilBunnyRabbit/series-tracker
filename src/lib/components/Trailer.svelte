<script lang="ts">
  import type { Video } from "$lib/types";

  type Props = { videos: Video[] };
  let { videos }: Props = $props();

  let playing = $state<string | null>(null);

  const trailers = $derived.by(() => {
    const yt = videos.filter((v) => v.site === "YouTube");
    const officialTrailers = yt.filter((v) => v.type === "Trailer" && v.official);
    const trailers = yt.filter((v) => v.type === "Trailer");
    const teasers = yt.filter((v) => v.type === "Teaser");
    const clips = yt.filter((v) => v.type === "Clip");
    const seen = new Set<string>();
    const ordered = [...officialTrailers, ...trailers, ...teasers, ...clips].filter((v) => {
      if (seen.has(v.key)) return false;
      seen.add(v.key);
      return true;
    });
    return ordered.slice(0, 6);
  });
</script>

{#if trailers.length > 0}
  <div class="space-y-2">
    <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Trailers & clips</h2>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {#each trailers as v (v.key)}
        <div class="overflow-hidden rounded-lg border border-border bg-surface">
          {#if playing === v.key}
            <div class="aspect-video w-full">
              <iframe
                title={v.name}
                src="https://www.youtube-nocookie.com/embed/{v.key}?autoplay=1&rel=0"
                class="h-full w-full"
                frameborder="0"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            </div>
          {:else}
            <button
              type="button"
              onclick={() => (playing = v.key)}
              class="group relative block aspect-video w-full overflow-hidden"
              aria-label="Play {v.name}"
            >
              <img
                src="https://img.youtube.com/vi/{v.key}/hqdefault.jpg"
                alt=""
                class="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
              <div class="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/15">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-bg shadow-lg"
                >
                  <span class="ml-0.5 text-lg leading-none">▶</span>
                </div>
              </div>
            </button>
          {/if}
          <div class="px-3 py-2">
            <div class="line-clamp-2 text-xs font-medium">{v.name}</div>
            <div class="text-[10px] uppercase tracking-wider text-muted">{v.type}</div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
