<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import CastList from "$lib/components/CastList.svelte";
  import Gallery from "$lib/components/Gallery.svelte";
  import InfoStat from "$lib/components/InfoStat.svelte";
  import Trailer from "$lib/components/Trailer.svelte";
  import { store } from "$lib/store.svelte";
  import { posterUrl, tvDetailFull } from "$lib/tmdb";
  import type { TvDetailFull } from "$lib/types";

  const id = $derived(Number(page.params.id));

  let detail = $state<TvDetailFull | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!store.apiKey || !id) return;
    loading = true;
    error = null;
    const ctrl = new AbortController();
    tvDetailFull(id, store.apiKey, ctrl.signal)
      .then((d) => (detail = d))
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        error = e instanceof Error ? e.message : String(e);
      })
      .finally(() => (loading = false));
    return () => ctrl.abort();
  });

  const backdrop = $derived(
    detail?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}` : null
  );
  const inLibrary = $derived(store.has("tv", id));
  const creators = $derived(detail?.credits?.crew.filter((c) => c.job === "Creator" || c.job === "Executive Producer").slice(0, 3) ?? []);
</script>

{#if loading && !detail}
  <p class="text-sm text-[var(--color-muted)]">Loading...</p>
{:else if error}
  <p class="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger)]/15 p-3 text-sm text-[var(--color-danger)]">{error}</p>
{:else if detail}
  <div class="space-y-8">
    <!-- HERO -->
    <div class="relative -mx-3 sm:-mx-4">
      {#if backdrop}
        <div class="relative h-44 w-full overflow-hidden sm:h-72 md:h-[28rem]">
          <img src={backdrop} alt="" class="h-full w-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/60 to-[var(--color-bg)]/20"></div>
        </div>
      {/if}

      <div class="px-3 sm:px-4 {backdrop ? 'md:-mt-40' : ''}">
        <div class="flex gap-4 md:items-end md:gap-6">
          <div class="w-24 flex-shrink-0 sm:w-32 md:w-52">
            <div class="aspect-[2/3] w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-lg">
              {#if detail.poster_path}
                <img src={posterUrl(detail.poster_path, "w342")} alt="" class="h-full w-full object-cover" />
              {/if}
            </div>
          </div>

          <div class="min-w-0 flex-1 space-y-2 sm:space-y-3">
            <div>
              <h1 class="text-2xl font-semibold leading-tight sm:text-3xl">{detail.name}</h1>
              {#if detail.tagline}
                <p class="mt-1 text-sm italic text-[var(--color-muted)]">"{detail.tagline}"</p>
              {/if}
            </div>

            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
              {#if typeof detail.vote_average === "number" && detail.vote_average > 0}
                <span class="rounded bg-[var(--color-surface)] px-2 py-0.5 font-medium text-[var(--color-text)]">
                  ★ {detail.vote_average.toFixed(1)}
                </span>
              {/if}
              {#if detail.first_air_date}<span>{detail.first_air_date.slice(0, 4)}</span>{/if}
              {#if detail.episode_run_time && detail.episode_run_time.length > 0}
                <span>· ~{detail.episode_run_time[0]} min</span>
              {/if}
              <span>· {detail.number_of_seasons}s · {detail.number_of_episodes}ep</span>
              {#if detail.status}<span>· {detail.status}</span>{/if}
            </div>

            {#if detail.genres && detail.genres.length > 0}
              <div class="flex flex-wrap gap-1.5">
                {#each detail.genres as g (g.id)}
                  <span class="rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-xs">{g.name}</span>
                {/each}
              </div>
            {/if}

            <div class="flex flex-wrap gap-2 pt-1">
              <a
                href="{base}/show/{id}/"
                class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-bg)]"
              >
                {inLibrary ? "Track" : "Add to library"}
              </a>
              {#if detail.external_ids?.imdb_id}
                <a
                  href="https://www.imdb.com/title/{detail.external_ids.imdb_id}/"
                  target="_blank"
                  rel="noopener"
                  class="rounded-md border border-[var(--color-secondary)]/40 px-4 py-2 text-sm text-[var(--color-secondary)] transition hover:bg-[var(--color-secondary)] hover:text-[var(--color-bg)]"
                >
                  IMDb ↗
                </a>
              {/if}
              <a
                href="https://www.themoviedb.org/tv/{detail.id}"
                target="_blank"
                rel="noopener"
                class="rounded-md border border-[var(--color-secondary)]/40 px-4 py-2 text-sm text-[var(--color-secondary)] transition hover:bg-[var(--color-secondary)] hover:text-[var(--color-bg)]"
              >
                TMDB ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- OVERVIEW -->
    {#if detail.overview}
      <section class="space-y-2">
        <h2 class="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">Overview</h2>
        <p class="max-w-prose text-sm leading-relaxed text-[var(--color-text)]/90 sm:text-base">{detail.overview}</p>
      </section>
    {/if}

    <!-- DETAILS GRID -->
    <section class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      <InfoStat label="First aired" value={detail.first_air_date || "—"} />
      <InfoStat label="Status" value={detail.status || "—"} />
      <InfoStat label="Seasons" value={String(detail.number_of_seasons)} />
      <InfoStat label="Episodes" value={String(detail.number_of_episodes)} />
      {#if detail.networks && detail.networks.length > 0}
        <InfoStat label="Network" value={detail.networks.map((n) => n.name).join(", ")} />
      {/if}
      {#if creators.length > 0}
        <InfoStat label="Creators" value={creators.map((c) => c.name).join(", ")} />
      {/if}
      {#if typeof detail.vote_average === "number" && detail.vote_average > 0}
        <InfoStat
          label="TMDB rating"
          value={`${detail.vote_average.toFixed(1)}${detail.vote_count ? ` (${detail.vote_count.toLocaleString()})` : ""}`}
        />
      {/if}
      {#if detail.episode_run_time && detail.episode_run_time.length > 0}
        <InfoStat label="Runtime" value={`~${detail.episode_run_time[0]} min`} />
      {/if}
    </section>

    <!-- CAST -->
    {#if detail.credits?.cast && detail.credits.cast.length > 0}
      <section class="space-y-3">
        <h2 class="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">Cast</h2>
        <CastList cast={detail.credits.cast} />
      </section>
    {/if}

    <!-- TRAILERS -->
    {#if detail.videos?.results && detail.videos.results.length > 0}
      <section>
        <Trailer videos={detail.videos.results} />
      </section>
    {/if}

    <!-- BACKDROPS -->
    {#if detail.images?.backdrops && detail.images.backdrops.length > 0}
      <section>
        <Gallery title="Backdrops" images={detail.images.backdrops} aspect="16/9" size="w300" />
      </section>
    {/if}

    <!-- POSTERS -->
    {#if detail.images?.posters && detail.images.posters.length > 0}
      <section>
        <Gallery title="Posters" images={detail.images.posters} aspect="2/3" size="w185" />
      </section>
    {/if}

    <!-- SEASONS -->
    {#if detail.seasons.length > 0}
      <section class="space-y-3">
        <h2 class="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">Seasons</h2>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each detail.seasons.filter((s) => s.season_number > 0 || s.episode_count > 0) as s (s.season_number)}
            <div class="flex gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
              <div class="h-20 w-14 flex-shrink-0 overflow-hidden rounded bg-[var(--color-surface-2)]">
                {#if s.poster_path}
                  <img src={posterUrl(s.poster_path, "w185")} alt="" class="h-full w-full object-cover" loading="lazy" />
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{s.name}</div>
                <div class="text-xs text-[var(--color-muted)]">{s.episode_count} episode{s.episode_count === 1 ? "" : "s"}</div>
                {#if s.air_date}<div class="text-[11px] text-[var(--color-muted)]">{s.air_date}</div>{/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </div>
{/if}
