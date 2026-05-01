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
  import { store } from "$lib/store.svelte";
  import { entryFromTvDetail, posterUrl, tvDetail } from "$lib/tmdb";
  import type { Status, TvDetail, TvEntry } from "$lib/types";

  const id = $derived(Number(page.params.id));

  let detail = $state<TvDetail | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const entry = $derived(store.get("tv", id));
  const tvEntry = $derived(entry?.kind === "tv" ? (entry as TvEntry) : null);

  const totalEpisodes = $derived(tvEntry ? tvEntry.seasons.reduce((a, s) => a + s.episodeCount, 0) : 0);
  const watchedEpisodes = $derived(
    tvEntry ? tvEntry.seasons.reduce((a, s) => a + Math.min(tvEntry.progress[s.number] ?? 0, s.episodeCount), 0) : 0
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
        const seasons = d.seasons
          .filter((s) => s.season_number > 0 || s.episode_count > 0)
          .map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count }));
        store.syncTvSeasons(id, seasons);
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
    if (tvEntry) return { title: tvEntry.title, poster: tvEntry.poster, overview: detail?.overview ?? "" };
    if (detail) return { title: detail.name, poster: posterUrl(detail.poster_path, "w342"), overview: detail.overview };
    return null;
  });

  const seasons = $derived(
    tvEntry
      ? tvEntry.seasons
      : (detail?.seasons ?? [])
          .filter((s) => s.season_number > 0 || s.episode_count > 0)
          .map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count }))
  );

  function addToLibrary(status: Status): void {
    if (!detail) return;
    store.addToLibrary(entryFromTvDetail(detail, status));
  }

  function remove(): void {
    if (!confirm(`Remove "${tvEntry?.title}" from your library?`)) return;
    store.removeFromLibrary("tv", id);
    void goto(`${base}/`);
  }
</script>

<svelte:head>
  <title>{headerInfo ? `${headerInfo.title} · Series Tracker` : "Show · Series Tracker"}</title>
</svelte:head>

<section class="space-y-6">
  <a href="{base}/" class="hidden text-sm text-muted hover:text-text sm:inline-block">← Back</a>

  {#if loading && !headerInfo}
    <div class="flex flex-col gap-6 md:flex-row">
      <div class="w-full max-w-[200px] flex-shrink-0">
        <Skeleton variant="poster" />
      </div>
      <div class="min-w-0 flex-1 space-y-3">
        <Skeleton variant="line" />
        <Skeleton variant="line" />
        <Skeleton variant="line" />
      </div>
    </div>
  {:else if error}
    <p class="rounded-md border border-danger bg-danger/15 p-3 text-sm text-danger">{error}</p>
  {:else if headerInfo}
    <div class="flex flex-col gap-6 md:flex-row">
      <div class="w-full max-w-[200px] flex-shrink-0">
        <div class="aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface-2">
          {#if headerInfo.poster}
            <img src={headerInfo.poster} alt="" class="h-full w-full object-cover" />
          {/if}
        </div>
      </div>
      <div class="min-w-0 flex-1 space-y-4">
        <div>
          <h1 class="text-2xl font-semibold">{headerInfo.title}</h1>
          {#if tvEntry}
            <p class="mt-1 text-sm text-muted">
              {watchedEpisodes} / {totalEpisodes} episodes watched
            </p>
          {:else if detail}
            {#if detail.original_name && detail.original_name !== detail.name}
              <p class="mt-0.5 text-sm italic text-muted">{detail.original_name}</p>
            {/if}
            <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
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
          {/if}
        </div>

        {#if !tvEntry && detail}
          {#if typeof detail.vote_average === "number" && detail.vote_average > 0 && (detail.vote_count ?? 0) >= 50}
            <div class="flex items-center gap-2 text-xs">
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

        {#if headerInfo.overview}
          <p class="text-sm text-muted">{headerInfo.overview}</p>
        {/if}

        {#if !tvEntry}
          <div class="flex flex-wrap gap-2">
            <StatusMenu
              label="+ Add to library"
              onSelect={addToLibrary}
              title={`Add "${headerInfo.title}" as...`}
            />
            <a
              href="{base}/show/{id}/info/"
              class="rounded-md border border-border px-4 py-2 text-sm hover:border-accent"
            >
              More info
            </a>
          </div>
        {:else}
          <a
            href="{base}/show/{id}/info/"
            class="inline-flex rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent"
          >
            ⓘ More info
          </a>
        {/if}
      </div>
    </div>

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
        />
      </div>

      <NotesEditor
        value={tvEntry.notes ?? ""}
        onCommit={(v) => store.setNotes("tv", id, v)}
        placeholder="e.g. xyz recommended it, watched on a flight..."
      />
    {/if}

    {#if seasons.length > 0}
      <div class="space-y-2">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Seasons</h2>
        <div class="space-y-2">
          {#each seasons as s (s.number)}
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

    {#if tvEntry}
      <div class="flex justify-center border-t border-border pt-6">
        <button
          type="button"
          onclick={remove}
          class="rounded-md border border-border px-4 py-2 text-sm text-muted hover:border-danger hover:text-danger"
        >
          Remove from library
        </button>
      </div>
    {/if}
  {/if}
</section>
