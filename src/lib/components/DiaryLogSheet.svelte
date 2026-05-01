<script lang="ts">
  import RatingPicker from "$lib/components/RatingPicker.svelte";
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import type { Entry, TvEntry } from "$lib/types";

  type Props = {
    open: boolean;
    onClose: () => void;
    /** Pre-filled context — title comes from here, episode hints if TV. */
    kind: "tv" | "movie";
    refId: number;
    title: string;
    poster?: string | null;
    /** Optional library entry — used to pre-fill episode range and offer
     *  "also bump progress" for TV. Movies use it to know whether to bump
     *  status to completed on save. */
    entry?: Entry;
  };

  let { open, onClose, kind, refId, title, poster, entry }: Props = $props();

  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      reset();
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function todayIso(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Hydrated on each open via reset(). $state so the sheet survives reopens
  // without leaking values between different titles.
  let watchedAt = $state(todayIso());
  let rating = $state<number | null>(null);
  let note = $state("");
  let bumpProgress = $state(true);
  // TV: range — initialised from next-unwatched on reset.
  let season = $state(1);
  let fromEp = $state(1);
  let toEp = $state(1);
  let isRewatch = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);

  // For TV, surface the existing seasons so the user can pick which to log.
  const tvEntry = $derived(entry?.kind === "tv" ? (entry as TvEntry) : null);
  const seasons = $derived(tvEntry?.seasons ?? []);
  const currentSeason = $derived(seasons.find((s) => s.number === season) ?? seasons[0]);

  // Detect rewatch automatically: prior diary entries for this title.
  const priorCount = $derived(store.diaryFor(kind, refId).length);

  function nextUnwatched(e: TvEntry): { season: number; episode: number } | null {
    for (const s of e.seasons) {
      const cur = e.progress[s.number] ?? 0;
      if (cur < s.episodeCount) return { season: s.number, episode: cur + 1 };
    }
    return null;
  }

  function reset(): void {
    watchedAt = todayIso();
    rating = null;
    note = "";
    saving = false;
    error = null;
    isRewatch = priorCount > 0;
    bumpProgress = true;
    if (tvEntry) {
      const next = nextUnwatched(tvEntry);
      if (next) {
        season = next.season;
        fromEp = next.episode;
        toEp = next.episode;
      } else if (tvEntry.seasons.length > 0) {
        // Fully watched — default to logging the season finale as a rewatch.
        const last = tvEntry.seasons[tvEntry.seasons.length - 1];
        season = last.number;
        fromEp = last.episodeCount;
        toEp = last.episodeCount;
        isRewatch = true;
      }
    } else {
      season = 1;
      fromEp = 1;
      toEp = 1;
    }
  }

  function close(): void {
    onClose();
  }

  function onBackdropClick(e: MouseEvent): void {
    if (e.target === dialog) close();
  }

  function clampRange(): void {
    if (fromEp < 1) fromEp = 1;
    if (toEp < fromEp) toEp = fromEp;
    if (currentSeason && toEp > currentSeason.episodeCount) toEp = currentSeason.episodeCount;
    if (currentSeason && fromEp > currentSeason.episodeCount) fromEp = currentSeason.episodeCount;
  }

  function save(): void {
    if (saving) return;
    saving = true;
    error = null;
    try {
      clampRange();
      const trimmedNote = note.trim();
      const payload: Parameters<typeof store.addDiary>[0] = {
        kind,
        refId,
        title,
        poster: poster ?? undefined,
        watchedAt,
        ...(rating !== null ? { rating } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
        ...(isRewatch ? { rewatch: true } : {}),
      };
      if (kind === "tv") {
        payload.season = season;
        payload.fromEp = fromEp;
        payload.toEp = toEp;
      }
      store.addDiary(payload);

      // Optional progress side-effect — only for TV when the user opted in
      // and the range advances current progress. Movies always promote to
      // completed (the journal entry implies they finished it).
      if (kind === "tv" && bumpProgress && tvEntry) {
        const cur = tvEntry.progress[season] ?? 0;
        if (toEp > cur) store.setProgress(refId, season, toEp);
      } else if (kind === "movie" && bumpProgress) {
        // Only promote if not already completed; respect existing status otherwise.
        if (entry && entry.status !== "completed") {
          store.setStatus("movie", refId, "completed");
        }
      }

      vibrate("success");
      close();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      saving = false;
    }
  }

  function adjustEpisode(field: "from" | "to", delta: number): void {
    const max = currentSeason?.episodeCount ?? 99;
    if (field === "from") {
      fromEp = Math.max(1, Math.min(max, fromEp + delta));
      if (toEp < fromEp) toEp = fromEp;
    } else {
      toEp = Math.max(fromEp, Math.min(max, toEp + delta));
    }
  }
</script>

<dialog
  bind:this={dialog}
  onclick={onBackdropClick}
  onclose={close}
  class="diary-sheet w-[min(28rem,94vw)] max-w-[94vw] overflow-hidden border-border bg-surface p-0 text-text shadow-2xl"
>
  <div class="diary-sheet-handle sm:hidden" aria-hidden="true"></div>
  <div class="max-h-[80vh] w-full overflow-y-auto p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:pb-5">
    <header class="mb-4 flex items-start gap-3">
      {#if poster}
        <div class="h-16 w-11 shrink-0 overflow-hidden rounded bg-surface-2">
          <img src={poster} alt="" class="h-full w-full object-cover" loading="lazy" />
        </div>
      {/if}
      <div class="min-w-0 flex-1">
        <p class="text-[10px] uppercase tracking-[0.2em] text-muted">Log viewing</p>
        <h2 class="mt-0.5 truncate text-base font-semibold">{title}</h2>
        {#if priorCount > 0}
          <p class="mt-0.5 text-[11px] text-muted">
            {priorCount} previous entr{priorCount === 1 ? "y" : "ies"}
          </p>
        {/if}
      </div>
    </header>

    <div class="space-y-4">
      <!-- Date -->
      <label class="block">
        <span class="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">When</span>
        <input
          type="date"
          bind:value={watchedAt}
          max={todayIso()}
          class="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      <!-- TV: season + episode range -->
      {#if kind === "tv" && seasons.length > 0}
        <div class="space-y-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted">Episodes</span>
          <select
            value={season}
            onchange={(e) => {
              season = Number((e.currentTarget as HTMLSelectElement).value);
              const s = seasons.find((x) => x.number === season);
              if (s) {
                fromEp = Math.min(fromEp, s.episodeCount);
                toEp = Math.min(toEp, s.episodeCount);
              }
            }}
            class="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {#each seasons as s (s.number)}
              <option value={s.number}>S{s.number} · {s.name} ({s.episodeCount} ep)</option>
            {/each}
          </select>

          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-md border border-border bg-surface-2 p-2">
              <div class="text-[10px] uppercase tracking-wider text-muted">From episode</div>
              <div class="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  use:tactile
                  onclick={() => adjustEpisode("from", -1)}
                  class="tap-target tap-target--icon flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted"
                  aria-label="Decrease from-episode"
                >
                  −
                </button>
                <span class="flex-1 text-center text-base font-semibold tabular-nums">E{fromEp}</span>
                <button
                  type="button"
                  use:tactile
                  onclick={() => adjustEpisode("from", 1)}
                  class="tap-target tap-target--icon flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted"
                  aria-label="Increase from-episode"
                >
                  +
                </button>
              </div>
            </div>
            <div class="rounded-md border border-border bg-surface-2 p-2">
              <div class="text-[10px] uppercase tracking-wider text-muted">To episode</div>
              <div class="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  use:tactile
                  onclick={() => adjustEpisode("to", -1)}
                  class="tap-target tap-target--icon flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted"
                  aria-label="Decrease to-episode"
                >
                  −
                </button>
                <span class="flex-1 text-center text-base font-semibold tabular-nums">E{toEp}</span>
                <button
                  type="button"
                  use:tactile
                  onclick={() => adjustEpisode("to", 1)}
                  class="tap-target tap-target--icon flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted"
                  aria-label="Increase to-episode"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <p class="text-[11px] text-muted">
            Logging
            <span class="text-text">{toEp - fromEp + 1}</span>
            episode{toEp - fromEp + 1 === 1 ? "" : "s"}
            {#if currentSeason}<span class="text-muted/70"> of S{currentSeason.number} · {currentSeason.episodeCount} total</span>{/if}
          </p>
        </div>
      {/if}

      <!-- Rating -->
      <RatingPicker value={rating} onChange={(v) => (rating = v)} label="Rating (optional)" />

      <!-- Note -->
      <label class="block">
        <span class="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Note (optional)</span>
        <textarea
          bind:value={note}
          rows="3"
          maxlength="1000"
          placeholder="On a flight, with friends, drunk on a Tuesday…"
          class="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        ></textarea>
      </label>

      <!-- Toggles -->
      <div class="space-y-2">
        <label class="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-2 px-3 py-2.5">
          <span class="min-w-0">
            <span class="block text-sm font-medium">Mark as rewatch</span>
            <span class="mt-0.5 block text-[11px] text-muted">
              {priorCount > 0 ? "You've logged this before — auto-detected." : "Tag this viewing as a repeat."}
            </span>
          </span>
          <input type="checkbox" bind:checked={isRewatch} class="h-5 w-5 cursor-pointer accent-primary" />
        </label>

        {#if entry}
          <label class="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-2 px-3 py-2.5">
            <span class="min-w-0">
              <span class="block text-sm font-medium">
                {kind === "tv" ? "Also bump episode progress" : "Mark movie as watched"}
              </span>
              <span class="mt-0.5 block text-[11px] text-muted">
                {kind === "tv"
                  ? "Set season progress so the counter catches up."
                  : entry.status === "completed"
                    ? "Already watched — no change."
                    : "Set status to Completed."}
              </span>
            </span>
            <input type="checkbox" bind:checked={bumpProgress} class="h-5 w-5 cursor-pointer accent-primary" />
          </label>
        {/if}
      </div>

      {#if error}
        <p class="rounded-md border border-danger bg-danger/15 p-2 text-xs text-danger">{error}</p>
      {/if}

      <div class="flex items-center gap-2 pt-1">
        <button
          type="button"
          use:tactile={{ haptic: false }}
          onclick={close}
          class="tap-target tap-target--btn flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-muted hover-text-text"
        >
          Cancel
        </button>
        <button
          type="button"
          use:tactile={{ haptic: "success" }}
          onclick={save}
          disabled={saving}
          class="tap-target tap-target--btn flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save log"}
        </button>
      </div>
    </div>
  </div>
</dialog>

<style>
  .diary-sheet {
    margin: auto;
    border-radius: 1rem 1rem 0 0;
    border: 1px solid var(--color-border);
  }
  .diary-sheet[open] {
    animation: sheet-in 280ms var(--ease-spring);
  }
  .diary-sheet::backdrop {
    background: rgb(0 0 0 / 0.6);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }
  .diary-sheet[open]::backdrop {
    animation: backdrop-in 200ms ease-out;
  }

  @media (max-width: 639.98px) {
    .diary-sheet {
      margin: 0;
      max-width: 100%;
      width: 100%;
      max-height: 95vh;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: auto;
    }
  }

  @media (min-width: 640px) {
    .diary-sheet {
      border-radius: 0.75rem;
    }
    .diary-sheet[open] {
      animation: pop-in 180ms var(--ease-out);
    }
  }

  .diary-sheet-handle {
    margin: 0.5rem auto 0;
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 9999px;
    background: var(--color-border);
  }

  @media (prefers-reduced-motion: reduce) {
    .diary-sheet[open],
    .diary-sheet[open]::backdrop {
      animation: none;
    }
  }
</style>
