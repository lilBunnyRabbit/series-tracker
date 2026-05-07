<script lang="ts">
  import EpisodeCard from "$lib/components/EpisodeCard.svelte";
  import { store } from "$lib/store.svelte";
  import { currentTemptation, glowIntensity, TEMPTATION_GLOW_COLOR } from "$lib/temptation";
  import type { MovieEntry, TvEntry } from "$lib/types";

  // Accepts either a TV entry (with season + episode + remaining) or a movie
  // entry (with minutesWatched + minutesTotal). Caller passes only the props
  // that match the entry kind; the component picks the right label set.
  type Props = {
    entry: TvEntry | MovieEntry;
    /** TV-only: next season number to watch. */
    season?: number;
    /** TV-only: next episode number to watch. */
    episode?: number;
    /** TV-only: episodes still unwatched across the show. */
    remaining?: number;
    /** Movie-only: minutes watched so far. */
    minutesWatched?: number;
    /** Movie-only: total runtime. Used for the "of {N}m" suffix. */
    minutesTotal?: number;
  };
  let { entry, season, episode, remaining, minutesWatched, minutesTotal }: Props = $props();

  function daysSince(iso?: string): string {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    const days = Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
    return `${days}d`;
  }

  const episodeLabel = $derived(
    entry.kind === "tv" && season !== undefined && episode !== undefined
      ? `S${season} · E${episode}`
      : undefined
  );
  const topLeft = $derived(
    typeof entry.runtime === "number" && entry.runtime > 0 ? `${entry.runtime}m` : undefined
  );
  const bottomLeft = $derived.by(() => {
    const days = daysSince(entry.updatedAt);
    if (entry.kind === "tv") {
      const left = remaining ?? 0;
      return days ? `${left} remaining · ${days}` : `${left} remaining`;
    }
    const watched = minutesWatched ?? 0;
    const total = minutesTotal ?? entry.runtime ?? 0;
    const head = total > 0 ? `${watched}m of ${total}m` : `${watched}m`;
    return days ? `${head} · ${days}` : head;
  });

  const tempt = $derived(currentTemptation(entry, store.preferences.temptationPacing));
  const glow = $derived(glowIntensity(tempt));
  const glowStyle = $derived(`--tt: ${glow.toFixed(3)}; --tt-c: ${TEMPTATION_GLOW_COLOR[entry.status]};`);
</script>

<EpisodeCard
  kind={entry.kind}
  id={entry.id}
  title={entry.title}
  backdrop={entry.backdrop ?? null}
  poster={entry.poster}
  {episodeLabel}
  {topLeft}
  {bottomLeft}
  {glowStyle}
/>
