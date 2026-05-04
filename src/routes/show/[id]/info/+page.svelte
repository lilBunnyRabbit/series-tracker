<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import DiaryLogSheet from "$lib/components/DiaryLogSheet.svelte";
  import Gallery from "$lib/components/Gallery.svelte";
  import PersonCard from "$lib/components/PersonCard.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import Rail from "$lib/components/Rail.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import StatusMenu from "$lib/components/StatusMenu.svelte";
  import Trailer from "$lib/components/Trailer.svelte";
  import WatchProviders from "$lib/components/WatchProviders.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import {
    backdropUrl,
    defaultLanguage,
    defaultRegion,
    entryFromTvDetail,
    posterUrl,
    recommendations,
    regionFromLocale,
    similar,
    tvDetail,
    tvDetailFull,
    watchProviders,
  } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import { effectiveSeasons, STATUS_COLOR } from "$lib/types";
  import type { Status, TvDetailFull, TvEntry, WatchProviderRegion } from "$lib/types";

  const id = $derived(Number(page.params.id));
  const language = $derived(store.preferences.language ?? defaultLanguage());
  // Default region resolves through: locale country (sl-SI → SI) → navigator → "US".
  const localeRegion = $derived(regionFromLocale(language) ?? defaultRegion());
  // Effective region = explicit override (set when user picks from inline dropdown) → locale fallback.
  const effectiveRegion = $derived(store.preferences.region ?? localeRegion);

  let detail = $state<TvDetailFull | null>(null);
  let related = $state<RecommendationItem[]>([]);
  let similarItems = $state<RecommendationItem[]>([]);
  let providerResults = $state<Record<string, WatchProviderRegion> | null>(null);
  let selectedRegion = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);
  let trailerOpen = $state(false);

  // Sync the inline picker with preferences/locale changes (and across navigations
  // — the same page component is reused when [id] changes).
  $effect(() => {
    selectedRegion = effectiveRegion;
  });

  function handleRegionChange(code: string): void {
    // Persist as null when the choice matches the locale-derived default — that
    // way changing locale later still moves the picker, instead of being pinned.
    store.setPreference("region", code === localeRegion ? null : code);
  }

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
      watchProviders("tv", id, apiKey, language, ctrl.signal).catch(() => null),
    ])
      .then(([d, r, s, p]) => {
        if (ctrl.signal.aborted) return;
        detail = d;
        related = r.slice(0, 16);
        // Drop anything already in the recommendations list to keep the two
        // rails distinct (algorithmic vs keyword-overlap).
        const seen = new Set(r.map((x) => `${x.media_type}:${x.id}`));
        similarItems = s.filter((x) => !seen.has(`${x.media_type}:${x.id}`)).slice(0, 16);
        providerResults = p?.results ?? null;
        if (store.has("tv", id)) store.setBackdrop("tv", id, backdropUrl(d.backdrop_path, "w780"));
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
  const tvEntry = $derived(entry?.kind === "tv" ? (entry as TvEntry) : null);
  const inLibrary = $derived(!!entry);
  const status = $derived(entry?.status ?? null);
  // Status palette drives the season-card border tint so the info-page seasons
  // grid mirrors the user's progress on each season at a glance.
  const sc = $derived(tvEntry ? STATUS_COLOR[tvEntry.status] : null);

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
  // is fully watched (or not in library), which hides the button. Walks only
  // the seasons that count for completion (specials excluded by default).
  const nextEp = $derived.by<{ season: number; episode: number; total: number } | null>(() => {
    if (!entry || entry.kind !== "tv") return null;
    for (const s of effectiveSeasons(entry)) {
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

  // Diary log sheet — populated from this title's data on open.
  let logOpen = $state(false);
  const titleHistory = $derived(detail ? store.diaryFor("tv", id) : []);

  const posterBorder = $derived(
    entry ? STATUS_COLOR[entry.status].border : "border-border"
  );
  const titleColor = $derived(
    entry ? STATUS_COLOR[entry.status].text : "text-text"
  );
  const ratingTint = $derived(entry ? STATUS_COLOR[entry.status] : null);
</script>

<svelte:head>
  <title>{detail ? `${detail.name} · Series Tracker` : "Show · Series Tracker"}</title>
</svelte:head>

{#if loading && !detail}
  <Skeleton variant="infoPage" />
{:else if error}
  <p class="rounded-md border border-error bg-error/15 p-3 text-sm text-error">{error}</p>
{:else if detail}
  <div class="space-y-8">
    <!-- HERO: optional full-bleed backdrop pinned to the top, with the centered
         poster + title block sitting in front of it. -->
    <div class="relative">
      {#if detail.backdrop_path}
        <div
          class="absolute inset-x-0 -top-4 -mx-3 h-44 overflow-hidden bg-surface-2 sm:-top-6 sm:-mx-4 sm:h-56 md:h-64"
          aria-hidden="true"
        >
          <img src={backdropUrl(detail.backdrop_path, "w780")} alt="" class="h-full w-full object-cover object-top" />
          <div
            class="absolute inset-0"
            style="background: linear-gradient(to top, var(--color-bg) 0%, color-mix(in oklab, var(--color-bg) 50%, transparent) 45%, transparent 90%);"
          ></div>
        </div>
      {/if}
      <section class="relative flex flex-col items-center gap-4 text-center {detail.backdrop_path ? 'pt-24 sm:pt-28 md:pt-32' : 'pt-2'}">
      <div class="w-44 sm:w-52 md:w-60">
        <div class="aspect-[2/3] w-full overflow-hidden rounded-xl border-2 bg-surface-2 shadow-2xl {posterBorder}">
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
        <h1 class="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl {titleColor}">{detail.name}</h1>

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
          use:tactile={{ haptic: "success" }}
          onclick={inLibrary ? toggleWatched : () => addAs("completed")}
          aria-pressed={status === "completed"}
          aria-label={status === "completed" ? "Mark unwatched" : "Mark watched"}
          class="tap-target tap-target--icon flex h-12 w-12 items-center justify-center rounded-full border text-xl transition-colors duration-150 {status ===
          'completed'
            ? 'border-primary bg-primary text-bg'
            : 'border-border bg-surface text-text hover-border-primary hover-text-primary'}"
        >
          ✓
        </button>

        {#if inLibrary && status}
          <button
            type="button"
            use:tactile
            onclick={() => setExistingStatus(status === "plan" ? "watching" : "plan")}
            aria-label={status === "plan" ? "Move to watching" : "Save for later"}
            class="tap-target tap-target--icon flex h-12 w-12 items-center justify-center rounded-full border text-lg transition-colors duration-150 {status ===
            'plan'
              ? 'border-accent bg-accent text-bg'
              : 'border-border bg-surface text-text hover-border-accent'}"
          >
            🔖
          </button>
        {:else}
          <StatusMenu label="🔖" onSelect={addAs} title={`Add "${detail.name}" as...`} variant="outline" size="md" />
        {/if}

        <button
          type="button"
          use:tactile
          onclick={() => (logOpen = true)}
          aria-label="Log a viewing"
          title="Log a viewing"
          class="tap-target tap-target--icon flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-lg text-text hover-border-secondary"
        >
          📓
        </button>

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

        <a
          href="{base}/show/{id}/"
          use:tactile={{ haptic: false }}
          aria-label="More tracking options"
          class="tap-target tap-target--icon flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-lg text-text hover-border-accent"
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
          use:tactile={{ haptic: "success" }}
          onclick={bumpNextEpisode}
          aria-label="Mark S{nextEp.season} E{nextEp.episode} watched"
          class="tap-target tap-target--btn flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150 {bumpFlash
            ? 'border-primary bg-primary text-bg'
            : 'border-border bg-surface hover-border-primary hover-text-primary'}"
        >
          <span class="text-base leading-none">+</span>
          <span>Watched S{nextEp.season} E{nextEp.episode}</span>
          <span class="text-[10px] tabular-nums text-muted">{nextEp.episode}/{nextEp.total}</span>
        </button>
      {/if}
    </section>
    </div>

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

    <!-- DIARY HISTORY for this title -->
    {#if titleHistory.length > 0}
      <section class="space-y-2">
        <h2 class="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted">
          Watched on
          <span class="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-normal tabular-nums text-muted">
            {titleHistory.length}
          </span>
        </h2>
        <div class="space-y-1.5">
          {#each titleHistory as h (h.id)}
            <a
              href="{base}/diary/#entry-{h.id}"
              use:tactile
              class="tap-target tap-target--card flex items-start gap-3 rounded-md border border-border bg-surface p-2.5"
            >
              <div class="shrink-0 text-center">
                <div class="text-[10px] uppercase tracking-wider text-muted">{h.watchedAt.slice(0, 7)}</div>
                <div class="text-base font-semibold tabular-nums">{h.watchedAt.slice(8, 10)}</div>
              </div>
              <div class="min-w-0 flex-1 text-xs">
                <div class="flex items-center gap-2">
                  {#if h.season !== undefined && h.fromEp !== undefined && h.toEp !== undefined}
                    <span class="font-medium text-text">
                      S{h.season}
                      · E{h.fromEp}{h.toEp !== h.fromEp ? `–E${h.toEp}` : ""}
                    </span>
                  {:else}
                    <span class="font-medium text-text">Logged</span>
                  {/if}
                  {#if h.rewatch}
                    <span class="rounded-full border border-accent/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-accent">Rewatch</span>
                  {/if}
                  {#if typeof h.rating === "number" && h.rating > 0}
                    <span class="ml-auto rounded-md px-1.5 py-0.5 font-semibold tabular-nums {ratingTint ? `${ratingTint.bgSoft} ${ratingTint.text}` : 'bg-accent/15 text-accent'}">♥ {h.rating}</span>
                  {/if}
                </div>
                {#if h.note}
                  <p class="mt-1 line-clamp-2 text-muted">{h.note}</p>
                {/if}
              </div>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <!-- WHERE TO WATCH -->
    <WatchProviders
      results={providerResults}
      {selectedRegion}
      onSelectedRegionChange={handleRegionChange}
      uiLocale={language}
    />

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

    <!-- SEASONS — specials (season 0) sorted to the bottom. Each card links to
         the season info page with rich episode + cast + crew data. -->
    {#if detail.seasons.length > 0}
      {@const visibleSeasons = detail.seasons
        .filter((s) => s.season_number > 0 || s.episode_count > 0)
        .slice()
        .sort((a, b) => {
          if (a.season_number === 0 && b.season_number !== 0) return 1;
          if (b.season_number === 0 && a.season_number !== 0) return -1;
          return a.season_number - b.season_number;
        })}
      <section class="space-y-3">
        <h2 class="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted">
          Seasons
          <span class="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-normal tabular-nums text-muted">
            {visibleSeasons.length}
          </span>
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          {#each visibleSeasons as s (s.season_number)}
            {@const watched = tvEntry?.progress[s.season_number] ?? 0}
            {@const seasonComplete = s.episode_count > 0 && watched >= s.episode_count}
            {@const seasonStarted = watched > 0 && !seasonComplete}
            {@const cardBorder = (seasonComplete || seasonStarted) && sc ? sc.borderSoft : "border-border"}
            <a
              href="{base}/show/{id}/season/{s.season_number}/info/"
              use:tactile
              aria-label="Open {s.name}"
              class="tap-target tap-target--card hover-zoom group flex gap-3 overflow-hidden rounded-lg border bg-surface p-3 transition-colors duration-150 {cardBorder} {seasonComplete ? '' : 'hover-border-accent'}"
            >
              <div class="aspect-[2/3] h-32 flex-shrink-0 overflow-hidden rounded-md border border-border/40 bg-surface-2 sm:h-36">
                {#if s.poster_path}
                  <img src={posterUrl(s.poster_path, "w185")} alt="" class="h-full w-full object-cover" loading="lazy" />
                {/if}
              </div>
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <div class="flex items-baseline gap-2">
                  <span class="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted">
                    {s.season_number === 0 ? "Specials" : `Season ${s.season_number}`}
                  </span>
                  {#if s.air_date}
                    <span class="text-[10px] tabular-nums text-muted">· {s.air_date.slice(0, 4)}</span>
                  {/if}
                </div>
                <div class="line-clamp-2 text-sm font-medium leading-snug text-text">{s.name}</div>
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums text-muted">
                  <span>{s.episode_count} ep{s.episode_count === 1 ? "" : "s"}</span>
                  {#if typeof s.vote_average === "number" && s.vote_average > 0}
                    <span class="inline-flex items-center gap-0.5">
                      <span class="text-accent">★</span>
                      <span class="font-medium text-text/90">{s.vote_average.toFixed(1)}</span>
                    </span>
                  {/if}
                </div>
                {#if s.overview}
                  <p class="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">{s.overview}</p>
                {/if}
                <span class="mt-auto pt-1 text-[10px] uppercase tracking-wider text-muted/70 group-active:text-accent">
                  View season info →
                </span>
              </div>
            </a>
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

  <DiaryLogSheet
    open={logOpen}
    onClose={() => (logOpen = false)}
    kind="tv"
    refId={id}
    title={detail.name}
    poster={posterUrl(detail.poster_path, "w342")}
    entry={entry}
  />
{/if}
