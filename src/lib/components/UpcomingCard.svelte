<script lang="ts">
  import EpisodeCard from "$lib/components/EpisodeCard.svelte";
  import { store } from "$lib/store.svelte";
  import { currentTemptation, glowIntensity, TEMPTATION_GLOW_COLOR } from "$lib/temptation";
  import { backdropUrl } from "$lib/tmdb";
  import type { EpisodeBrief, TvEntry } from "$lib/types";

  type Props = {
    entry: TvEntry;
    season: number;
    episode: EpisodeBrief;
    daysOut: number;
  };
  let { entry, season, episode, daysOut }: Props = $props();

  function airBadge(d: number): string {
    if (d <= 0) return "Today";
    if (d === 1) return "Tomorrow";
    return `In ${d}d`;
  }

  const episodeLabel = $derived(
    episode.name
      ? `S${season} · E${episode.episode_number} — ${episode.name}`
      : `S${season} · E${episode.episode_number}`
  );
  const topLeft = $derived(airBadge(daysOut));
  const bottomLeft = $derived(
    typeof episode.runtime === "number" && episode.runtime > 0 ? `${episode.runtime}m` : undefined
  );
  // Prefer the per-episode still; fall back to the show's backdrop captured at
  // add time so cards don't go blank when TMDB hasn't posted a still yet.
  const backdrop = $derived(backdropUrl(episode.still_path) ?? entry.backdrop ?? null);

  const tempt = $derived(currentTemptation(entry, store.preferences.temptationPacing));
  const glow = $derived(glowIntensity(tempt));
  const glowStyle = $derived(`--tt: ${glow.toFixed(3)}; --tt-c: ${TEMPTATION_GLOW_COLOR[entry.status]};`);
</script>

<EpisodeCard
  kind="tv"
  id={entry.id}
  title={entry.title}
  {backdrop}
  poster={entry.poster}
  {episodeLabel}
  {topLeft}
  {bottomLeft}
  {glowStyle}
/>
