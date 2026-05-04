<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { tactile } from "$lib/tactile";

  // Receiver for the PWA share_target. Manifest declares method=GET with
  // params { title, text, url } — the OS appends those to this route when the
  // user picks "Series Tracker" from the system share sheet. We feel-check the
  // payload for a TMDB URL (the most common share source) and redirect to the
  // matching detail page; on miss we surface what we got plus a one-tap search
  // so the user can recover.

  type Hit =
    | { kind: "tv" | "movie"; id: number }
    | { kind: "season"; id: number; season: number };

  // Matches both `themoviedb.org/(tv|movie)/{id}` and the app's own routes
  // when shared back into itself. The optional `/season/{n}` capture lets us
  // route a shared season tracker URL to its season page rather than the show
  // root. Trailing path bits ("12345-the-show-name") and query strings are
  // tolerated; the numbers are the only thing we care about.
  const TMDB_PATTERN = /(?:themoviedb\.org|\/series-tracker)\/(tv|movie|show)\/(\d+)(?:\/season\/(\d+))?/i;

  function parsePayload(raw: string | null | undefined): Hit | null {
    if (!raw) return null;
    const m = raw.match(TMDB_PATTERN);
    if (!m) return null;
    const isMovie = m[1].toLowerCase() === "movie";
    const id = Number(m[2]);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (m[3] !== undefined && !isMovie) {
      const season = Number(m[3]);
      if (Number.isFinite(season) && season >= 0) return { kind: "season", id, season };
    }
    return { kind: isMovie ? "movie" : "tv", id };
  }

  // Title/text/url are all candidate carriers — Android sometimes puts the URL
  // in `text` instead of `url`, especially when the source app shares
  // free-form. Walk all three so we don't miss the obvious case.
  const sharedTitle = $derived(page.url.searchParams.get("title") ?? "");
  const sharedText = $derived(page.url.searchParams.get("text") ?? "");
  const sharedUrl = $derived(page.url.searchParams.get("url") ?? "");

  const hit = $derived(
    parsePayload(sharedUrl) ?? parsePayload(sharedText) ?? parsePayload(sharedTitle)
  );

  // Auto-redirect on a confident match. `replaceState` keeps the share route
  // out of the back stack so tapping back from the show page returns to the
  // app the user came from, not this hand-off screen.
  $effect(() => {
    if (!hit) return;
    let path: string;
    if (hit.kind === "movie") path = `${base}/movie/${hit.id}/`;
    else if (hit.kind === "season") path = `${base}/show/${hit.id}/season/${hit.season}/`;
    else path = `${base}/show/${hit.id}/`;
    void goto(path, { replaceState: true });
  });

  // Best-guess search query for the fallback — drop URLs out of the text so
  // the search input doesn't get a literal http(s) string.
  const searchQuery = $derived.by<string>(() => {
    const candidate = sharedTitle.trim() || sharedText.trim();
    return candidate.replace(/https?:\/\/\S+/g, "").trim();
  });
</script>

<svelte:head>
  <title>Shared link · Series Tracker</title>
</svelte:head>

<PageHeader title="Open shared link" subtitle="Routing to the matching title…" />

<section class="space-y-4">
  {#if hit}
    <p class="rounded-md border border-border bg-surface p-4 text-sm text-muted">
      Opening
      {#if hit.kind === "season"}
        show #{hit.id} · season {hit.season}…
      {:else if hit.kind === "movie"}
        movie #{hit.id}…
      {:else}
        show #{hit.id}…
      {/if}
    </p>
  {:else}
    <div class="space-y-3 rounded-md border border-dashed border-border p-4 text-sm">
      <p>
        Couldn't recognise the shared content as a TMDB title. Try searching for it instead.
      </p>
      {#if sharedTitle || sharedText || sharedUrl}
        <div class="space-y-1 rounded bg-surface-2 p-3 text-xs text-muted">
          {#if sharedTitle}<p><span class="text-muted/70">Title:</span> {sharedTitle}</p>{/if}
          {#if sharedText}<p class="break-all"><span class="text-muted/70">Text:</span> {sharedText}</p>{/if}
          {#if sharedUrl}<p class="break-all"><span class="text-muted/70">URL:</span> {sharedUrl}</p>{/if}
        </div>
      {/if}
      <div class="flex flex-wrap gap-2">
        {#if searchQuery}
          <a
            href="{base}/search/?q={encodeURIComponent(searchQuery)}"
            use:tactile
            class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-bg"
          >
            <Icon name="search" size={14} />
            Search "{searchQuery}"
          </a>
        {/if}
        <a
          href="{base}/"
          use:tactile={{ haptic: false }}
          class="tap-target tap-target--btn rounded-md border border-border px-3 py-1.5 text-sm hover-border-primary"
        >
          Cancel
        </a>
      </div>
    </div>
  {/if}
</section>
