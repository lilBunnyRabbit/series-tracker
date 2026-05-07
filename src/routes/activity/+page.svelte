<script lang="ts">
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { STATUS_LABEL } from "$lib/types";
  import type { ActionEntry, ActionType } from "$lib/types";

  const actions = $derived(store.actions);

  type DayBucket = { key: string; label: string; items: ActionEntry[] };

  // Day-key from a UTC ISO timestamp using the *local* date so "today" lines
  // up with the user's clock. `toLocaleDateString("en-CA")` returns YYYY-MM-DD,
  // which is sortable and trivial to bucket on.
  function dayKey(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString("en-CA");
  }

  function todayKey(): string {
    return new Date().toLocaleDateString("en-CA");
  }

  function yesterdayKey(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("en-CA");
  }

  function dayLabel(key: string): string {
    if (key === todayKey()) return "Today";
    if (key === yesterdayKey()) return "Yesterday";
    const d = new Date(`${key}T00:00:00`);
    if (Number.isNaN(d.getTime())) return key;
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    });
  }

  const buckets = $derived.by<DayBucket[]>(() => {
    const out = new Map<string, DayBucket>();
    for (const a of actions) {
      const key = dayKey(a.createdAt);
      let bucket = out.get(key);
      if (!bucket) {
        bucket = { key, label: dayLabel(key), items: [] };
        out.set(key, bucket);
      }
      bucket.items.push(a);
    }
    return [...out.values()];
  });

  function relativeTime(iso: string): string {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    const diffMs = Date.now() - t;
    const sec = Math.round(diffMs / 1000);
    if (sec < 45) return "just now";
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function entryHref(a: ActionEntry): string {
    return a.kind === "tv" ? `${base}/show/${a.refId}/info/` : `${base}/movie/${a.refId}/info/`;
  }

  // Tick `now` once a minute so the 24-hour undo window expires gracefully
  // for a tab left open overnight, instead of pinning at the page-load value.
  let now = $state(Date.now());
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(t);
  });

  const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;
  function isUndoable(a: ActionEntry): boolean {
    if (a.undoneAt) return false;
    if (now - new Date(a.createdAt).getTime() > UNDO_WINDOW_MS) return false;
    return a.type === "add" || a.prev !== undefined;
  }

  function handleUndo(a: ActionEntry): void {
    store.undoAction(a.id);
  }

  // The action's `prev` is the snapshot *before* the mutation. To describe
  // what changed we sometimes look at the live entry (e.g. the new status),
  // falling back to "—" when the entry has been removed since.
  type IconBucket = "additions" | "removals" | "metadata";
  const iconBucket: Record<ActionType, IconBucket> = {
    add: "additions",
    remove: "removals",
    status: "metadata",
    rating: "metadata",
    notes: "metadata",
    rewatchable: "metadata",
    specials: "metadata",
    progress: "additions",
    "season-complete": "additions",
    "season-reset": "removals",
    "episode-toggle": "additions",
    "season-rating": "metadata",
    "movie-progress": "additions",
  };

  // Tailwind class fragments per bucket. Literal strings so the content
  // scanner picks them up. Soft tinted background + matching foreground.
  const iconClasses: Record<IconBucket, string> = {
    additions: "bg-primary/15 text-primary",
    removals: "bg-muted/15 text-muted",
    metadata: "bg-accent/15 text-accent",
  };

  const iconName = {
    add: "plus",
    remove: "trash",
    status: "tag",
    rating: "star",
    notes: "pencil",
    rewatchable: "repeat",
    specials: "sparkles",
    progress: "play",
    "season-complete": "check",
    "season-reset": "rotate-ccw",
    "episode-toggle": "check",
    "season-rating": "star",
    "movie-progress": "play",
  } as const satisfies Record<ActionType, string>;

  // The verb is always the part *before* the title. The page renders
  // `{verb} <title>{suffix}` so the title can be a link when the entry still
  // exists. Suffix carries trailing details (e.g. "→ Completed", "S2 E5").
  function verbFor(a: ActionEntry): { verb: string; suffix: string } {
    const live = store.get(a.kind, a.refId);
    switch (a.type) {
      case "add":
        return { verb: "Added", suffix: "" };
      case "remove":
        return { verb: "Removed", suffix: "" };
      case "status": {
        const next = live?.status ?? a.prev?.status;
        const label = next ? STATUS_LABEL[next] : "";
        return { verb: "Status:", suffix: label ? ` → ${label}` : "" };
      }
      case "rating": {
        const v = live?.rating;
        return { verb: "Rated", suffix: typeof v === "number" ? ` ${v}/10` : " (cleared)" };
      }
      case "notes":
        return { verb: "Edited notes on", suffix: "" };
      case "rewatchable": {
        const on = !!live?.rewatchable;
        return { verb: on ? "Marked rewatchable:" : "Cleared rewatchable:", suffix: "" };
      }
      case "specials": {
        const on = live && live.kind === "tv" && live.includeSpecials;
        return { verb: on ? "Tracking specials on" : "Hiding specials on", suffix: "" };
      }
      case "progress": {
        const s = a.meta?.season;
        const ep = a.meta?.episode;
        const tail = s !== undefined && ep !== undefined ? ` · S${s} E${ep}` : "";
        return { verb: "Progress:", suffix: tail };
      }
      case "season-complete": {
        const s = a.meta?.season;
        return { verb: "Completed", suffix: s !== undefined ? ` S${s} of` : "" };
      }
      case "season-reset": {
        const s = a.meta?.season;
        return { verb: "Reset", suffix: s !== undefined ? ` S${s} of` : "" };
      }
      case "episode-toggle": {
        const s = a.meta?.season;
        const ep = a.meta?.episode;
        const tail = s !== undefined && ep !== undefined ? ` · S${s} E${ep}` : "";
        return { verb: "Toggled episode:", suffix: tail };
      }
      case "season-rating": {
        const s = a.meta?.season;
        const ratingsSrc = live && live.kind === "tv" ? live.seasonRatings : undefined;
        const v = s !== undefined ? ratingsSrc?.[s] : undefined;
        const head = `Rated${s !== undefined ? ` S${s} of` : ""}`;
        const tail = typeof v === "number" ? ` ${v}/10` : "";
        return { verb: head, suffix: tail };
      }
      case "movie-progress": {
        const m = a.meta?.minutes;
        if (m === 0) return { verb: "Reset progress on", suffix: "" };
        // Pull runtime off the live entry (or the snapshot) so we can show
        // "45m of 155m" instead of a bare "45m" when context is available.
        const rt =
          live?.kind === "movie"
            ? live.runtime
            : a.prev?.kind === "movie"
              ? a.prev.runtime
              : undefined;
        const tail = typeof m === "number" ? ` · ${m}m${rt ? ` of ${rt}m` : ""}` : "";
        return { verb: "Progress:", suffix: tail };
      }
    }
  }
</script>

<PageHeader title="Activity" subtitle="Recent changes to your library" />

<section class="space-y-5">
  {#if !store.loaded}
    <p class="text-xs text-muted">Loading…</p>
  {:else if actions.length === 0}
    <div class="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
      <p class="mb-2">No activity yet.</p>
      <p class="text-xs text-muted/70">
        Adds, status changes, progress and ratings will show up here.
      </p>
    </div>
  {:else}
    {#each buckets as bucket (bucket.key)}
      <div class="space-y-2">
        <h2 class="text-sm font-medium uppercase tracking-wider text-muted">
          {bucket.label}
          <span class="ml-1 font-normal normal-case text-muted/70">
            · {bucket.items.length} change{bucket.items.length === 1 ? "" : "s"}
          </span>
        </h2>
        <ul class="space-y-1.5">
          {#each bucket.items as a (a.id)}
            {@const live = store.get(a.kind, a.refId)}
            {@const v = verbFor(a)}
            {@const bucketKey = iconBucket[a.type]}
            {@const undoable = isUndoable(a)}
            <li class="rounded-lg border border-border bg-surface p-2.5 {a.undoneAt ? 'opacity-60' : ''}">
              <div class="flex items-start gap-3">
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {iconClasses[bucketKey]}"
                  aria-hidden="true"
                >
                  <Icon name={iconName[a.type]} size={16} />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm leading-snug">
                    <span class="text-muted">{v.verb}</span>
                    {#if live}
                      <a
                        href={entryHref(a)}
                        use:tactile={{ haptic: false }}
                        class="font-medium hover:text-accent"
                      >
                        {a.title}
                      </a>
                    {:else}
                      <span class="font-medium text-muted line-through">{a.title}</span>
                    {/if}
                    {#if v.suffix}<span class="text-muted">{v.suffix}</span>{/if}
                  </p>
                  <p class="mt-0.5 text-[11px] tabular-nums text-muted/70">
                    {relativeTime(a.createdAt)}{#if a.undoneAt}<span class="ml-1.5 uppercase tracking-wider">· undone</span>{/if}
                  </p>
                </div>
                {#if undoable}
                  <button
                    type="button"
                    use:tactile={{ haptic: "warn" }}
                    onclick={() => handleUndo(a)}
                    aria-label="Undo {v.verb} {a.title}"
                    class="tap-target tap-target--btn shrink-0 rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted hover-border-accent hover-text-text"
                  >
                    Undo
                  </button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  {/if}
</section>
