<script lang="ts">
  import { base } from "$app/paths";
  import { tactile } from "$lib/tactile";

  type Props = {
    id: number;
    name: string;
    /** Role / character on the current title — e.g. "Meredith Grey". */
    role?: string;
    profile: string | null;
    /** Episode count overlay for this title — clever way to show involvement. */
    episodeCount?: number;
  };

  let { id, name, role, profile, episodeCount }: Props = $props();

  const href = $derived(`${base}/person/${id}/`);
</script>

<a
  href={href}
  use:tactile
  class="tap-target tap-target--card hover-zoom group flex w-[100px] flex-col gap-1.5 sm:w-[112px]"
  aria-label={name}
>
  <div class="tx-card-poster relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-border/60 bg-surface-2 shadow-sm">
    {#if profile}
      <img src={profile} alt="" class="h-full w-full object-cover" loading="lazy" />
    {/if}
    {#if typeof episodeCount === "number" && episodeCount > 0}
      <span class="absolute bottom-1 right-1 rounded bg-overlay px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-on-overlay backdrop-blur-sm">
        {episodeCount} ep.
      </span>
    {/if}
  </div>
  <div class="min-w-0 px-0.5">
    <div class="line-clamp-1 text-xs font-medium leading-snug">{name}</div>
    {#if role}
      <div class="line-clamp-1 text-[10px] text-muted">{role}</div>
    {/if}
  </div>
</a>
