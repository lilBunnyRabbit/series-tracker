<script lang="ts">
  import Rail from "$lib/components/Rail.svelte";
  import { tactile } from "$lib/tactile";
  import { posterUrl } from "$lib/tmdb";
  import type { WatchProvider, WatchProviderRegion } from "$lib/types";

  type Props = {
    region: WatchProviderRegion | null;
    /** Resolved 2-letter region code (e.g. "US"). */
    regionCode: string;
  };

  let { region, regionCode }: Props = $props();

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
</script>

{#if flat.length > 0}
  <Rail
    title="Where to Watch"
    subtitle="{regionCode} · via JustWatch"
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
  </Rail>
{/if}
