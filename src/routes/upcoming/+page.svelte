<script lang="ts">
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import { buildIcs, downloadIcs, type IcsEvent } from "$lib/ics";
  import {
    getLatestSeasonNumber,
    getUpcomingEpisodes,
    warmUpForWatching,
  } from "$lib/newEpisodes.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import type { EpisodeBrief, TvEntry } from "$lib/types";

  type UpcomingItem = {
    entry: TvEntry;
    season: number;
    episode: EpisodeBrief;
    daysOut: number;
  };

  type Bucket = { label: string; items: UpcomingItem[] };

  const watchingEntries = $derived.by<TvEntry[]>(() =>
    store.entries.filter((e): e is TvEntry => e.kind === "tv" && e.status === "watching")
  );

  let warming = $state(false);

  $effect(() => {
    if (!store.apiKey) return;
    const apiKey = store.apiKey;
    const entries = watchingEntries;
    if (entries.length === 0) return;
    warming = true;
    void warmUpForWatching(entries, apiKey).finally(() => {
      warming = false;
    });
  });

  function startOfDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
  }

  function daysBetween(iso: string): number {
    const today = startOfDay(new Date());
    const air = startOfDay(new Date(iso));
    return Math.round((air.getTime() - today.getTime()) / 86_400_000);
  }

  const buckets = $derived.by<Bucket[]>(() => {
    const all: UpcomingItem[] = [];
    for (const e of watchingEntries) {
      const ups = getUpcomingEpisodes(e.id);
      const season = getLatestSeasonNumber(e.id);
      if (!ups || season === undefined) continue;
      for (const ep of ups) {
        if (!ep.air_date) continue;
        all.push({ entry: e, season, episode: ep, daysOut: daysBetween(ep.air_date) });
      }
    }
    all.sort((a, b) => a.daysOut - b.daysOut);

    const thisWeek: UpcomingItem[] = [];
    const nextWeek: UpcomingItem[] = [];
    const later: UpcomingItem[] = [];
    for (const it of all) {
      if (it.daysOut <= 7) thisWeek.push(it);
      else if (it.daysOut <= 14) nextWeek.push(it);
      else later.push(it);
    }
    return [
      { label: "This week", items: thisWeek },
      { label: "Next week", items: nextWeek },
      { label: "Later", items: later },
    ].filter((b) => b.items.length > 0);
  });

  const hasAnyData = $derived(buckets.some((b) => b.items.length > 0));

  function airLabel(daysOut: number, iso: string): string {
    if (daysOut === 0) return "Today";
    if (daysOut === 1) return "Tomorrow";
    if (daysOut < 0) return iso; // shouldn't happen — these are upcoming only
    if (daysOut <= 7) {
      const date = new Date(iso);
      return date.toLocaleDateString(undefined, { weekday: "long" });
    }
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function exportCalendar(): void {
    const items: UpcomingItem[] = buckets.flatMap((b) => b.items);
    if (items.length === 0) return;
    const events: IcsEvent[] = items
      .filter((it) => it.episode.air_date)
      .map((it) => {
        const ep = it.episode;
        const epLabel = `S${it.season}E${ep.episode_number}`;
        const summary = ep.name ? `${it.entry.title} ${epLabel} — ${ep.name}` : `${it.entry.title} ${epLabel}`;
        const url = `${location.origin}${base}/show/${it.entry.id}/`;
        return {
          uid: `series-tracker-${it.entry.id}-${it.season}-${ep.episode_number}@${location.host || "local"}`,
          date: ep.air_date!,
          summary,
          description: ep.overview || undefined,
          url,
        };
      });
    if (events.length === 0) return;
    const ics = buildIcs(events);
    downloadIcs(`series-tracker-upcoming-${new Date().toISOString().slice(0, 10)}.ics`, ics);
  }
</script>

<svelte:head>
  <title>Upcoming · Series Tracker</title>
</svelte:head>

{#snippet titleActions()}
  {#if hasAnyData}
    <button
      type="button"
      use:tactile
      onclick={exportCalendar}
      class="tap-target tap-target--icon flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover-border-accent hover-text-text"
      aria-label="Export upcoming episodes as iCal calendar"
      title="Download .ics file for your calendar app"
    >
      <Icon name="download" size={16} />
    </button>
  {/if}
{/snippet}

<PageHeader title="Upcoming" {titleActions} />

<section class="space-y-5">
  {#if watchingEntries.length === 0}
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-muted">
      <p class="mb-4">No shows currently in your watching list.</p>
      <a
        href="{base}/discover/"
        class="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
      >
        Discover something new
      </a>
    </div>
  {:else if !hasAnyData && warming}
    <Skeleton variant="results" count={4} />
  {:else if !hasAnyData}
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-muted">
      <p>No upcoming episodes for the shows you're watching.</p>
      <p class="mt-2 text-xs">Either everything's aired, or TMDB doesn't have schedule data yet.</p>
    </div>
  {:else}
    {#each buckets as bucket (bucket.label)}
      <div class="space-y-2.5">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">
          {bucket.label}
          <span class="ml-1 font-normal normal-case text-muted/70">
            · {bucket.items.length} episode{bucket.items.length === 1 ? "" : "s"}
          </span>
        </h2>
        <div class="space-y-1.5">
          {#each bucket.items as item (item.entry.id + ":" + item.season + ":" + item.episode.id)}
            <a
              href="{base}/show/{item.entry.id}/"
              use:tactile
              class="tap-target tap-target--card flex items-stretch gap-3 rounded-lg border border-border bg-surface p-2 hover-border-accent"
            >
              <div class="h-20 w-14 flex-shrink-0 overflow-hidden rounded bg-surface-2">
                {#if item.entry.poster}
                  <img src={item.entry.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
                {/if}
              </div>
              <div class="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium">{item.entry.title}</div>
                  <div class="mt-0.5 text-[11px] text-muted">
                    S{item.season} · E{item.episode.episode_number}
                    {#if item.episode.name}
                      <span class="text-text/80"> — {item.episode.name}</span>
                    {/if}
                  </div>
                </div>
                {#if item.episode.overview}
                  <div class="mt-1 line-clamp-1 text-[11px] text-muted">{item.episode.overview}</div>
                {/if}
              </div>
              <div class="flex flex-shrink-0 flex-col items-end justify-center pr-1 text-right">
                <span class="text-xs font-medium text-accent">
                  {airLabel(item.daysOut, item.episode.air_date ?? "")}
                </span>
                <span class="mt-0.5 text-[10px] tabular-nums text-muted">
                  {item.daysOut === 0 ? "today" : `in ${item.daysOut}d`}
                </span>
              </div>
            </a>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</section>
