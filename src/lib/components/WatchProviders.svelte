<script lang="ts">
  import { tactile } from "$lib/tactile";
  import { posterUrl } from "$lib/tmdb";
  import type { WatchProvider, WatchProviderRegion } from "$lib/types";

  type Props = {
    /** Full TMDB `results` map: region code → providers for that country. */
    results: Record<string, WatchProviderRegion> | null | undefined;
    /** Currently selected region (2-letter ISO code). */
    selectedRegion: string;
    /** Fired when the user picks a different region. Parent decides whether to persist. */
    onSelectedRegionChange: (code: string) => void;
    /** UI locale used to render country names (e.g. "United States" vs "Združene države Amerike"). */
    uiLocale: string;
  };

  let { results, selectedRegion, onSelectedRegionChange, uiLocale }: Props = $props();

  const regionDisplay = $derived.by(() => {
    try {
      return new Intl.DisplayNames([uiLocale], { type: "region" });
    } catch {
      return null;
    }
  });

  function regionName(code: string): string {
    return regionDisplay?.of(code) ?? code;
  }

  const availableRegions = $derived.by<string[]>(() => {
    if (!results) return [];
    return Object.keys(results).sort((a, b) => regionName(a).localeCompare(regionName(b), uiLocale));
  });

  const region = $derived<WatchProviderRegion | null>(
    (selectedRegion && results?.[selectedRegion]) || null
  );

  type Group = { kind: "Stream" | "Free" | "Rent" | "Buy"; providers: WatchProvider[] };

  const groups = $derived.by<Group[]>(() => {
    if (!region) return [];
    const out: Group[] = [];
    if (region.flatrate?.length) out.push({ kind: "Stream", providers: region.flatrate });
    if (region.free?.length) out.push({ kind: "Free", providers: region.free });
    if (region.rent?.length) out.push({ kind: "Rent", providers: region.rent });
    if (region.buy?.length) out.push({ kind: "Buy", providers: region.buy });
    return out;
  });

  // Flatten + dedupe providers across groups, but keep each provider's first kind label.
  // The rail then shows each provider once with its primary availability mode.
  type FlatItem = { provider: WatchProvider; kind: Group["kind"] };

  const flat = $derived.by<FlatItem[]>(() => {
    const seen = new Set<number>();
    const out: FlatItem[] = [];
    for (const g of groups) {
      for (const p of g.providers) {
        if (seen.has(p.provider_id)) continue;
        seen.add(p.provider_id);
        out.push({ provider: p, kind: g.kind });
      }
    }
    return out;
  });

  const link = $derived(region?.link ?? null);

  function onChange(e: Event): void {
    onSelectedRegionChange((e.currentTarget as HTMLSelectElement).value);
  }
</script>

{#if availableRegions.length > 0}
  <section class="space-y-2.5">
    <div class="flex items-center gap-2">
      <h2 class="shrink-0 text-base font-semibold tracking-tight text-text">Where to Watch</h2>
      <select
        value={selectedRegion}
        onchange={onChange}
        aria-label="Region"
        class="region-select min-w-0 max-w-[12rem] rounded-md border border-strong bg-surface-2 px-2 py-0.5 text-xs outline-none focus:border-accent"
      >
        {#each availableRegions as code (code)}
          <option value={code}>{regionName(code)}</option>
        {/each}
      </select>
      <span class="ml-auto shrink-0 text-xs text-muted">via JustWatch</span>
    </div>

    {#if flat.length > 0}
      <div class="-mx-3 sm:-mx-4">
        <div
          class="rail-track flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-3 px-3 pb-2 sm:scroll-px-4 sm:px-4"
        >
          {#each flat as item (item.provider.provider_id)}
            <a
              href={link ?? "#"}
              target={link ? "_blank" : undefined}
              rel={link ? "noopener" : undefined}
              use:tactile
              class="tap-target tap-target--card group flex w-[112px] flex-col items-center gap-1.5 rounded-lg border border-border bg-surface p-2 hover-border-primary"
            >
              <div class="aspect-square w-full overflow-hidden rounded-md bg-surface-2">
                {#if item.provider.logo_path}
                  <img
                    src={posterUrl(item.provider.logo_path, "w185")}
                    alt={item.provider.provider_name}
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                {/if}
              </div>
              <div class="min-w-0 text-center">
                <div class="line-clamp-1 text-[11px] font-medium leading-tight">{item.provider.provider_name}</div>
                <div class="text-[10px] uppercase tracking-wider text-muted">{item.kind}</div>
              </div>
            </a>
          {/each}
        </div>
      </div>
    {:else}
      <p class="text-xs text-muted">No providers listed for {regionName(selectedRegion)}.</p>
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
  /* Native <select> sizes itself to the longest <option>; clip to the chosen
     value width so long country names don't blow out the row. */
  .region-select {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }
</style>
