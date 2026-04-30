<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import Gallery from "$lib/components/Gallery.svelte";
  import Trailer from "$lib/components/Trailer.svelte";
  import { store } from "$lib/store.svelte";
  import { movieDetailFull, posterUrl } from "$lib/tmdb";
  import type { MovieDetailFull } from "$lib/types";

  const id = $derived(Number(page.params.id));

  let detail = $state<MovieDetailFull | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!store.apiKey || !id) return;
    loading = true;
    error = null;
    const ctrl = new AbortController();
    movieDetailFull(id, store.apiKey, ctrl.signal)
      .then((d) => (detail = d))
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        error = e instanceof Error ? e.message : String(e);
      })
      .finally(() => (loading = false));
    return () => ctrl.abort();
  });

  const backdrop = $derived(
    detail?.backdrop_path ? `https://image.tmdb.org/t/p/w780${detail.backdrop_path}` : null
  );
  const inLibrary = $derived(store.has("movie", id));
  const director = $derived(detail?.credits?.crew.find((c) => c.job === "Director"));
</script>

<section class="space-y-6">
  <a href="{base}/movie/{id}/" class="inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]">← Back to tracker</a>

  {#if loading && !detail}
    <p class="text-sm text-[var(--color-muted)]">Loading...</p>
  {:else if error}
    <p class="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger)]/15 p-3 text-sm text-[var(--color-danger)]">
      {error}
    </p>
  {:else if detail}
    {#if backdrop}
      <div class="relative -mx-3 -mt-4 h-48 overflow-hidden sm:-mx-4 sm:-mt-6 sm:h-64">
        <img src={backdrop} alt="" class="h-full w-full object-cover opacity-50" />
        <div class="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/70 to-transparent"></div>
      </div>
    {/if}

    <div class="flex flex-col gap-6 md:flex-row">
      <div class="w-full max-w-[180px] flex-shrink-0">
        <div class="aspect-[2/3] w-full overflow-hidden rounded-lg bg-[var(--color-surface-2)]">
          {#if detail.poster_path}
            <img src={posterUrl(detail.poster_path, "w342")} alt="" class="h-full w-full object-cover" />
          {/if}
        </div>
      </div>
      <div class="min-w-0 flex-1 space-y-3">
        <div>
          <h1 class="text-2xl font-semibold">{detail.title}</h1>
          {#if detail.tagline}<p class="text-sm italic text-[var(--color-muted)]">{detail.tagline}</p>{/if}
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
            {#if detail.release_date}<span>{detail.release_date.slice(0, 4)}</span>{/if}
            {#if detail.runtime}<span>· {detail.runtime} min</span>{/if}
            {#if detail.status}<span>· {detail.status}</span>{/if}
            {#if typeof detail.vote_average === "number" && detail.vote_average > 0}
              <span>· ★ {detail.vote_average.toFixed(1)}{detail.vote_count ? ` (${detail.vote_count.toLocaleString()})` : ""}</span>
            {/if}
          </div>
        </div>

        {#if detail.genres && detail.genres.length > 0}
          <div class="flex flex-wrap gap-1.5">
            {#each detail.genres as g (g.id)}
              <span class="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-xs">{g.name}</span>
            {/each}
          </div>
        {/if}

        <p class="text-sm text-[var(--color-text)]/90">{detail.overview}</p>

        {#if director}
          <p class="text-xs text-[var(--color-muted)]">Directed by <span class="text-[var(--color-text)]">{director.name}</span></p>
        {/if}

        <div class="flex flex-wrap gap-2 pt-2">
          <a
            href="{base}/movie/{id}/"
            class="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)]"
          >
            {inLibrary ? "Track" : "Add to library"}
          </a>
          {#if detail.external_ids?.imdb_id}
            <a
              href="https://www.imdb.com/title/{detail.external_ids.imdb_id}/"
              target="_blank"
              rel="noopener"
              class="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:border-[var(--color-accent)]"
            >
              IMDb ↗
            </a>
          {/if}
          <a
            href="https://www.themoviedb.org/movie/{detail.id}"
            target="_blank"
            rel="noopener"
            class="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:border-[var(--color-accent)]"
          >
            TMDB ↗
          </a>
        </div>
      </div>
    </div>

    {#if detail.credits?.cast && detail.credits.cast.length > 0}
      <div class="space-y-2">
        <h2 class="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">Cast</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {#each detail.credits.cast.slice(0, 12) as c (c.id)}
            <div class="flex flex-col">
              <div class="aspect-[2/3] w-full overflow-hidden rounded-md bg-[var(--color-surface-2)]">
                {#if c.profile_path}
                  <img src={posterUrl(c.profile_path, "w185")} alt="" class="h-full w-full object-cover" loading="lazy" />
                {/if}
              </div>
              <div class="mt-1.5 truncate text-xs font-medium">{c.name}</div>
              <div class="truncate text-xs text-[var(--color-muted)]">{c.character}</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if detail.videos?.results}
      <Trailer videos={detail.videos.results} />
    {/if}

    {#if detail.images?.backdrops && detail.images.backdrops.length > 0}
      <Gallery title="Backdrops" images={detail.images.backdrops} aspect="16/9" size="w300" />
    {/if}

    {#if detail.images?.posters && detail.images.posters.length > 0}
      <Gallery title="Posters" images={detail.images.posters} aspect="2/3" size="w185" />
    {/if}
  {/if}
</section>
