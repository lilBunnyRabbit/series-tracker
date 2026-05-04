<script lang="ts">
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { STATUS_COLOR } from "$lib/types";
  import type { DiaryEntry } from "$lib/types";

  type KindFilter = "all" | "tv" | "movie" | "rewatch";

  let filter = $state<KindFilter>("all");
  let backfillPrompt = $state(false);
  let backfillResult = $state<string | null>(null);
  let editing = $state<DiaryEntry | null>(null);

  $effect(() => {
    // Surface the backfill prompt once: the user has completed entries but no
    // diary, and hasn't been asked yet.
    if (!store.loaded) return;
    if (store.preferences.diaryBackfilled) return;
    if (store.diary.length > 0) return;
    const completed = store.entries.filter((e) => e.status === "completed").length;
    if (completed > 0) backfillPrompt = true;
  });

  const filtered = $derived.by<DiaryEntry[]>(() => {
    const all = [...store.diary].sort((a, b) =>
      (b.watchedAt + b.createdAt).localeCompare(a.watchedAt + a.createdAt)
    );
    if (filter === "all") return all;
    if (filter === "rewatch") return all.filter((d) => d.rewatch);
    return all.filter((d) => d.kind === filter);
  });

  type MonthBucket = { label: string; key: string; items: DiaryEntry[] };
  const buckets = $derived.by<MonthBucket[]>(() => {
    const out = new Map<string, MonthBucket>();
    for (const d of filtered) {
      const key = d.watchedAt.slice(0, 7); // YYYY-MM
      let bucket = out.get(key);
      if (!bucket) {
        const date = new Date(`${key}-01T00:00:00`);
        const label = Number.isNaN(date.getTime())
          ? key
          : date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
        bucket = { key, label, items: [] };
        out.set(key, bucket);
      }
      bucket.items.push(d);
    }
    return [...out.values()];
  });

  function totalCount(): number {
    return store.diary.length;
  }

  function rewatchCount(): number {
    return store.diary.filter((d) => d.rewatch).length;
  }

  function tvCount(): number {
    return store.diary.filter((d) => d.kind === "tv").length;
  }

  function movieCount(): number {
    return store.diary.filter((d) => d.kind === "movie").length;
  }

  function entryHref(d: DiaryEntry): string {
    return d.kind === "tv" ? `${base}/show/${d.refId}/info/` : `${base}/movie/${d.refId}/info/`;
  }

  function formatDay(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
  }

  function applyBackfill(): void {
    const added = store.backfillDiary();
    store.setPreference("diaryBackfilled", true);
    backfillResult = `Added ${added} ${added === 1 ? "entry" : "entries"} from your completed library.`;
    backfillPrompt = false;
    vibrate("success");
  }

  function dismissBackfill(): void {
    store.setPreference("diaryBackfilled", true);
    backfillPrompt = false;
  }

  function deleteEntry(d: DiaryEntry): void {
    if (!confirm(`Delete diary entry for "${d.title}" on ${d.watchedAt}?`)) return;
    vibrate("warn");
    store.removeDiary(d.id);
    if (editing?.id === d.id) editing = null;
  }

  function startEdit(d: DiaryEntry): void {
    editing = { ...d };
  }

  function saveEdit(): void {
    if (!editing) return;
    const { id, watchedAt, rating, note, rewatch, fromEp, toEp, season } = editing;
    store.updateDiary(id, {
      watchedAt,
      rating: typeof rating === "number" && rating > 0 ? rating : undefined,
      note: note?.trim() || undefined,
      rewatch: rewatch || undefined,
      season,
      fromEp,
      toEp,
    });
    editing = null;
    vibrate("success");
  }

  function cancelEdit(): void {
    editing = null;
  }
</script>

<PageHeader title="Diary" subtitle="Every viewing you've logged. Independent of progress." />

<section class="space-y-5">
  {#if backfillPrompt}
    <div class="rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm">
      <div class="mb-2 flex items-center gap-2 font-medium">
        <Icon name="sparkles" size={14} />
        <span>Seed your diary?</span>
      </div>
      <p class="text-xs text-muted">
        You have completed entries in your library but no diary yet. We can synthesize one diary entry per
        completed title, dated to when you last updated it. Skip if you'd rather start fresh.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          use:tactile={{ haptic: "success" }}
          onclick={applyBackfill}
          class="tap-target tap-target--btn rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-bg"
        >
          Yes, seed it
        </button>
        <button
          type="button"
          use:tactile={{ haptic: false }}
          onclick={dismissBackfill}
          class="tap-target tap-target--btn rounded-md border border-border px-4 py-1.5 text-xs text-muted hover-text-text"
        >
          No thanks
        </button>
      </div>
    </div>
  {/if}

  {#if backfillResult}
    <p class="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs text-primary">{backfillResult}</p>
  {/if}

  {#if totalCount() === 0 && !backfillPrompt}
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
      <p class="mb-2">Your diary is empty.</p>
      <p class="text-xs text-muted/70">
        Tap the 📓 button on a show or movie page to log a viewing.
      </p>
    </div>
  {:else if totalCount() > 0}
    <!-- Filter chips -->
    <div class="-mx-1 flex flex-wrap gap-1.5 px-1 text-xs">
      {#each [["all", "All", totalCount()], ["tv", "TV", tvCount()], ["movie", "Movies", movieCount()], ["rewatch", "Rewatches", rewatchCount()]] as const as [k, label, count] (k)}
        <button
          type="button"
          use:tactile
          onclick={() => (filter = k)}
          aria-pressed={filter === k}
          class="tap-target tap-target--chip flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors duration-150 {filter === k
            ? 'border-primary bg-primary text-bg'
            : 'border-border text-muted hover-text-text'}"
        >
          <span>{label}</span>
          <span class="tabular-nums {filter === k ? 'opacity-80' : 'opacity-60'}">{count}</span>
        </button>
      {/each}
    </div>

    {#if filtered.length === 0}
      <p class="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted">
        No diary entries match this filter.
      </p>
    {:else}
      {#each buckets as bucket (bucket.key)}
        <div class="space-y-2">
          <h2 class="text-sm font-medium uppercase tracking-wider text-muted">
            {bucket.label}
            <span class="ml-1 font-normal normal-case text-muted/70">
              · {bucket.items.length} entr{bucket.items.length === 1 ? "y" : "ies"}
            </span>
          </h2>
          <div class="space-y-1.5">
            {#each bucket.items as d (d.id)}
              <article id="entry-{d.id}" class="rounded-lg border border-border bg-surface p-2.5">
                <div class="flex items-start gap-3">
                  <a
                    href={entryHref(d)}
                    use:tactile={{ haptic: false }}
                    class="tap-target tap-target--card h-20 w-14 shrink-0 overflow-hidden rounded bg-surface-2"
                    aria-label="Open {d.title}"
                  >
                    {#if d.poster}
                      <img src={d.poster} alt="" class="h-full w-full object-cover" loading="lazy" />
                    {/if}
                  </a>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <a
                        href={entryHref(d)}
                        use:tactile={{ haptic: false }}
                        class="tap-target min-w-0 truncate text-sm font-medium hover:text-accent"
                      >
                        {d.title}
                      </a>
                      {#if d.rewatch}
                        <span class="rounded-full border border-accent/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-accent">Rewatch</span>
                      {/if}
                    </div>
                    <div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                      <span class="tabular-nums">{formatDay(d.watchedAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span class="uppercase tracking-wider">{d.kind}</span>
                      {#if d.kind === "tv" && d.season !== undefined && d.fromEp !== undefined && d.toEp !== undefined}
                        <span aria-hidden="true">·</span>
                        <span class="tabular-nums">
                          S{d.season} · E{d.fromEp}{d.toEp !== d.fromEp ? `–E${d.toEp}` : ""}
                        </span>
                      {/if}
                      {#if typeof d.rating === "number" && d.rating > 0}
                        {@const dEntry = store.get(d.kind, d.refId)}
                        {@const dSc = dEntry ? STATUS_COLOR[dEntry.status] : null}
                        <span aria-hidden="true">·</span>
                        <span class="rounded-md px-1.5 py-0.5 font-semibold tabular-nums {dSc ? `${dSc.bgSoft} ${dSc.text}` : 'bg-accent/15 text-accent'}">♥ {d.rating}</span>
                      {/if}
                    </div>
                    {#if d.note && editing?.id !== d.id}
                      <p class="mt-1.5 whitespace-pre-wrap text-xs text-text/90">{d.note}</p>
                    {/if}

                    {#if editing?.id === d.id}
                      <div class="mt-2 space-y-2 rounded-md border border-border bg-surface-2 p-2">
                        <input
                          type="date"
                          bind:value={editing.watchedAt}
                          class="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
                        />
                        <textarea
                          bind:value={editing.note}
                          rows="2"
                          maxlength="1000"
                          placeholder="Note…"
                          class="w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
                        ></textarea>
                        <div class="flex items-center gap-2 text-xs">
                          <label class="flex items-center gap-1.5 text-muted">
                            Rating
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="1"
                              value={editing.rating ?? ""}
                              oninput={(e) => {
                                if (!editing) return;
                                const v = Number((e.currentTarget as HTMLInputElement).value);
                                editing.rating = Number.isNaN(v) || v <= 0 ? undefined : Math.min(10, v);
                              }}
                              class="w-14 rounded-md border border-border bg-surface px-2 py-1 tabular-nums outline-none focus:border-accent"
                            />
                          </label>
                          <label class="flex items-center gap-1.5 text-muted">
                            <input
                              type="checkbox"
                              bind:checked={editing.rewatch}
                              class="accent-primary"
                            />
                            Rewatch
                          </label>
                          <div class="ml-auto flex gap-1">
                            <button
                              type="button"
                              use:tactile={{ haptic: false }}
                              onclick={cancelEdit}
                              class="tap-target tap-target--btn rounded-md border border-border px-2 py-1 text-[11px] text-muted"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              use:tactile={{ haptic: "success" }}
                              onclick={saveEdit}
                              class="tap-target tap-target--btn rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-bg"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>

                  {#if editing?.id !== d.id}
                    <div class="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        use:tactile
                        onclick={() => startEdit(d)}
                        aria-label="Edit entry"
                        class="tap-target tap-target--icon flex h-7 w-7 items-center justify-center rounded-md border border-border text-[11px] text-muted hover-border-accent"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        use:tactile={{ haptic: "warn" }}
                        onclick={() => deleteEntry(d)}
                        aria-label="Delete entry"
                        class="tap-target tap-target--icon flex h-7 w-7 items-center justify-center rounded-md border border-border text-[11px] text-muted hover:border-error hover:text-error"
                      >
                        ×
                      </button>
                    </div>
                  {/if}
                </div>
              </article>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  {/if}
</section>
