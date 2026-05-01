<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import Gallery from "$lib/components/Gallery.svelte";
  import PersonCard from "$lib/components/PersonCard.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import Rail from "$lib/components/Rail.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import StatusMenu from "$lib/components/StatusMenu.svelte";
  import Trailer from "$lib/components/Trailer.svelte";
  import WatchProviders from "$lib/components/WatchProviders.svelte";
  import { store } from "$lib/store.svelte";
  import {
    defaultRegion,
    entryFromTvDetail,
    posterUrl,
    recommendations,
    similar,
    tvDetail,
    tvDetailFull,
    watchProviders,
  } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import type { Status, TvDetailFull, WatchProviderRegion } from "$lib/types";

  const id = $derived(Number(page.params.id));
  const region = $derived(store.preferences.region ?? defaultRegion());

  let detail = $state<TvDetailFull | null>(null);
  let related = $state<RecommendationItem[]>([]);
  let similarItems = $state<RecommendationItem[]>([]);
  let providers = $state<WatchProviderRegion | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let trailerOpen = $state(false);

  $effect(() => {
    if (!store.apiKey || !id || Number.isNaN(id)) return;
    loading = true;
    error = null;
    const ctrl = new AbortController();
    const apiKey = store.apiKey;
    Promise.all([
      tvDetailFull(id, apiKey, ctrl.signal),
      recommendations("tv", id, apiKey, ctrl.signal).catch(() => [] as RecommendationItem[]),
      similar("tv", id, apiKey, ctrl.signal).catch(() => [] as RecommendationItem[]),
      watchProviders("tv", id, apiKey, ctrl.signal).catch(() => null),
    ])
      .then(([d, r, s, p]) => {
        if (ctrl.signal.aborted) return;
        detail = d;
        related = r.slice(0, 16);
        // Drop anything already in the recommendations list to keep the two
        // rails distinct (algorithmic vs keyword-overlap).
        const seen = new Set(r.map((x) => `${x.media_type}:${x.id}`));
        similarItems = s.filter((x) => !seen.has(`${x.media_type}:${x.id}`)).slice(0, 16);
        providers = p?.results?.[region] ?? null;
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        error = e instanceof Error ? e.message : String(e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) loading = false;
      });
    return () => ctrl.abort();
  });

  const entry = $derived(store.get("tv", id));
  const inLibrary = $derived(!!entry);
  const status = $derived(entry?.status ?? null);

  const creators = $derived(
    detail?.credits?.crew.filter((c) => c.job === "Creator").slice(0, 3) ??
      detail?.credits?.crew.filter((c) => c.job === "Executive Producer").slice(0, 3) ??
      []
  );

  const cast = $derived(detail?.credits?.cast?.slice(0, 16) ?? []);
  const trailers = $derived(detail?.videos?.results ?? []);
  const hasTrailer = $derived(
    trailers.some((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"))
  );

  async function addAs(s: Status): Promise<void> {
    if (!store.apiKey || !detail) return;
    // detail is the full version; tvDetail call will hit cache from the load above.
    const d = await tvDetail(id, store.apiKey);
    store.addToLibrary(entryFromTvDetail(d, s));
  }

  function setExistingStatus(s: Status): void {
    store.setStatus("tv", id, s);
  }

  function toggleWatched(): void {
    if (!entry || entry.kind !== "tv") return;
    store.setStatus("tv", id, entry.status === "completed" ? "watching" : "completed");
  }

  // Next-episode label for the inline +ep button. Returns null when the show
  // is fully watched (or not in library), which hides the button.
  const nextEp = $derived.by<{ season: number; episode: number; total: number } | null>(() => {
    if (!entry || entry.kind !== "tv") return null;
    for (const s of entry.seasons) {
      const cur = entry.progress[s.number] ?? 0;
      if (cur < s.episodeCount) {
        return { season: s.number, episode: cur + 1, total: s.episodeCount };
      }
    }
    return null;
  });

  let bumpFlash = $state(false);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  function bumpNextEpisode(): void {
    if (!entry || entry.kind !== "tv") return;
    if (!store.incrementCurrent(id)) return;
    bumpFlash = true;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (bumpFlash = false), 600);
  }
</script>

<svelte:head>
  <title>{detail ? `${detail.name} · Series Tracker` : "Show · Series Tracker"}</title>
</svelte:head>

{#if loading && !detail}
  <Skeleton variant="infoPage" />
{:else if error}
  <p class="rounded-md border border-danger bg-danger/15 p-3 text-sm text-danger">{error}</p>
{:else if detail}
  <div class="space-y-8">
    <!-- HERO: poster-only, centered, drop-shadow -->
    <section class="flex flex-col items-center gap-4 pt-2 text-center">
      <div class="w-44 sm:w-52 md:w-60">
        <div class="aspect-[2/3] w-full overflow-hidden rounded-xl border border-border/60 bg-surface-2 shadow-2xl">
          {#if detail.poster_path}
            <img src={posterUrl(detail.poster_path, "w500")} alt="" class="h-full w-full object-cover" />
          {/if}
        </div>
      </div>

      <!-- Multi-source rating row -->
      <div class="flex items-center gap-3 text-xs">
        {#if typeof detail.vote_average === "number" && detail.vote_average > 0}
          <span class="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 font-medium text-text">
            <span class="text-accent">★</span>
            <span class="tabular-nums">{Math.round(detail.vote_average * 10)}%</span>
            <span class="text-muted">TMDB</span>
          </span>
        {/if}
        {#if detail.external_ids?.imdb_id}
          <a
            href="https://www.imdb.com/title/{detail.external_ids.imdb_id}/"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-medium text-muted transition hover:border-accent hover:text-text"
          >
            <span class="font-bold">IMDb</span>
            <span class="text-[10px]">↗</span>
          </a>
        {/if}
      </div>

      <!-- Title block -->
      <div class="max-w-prose space-y-1.5">
        <h1 class="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{detail.name}</h1>

        {#if creators.length > 0}
          <p class="text-xs text-muted">
            Created by
            {#each creators as cr, i (cr.id)}
              <a href="{base}/person/{cr.id}/" class="text-text hover:text-accent">{cr.name}</a>{#if i < creators.length - 1},
              {/if}
            {/each}
          </p>
        {/if}

        <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
          {#if detail.first_air_date}<span>{detail.first_air_date.slice(0, 4)}</span>{/if}
          <span aria-hidden="true">·</span>
          <span>{detail.number_of_episodes} ep</span>
          {#if detail.episode_run_time && detail.episode_run_time.length > 0}
            <span aria-hidden="true">·</span>
            <span>~{detail.episode_run_time[0]}m</span>
          {/if}
          {#if detail.genres && detail.genres.length > 0}
            <span aria-hidden="true">·</span>
            <span class="truncate">{detail.genres.slice(0, 2).map((g) => g.name).join(", ")}</span>
          {/if}
        </div>

        {#if detail.status}
          <p class="text-xs font-medium uppercase tracking-wider text-accent">{detail.status}</p>
        {/if}
      </div>

      <!-- Action bar: icon pill row -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={inLibrary ? toggleWatched : () => addAs("completed")}
          aria-pressed={status === "completed"}
          aria-label={status === "completed" ? "Mark unwatched" : "Mark watched"}
          class="flex h-12 w-12 items-center justify-center rounded-full border text-xl transition {status ===
          'completed'
            ? 'border-primary bg-primary text-bg'
            : 'border-border bg-surface text-text hover:border-primary hover:text-primary'}"
        >
          ✓
        </button>

        {#if inLibrary && status}
          <button
            type="button"
            onclick={() => setExistingStatus(status === "plan" ? "watching" : "plan")}
            aria-label={status === "plan" ? "Move to watching" : "Save for later"}
            class="flex h-12 w-12 items-center justify-center rounded-full border text-lg transition {status ===
            'plan'
              ? 'border-accent bg-accent text-bg'
              : 'border-border bg-surface text-text hover:border-accent hover:text-accent'}"
          >
            🔖
          </button>
        {:else}
          <StatusMenu label="🔖" onSelect={addAs} title={`Add "${detail.name}" as...`} variant="outline" size="md" />
        {/if}

        {#if hasTrailer}
          <button
            type="button"
            onclick={() => (trailerOpen = !trailerOpen)}
            aria-pressed={trailerOpen}
            aria-label="Trailer"
            class="flex h-12 w-12 items-center justify-center rounded-full border text-lg transition {trailerOpen
              ? 'border-accent bg-accent text-bg'
              : 'border-border bg-surface text-text hover:border-accent hover:text-accent'}"
          >
            ▶
          </button>
        {/if}

        <a
          href="{base}/show/{id}/"
          aria-label="More tracking options"
          class="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-lg text-text transition hover:border-accent hover:text-accent"
        >
          ⋯
        </a>
      </div>

      <!-- Inline track-next: bumps the next unwatched episode without leaving
           the page. Only shown for in-library shows that still have episodes
           left. -->
      {#if inLibrary && nextEp}
        <button
          type="button"
          onclick={bumpNextEpisode}
          aria-label="Mark S{nextEp.season} E{nextEp.episode} watched"
          class="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition {bumpFlash
            ? 'border-primary bg-primary text-bg'
            : 'border-border bg-surface hover:border-primary hover:text-primary'}"
        >
          <span class="text-base leading-none">+</span>
          <span>Watched S{nextEp.season} E{nextEp.episode}</span>
          <span class="text-[10px] tabular-nums text-muted">{nextEp.episode}/{nextEp.total}</span>
        </button>
      {/if}
    </section>

    <!-- TRAILER (collapsible) -->
    {#if trailerOpen && trailers.length > 0}
      <section>
        <Trailer videos={trailers} />
      </section>
    {/if}

    <!-- OVERVIEW -->
    {#if detail.overview}
      <section class="space-y-2">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Overview</h2>
        <p class="text-sm leading-relaxed text-text/90 sm:text-base">{detail.overview}</p>
      </section>
    {/if}

    <!-- WHERE TO WATCH -->
    <WatchProviders region={providers} regionCode={region} />

    <!-- ACTORS RAIL -->
    {#if cast.length > 0}
      <Rail title="Actors" subtitle="{detail.credits?.cast?.length ?? cast.length} in cast">
        {#each cast as c (c.id)}
          <PersonCard
            id={c.id}
            name={c.name}
            role={c.character}
            profile={posterUrl(c.profile_path, "w185")}
          />
        {/each}
      </Rail>
    {/if}

    <!-- WATCH NEXT (recommendations endpoint — sequels & franchise) -->
    {#if related.length > 0}
      <Rail title="Watch next" subtitle="Sequels & franchise">
        {#each related as r (r.media_type + ":" + r.id)}
          {#if r.media_type === "tv"}
            <PosterCard
              kind="tv"
              id={r.id}
              title={r.name}
              poster={posterUrl(r.poster_path, "w342")}
              year={r.first_air_date ? r.first_air_date.slice(0, 4) : undefined}
              voteAverage={r.vote_average}
            />
          {:else if r.media_type === "movie"}
            <PosterCard
              kind="movie"
              id={r.id}
              title={r.title}
              poster={posterUrl(r.poster_path, "w342")}
              year={r.release_date ? r.release_date.slice(0, 4) : undefined}
              voteAverage={r.vote_average}
            />
          {/if}
        {/each}
      </Rail>
    {/if}

    <!-- MORE LIKE THIS (similar endpoint — thematic) -->
    {#if similarItems.length > 0}
      <Rail title="More like this" subtitle="Thematically alike">
        {#each similarItems as r (r.media_type + ":" + r.id)}
          {#if r.media_type === "tv"}
            <PosterCard
              kind="tv"
              id={r.id}
              title={r.name}
              poster={posterUrl(r.poster_path, "w342")}
              year={r.first_air_date ? r.first_air_date.slice(0, 4) : undefined}
              voteAverage={r.vote_average}
            />
          {:else if r.media_type === "movie"}
            <PosterCard
              kind="movie"
              id={r.id}
              title={r.title}
              poster={posterUrl(r.poster_path, "w342")}
              year={r.release_date ? r.release_date.slice(0, 4) : undefined}
              voteAverage={r.vote_average}
            />
          {/if}
        {/each}
      </Rail>
    {/if}

    <!-- SEASONS -->
    {#if detail.seasons.length > 0}
      <section class="space-y-3">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Seasons</h2>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each detail.seasons.filter((s) => s.season_number > 0 || s.episode_count > 0) as s (s.season_number)}
            <div class="flex gap-3 rounded-md border border-border bg-surface p-2">
              <div class="h-20 w-14 flex-shrink-0 overflow-hidden rounded bg-surface-2">
                {#if s.poster_path}
                  <img src={posterUrl(s.poster_path, "w185")} alt="" class="h-full w-full object-cover" loading="lazy" />
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{s.name}</div>
                <div class="text-xs text-muted">{s.episode_count} ep{s.episode_count === 1 ? "" : "s"}</div>
                {#if s.air_date}<div class="text-[11px] text-muted">{s.air_date}</div>{/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- IMAGES -->
    {#if detail.images?.backdrops && detail.images.backdrops.length > 0}
      <Gallery title="Backdrops" images={detail.images.backdrops} aspect="16/9" size="w300" />
    {/if}
    {#if detail.images?.posters && detail.images.posters.length > 0}
      <Gallery title="Posters" images={detail.images.posters} aspect="2/3" size="w185" />
    {/if}
  </div>
{/if}
