<script lang="ts">
  import { posterUrl } from "$lib/tmdb";
  import type { CastMember } from "$lib/types";

  type Props = { cast: CastMember[]; limit?: number };
  let { cast, limit = 12 }: Props = $props();

  const items = $derived(cast.slice(0, limit));
</script>

{#if items.length > 0}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
    {#each items as c (c.id)}
      <div class="overflow-hidden rounded-lg border border-border bg-surface">
        <div class="aspect-[2/3] w-full bg-surface-2">
          {#if c.profile_path}
            <img src={posterUrl(c.profile_path, "w185")} alt="" class="h-full w-full object-cover" loading="lazy" />
          {/if}
        </div>
        <div class="p-2">
          <div class="truncate text-xs font-medium">{c.name}</div>
          <div class="truncate text-[11px] text-muted">{c.character}</div>
        </div>
      </div>
    {/each}
  </div>
{/if}
