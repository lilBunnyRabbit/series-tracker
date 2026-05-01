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
    entryFromMovieDetail,
    movieDetail,
    movieDetailFull,
    posterUrl,
    recommendations,
    similar,
    watchProviders,
  } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import type { MovieDetailFull, Status, WatchProviderRegion } from "$lib/types";

  const id = $derived(Number(page.params.id));
  const region = $derived(store.preferences.region ?? defaultRegion());

  let detail = $state<MovieDetailFull | null>(null);
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
      movieDetailFull(id, apiKey, ctrl.signal),
      recommendations("movie", id, apiKey, ctrl.signal).catch(() => [] as RecommendationItem[]),
      similar("movie", id, apiKey, ctrl.signal).catch(() => [] as RecommendationItem[]),
      watchProviders("movie", id, apiKey, ctrl.signal).catch(() => null),
    ])
      .then(([d, r, s, p]) => {
        if (ctrl.signal.aborted) return;
        detail = d;
        related = r.slice(0, 16);
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

  const entry = $derived(store.get("movie", id));
  const inLibrary = $derived(!!entry);
  const status = $derived(entry?.status ?? null);

  const director = $derived(detail?.credits?.crew.find((c) => c.job === "Director"));
  const cast = $derived(detail?.credits?.cast?.slice(0, 16) ?? []);
  const trailers = $derived(detail?.videos?.results ?? []);
  const hasTrailer = $derived(
    trailers.some((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"))
  );

  async function addAs(s: Status): Promise<void> {
    if (!store.apiKey || !detail) return;
    const d = await movieDetail(id, store.apiKey);
    store.addToLibrary(entryFromMovieDetail(d, s));
  }

  function setExistingStatus(s: Status): void {
    store.setStatus("movie", id, s);
  }

  function toggleWatched(): void {
    if (!entry) return;
    store.setStatus("movie", id, entry.status === "completed" ? "plan" : "completed");
  }
</script>

<svelte:head>
  <title>{detail ? `${detail.title} · Series Tracker` : "Movie · Series Tracker"}</title>
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
        <h1 class="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{detail.title}</h1>

        {#if director}
          <p class="text-xs text-muted">
            Directed by
            <a href="{base}/person/{director.id}/" class="text-text hover:text-accent">{director.name}</a>
          </p>
        {/if}

        <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
          {#if detail.release_date}<span>{detail.release_date.slice(0, 4)}</span>{/if}
          {#if detail.runtime}
            <span aria-hidden="true">·</span>
            <span>{detail.runtime}m</span>
          {/if}
          {#if detail.genres && detail.genres.length > 0}
            <span aria-hidden="true">·</span>
            <span class="truncate">{detail.genres.slice(0, 2).map((g) => g.name).join(", ")}</span>
          {/if}
        </div>

        {#if detail.status && detail.status !== "Released"}
          <p class="text-xs font-medium uppercase tracking-wider text-accent">{detail.status}</p>
        {/if}

        {#if detail.tagline}
          <p class="text-sm italic text-muted">"{detail.tagline}"</p>
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
          <StatusMenu label="🔖" onSelect={addAs} title={`Add "${detail.title}" as...`} variant="outline" size="md" />
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
          href="{base}/movie/{id}/"
          aria-label="More tracking options"
          class="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-lg text-text transition hover:border-accent hover:text-accent"
        >
          ⋯
        </a>
      </div>
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

    <!-- IMAGES -->
    {#if detail.images?.backdrops && detail.images.backdrops.length > 0}
      <Gallery title="Backdrops" images={detail.images.backdrops} aspect="16/9" size="w300" />
    {/if}
    {#if detail.images?.posters && detail.images.posters.length > 0}
      <Gallery title="Posters" images={detail.images.posters} aspect="2/3" size="w185" />
    {/if}
  </div>
{/if}
