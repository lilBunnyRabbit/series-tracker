<script lang="ts">
  import EpisodeCard from "$lib/components/EpisodeCard.svelte";
  import { store } from "$lib/store.svelte";
  import { currentTemptation, glowIntensity, TEMPTATION_GLOW_COLOR } from "$lib/temptation";
  import type { TvEntry } from "$lib/types";

  type Props = {
    entry: TvEntry;
    season: number;
    episode: number;
    remaining: number;
  };
  let { entry, season, episode, remaining }: Props = $props();

  function daysSince(iso?: string): string {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    const days = Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
    return `${days}d`;
  }

  const episodeLabel = $derived(`S${season} · E${episode}`);
  const topLeft = $derived(
    typeof entry.runtime === "number" && entry.runtime > 0 ? `${entry.runtime}m` : undefined
  );
  const bottomLeft = $derived.by(() => {
    const days = daysSince(entry.updatedAt);
    return days ? `${remaining} remaining · ${days}` : `${remaining} remaining`;
  });

  const tempt = $derived(currentTemptation(entry, store.preferences.temptationPacing));
  const glow = $derived(glowIntensity(tempt));
  const glowStyle = $derived(`--tt: ${glow.toFixed(3)}; --tt-c: ${TEMPTATION_GLOW_COLOR[entry.status]};`);
</script>

<EpisodeCard
  kind="tv"
  id={entry.id}
  title={entry.title}
  backdrop={entry.backdrop ?? null}
  poster={entry.poster}
  {episodeLabel}
  {topLeft}
  {bottomLeft}
  {glowStyle}
/>
