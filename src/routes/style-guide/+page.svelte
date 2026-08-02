<script lang="ts">
  import EpisodeCard from "$lib/components/EpisodeCard.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import LibraryCard from "$lib/components/LibraryCard.svelte";
  import ListCard from "$lib/components/ListCard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PersonCard from "$lib/components/PersonCard.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import TemptationBar from "$lib/components/TemptationBar.svelte";
  import { PACING_PRESETS } from "$lib/temptation";
  import { STATUS_COLOR, STATUS_LABEL, STATUSES } from "$lib/types";
  import type { MovieEntry, SearchMultiResult, Season, Status, TemptationEvent, TvEntry } from "$lib/types";

  // Mock IDs are intentionally absurd so clicking through can't collide with a
  // real TMDB entry on the user's library. Style-guide actions are demo-only.
  const MOCK_BASE = 9_900_000;

  // TMDB-style placeholder posters/backdrops. Using w342 / w780 sizes for
  // realism. If TMDB images fail to load, the surface-2 background shows.
  const POSTERS = {
    severance: "https://image.tmdb.org/t/p/w342/jL22BUDO37BglDPx0fz4t8Wkfdu.jpg",
    arcane: "https://image.tmdb.org/t/p/w342/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg",
    dune: "https://image.tmdb.org/t/p/w342/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg",
    interstellar: "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    bridgerton: "https://image.tmdb.org/t/p/w342/luoKpgVwi1E5nQsi7W0UuKHu2Rq.jpg",
    matrix: "https://image.tmdb.org/t/p/w342/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  };
  const BACKDROPS = {
    severance: "https://image.tmdb.org/t/p/w780/2QxGwBQILcEVy9R3jlW96Owrhmg.jpg",
    arcane: "https://image.tmdb.org/t/p/w780/q8eejQcg1bAqImEV8jh8RtBD4uH.jpg",
    dune: "https://image.tmdb.org/t/p/w780/euYIwmwkmz95mnXvufEmbL6ovhZ.jpg",
  };
  const PROFILES = {
    actor: "https://image.tmdb.org/t/p/w185/4N1IKeRMGgbSQQA3IIZJ3OBF8DZ.jpg",
  };

  // Anchored "now" used by every temptation demo entry — keeps decay frozen
  // at the value we set rather than letting `currentTemptation` walk the
  // value down from a stale addedAt timestamp.
  const TT_NOW = new Date().toISOString();
  function fakeBump(action: TemptationEvent["action"], delta: number, meta?: string): TemptationEvent {
    const ev: TemptationEvent = { at: TT_NOW, delta, action };
    if (meta) ev.meta = meta;
    return ev;
  }

  // Mock entries — one per status × kind so every card variant gets exercised.
  function makeTv(opts: {
    id: number;
    title: string;
    poster: string;
    backdrop?: string | null;
    status: Status;
    seasons?: Season[];
    progress?: Record<number, number>;
    rating?: number;
    voteAverage?: number;
    year?: string;
    temptation?: number;
    temptationLog?: TemptationEvent[];
  }): TvEntry {
    const seasons: Season[] = opts.seasons ?? [
      { number: 1, name: "Season 1", episodeCount: 9 },
      { number: 2, name: "Season 2", episodeCount: 10 },
    ];
    return {
      kind: "tv",
      id: opts.id,
      title: opts.title,
      poster: opts.poster,
      backdrop: opts.backdrop ?? null,
      seasons,
      progress: opts.progress ?? {},
      status: opts.status,
      year: opts.year ?? "2022",
      voteAverage: opts.voteAverage,
      rating: opts.rating,
      temptation: opts.temptation,
      temptationUpdatedAt: opts.temptation !== undefined ? TT_NOW : undefined,
      temptationLog: opts.temptationLog,
      addedAt: "2025-09-01T00:00:00Z",
      updatedAt: "2025-12-01T00:00:00Z",
    };
  }

  function makeMovie(opts: {
    id: number;
    title: string;
    poster: string;
    backdrop?: string | null;
    status: Status;
    rating?: number;
    voteAverage?: number;
    year?: string;
    runtime?: number;
    temptation?: number;
    temptationLog?: TemptationEvent[];
  }): MovieEntry {
    return {
      kind: "movie",
      id: opts.id,
      title: opts.title,
      poster: opts.poster,
      backdrop: opts.backdrop ?? null,
      watched: opts.status === "completed",
      status: opts.status,
      year: opts.year ?? "2024",
      voteAverage: opts.voteAverage,
      rating: opts.rating,
      runtime: opts.runtime ?? 120,
      temptation: opts.temptation,
      temptationUpdatedAt: opts.temptation !== undefined ? TT_NOW : undefined,
      temptationLog: opts.temptationLog,
      addedAt: "2025-09-01T00:00:00Z",
      updatedAt: "2025-12-01T00:00:00Z",
    };
  }

  const tvWatching = makeTv({
    id: MOCK_BASE + 1,
    title: "Severance",
    poster: POSTERS.severance,
    backdrop: BACKDROPS.severance,
    status: "watching",
    progress: { 1: 9, 2: 4 },
    voteAverage: 8.4,
    rating: 9,
    year: "2022",
    temptation: 0.82,
    temptationLog: [fakeBump("episode-watched", 0.25, "S2E5"), fakeBump("rated-high", 0.1, "rated 9")],
  });
  const tvCompleted = makeTv({
    id: MOCK_BASE + 2,
    title: "Arcane",
    poster: POSTERS.arcane,
    backdrop: BACKDROPS.arcane,
    status: "completed",
    seasons: [
      { number: 1, name: "Season 1", episodeCount: 9 },
      { number: 2, name: "Season 2", episodeCount: 9 },
    ],
    progress: { 1: 9, 2: 9 },
    voteAverage: 8.7,
    rating: 10,
    year: "2021",
  });
  const tvPlan = makeTv({
    id: MOCK_BASE + 3,
    title: "Bridgerton",
    poster: POSTERS.bridgerton,
    status: "plan",
    progress: {},
    voteAverage: 7.4,
    year: "2020",
  });
  const tvDropped = makeTv({
    id: MOCK_BASE + 4,
    title: "A Show With A Particularly Long Title For Wrap Testing",
    poster: POSTERS.severance,
    status: "dropped",
    progress: { 1: 3 },
    voteAverage: 6.1,
    year: "2019",
  });
  const tvTuned = makeTv({
    id: MOCK_BASE + 5,
    title: "Bridgerton",
    poster: POSTERS.bridgerton,
    status: "tuned",
    progress: {},
    voteAverage: 7.4,
    year: "2020",
  });

  const movieWatching = makeMovie({
    id: MOCK_BASE + 11,
    title: "Dune: Part Two",
    poster: POSTERS.dune,
    backdrop: BACKDROPS.dune,
    status: "watching",
    voteAverage: 8.2,
    rating: 9,
    year: "2024",
    runtime: 166,
    temptation: 0.94,
    temptationLog: [fakeBump("detail-opened", 0.03), fakeBump("picker-win", 0.15)],
  });
  const movieCompleted = makeMovie({
    id: MOCK_BASE + 12,
    title: "Interstellar",
    poster: POSTERS.interstellar,
    status: "completed",
    voteAverage: 8.4,
    rating: 10,
    year: "2014",
    runtime: 169,
  });
  const moviePlan = makeMovie({
    id: MOCK_BASE + 13,
    title: "The Matrix",
    poster: POSTERS.matrix,
    status: "plan",
    voteAverage: 8.2,
    year: "1999",
    runtime: 136,
  });
  const movieDropped = makeMovie({
    id: MOCK_BASE + 14,
    title: "An Unfinished Movie",
    poster: POSTERS.matrix,
    status: "dropped",
    voteAverage: 5.2,
    year: "2018",
    runtime: 142,
  });
  const movieTuned = makeMovie({
    id: MOCK_BASE + 15,
    title: "The Matrix",
    poster: POSTERS.matrix,
    status: "tuned",
    voteAverage: 8.2,
    year: "1999",
    runtime: 136,
  });

  const allEntries = [
    tvWatching,
    tvCompleted,
    tvPlan,
    tvDropped,
    tvTuned,
    movieWatching,
    movieCompleted,
    moviePlan,
    movieDropped,
    movieTuned,
  ];

  // Temptation showcase entries — one per band so the bar + card glow can be
  // demoed at every intensity from Cold (no glow) to Burning (full halo).
  // All "watching" so the glow's hue stays in the primary palette and the
  // band-by-band intensity ramp reads cleanly.
  const ttBandEntries = [
    makeTv({
      id: MOCK_BASE + 901,
      title: "Cold · ignored for weeks",
      poster: POSTERS.severance,
      status: "watching",
      progress: { 1: 1 },
      year: "2022",
      temptation: 0.08,
      temptationLog: [fakeBump("detail-opened", 0.03)],
    }),
    makeTv({
      id: MOCK_BASE + 902,
      title: "Drifting · half-remembered",
      poster: POSTERS.bridgerton,
      status: "watching",
      progress: { 1: 3 },
      year: "2020",
      temptation: 0.32,
      temptationLog: [fakeBump("episode-watched", 0.25, "S1E3")],
    }),
    makeTv({
      id: MOCK_BASE + 903,
      title: "Warming · poking around",
      poster: POSTERS.arcane,
      status: "watching",
      progress: { 1: 5 },
      year: "2021",
      temptation: 0.52,
      temptationLog: [fakeBump("episode-watched", 0.25, "S1E5"), fakeBump("detail-opened", 0.03)],
    }),
    makeTv({
      id: MOCK_BASE + 904,
      title: "Hot · in the middle of",
      poster: POSTERS.severance,
      backdrop: BACKDROPS.severance,
      status: "watching",
      progress: { 1: 9, 2: 4 },
      year: "2022",
      temptation: 0.74,
      temptationLog: [fakeBump("episode-watched", 0.25, "S2E5"), fakeBump("rated-high", 0.1, "rated 9")],
    }),
    makeMovie({
      id: MOCK_BASE + 905,
      title: "Burning · obsessed right now",
      poster: POSTERS.dune,
      backdrop: BACKDROPS.dune,
      status: "watching",
      year: "2024",
      runtime: 166,
      temptation: 0.96,
      temptationLog: [fakeBump("picker-win", 0.15), fakeBump("detail-opened", 0.03)],
    }),
  ];

  // SearchResultCard wants raw TMDB-shaped results (not Entry).
  const searchResults: SearchMultiResult[] = [
    {
      media_type: "tv",
      id: MOCK_BASE + 100,
      name: "Severance",
      poster_path: "/jL22BUDO37BglDPx0fz4t8Wkfdu.jpg",
      first_air_date: "2022-02-18",
      overview:
        "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.",
    },
    {
      media_type: "movie",
      id: MOCK_BASE + 101,
      title: "Dune: Part Two",
      poster_path: "/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg",
      release_date: "2024-02-27",
      overview:
        "Paul Atreides unites with the Fremen while seeking revenge against the conspirators who destroyed his family.",
    },
    {
      media_type: "person",
      id: MOCK_BASE + 102,
      name: "Florence Pugh",
    },
  ];

  function noopAdd(): void {
    // style-guide demo — don't actually mutate the library
  }

  // ---- Colour tokens ------------------------------------------------------
  // Mirrors the brand palette in `layout.css`. The ladder is the 7 shades the
  // contrast contract is measured against; the roles are which rung each
  // surface tier sits on (and that mapping flips direction between modes).
  const shadeTokens = [
    { name: "background-lightest", className: "bg-background-lightest" },
    { name: "background-lighter", className: "bg-background-lighter" },
    { name: "background-light", className: "bg-background-light" },
    { name: "background", className: "bg-background" },
    { name: "background-dark", className: "bg-background-dark" },
    { name: "background-darker", className: "bg-background-darker" },
    { name: "background-darkest", className: "bg-background-darkest" },
  ] as const;

  const roleTokens = [
    { name: "bg", className: "bg-bg" },
    { name: "surface", className: "bg-surface" },
    { name: "surface-2", className: "bg-surface-2" },
    { name: "border", className: "bg-border" },
    { name: "strong", className: "bg-strong" },
    { name: "text", className: "bg-text" },
    { name: "muted", className: "bg-muted" },
    { name: "disabled", className: "bg-disabled" },
  ] as const;

  // Engagement order — the scale is a lightness ladder, brightest first.
  const statusTokens = [
    { name: "watching", className: "bg-status-watching" },
    { name: "plan", className: "bg-status-plan" },
    { name: "tuned", className: "bg-status-tuned" },
    { name: "completed", className: "bg-status-completed" },
    { name: "dropped", className: "bg-status-dropped" },
  ] as const;

  // Rank order is the brand's own: chroma is rank, 1c → 4c.
  const railTokens = [
    { name: "tertiary", className: "bg-tertiary" },
    { name: "secondary", className: "bg-secondary" },
    { name: "primary", className: "bg-primary" },
    { name: "accent", className: "bg-accent" },
    { name: "cottontail", className: "bg-cottontail" },
    { name: "success", className: "bg-success" },
    { name: "warning", className: "bg-warning" },
    { name: "error", className: "bg-error" },
    { name: "info", className: "bg-info" },
  ] as const;
</script>

<PageHeader
  title="Style Guide"
  subtitle="Component playground — iterate on cards, tokens, primitives here."
/>

<div class="space-y-12">
  <!-- ============================== INTENT NOTE ========================== -->
  <section class="rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm">
    <h2 class="mb-1 text-sm font-semibold text-accent">Card consolidation goal</h2>
    <p class="text-muted">
      Two card variants only: <strong class="text-text">horizontal list</strong> and
      <strong class="text-text">grid (poster)</strong>. In <em>all</em> scenarios the card
      must display the <strong class="text-text">type</strong> (tv / movie) and the user's
      <strong class="text-text">status</strong> (a coloured dot is fine; "not in library"
      cards display the type but no status).
    </p>
  </section>

  <!-- ============================== TOKENS =============================== -->
  <section class="space-y-6">
    <div class="space-y-1">
      <h2 class="text-lg font-semibold tracking-tight">Colour tokens</h2>
      <p class="text-sm text-muted">
        The lilBunnyRabbit brand palette. Every rail below clears WCAG AA 4.5:1 against every
        shade, in both modes — so any shade can back any section and nothing needs re-checking.
        <span class="text-text">cottontail</span> is exempt: it's an identity colour and makes no
        contrast claim.
      </p>
    </div>

    <div class="space-y-2">
      <h3 class="text-sm font-semibold">Shade ladder</h3>
      <p class="text-xs text-muted">
        Seven rungs, lightest to darkest. Keep it to three per viewport — neighbours are ~1.1:1
        apart, so a fourth stops reading as structure.
      </p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-7">
        {#each shadeTokens as t (t.name)}
          <div class="space-y-1.5">
            <div
              class="h-16 w-full rounded-md border border-border {t.className}"
              aria-hidden="true"
            ></div>
            <div class="text-[11px] tabular-nums text-muted">{t.name}</div>
          </div>
        {/each}
      </div>
    </div>

    <div class="space-y-2">
      <h3 class="text-sm font-semibold">Roles</h3>
      <p class="text-xs text-muted">
        Which rung each surface tier sits on. Elevation climbs the ladder in dark and descends it
        in light, so these rebind per mode while the shade names above never do.
      </p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {#each roleTokens as t (t.name)}
          <div class="space-y-1.5">
            <div
              class="h-16 w-full rounded-md border border-border {t.className}"
              aria-hidden="true"
            ></div>
            <div class="text-[11px] tabular-nums text-muted">{t.name}</div>
          </div>
        {/each}
      </div>
    </div>

    <div class="space-y-2">
      <h3 class="text-sm font-semibold">Rails</h3>
      <p class="text-xs text-muted">
        Four brand colours then four states. Hue is identity, chroma is rank — they're all the same
        lightness, so never place two adjacent without a gap or a border, and never gradient between
        them <em>decoratively</em>: with nowhere to travel but hue, a decorative blend comes out
        muddy. A data scale is the one exception (see the Temptation bar), and only interpolated in
        OKLCH along the shorter hue arc, where the travel is the signal.
      </p>
      <div class="grid grid-cols-3 gap-3 sm:grid-cols-9">
        {#each railTokens as t (t.name)}
          <div class="space-y-1.5">
            <div
              class="h-16 w-full rounded-md border border-border {t.className}"
              aria-hidden="true"
            ></div>
            <div class="text-[11px] tabular-nums text-muted">{t.name}</div>
          </div>
        {/each}
      </div>
    </div>

    <div class="space-y-2">
      <h3 class="text-sm font-semibold">Status scale <span class="font-normal text-muted">— data encoding, not brand</span></h3>
      <p class="text-xs text-muted">
        The one place colour carries meaning rather than emphasis, so it's the one place the rails
        can't be used: they share a single lightness, and hue alone doesn't survive a 6px dot or
        colour-vision deficiency. This scale is anchored on <span class="text-text">cottontail</span>
        and adds the lightness axis back — brightest is most engaged, dimmest is dropped.
      </p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {#each statusTokens as t (t.name)}
          <div class="space-y-1.5">
            <div
              class="h-16 w-full rounded-md border border-border {t.className}"
              aria-hidden="true"
            ></div>
            <div class="text-[11px] tabular-nums text-muted">{t.name}</div>
          </div>
        {/each}
      </div>
    </div>

    <div class="space-y-2">
      <h3 class="text-sm font-semibold">Modifiers</h3>
      <p class="text-xs text-muted">
        Interaction and de-emphasis are alpha on an existing colour, never a new colour.
      </p>
      <div class="flex flex-wrap gap-2">
        {#each [["hover", "85%"], ["active", "70%"], ["muted", "65%"], ["border", "67%"], ["disabled", "38%"]] as [name, pct] (name)}
          <span class="rounded-md border border-border bg-surface px-2.5 py-1 text-xs">
            {name}<span class="ml-1.5 tabular-nums text-muted">{pct}</span>
          </span>
        {/each}
      </div>
    </div>
  </section>

  <!-- ============================== TYPOGRAPHY =========================== -->
  <section class="space-y-4">
    <h2 class="text-lg font-semibold tracking-tight">Typography</h2>
    <div class="space-y-2 rounded-lg border border-border bg-surface p-4">
      <h1 class="text-xl font-semibold tracking-tight">H1 · text-xl semibold (page title)</h1>
      <h2 class="text-base font-semibold tracking-tight">H2 · text-base semibold (section)</h2>
      <h3 class="text-sm font-medium uppercase tracking-wider text-muted">
        H3 · uppercase muted (rail label)
      </h3>
      <p class="text-sm">Body · text-sm — default reading copy.</p>
      <p class="text-xs text-muted">Caption · text-xs muted — meta &amp; subtitles.</p>
      <p class="text-[10px] uppercase tracking-wider text-muted">
        Eyebrow · 10px uppercase muted (status meta on cards)
      </p>
      <p class="text-sm tabular-nums">Tabular nums: 1234 · 99/120 · 8.4</p>
    </div>
  </section>

  <!-- ============================== STATUS =============================== -->
  <section class="space-y-4">
    <h2 class="text-lg font-semibold tracking-tight">Status indicators</h2>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {#each STATUSES as s (s)}
        {@const c = STATUS_COLOR[s]}
        <div class="space-y-2 rounded-lg border border-border bg-surface p-3">
          <div class="text-[10px] uppercase tracking-wider text-muted">{s}</div>
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full {c.dot}"></span>
            <span class="text-sm {c.text}">{STATUS_LABEL[s]}</span>
          </div>
          <div>
            <span
              class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs {c.chip}"
            >
              <span class="h-1.5 w-1.5 rounded-full {c.dot}"></span>
              {STATUS_LABEL[s]}
            </span>
          </div>
          <div class="rounded-md border {c.border} p-2 text-xs {c.text}">
            border + text variant
          </div>
          <div class="rounded-md {c.bg} p-2 text-xs text-bg">filled bg variant</div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ============================== BUTTONS ============================== -->
  <section class="space-y-4">
    <h2 class="text-lg font-semibold tracking-tight">Buttons</h2>
    <div class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-4">
      <button
        type="button"
        class="tap-target tap-target--btn rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
      >
        Primary
      </button>
      <button
        type="button"
        class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-primary"
      >
        Secondary
      </button>
      <button
        type="button"
        class="tap-target tap-target--btn rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent hover-border-accent"
      >
        Accent
      </button>
      <button
        type="button"
        class="tap-target tap-target--btn rounded-md border border-error/40 px-4 py-2 text-sm text-error"
      >
        Error
      </button>
      <button
        type="button"
        class="tap-target tap-target--btn rounded-md px-4 py-2 text-sm text-muted hover-text-text"
      >
        Ghost
      </button>
      <button
        type="button"
        aria-label="Icon"
        class="tap-target tap-target--icon flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover-border-primary hover-text-text"
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
    <div class="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface p-4">
      {#each STATUSES as s (s)}
        {@const c = STATUS_COLOR[s]}
        <button
          type="button"
          class="tap-target tap-target--chip flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs {c.border} {c.text}"
        >
          <span class="h-1.5 w-1.5 rounded-full {c.dot}"></span>
          <span>{STATUS_LABEL[s]}</span>
        </button>
      {/each}
    </div>
  </section>

  <!-- ============================== POSTER CARD (GRID) ==================== -->
  <section class="space-y-4">
    <header>
      <h2 class="text-lg font-semibold tracking-tight">PosterCard <span class="text-xs font-normal text-muted">— rails &amp; library grid</span></h2>
      <p class="mt-0.5 text-xs text-muted">
        Currently used in: home rails, watchlist grid, discover/browse, picker, info
        recommendations. Today shows status dot but <strong class="text-text">no type indicator</strong>.
      </p>
    </header>

    <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">Rail (fixed widths)</h3>
    <div class="-mx-3 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
      <div class="flex gap-3 pb-2">
        <PosterCard
          kind="tv"
          id={tvWatching.id}
          title={tvWatching.title}
          poster={tvWatching.poster}
          year={tvWatching.year}
          meta="S2 · E5"
          voteAverage={tvWatching.voteAverage}
          rating={tvWatching.rating}
          status={tvWatching.status}
        />
        <PosterCard
          kind="movie"
          id={movieCompleted.id}
          title={movieCompleted.title}
          poster={movieCompleted.poster}
          year={movieCompleted.year}
          meta="2h 49m"
          voteAverage={movieCompleted.voteAverage}
          rating={movieCompleted.rating}
          status={movieCompleted.status}
          watched
        />
        <PosterCard
          kind="tv"
          id={tvPlan.id}
          title={tvPlan.title}
          poster={tvPlan.poster}
          year={tvPlan.year}
          meta="19 ep"
          voteAverage={tvPlan.voteAverage}
          status={tvPlan.status}
        />
        <PosterCard
          kind="tv"
          id={tvDropped.id}
          title={tvDropped.title}
          poster={tvDropped.poster}
          year={tvDropped.year}
          meta="3/9"
          voteAverage={tvDropped.voteAverage}
          status={tvDropped.status}
        />
        <PosterCard
          kind="movie"
          id={moviePlan.id}
          title="Not-in-library movie (no status)"
          poster={moviePlan.poster}
          year="1999"
          meta="2h 16m"
          voteAverage={moviePlan.voteAverage}
        />
      </div>
    </div>

    <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">Grid (auto width)</h3>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <PosterCard
        kind="tv"
        id={tvWatching.id}
        title={tvWatching.title}
        poster={tvWatching.poster}
        year={tvWatching.year}
        meta="19 ep"
        voteAverage={tvWatching.voteAverage}
        rating={tvWatching.rating}
        status={tvWatching.status}
        width="auto"
      />
      <PosterCard
        kind="movie"
        id={movieCompleted.id}
        title={movieCompleted.title}
        poster={movieCompleted.poster}
        year={movieCompleted.year}
        meta="2h 49m"
        voteAverage={movieCompleted.voteAverage}
        rating={movieCompleted.rating}
        status={movieCompleted.status}
        watched
        width="auto"
      />
      <PosterCard
        kind="tv"
        id={tvPlan.id}
        title={tvPlan.title}
        poster={tvPlan.poster}
        year={tvPlan.year}
        meta="19 ep"
        voteAverage={tvPlan.voteAverage}
        status={tvPlan.status}
        width="auto"
      />
      <PosterCard
        kind="tv"
        id={tvDropped.id}
        title={tvDropped.title}
        poster={tvDropped.poster}
        year={tvDropped.year}
        meta="3/9"
        voteAverage={tvDropped.voteAverage}
        status={tvDropped.status}
        width="auto"
      />
    </div>
  </section>

  <!-- ============================== LIST CARD (HORIZONTAL) ================ -->
  <section class="space-y-4">
    <header>
      <h2 class="text-lg font-semibold tracking-tight">ListCard <span class="text-xs font-normal text-muted">— horizontal w/ backdrop</span></h2>
      <p class="mt-0.5 text-xs text-muted">
        Currently used on: watchlist list view. Status dot on the poster, label in the meta line.
        Optional right-side backdrop bleed. Long-press → action sheet.
        <strong class="text-text">No type indicator today.</strong>
      </p>
    </header>
    <div class="space-y-2">
      {#each allEntries as e (e.kind + ":" + e.id)}
        <ListCard entry={e} backdrop={e.backdrop ?? null} />
      {/each}
    </div>
  </section>

  <!-- ============================== LIBRARY CARD (compact + grid) ========= -->
  <section class="space-y-4">
    <header>
      <h2 class="text-lg font-semibold tracking-tight">LibraryCard <span class="text-xs font-normal text-muted">— watchlist grid (with compact mode)</span></h2>
      <p class="mt-0.5 text-xs text-muted">
        Currently used on: watchlist grid view. Two modes packed into one component (compact
        horizontal + poster grid) — overlaps with both ListCard and PosterCard, prime
        consolidation target. <strong class="text-text">Type indicator missing.</strong>
      </p>
    </header>

    <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">Compact (horizontal list)</h3>
    <div class="space-y-1.5">
      {#each allEntries as e (e.kind + ":" + e.id)}
        <LibraryCard entry={e} compact />
      {/each}
    </div>

    <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">Grid mode</h3>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each allEntries as e (e.kind + ":" + e.id)}
        <LibraryCard entry={e} />
      {/each}
    </div>
  </section>

  <!-- ============================== SEARCH RESULT CARD ==================== -->
  <section class="space-y-4">
    <header>
      <h2 class="text-lg font-semibold tracking-tight">SearchResultCard <span class="text-xs font-normal text-muted">— search &amp; discover</span></h2>
      <p class="mt-0.5 text-xs text-muted">
        Currently used in: search results, discover sections. Has the
        <code class="rounded bg-surface-2 px-1">media_type</code> chip — already shows type.
        Status shown only when in library, otherwise &ldquo;+ Add&rdquo; menu.
      </p>
    </header>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      {#each searchResults as r (r.media_type + ":" + r.id)}
        <SearchResultCard result={r} onAdd={noopAdd} />
      {/each}
    </div>
  </section>

  <!-- ============================== TEMPTATION =========================== -->
  <section class="space-y-4">
    <header>
      <h2 class="text-lg font-semibold tracking-tight">
        Temptation
        <span class="text-xs font-normal text-muted">— bar, bands, card glow, pacing</span>
      </h2>
      <p class="mt-0.5 text-xs text-muted">
        Bounded 0–1 engagement score per library entry. Built up by activity (episodes
        watched, picker outcomes, opening detail pages, rating highly), faded by exponential
        time decay. Drives the Temptation watchlist sort and a refined warm halo on cards
        in the Hot or Burning bands.
      </p>
    </header>

    <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">TemptationBar — one per band</h3>
    <div class="grid gap-3 sm:grid-cols-2">
      {#each ttBandEntries as e (e.kind + ":" + e.id)}
        <div class="rounded-md border border-border bg-bg p-3">
          <p class="mb-2 text-xs text-muted">{e.title}</p>
          <TemptationBar entry={e} />
        </div>
      {/each}
    </div>

    <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">Card glow ramp</h3>
    <p class="text-xs text-muted">
      The same five entries rendered as <code class="rounded bg-surface-2 px-1 py-0.5 text-[11px]">LibraryCard</code>.
      Cold and Drifting stay neutral; Warming sits just below the glow threshold; Hot blooms
      with a subtle inset halo; Burning gets the full intensity. Hue follows the entry's
      status colour so the glow layers cleanly with the tinted border instead of fighting it.
    </p>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {#each ttBandEntries as e (e.kind + ":" + e.id)}
        <LibraryCard entry={e} />
      {/each}
    </div>

    <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">Pacing presets</h3>
    <p class="text-xs text-muted">
      User picks one in Settings → Preferences. The mapping translates to a per-day
      decay coefficient applied lazily on read.
    </p>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {#each PACING_PRESETS as preset (preset.value)}
        <div class="rounded-md border border-border bg-surface px-3 py-2">
          <p class="text-sm font-semibold">{preset.label}</p>
          <p class="text-[11px] text-muted">{preset.hint}</p>
        </div>
      {/each}
    </div>

    <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">Status colour mapping</h3>
    <p class="text-xs text-muted">
      The glow inherits each entry's status hue so a "Plan" card glows in accent, a
      "Watching" card glows in primary, etc. Below: a Hot LibraryCard at every status to
      show the tone variation.
    </p>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {#each STATUSES as s (s)}
        <LibraryCard
          entry={makeTv({
            id: MOCK_BASE + 920 + STATUSES.indexOf(s),
            title: STATUS_LABEL[s],
            poster: POSTERS.severance,
            status: s,
            progress: { 1: 5 },
            year: "2022",
            temptation: 0.85,
            temptationLog: [fakeBump("episode-watched", 0.25, "S1E5")],
          })}
        />
      {/each}
    </div>
  </section>

  <!-- ============================== EPISODE / PERSON ===================== -->
  <section class="space-y-4">
    <header>
      <h2 class="text-lg font-semibold tracking-tight">Other cards <span class="text-xs font-normal text-muted">— not in scope for the unification</span></h2>
      <p class="mt-0.5 text-xs text-muted">
        Episode and Person cards stay separate — they represent different content types.
      </p>
    </header>

    <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">EpisodeCard</h3>
    <div class="-mx-3 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
      <div class="flex gap-3 pb-2">
        <EpisodeCard
          kind="tv"
          id={tvWatching.id}
          title="Severance"
          backdrop={BACKDROPS.severance}
          episodeLabel="S2 · E5 — Trojan's Horse"
          topLeft="42m"
          bottomLeft="In 3 days"
        />
        <EpisodeCard
          kind="tv"
          id={tvCompleted.id}
          title="Arcane"
          backdrop={BACKDROPS.arcane}
          episodeLabel="S2 · E9 — The Dirt Under Your Nails"
          topLeft="38m"
          watched
        />
      </div>
    </div>

    <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted">PersonCard</h3>
    <div class="-mx-3 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
      <div class="flex gap-3 pb-2">
        <PersonCard
          id={MOCK_BASE + 200}
          name="Florence Pugh"
          role="Princess Irulan"
          profile={PROFILES.actor}
          episodeCount={6}
        />
        <PersonCard
          id={MOCK_BASE + 201}
          name="Adam Scott"
          role="Mark Scout"
          profile={null}
          episodeCount={19}
        />
      </div>
    </div>
  </section>
</div>
