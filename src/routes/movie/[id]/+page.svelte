<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { store } from "$lib/store.svelte";
  import { movieDetail, posterUrl } from "$lib/tmdb";
  import { STATUSES, STATUS_LABEL } from "$lib/types";
  import type { MovieDetail, MovieEntry, Status } from "$lib/types";

  const id = $derived(Number(page.params.id));

  let detail = $state<MovieDetail | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const entry = $derived(store.get("movie", id));
  const movieEntry = $derived(entry?.kind === "movie" ? (entry as MovieEntry) : null);

  $effect(() => {
    if (movieEntry || !store.apiKey || !id) return;
    loading = true;
    error = null;
    movieDetail(id, store.apiKey)
      .then((d) => (detail = d))
      .catch((e) => (error = e instanceof Error ? e.message : String(e)))
      .finally(() => (loading = false));
  });

  const headerInfo = $derived.by(() => {
    if (movieEntry) {
      return { title: movieEntry.title, poster: movieEntry.poster, overview: detail?.overview ?? "", date: detail?.release_date ?? "" };
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

  function addToLibrary() {
    if (!detail) return;
    const now = new Date().toISOString();
    const entry: MovieEntry = {
      kind: "movie",
      id: detail.id,
      title: detail.title,
      poster: posterUrl(detail.poster_path, "w342"),
      year: detail.release_date ? detail.release_date.slice(0, 4) : undefined,
      voteAverage: detail.vote_average,
      watched: false,
      status: "plan",
      addedAt: now,
      updatedAt: now,
    };
    store.addToLibrary(entry);
  }

  function remove() {
    if (!confirm(`Remove "${movieEntry?.title}" from your library?`)) return;
    store.removeFromLibrary("movie", id);
    goto(`${base}/`);
  }
</script>

<section class="space-y-6">
  <a href="{base}/" class="hidden text-sm text-muted hover:text-text sm:inline-block">← Back</a>

  {#if loading && !headerInfo}
    <p class="text-sm text-muted">Loading...</p>
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
          {#if headerInfo.date}
            <p class="mt-1 text-sm text-muted">{headerInfo.date}</p>
          {/if}
        </div>
        {#if headerInfo.overview}
          <p class="text-sm text-muted">{headerInfo.overview}</p>
        {/if}

        {#if movieEntry}
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={movieEntry.watched}
                onchange={(e) => store.setMovieWatched(id, (e.currentTarget as HTMLInputElement).checked)}
              />
              Watched
            </label>
            <label class="text-xs uppercase tracking-wider text-muted" for="status">Status</label>
            <select
              id="status"
              value={movieEntry.status}
              onchange={(e) => store.setStatus("movie", id, (e.currentTarget as HTMLSelectElement).value as Status)}
              class="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
            >
              {#each STATUSES as s (s)}
                <option value={s}>{STATUS_LABEL[s]}</option>
              {/each}
            </select>
            <a
              href="{base}/movie/{id}/info/"
              class="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent"
            >
              ⓘ More info
            </a>
          </div>
        {:else}
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              onclick={addToLibrary}
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
            >
              + Add to library
            </button>
            <a
              href="{base}/movie/{id}/info/"
              class="rounded-md border border-border px-4 py-2 text-sm hover:border-accent"
            >
              More info
            </a>
          </div>
        {/if}
      </div>
    </div>

    {#if movieEntry}
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
