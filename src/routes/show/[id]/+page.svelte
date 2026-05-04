<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import NotesEditor from "$lib/components/NotesEditor.svelte";
  import RatingPicker from "$lib/components/RatingPicker.svelte";
  import SeasonCounter from "$lib/components/SeasonCounter.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import StatusMenu from "$lib/components/StatusMenu.svelte";
  import StatusSegmented from "$lib/components/StatusSegmented.svelte";
  import { smartBack } from "$lib/back.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { backdropUrl, entryFromTvDetail, posterUrl, tvDetail } from "$lib/tmdb";
  import { effectiveSeasons, isSpecialSeason, sortSeasonsForDisplay, STATUS_COLOR } from "$lib/types";
  import type { Status, TvDetail, TvEntry } from "$lib/types";

  const id = $derived(Number(page.params.id));

  let detail = $state<TvDetail | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const entry = $derived(store.get("tv", id));
  const tvEntry = $derived(entry?.kind === "tv" ? (entry as TvEntry) : null);

  // Totals and progress are computed against the seasons that count for this
  // show — specials are excluded by default so the user can complete a series
  // without ticking the bonus content.
  const countedSeasons = $derived(tvEntry ? effectiveSeasons(tvEntry) : []);
  const totalEpisodes = $derived(countedSeasons.reduce((a, s) => a + s.episodeCount, 0));
  const watchedEpisodes = $derived(
    tvEntry ? countedSeasons.reduce((a, s) => a + Math.min(tvEntry.progress[s.number] ?? 0, s.episodeCount), 0) : 0
  );

  // Always pull fresh TMDB data so newly-aired episodes show up. When the show
  // is already in the library we sync seasons in the background (no spinner) —
  // store.syncTvSeasons preserves progress and demotes "completed" if new
  // episodes arrived, surfacing them as unwatched.
  $effect(() => {
    if (!store.apiKey || !id || Number.isNaN(id)) return;
    const apiKey = store.apiKey;
    const hasEntry = store.has("tv", id);
    if (!hasEntry) {
      loading = true;
      error = null;
    }
    const ctrl = new AbortController();
    tvDetail(id, apiKey, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        detail = d;
        const seasons = sortSeasonsForDisplay(
          d.seasons
            .filter((s) => s.season_number > 0 || s.episode_count > 0)
            .map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count }))
        );
        store.syncTvSeasons(id, seasons);
        if (hasEntry) store.setBackdrop("tv", id, backdropUrl(d.backdrop_path, "w780"));
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        if (!hasEntry) error = e instanceof Error ? e.message : String(e);
        else console.warn("[show] background sync failed", e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted && !hasEntry) loading = false;
      });
    return () => ctrl.abort();
  });

  const headerInfo = $derived.by(() => {
    const detailBackdrop = detail ? backdropUrl(detail.backdrop_path, "w780") : null;
    if (tvEntry) {
      return {
        title: tvEntry.title,
        poster: tvEntry.poster,
        backdrop: tvEntry.backdrop ?? detailBackdrop,
        overview: detail?.overview ?? "",
      };
    }
    if (detail) {
      return {
        title: detail.name,
        poster: posterUrl(detail.poster_path, "w342"),
        backdrop: detailBackdrop,
        overview: detail.overview,
      };
    }
    return null;
  });

  const seasons = $derived(
    sortSeasonsForDisplay(
      tvEntry
        ? tvEntry.seasons
        : (detail?.seasons ?? [])
            .filter((s) => s.season_number > 0 || s.episode_count > 0)
            .map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count }))
    )
  );

  // Split into regular vs specials so the seasons section can render them as
  // distinct groups — regular up top in display order, specials in their own
  // collapsed-by-default block at the bottom.
  const regularSeasons = $derived(seasons.filter((s) => !isSpecialSeason(s.number)));
  const specialSeasons = $derived(seasons.filter((s) => isSpecialSeason(s.number)));
  const includeSpecials = $derived(tvEntry?.includeSpecials ?? false);

  function addToLibrary(status: Status): void {
    if (!detail) return;
    store.addToLibrary(entryFromTvDetail(detail, status));
  }

  function remove(): void {
    if (!confirm(`Remove "${tvEntry?.title}" from your library?`)) return;
    store.removeFromLibrary("tv", id);
    void goto(`${base}/`);
  }

  // In-library posters wear the full status border so the preview hero reads
  // its state at a glance; unfiled stays neutral so a "not yet added" preview
  // doesn't fake a status. Title gets the same status tint.
  const posterBorder = $derived(
    tvEntry ? STATUS_COLOR[tvEntry.status].border : "border-border"
  );
  const titleColor = $derived(
    tvEntry ? STATUS_COLOR[tvEntry.status].text : "text-text"
  );

  const onBack = smartBack();
</script>

<svelte:head>
  <title>{headerInfo ? `${headerInfo.title} · Series Tracker` : "Show · Series Tracker"}</title>
</svelte:head>

<div class="space-y-6">
  <a href="{base}/" onclick={onBack} class="hidden text-sm text-muted hover-text-text sm:inline-block">← Back</a>

  {#if loading && !headerInfo}
    <div class="flex flex-col items-center gap-4 pt-2">
      <div class="w-36 sm:w-44 md:w-52">
        <Skeleton variant="poster" />
      </div>
      <div class="w-full max-w-prose space-y-3">
        <Skeleton variant="line" />
        <Skeleton variant="line" />
        <Skeleton variant="line" />
      </div>
    </div>
  {:else if error}
    <p class="rounded-md border border-error bg-error/15 p-3 text-sm text-error">{error}</p>
  {:else if headerInfo}
    <!-- HERO: optional full-bleed backdrop pinned to the top, with the centered
         poster + title block sitting in front of it. Backdrop fades into the
         page bg so the poster emerges from it. When no backdrop is available
         the section just centers from the page top. -->
    <div class="relative">
      {#if headerInfo.backdrop}
        <div
          class="absolute inset-x-0 -top-4 -mx-3 h-40 overflow-hidden bg-surface-2 sm:-top-6 sm:-mx-4 sm:h-48 md:h-56"
          aria-hidden="true"
        >
          <img src={headerInfo.backdrop} alt="" class="h-full w-full object-cover object-top" />
          <div
            class="absolute inset-0"
            style="background: linear-gradient(to top, var(--color-bg) 0%, color-mix(in oklab, var(--color-bg) 50%, transparent) 45%, transparent 90%);"
          ></div>
        </div>
      {/if}

      <section class="relative flex flex-col items-center gap-3 text-center {headerInfo.backdrop ? 'pt-20 sm:pt-24 md:pt-28' : 'pt-2'}">
        <a
          href="{base}/show/{id}/info/"
          use:tactile={{ haptic: false }}
          aria-label="More info about {headerInfo.title}"
          class="tap-target tap-target--card block w-36 sm:w-44 md:w-52"
        >
          <div class="aspect-[2/3] w-full overflow-hidden rounded-xl border-2 bg-surface-2 shadow-2xl {posterBorder}">
            {#if headerInfo.poster}
              <img src={headerInfo.poster} alt="" class="h-full w-full object-cover" />
            {/if}
          </div>
        </a>

        <div class="max-w-prose space-y-2">
          <h1 class="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl {titleColor}">{headerInfo.title}</h1>

          {#if tvEntry}
            <p class="text-sm text-muted">
              {watchedEpisodes} / {totalEpisodes} episodes watched
            </p>
          {:else if detail}
            {#if detail.original_name && detail.original_name !== detail.name}
              <p class="text-sm italic text-muted">{detail.original_name}</p>
            {/if}
            <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
              {#if detail.first_air_date}<span>{detail.first_air_date.slice(0, 4)}</span>{/if}
              {#if detail.status}
                <span aria-hidden="true">·</span>
                <span>{detail.status}</span>
              {/if}
              {#if detail.number_of_seasons > 0}
                <span aria-hidden="true">·</span>
                <span
                  >{detail.number_of_seasons} season{detail.number_of_seasons === 1 ? "" : "s"} ·
                  {detail.number_of_episodes} ep{detail.number_of_episodes === 1 ? "" : "s"}</span
                >
              {/if}
              {#if detail.genres && detail.genres.length > 0}
                <span aria-hidden="true">·</span>
                <span>{detail.genres.slice(0, 2).map((g) => g.name).join(", ")}</span>
              {/if}
            </div>
            {#if typeof detail.vote_average === "number" && detail.vote_average > 0 && (detail.vote_count ?? 0) >= 50}
              <div class="flex items-center justify-center gap-2 pt-0.5 text-xs">
                <span class="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 font-medium text-text">
                  <span class="text-accent">★</span>
                  <span class="tabular-nums">{Math.round(detail.vote_average * 10)}%</span>
                  <span class="text-muted">TMDB</span>
                </span>
              </div>
            {/if}
            {#if detail.tagline}
              <p class="text-sm italic text-muted">"{detail.tagline}"</p>
            {/if}
          {/if}
        </div>

        {#if !tvEntry}
          <div class="flex flex-wrap justify-center gap-2 pt-1">
            <StatusMenu
              label="+ Add to library"
              onSelect={addToLibrary}
              title={`Add "${headerInfo.title}" as...`}
            />
            <a
              href="{base}/show/{id}/info/"
              use:tactile={{ haptic: false }}
              class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-accent"
            >
              More info
            </a>
          </div>
        {:else}
          <a
            href="{base}/show/{id}/info/"
            use:tactile={{ haptic: false }}
            class="tap-target tap-target--btn inline-flex rounded-md border border-border px-3 py-1.5 text-xs hover-border-accent"
          >
            ⓘ More info
          </a>
        {/if}
      </section>
    </div>

    {#if headerInfo.overview}
      <p class="mx-auto max-w-prose text-sm leading-relaxed text-text/90 sm:text-base">
        {headerInfo.overview}
      </p>
    {/if}

    {#if tvEntry}
      <div class="space-y-3">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Status</h2>
        <StatusSegmented value={tvEntry.status} onChange={(s) => store.setStatus("tv", id, s)} />
      </div>

      <div class="space-y-3">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Overall rating</h2>
        <RatingPicker
          value={tvEntry.rating ?? null}
          onChange={(v) => store.setRating("tv", id, v)}
          label="Your rating"
          status={tvEntry.status}
        />
      </div>

      <NotesEditor
        value={tvEntry.notes ?? ""}
        onCommit={(v) => store.setNotes("tv", id, v)}
        placeholder="e.g. xyz recommended it, watched on a flight..."
      />
    {/if}

    {#if regularSeasons.length > 0}
      <div class="space-y-2">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Seasons</h2>
        <div class="space-y-2">
          {#each regularSeasons as s (s.number)}
            {#if tvEntry}
              <SeasonCounter showId={id} season={s.number} name={s.name} total={s.episodeCount} />
            {:else}
              <div class="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                <div>
                  <div class="text-sm font-medium">{s.name}</div>
                  <div class="text-xs text-muted">Season {s.number} · {s.episodeCount} episodes</div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    {#if specialSeasons.length > 0}
      <div class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Specials</h2>
          {#if tvEntry}
            <label class="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={includeSpecials}
                onchange={(e) => store.setIncludeSpecials(id, (e.currentTarget as HTMLInputElement).checked)}
                class="h-4 w-4 cursor-pointer accent-primary"
              />
              <span>Count toward completion</span>
            </label>
          {/if}
        </div>
        {#if tvEntry && !includeSpecials}
          <p class="text-xs text-muted">
            Specials are tracked separately — Mark complete and progress totals ignore this section unless you tick "Count toward completion".
          </p>
        {/if}
        <div class="space-y-2 {tvEntry && !includeSpecials ? 'opacity-75' : ''}">
          {#each specialSeasons as s (s.number)}
            {#if tvEntry}
              <SeasonCounter showId={id} season={s.number} name={s.name} total={s.episodeCount} />
            {:else}
              <div class="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                <div>
                  <div class="text-sm font-medium">{s.name}</div>
                  <div class="text-xs text-muted">Specials · {s.episodeCount} episodes</div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    {#if tvEntry}
      <div class="flex justify-center border-t border-border pt-6">
        <button
          type="button"
          use:tactile={{ haptic: "warn" }}
          onclick={remove}
          class="tap-target tap-target--btn rounded-md border border-error/40 px-4 py-2 text-sm font-medium text-error transition-colors duration-150 active:bg-error/10 hover-border-error"
        >
          Remove from library
        </button>
      </div>
    {/if}
  {/if}
</div>
