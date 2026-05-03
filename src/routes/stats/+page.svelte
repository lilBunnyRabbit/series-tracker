<script lang="ts">
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { STATUS_COLOR, STATUS_LABEL, STATUSES } from "$lib/types";
  import type { Entry, Status, TvEntry } from "$lib/types";

  // Fallbacks used when TMDB didn't supply runtime — older entries in the
  // library may have been added before the field was captured. Picking 45m/TV
  // and 110m/movie as the global medians keeps approximate hours useful.
  const FALLBACK_TV_RUNTIME = 45;
  const FALLBACK_MOVIE_RUNTIME = 110;

  const now = new Date();
  const thisYear = now.getFullYear();

  function watchedEpisodes(e: TvEntry): number {
    return e.seasons.reduce((a, s) => a + Math.min(e.progress[s.number] ?? 0, s.episodeCount), 0);
  }

  function entryMinutes(e: Entry): number {
    if (e.kind === "tv") {
      const eps = watchedEpisodes(e);
      const rt = e.runtime ?? FALLBACK_TV_RUNTIME;
      return eps * rt;
    }
    if (e.status === "completed") {
      return e.runtime ?? FALLBACK_MOVIE_RUNTIME;
    }
    return 0;
  }

  type Tally = { id: number; name: string; count: number };

  const stats = $derived.by(() => {
    const entries = store.entries;
    const tv = entries.filter((e): e is TvEntry => e.kind === "tv");
    const movies = entries.filter((e) => e.kind === "movie");

    const statusCounts: Record<Status, number> = {
      watching: 0,
      completed: 0,
      plan: 0,
      dropped: 0,
      tuned: 0,
    };
    for (const e of entries) statusCounts[e.status]++;

    const totalMinutes = entries.reduce((a, e) => a + entryMinutes(e), 0);

    let totalEpisodesWatched = 0;
    for (const e of tv) totalEpisodesWatched += watchedEpisodes(e);

    const completedThisYear = entries.filter((e) => {
      if (e.status !== "completed") return false;
      // updatedAt is ISO; year is the first 4 chars after the date "YYYY-..."
      return (e.updatedAt ?? "").slice(0, 4) === String(thisYear);
    });

    const ratings = entries.filter((e) => typeof e.rating === "number" && e.rating > 0);
    const avgRating =
      ratings.length > 0 ? ratings.reduce((a, e) => a + (e.rating ?? 0), 0) / ratings.length : null;

    const genreMap = new Map<number, Tally>();
    for (const e of entries) {
      if (!e.genres) continue;
      for (const g of e.genres) {
        const hit = genreMap.get(g.id);
        if (hit) hit.count++;
        else genreMap.set(g.id, { id: g.id, name: g.name, count: 1 });
      }
    }
    const topGenres = [...genreMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    const entriesWithGenres = entries.filter((e) => e.genres && e.genres.length > 0).length;

    return {
      total: entries.length,
      tvCount: tv.length,
      movieCount: movies.length,
      statusCounts,
      totalMinutes,
      totalEpisodesWatched,
      completedThisYear: completedThisYear.length,
      avgRating,
      ratedCount: ratings.length,
      topGenres,
      entriesWithGenres,
    };
  });

  const topRated = $derived.by<Entry[]>(() => {
    return [...store.entries]
      .filter((e) => typeof e.rating === "number" && e.rating > 0)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 6);
  });

  function fmtHours(minutes: number): string {
    if (minutes <= 0) return "0h";
    const days = Math.floor(minutes / (60 * 24));
    const hours = Math.floor((minutes % (60 * 24)) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  }

  function fmtNumber(n: number): string {
    return n.toLocaleString();
  }
</script>

{#snippet headerActions()}
  <a
    href="{base}/diary/"
    use:tactile={{ haptic: false }}
    aria-label="Diary"
    title="Diary"
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted hover-border-accent hover-text-text"
  >
    📓
    <span>Diary</span>
    {#if store.diary.length > 0}
      <span class="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] tabular-nums text-muted">
        {store.diary.length}
      </span>
    {/if}
  </a>
  <a
    href="{base}/settings/"
    use:tactile={{ haptic: false }}
    aria-label="Settings"
    class="tap-target tap-target--icon flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover-border-primary hover-text-text"
  >
    <Icon name="settings" size={16} />
  </a>
{/snippet}

<PageHeader title="Profile" subtitle="Your library at a glance" actions={headerActions} />

<section class="space-y-7">
  {#if stats.total === 0}
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-muted">
      <p class="mb-4">Your library is empty — start adding shows and movies to see stats.</p>
      <div class="flex justify-center gap-2">
        <a
          href="{base}/discover/"
          use:tactile={{ haptic: false }}
          class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-primary"
        >
          Discover
        </a>
        <a
          href="{base}/search/"
          use:tactile={{ haptic: false }}
          class="tap-target tap-target--btn rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
        >
          Search
        </a>
      </div>
    </div>
  {:else}
    <!-- Headline numbers -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-lg border border-border bg-surface p-4">
        <div class="text-2xl font-semibold tabular-nums">{fmtNumber(stats.tvCount)}</div>
        <div class="mt-1 text-[11px] uppercase tracking-wider text-muted">TV shows</div>
      </div>
      <div class="rounded-lg border border-border bg-surface p-4">
        <div class="text-2xl font-semibold tabular-nums">{fmtNumber(stats.movieCount)}</div>
        <div class="mt-1 text-[11px] uppercase tracking-wider text-muted">Movies</div>
      </div>
      <div class="rounded-lg border border-border bg-surface p-4">
        <div class="text-2xl font-semibold tabular-nums">{fmtHours(stats.totalMinutes)}</div>
        <div class="mt-1 text-[11px] uppercase tracking-wider text-muted">Time watched</div>
      </div>
      <div class="rounded-lg border border-border bg-surface p-4">
        <div class="text-2xl font-semibold tabular-nums">{fmtNumber(stats.totalEpisodesWatched)}</div>
        <div class="mt-1 text-[11px] uppercase tracking-wider text-muted">Episodes</div>
      </div>
    </div>

    <!-- Status breakdown -->
    <div class="space-y-3">
      <h2 class="text-sm font-medium uppercase tracking-wider text-muted">By status</h2>
      <div class="space-y-2">
        {#each STATUSES as s (s)}
          {@const c = STATUS_COLOR[s]}
          {@const count = stats.statusCounts[s]}
          {@const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0}
          <a
            href="{base}/watchlist/?status={s}"
            use:tactile
            class="tap-target tap-target--card flex items-center gap-3 rounded-md border border-border bg-surface p-3 hover-border-primary"
          >
            <span class="h-2 w-2 shrink-0 rounded-full {c.dot}" aria-hidden="true"></span>
            <span class="w-28 shrink-0 text-sm {c.text}">{STATUS_LABEL[s]}</span>
            <div class="flex-1">
              <div class="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div class="h-full {c.bg} transition-all" style="width: {pct}%"></div>
              </div>
            </div>
            <span class="w-10 shrink-0 text-right text-sm tabular-nums text-text">{fmtNumber(count)}</span>
            <span class="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">{pct}%</span>
          </a>
        {/each}
      </div>
    </div>

    <!-- This year -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="rounded-lg border border-border bg-surface p-4">
        <div class="text-2xl font-semibold tabular-nums">{fmtNumber(stats.completedThisYear)}</div>
        <div class="mt-1 text-[11px] uppercase tracking-wider text-muted">Completed in {thisYear}</div>
      </div>
      <div class="rounded-lg border border-border bg-surface p-4">
        <div class="flex items-baseline gap-2">
          <div class="text-2xl font-semibold tabular-nums">
            {stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—"}
          </div>
          {#if stats.avgRating !== null}
            <div class="text-sm text-muted">/ 10</div>
          {/if}
        </div>
        <div class="mt-1 text-[11px] uppercase tracking-wider text-muted">
          Avg rating
          {#if stats.ratedCount > 0}
            <span class="ml-1 normal-case">· {stats.ratedCount} rated</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Top genres -->
    {#if stats.topGenres.length > 0}
      <div class="space-y-3">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">
          Top genres
          {#if stats.entriesWithGenres < stats.total}
            <span class="ml-1 font-normal normal-case text-muted/70">
              (from {stats.entriesWithGenres} of {stats.total} entries)
            </span>
          {/if}
        </h2>
        <div class="flex flex-wrap gap-1.5 text-sm">
          {#each stats.topGenres as g (g.id)}
            <span class="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1">
              <span>{g.name}</span>
              <span class="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] tabular-nums text-muted">
                {g.count}
              </span>
            </span>
          {/each}
        </div>
      </div>
    {:else}
      <p class="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted">
        Genre data is captured when you add new entries — older entries don't contribute yet.
      </p>
    {/if}

    <!-- Top rated -->
    {#if topRated.length > 0}
      <div class="space-y-3">
        <h2 class="flex items-baseline justify-between text-sm font-medium uppercase tracking-wider text-muted">
          <span>Your top rated</span>
          <a
            href="{base}/leaderboard/"
            use:tactile={{ haptic: false }}
            class="tap-target text-[11px] font-normal normal-case text-muted hover-text-text"
          >
            See full leaderboard →
          </a>
        </h2>
        <div class="space-y-1.5">
          {#each topRated as e, i (e.kind + ":" + e.id)}
            <a
              href={e.kind === "tv" ? `${base}/show/${e.id}/` : `${base}/movie/${e.id}/`}
              use:tactile
              class="tap-target tap-target--card flex items-center gap-3 rounded-md border border-border bg-surface p-2.5 hover-border-accent"
            >
              <span class="w-5 shrink-0 text-center text-sm tabular-nums text-muted">#{i + 1}</span>
              <div class="h-12 w-9 shrink-0 overflow-hidden rounded bg-surface-2">
                {#if e.poster}
                  <img src={e.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{e.title}</div>
                <div class="text-[10px] uppercase tracking-wider text-muted">
                  {e.kind === "tv" ? "TV" : "Movie"}{e.year ? ` · ${e.year}` : ""}
                </div>
              </div>
              <span class="shrink-0 rounded-md bg-accent/15 px-2 py-1 text-xs font-semibold tabular-nums text-accent">
                ♥ {e.rating}
              </span>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <p class="text-center text-[11px] text-muted">
      Stats use {FALLBACK_TV_RUNTIME}m/episode and {FALLBACK_MOVIE_RUNTIME}m/movie defaults when runtime data isn't available.
    </p>
  {/if}
</section>
