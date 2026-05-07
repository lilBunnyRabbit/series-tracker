<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { smartBack } from "$lib/back.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import RatingPicker from "$lib/components/RatingPicker.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { debouncedPageOpen } from "$lib/temptation";
  import { posterUrl, seasonDetail } from "$lib/tmdb";
  import { isEpisodeWatched, STATUS_COLOR } from "$lib/types";
  import type { EpisodeBrief, SeasonDetail, TvEntry } from "$lib/types";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";

  const onBack = smartBack();

  const showId = $derived(Number(page.params.id));
  const season = $derived(Number(page.params.season));

  let detail = $state<SeasonDetail | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const entry = $derived(store.get("tv", showId) as TvEntry | undefined);
  const seasonInfo = $derived(entry?.seasons.find((s) => s.number === season));
  const total = $derived(seasonInfo?.episodeCount ?? detail?.episodes.length ?? 0);
  const current = $derived(entry?.progress[season] ?? 0);
  const seasonRating = $derived(entry?.seasonRatings?.[season] ?? null);
  const isComplete = $derived(total > 0 && current >= total);
  const sc = $derived(entry ? STATUS_COLOR[entry.status] : null);
  const todayIso = new Date().toISOString().slice(0, 10);
  const airedCount = $derived.by<number | null>(() => {
    if (!detail?.episodes) return null;
    let n = 0;
    for (const ep of detail.episodes) {
      if (ep.air_date && ep.air_date <= todayIso) n++;
    }
    return n;
  });
  const canCatchUp = $derived(airedCount !== null && airedCount > current && airedCount < total);

  $effect(() => {
    if (!store.apiKey || !showId || Number.isNaN(showId) || Number.isNaN(season)) return;
    loading = true;
    error = null;
    const ctrl = new AbortController();
    seasonDetail(showId, season, store.apiKey, ctrl.signal)
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

  // If the show was removed from the library while we're on this page, bail
  // back to home — the controls would all no-op anyway without an entry.
  $effect(() => {
    if (store.loaded && !entry) void goto(`${base}/`);
  });

  // Episode-page-opened temptation kick. Fires once per ~30 min per
  // (show, season). When upcoming gets per-season deep-links this becomes
  // the signal that "user is checking the next episode" — for now it just
  // means a season tracker view.
  $effect(() => {
    if (!showId || Number.isNaN(showId) || Number.isNaN(season)) return;
    if (!store.has("tv", showId)) return;
    debouncedPageOpen(`tt:open:episode-page-opened:tv:${showId}:s${season}`, () => {
      store.applyTemptation("tv", showId, "episode-page-opened", `Season ${season}`);
    });
  });

  // When the season transitions into "complete" (last episode marked),
  // scroll the rating section into view so the user can rate it without
  // hunting for the picker. `block: "center"` keeps the picker mid-viewport
  // — `start` aligned the rating to the page header which buried it. Plain
  // locals so the effect only re-runs on the tracked $derived (isComplete),
  // not on bookkeeping writes. The `initialized` guard skips the very first
  // run so an already-completed season doesn't auto-scroll on mount.
  let prevComplete = false;
  let completionInitialized = false;
  $effect(() => {
    const nowComplete = isComplete;
    if (completionInitialized && nowComplete && !prevComplete) {
      requestAnimationFrame(() => {
        const el = document.querySelector("[data-section='rating']");
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }
    prevComplete = nowComplete;
    completionInitialized = true;
  });

  // Bring the boundary episode into view after a button-driven progress
  // change. `block: "center"` keeps the target away from both the bottom
  // (where the floating island covers content) and the very top (where the
  // sticky page header sits) — the row lands roughly mid-viewport on each
  // tap, which reads as a clear focal point.
  function scrollToEp(epNum: number): void {
    if (epNum < 1) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-ep="${epNum}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  function dec(): void {
    if (!entry) return;
    const next = Math.max(0, current - 1);
    store.updateProgress(showId, season, -1);
    scrollToEp(next || 1);
  }
  function inc(): void {
    if (!entry) return;
    const next = Math.min(total, current + 1);
    store.updateProgress(showId, season, +1);
    scrollToEp(next);
  }
  function complete(): void {
    if (!entry) return;
    store.completeSeason(showId, season);
    scrollToEp(total);
  }
  function reset(): void {
    if (!entry) return;
    store.resetSeason(showId, season);
    scrollToEp(1);
  }
  function catchUp(): void {
    if (!entry || airedCount === null) return;
    store.setProgress(showId, season, airedCount);
    scrollToEp(airedCount);
  }
  // Body tap = "mark up through this episode". This is the fast path for the
  // common contiguous-watching flow: tap the latest episode you've reached and
  // everything before it is marked too. For toggling a single episode (e.g.
  // marking E3 watched while leaving E2 alone) the user taps the small circle
  // indicator instead — see `toggleSingle`.
  function markUpTo(ep: EpisodeBrief): void {
    if (!entry) return;
    if (isEpisodeWatched(entry, season, ep.episode_number)) {
      store.setProgress(showId, season, ep.episode_number - 1);
    } else {
      store.setProgress(showId, season, ep.episode_number);
    }
    scrollToEp(ep.episode_number);
  }
  // Per-episode toggle. Only this episode's state flips; the rest of the
  // season is untouched. If the result happens to be a contiguous run from E1
  // the store quietly drops back to counter-mode so the season is no longer
  // "explicit"; otherwise it sticks the explicit set on the entry.
  function toggleSingle(ep: EpisodeBrief, e: Event): void {
    e.stopPropagation();
    if (!entry) return;
    store.toggleEpisode(showId, season, ep.episode_number);
  }

  // Web Share — same feature-detect pattern as show + movie pages. Sharing a
  // season points recipients at the in-app season tracker for that show; the
  // /share/ route knows how to parse `/show/{id}/season/{n}/` and route there.
  let canShare = $state(false);
  $effect(() => {
    canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  });
  async function shareSeason(): Promise<void> {
    if (!entry) return;
    try {
      await navigator.share({
        title: `${heroTitle} · ${entry.title} · Series Tracker`,
        text: `${entry.title} — ${heroTitle}`,
        url: `${location.origin}${base}/show/${showId}/season/${season}/`,
      });
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.warn("[season] share failed", err);
      }
    }
  }

  // Local mirror of `current` for the inline number input. We commit on blur /
  // Enter (not on every keystroke) so typing "20" doesn't briefly land as 2 →
  // store → re-derive → cursor jump. The effect re-syncs whenever `current`
  // changes from outside the input (button taps, episode taps).
  let editingProgress = $state(0);
  $effect(() => {
    editingProgress = current;
  });
  function commitProgress(): void {
    const v = Number(editingProgress);
    if (!Number.isFinite(v)) {
      editingProgress = current;
      return;
    }
    if (v !== current) {
      const target = Math.max(0, Math.min(total, Math.floor(v)));
      store.setProgress(showId, season, target);
      scrollToEp(target || 1);
    }
  }

  const heroPoster = $derived(
    detail?.poster_path ? posterUrl(detail.poster_path, "w342") : (entry?.poster ?? null)
  );
  const heroTitle = $derived(seasonInfo?.name ?? detail?.name ?? `Season ${season}`);
  const heroSubtitle = $derived.by<string>(() => {
    const parts: string[] = [];
    if (detail?.air_date) parts.push(detail.air_date.slice(0, 4));
    if (total > 0) parts.push(`${total} ep${total === 1 ? "" : "s"}`);
    return parts.join(" · ");
  });
  const posterBorder = $derived(sc ? sc.border : "border-border");
  const titleColor = $derived(sc ? sc.text : "text-text");
</script>

<svelte:head>
  <title>{heroTitle} · {entry?.title ?? "Series Tracker"}</title>
</svelte:head>

<!-- Body scroll + main padding are locked by `.scroll-locked` on <html>
     (toggled in +layout.svelte for this route). This flex column fills main
     and owns its own internal scroll; the floating island sits OUTSIDE this
     column (position: fixed) so it overlays the bottom of the viewport. -->
<div class="flex flex-1 min-h-0 flex-col">
  <div class="flex-1 min-h-0 overflow-y-auto">
    <!-- pb-40 leaves clearance under the floating island so the last episode
         row can scroll fully into view without being covered. -->
    <div class="mx-auto max-w-2xl space-y-6 px-3 py-5 pb-40 sm:px-4 sm:py-6 sm:pb-44">
      <!-- Hero: small poster + title + meta + season rating -->
      <section class="flex flex-col items-center gap-3 text-center">
        <div class="w-32 sm:w-40">
          <div class="aspect-[2/3] w-full overflow-hidden rounded-xl border-2 bg-surface-2 shadow-2xl {posterBorder}">
            {#if heroPoster}
              <img src={heroPoster} alt="" class="h-full w-full object-cover" />
            {/if}
          </div>
        </div>

        <div class="space-y-1">
          <h1 class="text-xl font-semibold leading-tight tracking-tight sm:text-2xl {titleColor}">
            {heroTitle}
          </h1>
          {#if entry}
            <p class="text-xs text-muted">
              <a href="{base}/show/{showId}/" class="hover-text-text" use:tactile={{ haptic: false }}>
                {entry.title}
              </a>
            </p>
          {/if}
          {#if heroSubtitle}
            <p class="text-xs text-muted">{heroSubtitle}</p>
          {/if}
          {#if isComplete && sc}
            <p class="text-[11px] font-medium uppercase tracking-wider {sc.text}">
              ✓ Season complete
            </p>
          {/if}
        </div>

        <div class="flex flex-wrap justify-center gap-2">
          <a
            href="{base}/show/{showId}/season/{season}/info/"
            use:tactile={{ haptic: false }}
            class="tap-target tap-target--btn inline-flex rounded-md border border-border px-3 py-1.5 text-xs hover-border-accent"
          >
            ⓘ More info
          </a>
          {#if canShare}
            <button
              type="button"
              use:tactile={{ haptic: false }}
              onclick={shareSeason}
              aria-label="Share this season"
              class="tap-target tap-target--btn inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover-border-primary"
            >
              <span aria-hidden="true">↗</span>
              <span>Share</span>
            </button>
          {/if}
        </div>

        {#if detail?.overview}
          <p class="max-w-prose text-left text-sm leading-relaxed text-text/90">
            {detail.overview}
          </p>
        {/if}

        {#if entry}
          <div class="w-full max-w-prose scroll-mt-4 pt-1" data-section="rating">
            <RatingPicker
              value={seasonRating}
              onChange={(v) => store.setSeasonRating(showId, season, v)}
              label="Season rating"
              status={entry.status}
            />
          </div>
        {/if}
      </section>

      <!-- Episodes -->
      <section class="space-y-2">
        <h2 class="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted">
          Episodes
          {#if total > 0}
            <span class="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-normal tabular-nums text-muted">
              {#key current}<span class="inline-block" in:fly={{ y: 4, duration: 180, easing: cubicOut }}>{current}</span>{/key}/{total}
            </span>
          {/if}
        </h2>

        {#if loading && !detail}
          <div class="space-y-1.5">
            {#each Array(8) as _, i (i)}
              <Skeleton variant="line" />
            {/each}
          </div>
        {:else if error}
          <p class="rounded-md border border-error bg-error/15 p-3 text-sm text-error">{error}</p>
        {:else if detail && detail.episodes.length === 0}
          <p class="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted">
            No episodes listed.
          </p>
        {:else if detail}
          <ol class="space-y-1.5">
            {#each detail.episodes as ep (ep.id)}
              {@const watched = entry ? isEpisodeWatched(entry, season, ep.episode_number) : false}
              {@const aired = ep.air_date && ep.air_date <= todayIso}
              <!-- Two-target row: circle button toggles only this episode
                   (for non-contiguous tracking, e.g. watched E1 and E3 but
                   not E2); body button marks the season as watched up
                   through this episode (the common contiguous flow). -->
              <li
                data-ep={ep.episode_number}
                class="scroll-mt-4 relative flex items-stretch overflow-hidden rounded-md border bg-surface transition-colors duration-150 {watched
                  ? `${sc ? sc.borderSoft : 'border-primary/60'}`
                  : 'border-border'} {aired ? '' : 'opacity-60'}"
              >
                <!-- Watched-episode backdrop: a faded still bleeds in from
                     the right with a left-fade mask, matching the library
                     row treatment. Lives on the <li> so it spans both
                     buttons and never re-paints when the user taps. -->
                {#if watched && ep.still_path}
                  <div
                    aria-hidden="true"
                    transition:fade={{ duration: 220 }}
                    class="pointer-events-none absolute inset-y-0 right-0 w-3/5 bg-cover bg-center opacity-25 [mask-image:linear-gradient(to_left,black,transparent)]"
                    style="background-image: url('https://image.tmdb.org/t/p/w300{ep.still_path}')"
                  ></div>
                {/if}

                <button
                  type="button"
                  use:tactile={{ haptic: "tick" }}
                  onclick={(e) => toggleSingle(ep, e)}
                  disabled={!entry}
                  aria-label="Toggle E{ep.episode_number} watched"
                  aria-pressed={watched}
                  class="tap-target relative z-10 flex shrink-0 items-start py-2.5 pl-3 pr-2 active:bg-surface-2/50"
                >
                  <span
                    class="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors duration-150 {watched
                      ? `${sc ? `${sc.bg} ${sc.border} text-bg` : 'bg-primary border-primary text-bg'}`
                      : 'border-border bg-surface-2 text-muted'}"
                    aria-hidden="true"
                  >
                    {watched ? "✓" : ep.episode_number}
                  </span>
                </button>

                <button
                  type="button"
                  use:tactile={{ haptic: "tick" }}
                  onclick={() => markUpTo(ep)}
                  disabled={!entry}
                  aria-label="Mark watched up through E{ep.episode_number}"
                  class="tap-target relative z-10 min-w-0 flex-1 py-2.5 pl-1 pr-3 text-left active:bg-surface-2/50"
                >
                  <div class="flex items-baseline gap-2">
                    <span class="text-xs font-medium tabular-nums text-muted">E{ep.episode_number}</span>
                    <span class="min-w-0 flex-1 truncate text-sm font-medium {watched ? 'text-text' : 'text-text/90'}">
                      {ep.name}
                    </span>
                    {#if ep.runtime}
                      <span class="shrink-0 text-[10px] tabular-nums text-muted">{ep.runtime}m</span>
                    {/if}
                  </div>
                  <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-muted">
                    {#if ep.air_date}
                      <span>{ep.air_date}{aired ? "" : " · upcoming"}</span>
                    {/if}
                    {#if watched && typeof ep.vote_average === "number" && ep.vote_average > 0 && (ep.vote_count ?? 0) > 0}
                      <span
                        transition:fade={{ duration: 180 }}
                        class="inline-flex items-center gap-1"
                      >
                        <span class="text-accent">★</span>
                        <span class="font-medium text-text/90">{ep.vote_average.toFixed(1)}</span>
                        <span class="text-muted/80">({ep.vote_count})</span>
                      </span>
                    {/if}
                  </div>
                  {#if ep.overview}
                    <p class="mt-1 line-clamp-2 text-xs text-muted">{ep.overview}</p>
                  {/if}
                </button>
              </li>
            {/each}
          </ol>
        {/if}
      </section>
    </div>
  </div>
</div>

<!-- Floating island: a fixed pill at the bottom (replaces the standard
     floating nav for this page). Big tap targets for the hot path —
     decrement, increment, optional catch up — with the count tucked between
     the +/- so it reads as a single cluster. Mark all / reset live on the
     show page's season row, not here. -->
{#if entry}
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 sm:px-6"
    style="padding-bottom: max(env(safe-area-inset-bottom), 1.25rem); padding-top: 1rem"
  >
    <div class="season-island pointer-events-auto flex max-w-2xl items-center gap-2 rounded-full p-2">
      <a
        href="{base}/show/{showId}/"
        onclick={onBack}
        use:tactile
        aria-label="Back to show"
        class="tap-target tap-target--icon flex h-12 w-10 shrink-0 items-center justify-center rounded-full text-text"
      >
        <Icon name="arrow-left" size={18} />
      </a>
      <span class="mx-0.5 h-7 w-px shrink-0 bg-border" aria-hidden="true"></span>
      <button
        type="button"
        use:tactile={{ haptic: "tick" }}
        onclick={dec}
        disabled={current === 0}
        aria-label="Decrement watched"
        class="tap-target tap-target--icon flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-2xl leading-none disabled:opacity-40"
      >
        −
      </button>

      <div class="flex shrink-0 items-center gap-1 px-1">
        <input
          type="number"
          min="0"
          max={total}
          bind:value={editingProgress}
          onblur={commitProgress}
          onkeydown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
          onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
          aria-label="Watched episodes"
          class="h-10 w-12 rounded-md border border-border bg-surface-2 px-1 text-center text-sm font-semibold tabular-nums outline-none focus:border-accent"
        />
        <span class="text-sm tabular-nums text-muted">/ {total}</span>
      </div>

      <button
        type="button"
        use:tactile={{ haptic: "tick" }}
        onclick={inc}
        disabled={current >= total}
        aria-label="Increment watched"
        class="tap-target tap-target--icon flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-2xl leading-none text-bg disabled:opacity-40 {sc
          ? `${sc.bg} ${sc.border}`
          : 'border-primary bg-primary'}"
      >
        +
      </button>

      {#if canCatchUp}
        <span class="mx-1 h-7 w-px shrink-0 bg-border" aria-hidden="true"></span>
        <button
          type="button"
          use:tactile={{ haptic: "success" }}
          onclick={catchUp}
          title="Set progress to the latest aired episode (E{airedCount} of {total})"
          class="tap-target tap-target--btn h-12 shrink-0 rounded-full border border-accent px-4 text-sm font-medium text-accent transition-colors duration-150 active:bg-accent active:text-bg"
        >
          Catch up · E{airedCount}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Mirrors `.floating-nav-pill` from layout.css — same translucent fill,
     blur, and shadow stack so the season island reads as the same family
     of UI as the global tab bar. */
  .season-island {
    background: rgba(26, 31, 38, 0.85);
    background: color-mix(in oklab, var(--color-bg) 88%, transparent);
    border: 1px solid var(--color-border);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    box-shadow:
      0 24px 48px -12px rgb(0 0 0 / 0.7),
      0 12px 20px -6px rgb(0 0 0 / 0.5),
      0 4px 8px -2px rgb(0 0 0 / 0.35);
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .season-island {
      background: rgba(26, 31, 38, 0.96);
    }
  }
</style>
