<script lang="ts">
  import { base } from "$app/paths";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import Rail from "$lib/components/Rail.svelte";
  import { store } from "$lib/store.svelte";
  import type { Entry, TvEntry } from "$lib/types";

  type ContinueItem = {
    entry: TvEntry;
    season: number;
    episode: number;
    remaining: number;
  };

  function nextEpisode(e: TvEntry): { season: number; episode: number } | null {
    for (const s of e.seasons) {
      const cur = e.progress[s.number] ?? 0;
      if (cur < s.episodeCount) return { season: s.number, episode: cur + 1 };
    }
    return null;
  }

  function totalRemaining(e: TvEntry): number {
    return e.seasons.reduce((a, s) => a + Math.max(0, s.episodeCount - (e.progress[s.number] ?? 0)), 0);
  }

  const continueWatching = $derived.by<ContinueItem[]>(() => {
    return store.entries
      .filter((e): e is TvEntry => e.kind === "tv" && e.status === "watching")
      .map((e) => {
        const next = nextEpisode(e);
        if (!next) return null;
        return {
          entry: e,
          season: next.season,
          episode: next.episode,
          remaining: totalRemaining(e),
        };
      })
      .filter((x): x is ContinueItem => x !== null)
      .sort((a, b) => (b.entry.updatedAt ?? "").localeCompare(a.entry.updatedAt ?? ""))
      .slice(0, 12);
  });

  const startWatching = $derived.by<Entry[]>(() => {
    return store.entries
      .filter((e) => e.status === "plan")
      .sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""))
      .slice(0, 12);
  });

  const history = $derived.by<Entry[]>(() => {
    return store.entries
      .filter((e) => e.status === "completed" || e.status === "dropped")
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, 12);
  });

  function tvMeta(e: TvEntry): string {
    const total = e.seasons.reduce((a, s) => a + s.episodeCount, 0);
    return total > 0 ? `${total} ep` : "";
  }

  function continueMeta(item: ContinueItem): string {
    return `S${item.season} · E${item.episode} · ${item.remaining} left`;
  }
</script>

{#if store.entries.length === 0}
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">Welcome</h1>
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-muted">
      <p class="mb-4">Your library is empty.</p>
      <div class="flex justify-center gap-2">
        <a
          href="{base}/discover/"
          class="rounded-md border border-border px-4 py-2 text-sm hover:border-primary"
        >
          Browse discover
        </a>
        <a
          href="{base}/search/"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
        >
          Search TMDB
        </a>
      </div>
    </div>
  </section>
{:else}
  <div class="space-y-7">
    {#if continueWatching.length > 0}
      <Rail
        title="Continue Watching"
        seeAllHref="{base}/watchlist/?status=watching"
      >
        {#each continueWatching as item (item.entry.kind + ":" + item.entry.id)}
          <PosterCard
            kind="tv"
            id={item.entry.id}
            title={item.entry.title}
            poster={item.entry.poster}
            year={item.entry.year}
            meta={continueMeta(item)}
            voteAverage={item.entry.voteAverage}
            rating={item.entry.rating}
            status={item.entry.status}
          />
        {/each}
      </Rail>
    {/if}

    {#if startWatching.length > 0}
      <Rail
        title="Start Watching"
        subtitle="Plan to watch"
        seeAllHref="{base}/watchlist/?status=plan"
        onAction={() => (window.location.href = `${base}/search/`)}
        actionLabel="Add to plan"
      >
        {#each startWatching as e (e.kind + ":" + e.id)}
          <PosterCard
            kind={e.kind}
            id={e.id}
            title={e.title}
            poster={e.poster}
            year={e.year}
            meta={e.kind === "tv" ? tvMeta(e) : ""}
            voteAverage={e.voteAverage}
            rating={e.rating}
            status={e.status}
          />
        {/each}
      </Rail>
    {/if}

    {#if history.length > 0}
      <Rail
        title="History"
        subtitle="Recently completed & dropped"
        seeAllHref="{base}/watchlist/?status=completed"
      >
        {#each history as e (e.kind + ":" + e.id)}
          <PosterCard
            kind={e.kind}
            id={e.id}
            title={e.title}
            poster={e.poster}
            year={e.year}
            meta={e.kind === "tv" ? tvMeta(e) : ""}
            rating={e.rating}
            status={e.status}
            watched={e.status === "completed"}
          />
        {/each}
      </Rail>
    {/if}
  </div>
{/if}
