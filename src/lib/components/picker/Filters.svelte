<script lang="ts">
  // Shared filter chips for picker modes. Owns no state of its own — reads
  // from and writes to `pickerPrefs` so selections persist across mode hops
  // and across reloads. Modes that don't need a particular axis (e.g. ranking
  // mode might lock kind to "all") can hide axes via `show*` props.
  import { tactile } from "$lib/tactile";
  import { store } from "$lib/store.svelte";
  import { hasAired, passesKind, passesProgress } from "$lib/picker";
  import { pickerPrefs, persistFilters } from "$lib/pickerPrefs.svelte";
  import { hasProgress, STATUSES, STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { Status } from "$lib/types";

  type Props = {
    showStatus?: boolean;
    showKind?: boolean;
    showProgress?: boolean;
  };
  let {
    showStatus = true,
    showKind = true,
    showProgress = true,
  }: Props = $props();

  function toggleStatus(s: Status): void {
    const next = pickerPrefs.selectedStatuses.includes(s)
      ? pickerPrefs.selectedStatuses.filter((x) => x !== s)
      : [...pickerPrefs.selectedStatuses, s];
    pickerPrefs.selectedStatuses = next;
    persistFilters();
  }

  function setKind(k: "all" | "tv" | "movie"): void {
    pickerPrefs.kindFilter = k;
    persistFilters();
  }

  // Tap the active chip to clear back to "any"; tap the other to switch.
  function setProgress(p: "started" | "untouched"): void {
    pickerPrefs.progressFilter = pickerPrefs.progressFilter === p ? "any" : p;
    persistFilters();
  }

  // Status counts narrow by kind + progress so the per-status numbers always
  // reflect what would land in the pool if that status were toggled on.
  const counts = $derived.by(() => {
    const c: Record<Status, number> = {
      watching: 0, completed: 0, plan: 0, dropped: 0, tuned: 0,
    };
    for (const e of store.entries) {
      if (!passesKind(e, pickerPrefs.kindFilter)) continue;
      if (!passesProgress(e, pickerPrefs.progressFilter)) continue;
      if (!hasAired(e)) continue;
      c[e.status]++;
    }
    return c;
  });

  // Progress chip counts narrow by status + kind selection so toggling a chip
  // produces the number shown next to it.
  const progressCounts = $derived.by(() => {
    let started = 0;
    let untouched = 0;
    for (const e of store.entries) {
      if (
        pickerPrefs.selectedStatuses.length > 0 &&
        !pickerPrefs.selectedStatuses.includes(e.status)
      ) continue;
      if (!passesKind(e, pickerPrefs.kindFilter)) continue;
      if (!hasAired(e)) continue;
      if (hasProgress(e)) started++;
      else untouched++;
    }
    return { started, untouched };
  });
</script>

<div class="space-y-4">
  {#if showStatus}
    <div class="space-y-2">
      <h2 class="text-xs font-medium uppercase tracking-wider text-muted">Status</h2>
      <div class="flex flex-wrap gap-1.5 text-xs">
        {#each STATUSES as s (s)}
          {@const active = pickerPrefs.selectedStatuses.includes(s)}
          {@const c = STATUS_COLOR[s]}
          <button
            type="button"
            use:tactile
            onclick={() => toggleStatus(s)}
            aria-pressed={active}
            class="tap-target tap-target--chip flex max-w-56 grow items-center justify-between gap-3 rounded-md border px-3 py-1.5 transition-colors duration-150 {active
              ? `${c.border} ${c.bg} text-bg`
              : 'border-border text-muted hover-text-text'}"
          >
            <span class="flex min-w-0 items-center gap-1.5">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full {active ? 'bg-bg' : c.dot}"></span>
              <span class="truncate">{STATUS_LABEL[s]}</span>
            </span>
            <span class="shrink-0 tabular-nums {active ? 'opacity-80' : 'opacity-60'}">{counts[s]}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if showKind}
    <div class="space-y-2">
      <h2 class="text-xs font-medium uppercase tracking-wider text-muted">Type</h2>
      <div class="flex flex-wrap gap-1.5 text-xs">
        {#each [["all", "All"], ["tv", "TV"], ["movie", "Movies"]] as const as [k, label] (k)}
          <button
            type="button"
            use:tactile
            onclick={() => setKind(k)}
            aria-pressed={pickerPrefs.kindFilter === k}
            class="tap-target tap-target--chip max-w-56 grow rounded-md border px-3 py-1.5 text-center transition-colors duration-150 {pickerPrefs.kindFilter === k
              ? 'border-secondary bg-secondary text-bg'
              : 'border-border text-muted hover-text-text'}"
          >
            {label}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if showProgress}
    <!-- Progress axis: paired Started / Untouched chips, mutually exclusive,
         both off = "any" (default). -->
    <div class="space-y-2">
      <h2 class="text-xs font-medium uppercase tracking-wider text-muted">Progress</h2>
      <div class="flex flex-wrap gap-1.5 text-xs">
        {#each [["started", "Started", progressCounts.started], ["untouched", "Untouched", progressCounts.untouched]] as const as [p, label, count] (p)}
          {@const active = pickerPrefs.progressFilter === p}
          <button
            type="button"
            use:tactile
            onclick={() => setProgress(p)}
            aria-pressed={active}
            class="tap-target tap-target--chip flex max-w-56 grow items-center justify-between gap-3 rounded-md border px-3 py-1.5 transition-colors duration-150 {active
              ? 'border-secondary bg-secondary text-bg'
              : 'border-border text-muted hover-text-text'}"
          >
            <span class="truncate">{label}</span>
            <span class="shrink-0 tabular-nums {active ? 'opacity-80' : 'opacity-60'}">{count}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
