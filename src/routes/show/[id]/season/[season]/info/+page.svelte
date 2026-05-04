<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import Gallery from "$lib/components/Gallery.svelte";
  import PersonCard from "$lib/components/PersonCard.svelte";
  import Rail from "$lib/components/Rail.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import Trailer from "$lib/components/Trailer.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { posterUrl, seasonDetailFull } from "$lib/tmdb";
  import { STATUS_COLOR } from "$lib/types";
  import type { EpisodeBrief, SeasonDetailFull, TvEntry } from "$lib/types";

  const showId = $derived(Number(page.params.id));
  const season = $derived(Number(page.params.season));

  let detail = $state<SeasonDetailFull | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let trailerOpen = $state(false);

  const entry = $derived(store.get("tv", showId) as TvEntry | undefined);
  const seasonInfo = $derived(entry?.seasons.find((s) => s.number === season));
  const sc = $derived(entry ? STATUS_COLOR[entry.status] : null);
  const todayIso = new Date().toISOString().slice(0, 10);
  // Watched-progress threshold drives the per-episode border tint below — same
  // as the season tracker page, so the two views stay visually in sync.
  const current = $derived(entry?.progress[season] ?? 0);

  $effect(() => {
    if (!store.apiKey || !showId || Number.isNaN(showId) || Number.isNaN(season)) return;
    loading = true;
    error = null;
    const ctrl = new AbortController();
    seasonDetailFull(showId, season, store.apiKey, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        detail = d;
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

  // Hero data — prefers TMDB-fresh values, falls back to library entry while
  // detail is loading so the title doesn't pop in late.
  const heroPoster = $derived(
    detail?.poster_path ? posterUrl(detail.poster_path, "w342") : (entry?.poster ?? null)
  );
  const heroTitle = $derived(detail?.name ?? seasonInfo?.name ?? `Season ${season}`);
  const heroYear = $derived(detail?.air_date ? detail.air_date.slice(0, 4) : null);
  const totalEpisodes = $derived(detail?.episodes.length ?? seasonInfo?.episodeCount ?? 0);

  // Cast lives at the season level via append_to_response=credits — distinct
  // from the show-level cast. Slice to a reasonable rail size.
  const cast = $derived(detail?.credits?.cast?.slice(0, 16) ?? []);
  const trailers = $derived(detail?.videos?.results ?? []);
  const hasTrailer = $derived(
    trailers.some((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"))
  );

  const posters = $derived(detail?.images?.posters ?? []);

  // Per-episode crew picks: TMDB lists everyone who worked on the episode, but
  // the readable signal is director + writer. Surface those two as a single
  // line; the rest fall into the production-credit detail you'd only want on
  // a deeper page. Multiple directors/writers join with " & ".
  function epDirectors(ep: EpisodeBrief): string {
    return (ep.crew ?? [])
      .filter((c) => c.job === "Director")
      .map((c) => c.name)
      .join(" & ");
  }
  function epWriters(ep: EpisodeBrief): string {
    return (ep.crew ?? [])
      .filter((c) => c.job === "Writer" || c.job === "Story" || c.job === "Screenplay")
      .map((c) => c.name)
      .join(" & ");
  }
</script>

<svelte:head>
  <title>{heroTitle} · {entry?.title ?? "Series Tracker"}</title>
</svelte:head>

{#if loading && !detail}
  <Skeleton variant="infoPage" />
{:else if error}
  <p class="rounded-md border border-error bg-error/15 p-3 text-sm text-error">{error}</p>
{:else if detail}
  <div class="space-y-8">
    <!-- HERO -->
    <section class="flex flex-col items-center gap-4 pt-2 text-center">
      <div class="w-36 sm:w-44 md:w-52">
        <div class="aspect-[2/3] w-full overflow-hidden rounded-xl border-2 bg-surface-2 shadow-2xl {sc ? sc.borderSoft : 'border-border'}">
          {#if heroPoster}
            <img src={heroPoster} alt="" class="h-full w-full object-cover" />
          {/if}
        </div>
      </div>

      <!-- Rating row -->
      {#if typeof detail.vote_average === "number" && detail.vote_average > 0}
        <div class="flex items-center gap-3 text-xs">
          <span class="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 font-medium text-text">
            <span class="text-accent">★</span>
            <span class="tabular-nums">{Math.round(detail.vote_average * 10)}%</span>
            <span class="text-muted">TMDB</span>
          </span>
        </div>
      {/if}

      <div class="max-w-prose space-y-1.5">
        <h1 class="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl {sc ? sc.text : 'text-text'}">
          {heroTitle}
        </h1>

        {#if entry}
          <p class="text-xs text-muted">
            <a href="{base}/show/{showId}/" class="hover-text-text" use:tactile={{ haptic: false }}>
              {entry.title}
            </a>
          </p>
        {/if}

        <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{season === 0 ? "Specials" : `Season ${season}`}</span>
          {#if heroYear}
            <span aria-hidden="true">·</span>
            <span>{heroYear}</span>
          {/if}
          {#if totalEpisodes > 0}
            <span aria-hidden="true">·</span>
            <span>{totalEpisodes} ep{totalEpisodes === 1 ? "" : "s"}</span>
          {/if}
        </div>
      </div>

      <!-- Action bar -->
      <div class="flex items-center gap-2">
        {#if entry}
          <a
            href="{base}/show/{showId}/season/{season}/"
            use:tactile
            aria-label="Track progress"
            title="Track progress"
            class="tap-target tap-target--btn flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium {sc
              ? `${sc.borderSoft} ${sc.text}`
              : 'border-primary/60 text-primary'}"
          >
            <span class="text-base leading-none">✓</span>
            <span>Track progress</span>
          </a>
        {/if}

        {#if hasTrailer}
          <button
            type="button"
            use:tactile
            onclick={() => (trailerOpen = !trailerOpen)}
            aria-pressed={trailerOpen}
            aria-label="Trailer"
            class="tap-target tap-target--icon flex h-12 w-12 items-center justify-center rounded-full border text-lg transition-colors duration-150 {trailerOpen
              ? 'border-accent bg-accent text-bg'
              : 'border-border bg-surface text-text hover-border-accent'}"
          >
            ▶
          </button>
        {/if}
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

    <!-- SEASON CAST -->
    {#if cast.length > 0}
      <Rail title="Cast" subtitle="{detail.credits?.cast?.length ?? cast.length} in season">
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

    <!-- EPISODES — full info per card: still, name, meta, overview, crew, guest stars. -->
    {#if detail.episodes.length > 0}
      <section class="space-y-3">
        <h2 class="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted">
          Episodes
          <span class="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-normal tabular-nums text-muted">
            {detail.episodes.length}
          </span>
        </h2>
        <div class="space-y-3">
          {#each detail.episodes as ep (ep.id)}
            {@const aired = ep.air_date && ep.air_date <= todayIso}
            {@const watched = ep.episode_number <= current}
            {@const isCurrent = entry && ep.episode_number === current + 1}
            {@const directors = epDirectors(ep)}
            {@const writers = epWriters(ep)}
            {@const guests = ep.guest_stars ?? []}
            {@const epBorder = watched && sc
              ? sc.borderSoft
              : isCurrent
                ? "border-accent/60"
                : "border-border"}
            <article class="overflow-hidden rounded-lg border bg-surface transition-colors duration-150 {epBorder} {aired ? '' : 'opacity-75'}">
              {#if ep.still_path}
                <div class="aspect-video w-full overflow-hidden bg-surface-2">
                  <img
                    src="https://image.tmdb.org/t/p/w780{ep.still_path}"
                    alt=""
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              {/if}
              <div class="space-y-2 p-3 sm:p-4">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span class="text-[11px] font-medium uppercase tracking-wider text-muted">E{ep.episode_number}</span>
                  <h3 class="min-w-0 flex-1 text-sm font-semibold leading-snug text-text sm:text-base">
                    {ep.name}
                  </h3>
                  {#if typeof ep.vote_average === "number" && ep.vote_average > 0 && (ep.vote_count ?? 0) > 0}
                    <span class="inline-flex shrink-0 items-center gap-1 text-[11px]">
                      <span class="text-accent">★</span>
                      <span class="font-medium tabular-nums text-text/90">{ep.vote_average.toFixed(1)}</span>
                      <span class="text-muted/80 tabular-nums">({ep.vote_count})</span>
                    </span>
                  {/if}
                </div>

                <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums text-muted">
                  {#if ep.air_date}
                    <span>{ep.air_date}{aired ? "" : " · upcoming"}</span>
                  {/if}
                  {#if ep.runtime}
                    <span aria-hidden="true">·</span>
                    <span>{ep.runtime}m</span>
                  {/if}
                </div>

                {#if ep.overview}
                  <p class="text-xs leading-relaxed text-text/85 sm:text-sm">{ep.overview}</p>
                {/if}

                {#if directors || writers}
                  <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                    {#if directors}
                      <span>
                        <span class="uppercase tracking-wider text-muted/70">Directed by</span>
                        <span class="text-text/90">{directors}</span>
                      </span>
                    {/if}
                    {#if writers}
                      <span>
                        <span class="uppercase tracking-wider text-muted/70">Written by</span>
                        <span class="text-text/90">{writers}</span>
                      </span>
                    {/if}
                  </div>
                {/if}

                {#if guests.length > 0}
                  <div class="space-y-1.5 pt-1">
                    <div class="text-[10px] uppercase tracking-wider text-muted/70">
                      Guest stars
                      <span class="ml-1 text-muted/60 tabular-nums">{guests.length}</span>
                    </div>
                    <!-- Rail stays inside the card's padding so the right-most
                         visible avatar reads as cleanly cut, with a fading
                         mask-image cue that more content lives off-screen. -->
                    <div
                      class="ep-guest-rail flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1"
                    >
                      {#each guests as g (g.id)}
                        <a
                          href="{base}/person/{g.id}/"
                          use:tactile
                          class="tap-target tap-target--card flex w-[88px] shrink-0 snap-start flex-col gap-1 sm:w-[96px]"
                          aria-label={g.name}
                        >
                          <div class="aspect-[2/3] w-full overflow-hidden rounded-md border border-border/60 bg-surface-2">
                            {#if g.profile_path}
                              <img
                                src={posterUrl(g.profile_path, "w185")}
                                alt=""
                                class="h-full w-full object-cover"
                                loading="lazy"
                              />
                            {/if}
                          </div>
                          <div class="min-w-0 px-0.5">
                            <div class="line-clamp-1 text-[11px] font-medium leading-snug">{g.name}</div>
                            {#if g.character}
                              <div class="line-clamp-1 text-[10px] text-muted">{g.character}</div>
                            {/if}
                          </div>
                        </a>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/if}

    <!-- SEASON POSTERS -->
    {#if posters.length > 0}
      <Gallery title="Posters" images={posters} aspect="2/3" size="w185" />
    {/if}
  </div>
{/if}

<style>
  .ep-guest-rail {
    scrollbar-width: none;
  }
  .ep-guest-rail::-webkit-scrollbar {
    display: none;
  }
</style>
