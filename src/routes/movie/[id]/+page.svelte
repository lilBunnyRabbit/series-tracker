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
  import { STATUS_COLOR } from "$lib/types";
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
    const detailBackdrop = detail ? backdropUrl(detail.backdrop_path, "w780") : null;
    if (movieEntry) {
      return {
        title: movieEntry.title,
        poster: movieEntry.poster,
        backdrop: movieEntry.backdrop ?? detailBackdrop,
        overview: detail?.overview ?? "",
        date: detail?.release_date ?? movieEntry.year ?? "",
      };
    }
    if (detail) {
      return {
        title: detail.title,
        poster: posterUrl(detail.poster_path, "w342"),
        backdrop: detailBackdrop,
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

  // In-library posters wear the full status border so the preview hero reads
  // its state at a glance; unfiled stays neutral so a "not yet added" preview
  // doesn't fake a status. Title gets the same status tint.
  const posterBorder = $derived(
    movieEntry ? STATUS_COLOR[movieEntry.status].border : "border-border"
  );
  const titleColor = $derived(
    movieEntry ? STATUS_COLOR[movieEntry.status].text : "text-text"
  );

  const onBack = smartBack();

  // Web Share — feature-detected; share button hides on browsers without it.
  let canShare = $state(false);
  $effect(() => {
    canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  });
  async function shareMovie(): Promise<void> {
    if (!headerInfo) return;
    try {
      // Same reasoning as the show page — share the in-app URL so recipients
      // land on this app's detail page (the /share/ receiver round-trips it).
      await navigator.share({
        title: `${headerInfo.title} · Series Tracker`,
        text: headerInfo.title,
        url: `${location.origin}${base}/movie/${id}/`,
      });
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.warn("[movie] share failed", err);
      }
    }
  }
</script>

<svelte:head>
  <title>{headerInfo ? `${headerInfo.title} · Series Tracker` : "Movie · Series Tracker"}</title>
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
          href="{base}/movie/{id}/info/"
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

          {#if !movieEntry && detail}
            {#if detail.original_title && detail.original_title !== detail.title}
              <p class="text-sm italic text-muted">{detail.original_title}</p>
            {/if}
            <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
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
              <p class="text-xs font-medium uppercase tracking-wider text-accent">{detail.status}</p>
            {/if}
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
          {:else if headerInfo.date}
            <p class="text-sm text-muted">{headerInfo.date}</p>
          {/if}
        </div>

        {#if !movieEntry}
          <div class="flex flex-wrap justify-center gap-2 pt-1">
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
          <div class="flex flex-wrap justify-center gap-2">
            <a
              href="{base}/movie/{id}/info/"
              use:tactile={{ haptic: false }}
              class="tap-target tap-target--btn inline-flex rounded-md border border-border px-3 py-1.5 text-xs hover-border-accent"
            >
              ⓘ More info
            </a>
            {#if canShare}
              <button
                type="button"
                use:tactile={{ haptic: false }}
                onclick={shareMovie}
                aria-label="Share this movie"
                class="tap-target tap-target--btn inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover-border-primary"
              >
                <span aria-hidden="true">↗</span>
                <span>Share</span>
              </button>
            {/if}
          </div>
        {/if}
      </section>
    </div>

    {#if headerInfo.overview}
      <p class="mx-auto max-w-prose text-sm leading-relaxed text-text/90 sm:text-base">
        {headerInfo.overview}
      </p>
    {/if}

    {#if movieEntry}
      <div class="space-y-3">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Status</h2>
        <StatusSegmented value={movieEntry.status} onChange={(s) => store.setStatus("movie", id, s)} />
      </div>

      <!-- Extras: rating + rewatchable flag + free-text notes. Mirrors the
           show page — kept at the bottom so the top of the page stays focused
           on the status the user just came to update. -->
      <div class="space-y-3 border-t border-border pt-6">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Extras</h2>

        <div class="rounded-md border border-border bg-surface px-3 py-3">
          <RatingPicker
            value={movieEntry.rating ?? null}
            onChange={(v) => store.setRating("movie", id, v)}
            label="Your rating"
            status={movieEntry.status}
          />
        </div>

        <label class="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-3">
          <span class="min-w-0">
            <span class="flex items-center gap-2 text-sm font-medium">
              <span aria-hidden="true">♻</span>
              <span>Rewatchable</span>
            </span>
            <span class="mt-0.5 block text-xs text-muted">
              Boosts this title in the picker and shelves it in your profile.
            </span>
          </span>
          <input
            type="checkbox"
            checked={movieEntry.rewatchable ?? false}
            onchange={(e) => store.setRewatchable("movie", id, (e.currentTarget as HTMLInputElement).checked)}
            class="h-5 w-5 shrink-0 cursor-pointer accent-secondary"
          />
        </label>

        <NotesEditor
          value={movieEntry.notes ?? ""}
          onCommit={(v) => store.setNotes("movie", id, v)}
          placeholder="e.g. xyz recommended it, watched in cinema..."
        />
      </div>

      <div class="flex justify-center pt-2">
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
