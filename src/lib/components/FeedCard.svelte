<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import StatusMenu from "$lib/components/StatusMenu.svelte";
  import TypeBadge from "$lib/components/TypeBadge.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { backdropUrl, posterUrl } from "$lib/tmdb";
  import type { RecommendationItem } from "$lib/tmdb";
  import { STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { Status } from "$lib/types";

  type Props = {
    item: RecommendationItem;
    /** Map of TMDB genre id → name for the active kind. Optional — when
     *  missing, the genres row simply collapses. */
    genreById?: Map<number, string>;
    /** True when this item matches the resumed-feed lastSeen marker — paints
     *  a small "Last viewed" chip so the user knows where they left off. */
    isLastViewed?: boolean;
    onAdd: (item: RecommendationItem, status: Status) => Promise<void> | void;
    /** Optional back affordance rendered at the bottom of the action rail.
     *  When supplied, the rail gets a third "Back" circle styled like Details.
     *  The feed page passes this so the active feed view can have its back
     *  button live with the other actions instead of in a top header. */
    backHref?: string;
    onBack?: (e: MouseEvent) => void;
  };

  let { item, genreById, isLastViewed = false, onAdd, backHref, onBack }: Props = $props();

  const kind = $derived<"tv" | "movie">(item.media_type);
  const title = $derived(item.media_type === "movie" ? item.title : item.name);
  const dateRaw = $derived(item.media_type === "movie" ? item.release_date : item.first_air_date);
  const year = $derived(dateRaw ? dateRaw.slice(0, 4) : "");
  const overview = $derived(item.overview ?? "");
  const voteAverage = $derived(item.vote_average ?? 0);
  const voteCount = $derived(item.vote_count ?? 0);
  const originalLanguage = $derived((item.original_language ?? "").toLowerCase());
  const backdrop = $derived(backdropUrl(item.backdrop_path, "w780"));
  const poster = $derived(posterUrl(item.poster_path, "w342"));
  const detailHref = $derived(kind === "movie" ? `${base}/movie/${item.id}/` : `${base}/show/${item.id}/`);
  const genreNames = $derived.by<string[]>(() => {
    const ids = item.genre_ids ?? [];
    if (ids.length === 0 || !genreById) return [];
    const out: string[] = [];
    for (const id of ids) {
      const name = genreById.get(id);
      if (name) out.push(name);
    }
    // Cap at 3 so the meta row never wraps awkwardly on narrow phones.
    return out.slice(0, 3);
  });

  const existing = $derived(store.get(kind, item.id));
  const statusColor = $derived(existing ? STATUS_COLOR[existing.status] : null);
  // Poster border: full-opacity status colour once added, neutral otherwise.
  const posterBorder = $derived(statusColor ? statusColor.border : "border-border");

  const voteCountLabel = $derived.by(() => {
    if (voteCount <= 0) return "";
    if (voteCount >= 1000) return `${(voteCount / 1000).toFixed(voteCount >= 10000 ? 0 : 1)}k`;
    return String(voteCount);
  });

  let busy = $state(false);
  let error = $state<string | null>(null);
  // Imperative open trigger for the StatusMenu — bumped each time the user
  // taps the action-rail circle. The menu's hideTrigger lets us drive it
  // entirely from our own custom button so the rail visuals stay consistent.
  let menuTrigger = $state(0);

  async function handleStatusPick(status: Status): Promise<void> {
    busy = true;
    error = null;
    try {
      if (existing) {
        store.setStatus(existing.kind, existing.id, status);
      } else {
        await onAdd(item, status);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function openStatusMenu(): void {
    menuTrigger++;
  }

  function goToDetails(): void {
    void goto(detailHref);
  }
</script>

<article class="feed-item">
  <!-- Backdrop only at the top — fades cleanly into the matte bg before the
       poster row begins, so the lower content sits on a solid panel. -->
  <div class="feed-bg-area">
    {#if backdrop}
      <img src={backdrop} alt="" class="feed-bg" loading="lazy" decoding="async" />
    {:else if poster}
      <img
        src={poster}
        alt=""
        class="feed-bg feed-bg--blur"
        loading="lazy"
        decoding="async"
      />
    {/if}
  </div>

  <!-- Top-left: type badge. The resumed marker moved down to a divider stripe
       above the title — see .feed-resume-marker in the text region. -->
  <div class="feed-bg-meta">
    <TypeBadge {kind} variant="overlay" />
  </div>

  <!-- Poster + headline stack: poster, optional resume stripe, then a large
       centered title. Together they form the visual focal point of the card. -->
  <div class="feed-poster-area">
    <a
      href={detailHref}
      use:tactile={{ haptic: false }}
      class="feed-poster tap-target border-2 {posterBorder}"
      aria-label="Open {title}"
    >
      {#if poster}
        <img src={poster} alt="" loading="lazy" decoding="async" />
      {:else}
        <div class="feed-poster-fallback">
          <Icon name={kind === "movie" ? "film" : "tv"} size={32} />
        </div>
      {/if}
    </a>

    {#if isLastViewed}
      <div class="feed-resume-marker" aria-label="Resumed here">
        <span>Where you left off</span>
      </div>
    {/if}

    <h2 class="feed-title {existing && statusColor ? statusColor.text : ''}">{title}</h2>
  </div>

  <!-- Bottom-left content. Title moved up under the poster; this region now
       holds supporting metadata and the overview. -->
  <div class="feed-text">
    <div class="feed-meta">
      {#if year}<span class="feed-year tabular-nums">{year}</span>{/if}
      {#if voteAverage > 0}
        {#if year}<span class="feed-meta-sep" aria-hidden="true">·</span>{/if}
        <span class="tabular-nums">★ {voteAverage.toFixed(1)}</span>
        {#if voteCountLabel}
          <span class="text-muted">({voteCountLabel})</span>
        {/if}
      {/if}
      {#if originalLanguage && originalLanguage !== "en"}
        <span class="feed-meta-sep" aria-hidden="true">·</span>
        <span class="rounded border border-border/60 px-1.5 text-[10px] uppercase tracking-wider">
          {originalLanguage}
        </span>
      {/if}
    </div>

    {#if genreNames.length > 0}
      <div class="feed-genres">
        {#each genreNames as g, i (g)}
          {#if i > 0}<span class="feed-meta-sep" aria-hidden="true">·</span>{/if}
          <span>{g}</span>
        {/each}
      </div>
    {/if}

    {#if overview}
      <p class="feed-overview">{overview}</p>
    {/if}

    {#if error}
      <p class="feed-error">{error}</p>
    {/if}
  </div>

  <!-- TikTok-style action rail. Both buttons pair an icon-on-circle with a
       tiny label below. Rail stays clear of the text via fixed right offset. -->
  <div class="feed-rail">
    <button
      type="button"
      use:tactile
      onclick={goToDetails}
      class="feed-action"
      aria-label="Open details"
    >
      <span class="feed-action-circle border-border bg-surface/85">
        <Icon name="chevron-right" size={20} />
      </span>
      <span class="feed-action-label">Details</span>
    </button>

    <button
      type="button"
      use:tactile={{ haptic: "tap" }}
      onclick={openStatusMenu}
      disabled={busy}
      class="feed-action"
      aria-label={existing ? "Change status" : "Add to library"}
    >
      <span
        class="feed-action-circle {existing && statusColor
          ? `${statusColor.border} ${statusColor.bgSoft}`
          : 'border-primary bg-primary text-bg'}"
      >
        {#if existing && statusColor}
          <span class="h-3 w-3 rounded-full {statusColor.dot}" aria-hidden="true"></span>
        {:else}
          <Icon name="plus" size={22} />
        {/if}
      </span>
      <span class="feed-action-label {existing && statusColor ? statusColor.text : ''}">
        {busy ? "..." : existing ? STATUS_LABEL[existing.status] : "Add"}
      </span>
    </button>

    {#if backHref}
      <a
        href={backHref}
        onclick={onBack}
        use:tactile
        class="feed-action"
        aria-label="Back to feed setup"
      >
        <span class="feed-action-circle border-border bg-surface/85">
          <Icon name="arrow-left" size={20} />
        </span>
        <span class="feed-action-label">Back</span>
      </a>
    {/if}
  </div>

  <!-- Hidden picker — driven by the action-rail circle. -->
  <StatusMenu
    label=""
    hideTrigger
    openTrigger={menuTrigger}
    forcePicker
    onSelect={handleStatusPick}
    title={existing ? `Change "${title}" status...` : `Add "${title}" as...`}
  />
</article>

<style>
  .feed-item {
    position: relative;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: var(--color-bg);
    /* Baseline CSS snap — JS overrides for snappier feel on touch + wheel,
       this still kicks in for keyboard/scrollbar fallbacks. */
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }

  /* ---- Backdrop region pinned to the top, fades cleanly into the matte bg
       before reaching the poster row. ---- */

  .feed-bg-area {
    position: absolute;
    inset: 0 0 auto 0;
    height: 42%;
    overflow: hidden;
    z-index: 0;
  }

  .feed-bg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
  }

  .feed-bg--blur {
    filter: blur(24px);
    transform: scale(1.18);
    opacity: 0.55;
  }

  /* Bottom fade INSIDE the backdrop region — the seam to the matte bg below
     is hidden by the gradient finishing at the bg colour. */
  .feed-bg-area::after {
    content: "";
    position: absolute;
    inset: auto 0 0 0;
    height: 65%;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      color-mix(in oklab, var(--color-bg) 35%, transparent) 45%,
      color-mix(in oklab, var(--color-bg) 80%, transparent) 75%,
      var(--color-bg) 100%
    );
    pointer-events: none;
  }

  .feed-bg-meta {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    /* iOS notch / rounded corner safe inset. */
    padding-top: env(safe-area-inset-top);
  }

  /* ---- Poster row — flex item below the backdrop. Aligned to its bottom
       edge with padding so there's a calm gap before the text content. ---- */

  .feed-poster-area {
    /* Spans the full card height so the poster's vertical position is
       controlled by padding-top alone, independent of the backdrop or text
       sizes. Now a flex column so the resume stripe and big title can stack
       below the poster as a single headline group.
       The wrapper itself is click-transparent — only the <a> poster inside
       reactivates pointer events for the tap-to-details target. */
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    /* Backdrop ends at 42%; one-third puts the poster just inside the fade
       so it visually anchors on top of the backdrop seam, not below it. */
    padding: 33% 1rem 0;
    gap: 1rem;
    z-index: 2;
    pointer-events: none;
  }

  .feed-poster-area > .feed-poster {
    pointer-events: auto;
    /* Center just the poster — title and resume stripe stretch full-width
       below so their text/lines can read as proper headline elements. */
    align-self: center;
  }

  .feed-poster {
    width: min(56vw, 13rem);
    aspect-ratio: 2 / 3;
    border-radius: 1.125rem;
    overflow: hidden;
    background: var(--color-surface-2);
    box-shadow:
      0 24px 48px -16px rgb(0 0 0 / 0.7),
      0 8px 16px -6px rgb(0 0 0 / 0.45);
    transition: transform 220ms var(--ease-spring);
    display: block;
    flex-shrink: 0;
  }

  .feed-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .feed-poster-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-muted);
  }

  /* ---- Bottom-left text (no box, just typography over the matte) ---- */

  .feed-text {
    position: absolute;
    /* Right inset clears the action rail (~4.5rem of rail visual width) plus
       a small breathing gap so the text never feels like it's hugging the
       circles. */
    inset: auto 5rem 0 0;
    z-index: 3;
    padding: 0 0 1.25rem 1rem;
    padding-bottom: max(env(safe-area-inset-bottom), 1.25rem);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    color: var(--color-text);
  }

  .feed-title {
    font-size: 1.875rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.025em;
    margin: 0;
    text-align: center;
    /* Cap to two lines so a long title doesn't push the meta/overview region
     up into the headline group on small screens. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    /* Soft drop shadow keeps the headline legible on the backdrop fade behind
       the upper third of the title on short viewports. */
    text-shadow: 0 2px 10px rgb(0 0 0 / 0.55);
  }

  /* "Where you left off" stripe — sits between the poster and the headline
     title, visually separating the poster section from the title group.
     Centered label flanked by accent gradient lines that fade out at the
     edges. */
  .feed-resume-marker {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .feed-resume-marker::before,
  .feed-resume-marker::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(
      to right,
      transparent,
      color-mix(in oklab, var(--color-accent) 65%, transparent)
    );
  }

  .feed-resume-marker::after {
    background: linear-gradient(
      to left,
      transparent,
      color-mix(in oklab, var(--color-accent) 65%, transparent)
    );
  }

  .feed-resume-marker > span {
    white-space: nowrap;
  }


  .feed-meta,
  .feed-genres {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  /* Year is the most useful single-glance fact in the meta row, so we promote
     it to a larger weight to anchor the row visually. The neighbouring rating /
     language stay at the base meta size so the year reads as the headline. */
  .feed-year {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1;
  }

  .feed-meta-sep {
    color: var(--color-muted);
  }

  .feed-genres {
    color: color-mix(in oklab, var(--color-text) 80%, transparent);
    font-size: 0.8125rem;
  }

  .feed-overview {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: color-mix(in oklab, var(--color-text) 92%, transparent);
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .feed-error {
    margin: 0;
    border-radius: 0.375rem;
    border: 1px solid var(--color-error);
    background: color-mix(in oklab, var(--color-error) 15%, transparent);
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
    color: var(--color-error);
    text-shadow: none;
  }

  /* ---- Action rail ---- */

  .feed-rail {
    position: absolute;
    right: 0.875rem;
    bottom: 0;
    z-index: 4;
    padding-bottom: max(env(safe-area-inset-bottom), 1.25rem);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.875rem;
  }

  .feed-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    color: var(--color-text);
  }

  .feed-action[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .feed-action-circle {
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 9999px;
    /* Width + style only — leave border-color to the Tailwind `border-{x}`
       utility passed in via class. The `border` shorthand would otherwise
       reset border-color to currentColor and beat the utility on
       specificity, painting every circle white. */
    border-width: 2px;
    border-style: solid;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 12px 24px -10px rgb(0 0 0 / 0.7),
      0 3px 8px -2px rgb(0 0 0 / 0.45);
  }

  .feed-action-label {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: color-mix(in oklab, var(--color-text) 80%, transparent);
    max-width: 4.5rem;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
  }

  /* Short / landscape viewports: shrink everything so the absolute poster
     stays clear of the bottom text. */
  @media (max-height: 700px) {
    .feed-bg-area {
      height: 36%;
    }
    .feed-poster-area {
      padding-top: 26%;
      gap: 0.625rem;
    }
    .feed-poster {
      width: min(42vw, 9.5rem);
    }
    .feed-title {
      font-size: 1.5rem;
    }
    .feed-year {
      font-size: 1rem;
    }
    .feed-overview {
      -webkit-line-clamp: 3;
      line-clamp: 3;
    }
  }

  @media (max-width: 380px) {
    .feed-action-circle {
      width: 2.875rem;
      height: 2.875rem;
    }
    .feed-rail {
      gap: 0.625rem;
    }
  }
</style>
