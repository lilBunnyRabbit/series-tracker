<script lang="ts">
  import { base } from "$app/paths";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import Rail from "$lib/components/Rail.svelte";
  import StatusMenu from "$lib/components/StatusMenu.svelte";
  import { store } from "$lib/store.svelte";
  import { entryFromSearchResult, posterUrl, searchMulti } from "$lib/tmdb";
  import { STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { SearchMultiResult, Status } from "$lib/types";

  // Person results are filtered out before display, so the rendered list only
  // ever contains tv/movie variants. Narrowing the type here saves a runtime
  // re-check at every card.
  type NonPersonResult = Exclude<SearchMultiResult, { media_type: "person" }>;

  type GroupResult = {
    query: string;
    /** null while searching, [] if no matches, populated otherwise. */
    results: NonPersonResult[] | null;
    error?: string;
  };

  const PER_QUERY_LIMIT = 5;
  const MAX_QUERIES = 30;

  let input = $state("");
  let groups = $state<GroupResult[]>([]);
  let running = $state(false);
  let busyKey = $state<string | null>(null);

  function parseQueries(raw: string): string[] {
    // Accept newline OR comma-separated; tolerate markdown/list bullets, numbering,
    // and trailing punctuation. Trim, dedupe case-insensitively.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const part of raw.split(/[\n,]+/)) {
      const q = stripBullet(part);
      if (!q) continue;
      const k = q.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(q);
      if (out.length >= MAX_QUERIES) break;
    }
    return out;
  }

  // Strips leading list markers so users can paste lists from Markdown / chat /
  // ordered lists without first cleaning them up.
  function stripBullet(line: string): string {
    let s = line.trim();
    if (!s) return "";
    // Repeatedly peel off any of: -, *, +, •, –, —, "1.", "1)", "(1)", "[ ]"/"[x]" task markers.
    // Loop because users sometimes nest, e.g. "- [ ] Foo".
    const patterns: RegExp[] = [
      /^[-*+•–—]\s+/,
      /^\d+[.)]\s+/,
      /^\(\d+\)\s+/,
      /^\[\s*[xX ]?\s*\]\s+/,
      /^>\s+/,
    ];
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of patterns) {
        if (p.test(s)) {
          s = s.replace(p, "").trim();
          changed = true;
        }
      }
    }
    return s;
  }

  async function run(): Promise<void> {
    if (!store.apiKey) return;
    const queries = parseQueries(input);
    if (queries.length === 0) {
      groups = [];
      return;
    }

    // Seed groups so the UI can show per-row progress while requests resolve.
    groups = queries.map((q) => ({ query: q, results: null }));
    running = true;
    const apiKey = store.apiKey;

    // Run in parallel — TMDB tolerates this fine for ≤30 requests, and we cache by query.
    await Promise.all(
      queries.map(async (q, i) => {
        try {
          const r = await searchMulti(q, apiKey);
          const top = r.results
            .filter((x): x is NonPersonResult => x.media_type !== "person")
            .slice(0, PER_QUERY_LIMIT);
          groups = groups.map((g, idx) => (idx === i ? { ...g, results: top } : g));
          if (q.trim()) store.pushSearchHistory(q);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          groups = groups.map((g, idx) => (idx === i ? { ...g, results: [], error: msg } : g));
        }
      })
    );
    running = false;
  }

  async function handleAdd(r: SearchMultiResult, status: Status): Promise<void> {
    if (r.media_type === "person" || !store.apiKey) return;
    const k = `${r.media_type}:${r.id}`;
    busyKey = k;
    try {
      const entry = await entryFromSearchResult(r, store.apiKey, status);
      if (entry) store.addToLibrary(entry);
    } finally {
      busyKey = null;
    }
  }

  function clearAll(): void {
    input = "";
    groups = [];
  }

  function titleOf(r: SearchMultiResult): string {
    if (r.media_type === "movie") return r.title;
    if (r.media_type === "tv") return r.name;
    return r.name;
  }
  function yearOf(r: SearchMultiResult): string | undefined {
    if (r.media_type === "movie") return r.release_date?.slice(0, 4);
    if (r.media_type === "tv") return r.first_air_date?.slice(0, 4);
    return undefined;
  }

  const queryCount = $derived(parseQueries(input).length);
</script>

<section class="space-y-5">
  <div class="space-y-1">
    <div class="flex items-baseline gap-2">
      <h1 class="text-xl font-semibold">Bulk search</h1>
      <a href="{base}/search/" class="text-xs text-muted hover:text-primary">← single search</a>
    </div>
    <p class="text-xs text-muted">
      Paste a list of titles — one per line or comma-separated. We'll fetch the top {PER_QUERY_LIMIT} TMDB matches for
      each so you can add several in one pass. Up to {MAX_QUERIES} titles per run.
    </p>
  </div>

  <div class="space-y-2">
    <textarea
      bind:value={input}
      placeholder={"Severance\n- Breaking Bad\n1. Dune (2021)"}
      rows="5"
      class="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-primary"
    ></textarea>
    <p class="text-[11px] text-muted">
      Markdown bullets (- * +), numbered lists (1.), task checkboxes ([ ]) and quotes (&gt;) are stripped automatically.
    </p>
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={run}
        disabled={running || queryCount === 0 || !store.apiKey}
        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? "Searching..." : `Search ${queryCount || ""} ${queryCount === 1 ? "title" : "titles"}`.trim()}
      </button>
      {#if input.trim()}
        <button
          type="button"
          onclick={clearAll}
          class="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-text"
        >
          Clear
        </button>
      {/if}
      {#if !store.apiKey}
        <span class="text-xs text-danger">Set your TMDB API key in settings first.</span>
      {/if}
    </div>
  </div>

  {#if groups.length > 0}
    <div class="space-y-6 pb-12">
      {#each groups as g (g.query)}
        {#if g.results === null}
          <div class="space-y-2">
            <h2 class="text-sm font-medium">
              {g.query} <span class="text-xs text-muted">— searching...</span>
            </h2>
          </div>
        {:else if g.error}
          <div class="space-y-2">
            <h2 class="text-sm font-medium">
              {g.query} <span class="text-xs text-danger">— {g.error}</span>
            </h2>
          </div>
        {:else if g.results.length === 0}
          <div class="space-y-2">
            <h2 class="text-sm font-medium">
              {g.query} <span class="text-xs text-muted">— no matches</span>
            </h2>
          </div>
        {:else}
          <Rail title={g.query} subtitle={`top ${g.results.length}`}>
            {#each g.results as r (r.media_type + ":" + r.id)}
              {@const existing = store.get(r.media_type, r.id)}
              {@const k = `${r.media_type}:${r.id}`}
              {@const c = existing ? STATUS_COLOR[existing.status] : null}
              <div class="flex h-full w-[132px] flex-col gap-2 sm:w-[148px]">
                <PosterCard
                  kind={r.media_type}
                  id={r.id}
                  title={titleOf(r)}
                  poster={posterUrl(r.poster_path, "w342")}
                  year={yearOf(r)}
                  status={existing?.status}
                  width="auto"
                />
                <div class="mt-auto">
                  {#if existing && c}
                    <span
                      class="flex items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium {c.chip}"
                    >
                      <span class="h-1.5 w-1.5 rounded-full {c.dot}" aria-hidden="true"></span>
                      <span class="truncate">{STATUS_LABEL[existing.status]}</span>
                    </span>
                  {:else}
                    <StatusMenu
                      label="+ Add"
                      size="sm"
                      variant="primary"
                      class="w-full"
                      busy={busyKey === k}
                      onSelect={(s) => handleAdd(r, s)}
                      title={`Add "${titleOf(r)}" as...`}
                    />
                  {/if}
                </div>
              </div>
            {/each}
          </Rail>
        {/if}
      {/each}
    </div>
  {/if}
</section>
