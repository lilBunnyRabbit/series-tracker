<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { STATUS_COLOR } from "$lib/types";
  import type { Entry } from "$lib/types";

  type KindFilter = "both" | "tv" | "movie";
  const VALID_KIND: KindFilter[] = ["both", "tv", "movie"];

  const kindFilter = $derived.by<KindFilter>(() => {
    const v = page.url.searchParams.get("kind");
    return VALID_KIND.includes(v as KindFilter) ? (v as KindFilter) : "both";
  });

  function setKind(k: KindFilter): void {
    const url = new URL(page.url);
    if (k === "both") url.searchParams.delete("kind");
    else url.searchParams.set("kind", k);
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // Stable rank order: rating desc, then user title fallback so ties stay
  // alphabetical instead of jittering on each derive.
  function rank(a: Entry, b: Entry): number {
    const ra = a.rating ?? 0;
    const rb = b.rating ?? 0;
    if (ra !== rb) return rb - ra;
    return a.title.localeCompare(b.title);
  }

  const ratedTv = $derived.by<Entry[]>(() =>
    store.entries
      .filter((e) => e.kind === "tv" && typeof e.rating === "number" && e.rating > 0)
      .sort(rank)
  );
  const ratedMovies = $derived.by<Entry[]>(() =>
    store.entries
      .filter((e) => e.kind === "movie" && typeof e.rating === "number" && e.rating > 0)
      .sort(rank)
  );

  const showTv = $derived(kindFilter !== "movie");
  const showMovies = $derived(kindFilter !== "tv");

  const totalRated = $derived(ratedTv.length + ratedMovies.length);
</script>

<PageHeader title="Leaderboard" subtitle="Your library, ranked by rating." />

<section class="space-y-6">
  {#if totalRated === 0}
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-muted">
      <p class="mb-4">Rate something in your library to start a leaderboard.</p>
      <a
        href="{base}/watchlist/"
        use:tactile={{ haptic: false }}
        class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm hover-border-primary"
      >
        Open watchlist
      </a>
    </div>
  {:else}
    <div class="flex gap-1.5 text-xs">
      {#each [["both", "Both"], ["tv", "TV"], ["movie", "Movies"]] as const as [k, label] (k)}
        <button
          type="button"
          use:tactile
          onclick={() => setKind(k)}
          aria-pressed={kindFilter === k}
          class="tap-target tap-target--chip rounded-full border px-3 py-1.5 transition-colors duration-150 {kindFilter === k
            ? 'border-secondary bg-secondary text-bg'
            : 'border-border text-muted hover-text-text'}"
        >
          {label}
        </button>
      {/each}
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      {#if showTv}
        {@render board("TV", ratedTv)}
      {/if}
      {#if showMovies}
        {@render board("Movies", ratedMovies)}
      {/if}
    </div>
  {/if}
</section>

{#snippet board(label: string, list: Entry[])}
  <div class="space-y-3">
    <h2 class="flex items-baseline justify-between text-sm font-medium uppercase tracking-wider text-muted">
      <span>{label}</span>
      <span class="text-[11px] tabular-nums text-muted">{list.length}</span>
    </h2>
    {#if list.length === 0}
      <p class="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted">
        Nothing rated in this category yet.
      </p>
    {:else}
      <ol class="space-y-1.5">
        {#each list as e, i (e.kind + ":" + e.id)}
          {@const sc = STATUS_COLOR[e.status]}
          {@const rankClass = i === 0
            ? "border-accent bg-accent text-bg"
            : i === 1
              ? "border-text/60 bg-text/15 text-text"
              : i === 2
                ? "border-muted bg-muted/20 text-muted"
                : "border-border bg-surface-2 text-muted"}
          <li>
            <a
              href={e.kind === "tv" ? `${base}/show/${e.id}/` : `${base}/movie/${e.id}/`}
              use:tactile
              class="tap-target tap-target--card flex items-center gap-3 rounded-md border border-border bg-surface p-2.5 hover-border-accent"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums {rankClass}"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div class="h-14 w-10 shrink-0 overflow-hidden rounded bg-surface-2">
                {#if e.poster}
                  <img src={e.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{e.title}</div>
                <div class="text-[10px] uppercase tracking-wider text-muted">
                  {e.kind === "tv" ? "TV" : "Movie"}{e.year ? ` · ${e.year}` : ""}
                </div>
              </div>
              <span class="shrink-0 rounded-md {sc.bgSoft} px-2.5 py-1 text-sm font-semibold tabular-nums {sc.text}">
                ♥ {e.rating}
              </span>
            </a>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
{/snippet}
