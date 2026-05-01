<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import NotesEditor from "$lib/components/NotesEditor.svelte";
  import RatingPicker from "$lib/components/RatingPicker.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import StatusMenu from "$lib/components/StatusMenu.svelte";
  import StatusSegmented from "$lib/components/StatusSegmented.svelte";
  import { smartBack } from "$lib/back.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { backdropUrl, entryFromMovieDetail, movieDetail, posterUrl } from "$lib/tmdb";
  import type { MovieDetail, MovieEntry, Status } from "$lib/types";

  const id = $derived(Number(page.params.id));

  let detail = $state<MovieDetail | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const entry = $derived(store.get("movie", id));
  const movieEntry = $derived(entry?.kind === "movie" ? (entry as MovieEntry) : null);

  $effect(() => {
    if (!store.apiKey || !id || Number.isNaN(id)) return;
    const apiKey = store.apiKey;
    const hasEntry = !!movieEntry;
    // Already-in-library: fetch silently in the background to backfill
    // backdrop on entries added before the field existed. Cached, so on repeat
    // visits this resolves instantly.
    if (hasEntry && movieEntry?.backdrop) return;
    if (!hasEntry) {
      loading = true;
      error = null;
    }
    const ctrl = new AbortController();
    movieDetail(id, apiKey, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        detail = d;
        if (hasEntry) store.setBackdrop("movie", id, backdropUrl(d.backdrop_path, "w780"));
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        if (!hasEntry) error = e instanceof Error ? e.message : String(e);
        else console.warn("[movie] background backdrop backfill failed", e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted && !hasEntry) loading = false;
      });
    return () => ctrl.abort();
  });

  const headerInfo = $derived.by(() => {
    if (movieEntry) {
      return {
        title: movieEntry.title,
        poster: movieEntry.poster,
        overview: detail?.overview ?? "",
        date: detail?.release_date ?? movieEntry.year ?? "",
      };
    }
    if (detail) {
      return {
        title: detail.title,
        poster: posterUrl(detail.poster_path, "w342"),
        overview: detail.overview,
        date: detail.release_date,
      };
    }
    return null;
  });

  function addToLibrary(status: Status): void {
    if (!detail) return;
    store.addToLibrary(entryFromMovieDetail(detail, status));
  }

  function remove(): void {
    if (!confirm(`Remove "${movieEntry?.title}" from your library?`)) return;
    store.removeFromLibrary("movie", id);
    void goto(`${base}/`);
  }

  const onBack = smartBack();
</script>

<svelte:head>
  <title>{headerInfo ? `${headerInfo.title} · Series Tracker` : "Movie · Series Tracker"}</title>
</svelte:head>

<section class="space-y-6">
  <a href="{base}/" onclick={onBack} class="hidden text-sm text-muted hover-text-text sm:inline-block">← Back</a>

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
          {#if !movieEntry && detail}
            {#if detail.original_title && detail.original_title !== detail.title}
              <p class="mt-0.5 text-sm italic text-muted">{detail.original_title}</p>
            {/if}
            <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              {#if detail.release_date}<span>{detail.release_date.slice(0, 4)}</span>{/if}
              {#if detail.runtime}
                <span aria-hidden="true">·</span>
                <span>{detail.runtime}m</span>
              {/if}
              {#if detail.genres && detail.genres.length > 0}
                <span aria-hidden="true">·</span>
                <span>{detail.genres.slice(0, 2).map((g) => g.name).join(", ")}</span>
              {/if}
            </div>
            {#if detail.status && detail.status !== "Released"}
              <p class="mt-1.5 text-xs font-medium uppercase tracking-wider text-accent">{detail.status}</p>
            {/if}
          {:else if headerInfo.date}
            <p class="mt-1 text-sm text-muted">{headerInfo.date}</p>
          {/if}
        </div>

        {#if !movieEntry && detail}
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

        {#if !movieEntry}
          <div class="flex flex-wrap gap-2">
            <StatusMenu
              label="+ Add to library"
              onSelect={addToLibrary}
              title={`Add "${headerInfo.title}" as...`}
            />
            <a
              href="{base}/movie/{id}/info/"
              use:tactile={{ haptic: false }}
              class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-accent"
            >
              More info
            </a>
          </div>
        {:else}
          <a
            href="{base}/movie/{id}/info/"
            use:tactile={{ haptic: false }}
            class="tap-target tap-target--btn inline-flex rounded-md border border-border px-3 py-1.5 text-xs hover-border-accent"
          >
            ⓘ More info
          </a>
        {/if}
      </div>
    </div>

    {#if movieEntry}
      <div class="space-y-3">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Status</h2>
        <StatusSegmented value={movieEntry.status} onChange={(s) => store.setStatus("movie", id, s)} />
      </div>

      <div class="space-y-3">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Your rating</h2>
        <RatingPicker
          value={movieEntry.rating ?? null}
          onChange={(v) => store.setRating("movie", id, v)}
        />
      </div>

      <NotesEditor
        value={movieEntry.notes ?? ""}
        onCommit={(v) => store.setNotes("movie", id, v)}
        placeholder="e.g. xyz recommended it, watched in cinema..."
      />

      <div class="flex justify-center border-t border-border pt-6">
        <button
          type="button"
          use:tactile={{ haptic: "warn" }}
          onclick={remove}
          class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm text-muted hover-border-danger hover-text-danger"
        >
          Remove from library
        </button>
      </div>
    {/if}
  {/if}
</section>
