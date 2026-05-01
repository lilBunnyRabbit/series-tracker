<script lang="ts">
  import { page } from "$app/state";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import Rail from "$lib/components/Rail.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import { store } from "$lib/store.svelte";
  import { personCombinedCredits, personDetail, posterUrl } from "$lib/tmdb";
  import type { PersonCombinedCredits, PersonCredit, PersonDetail } from "$lib/types";

  const id = $derived(Number(page.params.id));

  let detail = $state<PersonDetail | null>(null);
  let credits = $state<PersonCombinedCredits | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let bioExpanded = $state(false);

  $effect(() => {
    if (!store.apiKey || !id || Number.isNaN(id)) return;
    loading = true;
    error = null;
    const ctrl = new AbortController();
    const apiKey = store.apiKey;
    Promise.all([
      personDetail(id, apiKey, ctrl.signal),
      personCombinedCredits(id, apiKey, ctrl.signal).catch(() => null),
    ])
      .then(([d, c]) => {
        if (ctrl.signal.aborted) return;
        detail = d;
        credits = c;
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

  // Cast credits ranked by popularity, deduped by id (TMDB occasionally lists
  // the same title twice when an actor crewed and acted on the same project).
  const acted = $derived.by<PersonCredit[]>(() => {
    if (!credits) return [];
    const seen = new Set<string>();
    const out: PersonCredit[] = [];
    const sorted = [...credits.cast].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    for (const c of sorted) {
      const k = `${c.media_type}:${c.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out;
  });

  // Group crew by job so directors / writers / producers each get their own rail.
  const crewByJob = $derived.by<{ job: string; items: PersonCredit[] }[]>(() => {
    if (!credits) return [];
    const groups = new Map<string, PersonCredit[]>();
    for (const c of credits.crew) {
      const job = c.job ?? "Other";
      if (!groups.has(job)) groups.set(job, []);
      groups.get(job)!.push(c);
    }
    const PRIORITY = ["Director", "Writer", "Screenplay", "Executive Producer", "Producer", "Creator"];
    const arr = Array.from(groups.entries())
      .map(([job, items]) => ({
        job,
        items: items
          .slice()
          .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
      }))
      .filter((g) => g.items.length > 0);
    arr.sort((a, b) => {
      const ai = PRIORITY.indexOf(a.job);
      const bi = PRIORITY.indexOf(b.job);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return b.items.length - a.items.length;
    });
    return arr;
  });

  function ageOrLifespan(d: PersonDetail): string | null {
    if (!d.birthday) return null;
    const birth = new Date(d.birthday);
    const end = d.deathday ? new Date(d.deathday) : new Date();
    if (Number.isNaN(birth.getTime()) || Number.isNaN(end.getTime())) return null;
    let years = end.getFullYear() - birth.getFullYear();
    const m = end.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) years--;
    return d.deathday ? `${years} years` : `${years} years old`;
  }

  function metaOf(c: PersonCredit): string | undefined {
    if (c.media_type === "tv" && c.episode_count) {
      return `${c.episode_count} ep`;
    }
    return undefined;
  }

  function yearOf(c: PersonCredit): string | undefined {
    if (c.media_type === "movie") return c.release_date?.slice(0, 4);
    return c.first_air_date?.slice(0, 4);
  }

  function titleOf(c: PersonCredit): string {
    return c.media_type === "movie" ? c.title : c.name;
  }
</script>

<svelte:head>
  <title>{detail ? `${detail.name} · Series Tracker` : "Person · Series Tracker"}</title>
</svelte:head>

{#if loading && !detail}
  <Skeleton variant="infoPage" />
{:else if error}
  <p class="rounded-md border border-danger bg-danger/15 p-3 text-sm text-danger">{error}</p>
{:else if detail}
  <div class="space-y-8">
    <!-- HERO -->
    <section class="flex flex-col items-center gap-4 pt-2 text-center">
      <div class="w-40 sm:w-48">
        <div class="aspect-[2/3] w-full overflow-hidden rounded-xl border border-border/60 bg-surface-2 shadow-2xl">
          {#if detail.profile_path}
            <img src={posterUrl(detail.profile_path, "w500")} alt="" class="h-full w-full object-cover" />
          {/if}
        </div>
      </div>

      <div class="max-w-prose space-y-1.5">
        <h1 class="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{detail.name}</h1>
        {#if detail.known_for_department}
          <p class="text-xs font-medium uppercase tracking-wider text-accent">{detail.known_for_department}</p>
        {/if}
        <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
          {#if detail.birthday}<span>Born {detail.birthday}</span>{/if}
          {#if detail.deathday}
            <span aria-hidden="true">·</span>
            <span>Died {detail.deathday}</span>
          {/if}
          {#if ageOrLifespan(detail)}
            <span aria-hidden="true">·</span>
            <span>{ageOrLifespan(detail)}</span>
          {/if}
          {#if detail.place_of_birth}
            <span aria-hidden="true">·</span>
            <span class="truncate">{detail.place_of_birth}</span>
          {/if}
        </div>
      </div>

      {#if detail.imdb_id}
        <a
          href="https://www.imdb.com/name/{detail.imdb_id}/"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-text"
        >
          <span class="font-bold">IMDb</span>
          <span class="text-[10px]">↗</span>
        </a>
      {/if}
    </section>

    <!-- BIOGRAPHY -->
    {#if detail.biography}
      <section class="space-y-2">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">Biography</h2>
        <div class="text-sm leading-relaxed text-text/90 sm:text-base">
          {#if bioExpanded || detail.biography.length < 600}
            {#each detail.biography.split(/\n+/) as p, i (i)}
              {#if p.trim()}<p class="mb-2">{p}</p>{/if}
            {/each}
          {:else}
            <p>{detail.biography.slice(0, 560).trim()}…</p>
          {/if}
        </div>
        {#if detail.biography.length >= 600}
          <button
            type="button"
            onclick={() => (bioExpanded = !bioExpanded)}
            class="text-xs text-accent hover:underline"
          >
            {bioExpanded ? "Show less" : "Read more"}
          </button>
        {/if}
      </section>
    {/if}

    <!-- KNOWN FOR -->
    {#if acted.length > 0}
      <Rail title="Known for" subtitle="{acted.length} title{acted.length === 1 ? '' : 's'}">
        {#each acted.slice(0, 30) as c (c.media_type + ":" + c.id)}
          <PosterCard
            kind={c.media_type}
            id={c.id}
            title={titleOf(c)}
            poster={posterUrl(c.poster_path, "w342")}
            year={yearOf(c)}
            meta={metaOf(c)}
            voteAverage={c.vote_average}
          />
        {/each}
      </Rail>
    {/if}

    <!-- CREW BY JOB -->
    {#each crewByJob as group (group.job)}
      {#if group.items.length > 0}
        <Rail title="As {group.job}" subtitle="{group.items.length} title{group.items.length === 1 ? '' : 's'}">
          {#each group.items.slice(0, 24) as c (c.media_type + ":" + c.id + ":" + group.job)}
            <PosterCard
              kind={c.media_type}
              id={c.id}
              title={titleOf(c)}
              poster={posterUrl(c.poster_path, "w342")}
              year={yearOf(c)}
              voteAverage={c.vote_average}
            />
          {/each}
        </Rail>
      {/if}
    {/each}

    {#if loading && !credits}
      <Skeleton variant="rail" count={6} />
    {/if}
  </div>
{/if}
