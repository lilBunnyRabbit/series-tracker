<script lang="ts">
  type Props = {
    kind: "tv" | "movie";
    /** "overlay" — dark translucent pill for poster image overlays. "chip" — translucent surface chip matching the rating chip, for card-surface clusters. */
    variant?: "overlay" | "chip";
  };

  let { kind, variant = "overlay" }: Props = $props();

  const label = $derived(kind === "tv" ? "TV" : "Movie");
</script>

{#if variant === "overlay"}
  <span class="inline-flex items-center rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-text backdrop-blur-sm">
    {label}
  </span>
{:else}
  <span class="inline-flex items-center rounded-md bg-muted/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
    {label}
  </span>
{/if}
