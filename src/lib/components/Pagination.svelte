<script lang="ts">
  type Props = {
    current: number;
    total: number;
    onGoTo: (page: number) => void;
    /** Numbers to show on each side of the current page. Default 1 → "1 ... 5 6 7 ... 10". */
    siblings?: number;
  };

  let { current, total, onGoTo, siblings = 1 }: Props = $props();

  type Item = number | "left-ellipsis" | "right-ellipsis";

  // 5 fixed slots: first, last, current, two ellipsis. Plus 2*siblings around current.
  // If total fits in those slots without dots, render every page.
  const pages = $derived.by<Item[]>(() => {
    if (total <= 1) return [];
    const totalSlots = 5 + siblings * 2;
    if (total <= totalSlots) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const left = Math.max(current - siblings, 1);
    const right = Math.min(current + siblings, total);
    const showLeftDots = left > 2;
    const showRightDots = right < total - 1;

    if (!showLeftDots && showRightDots) {
      const count = 3 + siblings * 2;
      return [...Array.from({ length: count }, (_, i) => i + 1), "right-ellipsis", total];
    }
    if (showLeftDots && !showRightDots) {
      const count = 3 + siblings * 2;
      const start = total - count + 1;
      return [1, "left-ellipsis", ...Array.from({ length: count }, (_, i) => start + i)];
    }
    const middle = Array.from({ length: right - left + 1 }, (_, i) => left + i);
    return [1, "left-ellipsis", ...middle, "right-ellipsis", total];
  });

  function jump(delta: number): void {
    const target = current + delta;
    if (target < 1 || target > total) return;
    onGoTo(target);
  }
</script>

<nav class="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
  <button
    type="button"
    onclick={() => jump(-1)}
    disabled={current <= 1}
    aria-label="Previous page"
    class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
  >
    ←
  </button>

  {#each pages as item, i (i + ":" + item)}
    {#if typeof item === "number"}
      {@const active = item === current}
      <button
        type="button"
        onclick={() => onGoTo(item)}
        aria-current={active ? "page" : undefined}
        aria-label={`Page ${item}`}
        class="min-w-9 rounded-md border px-2.5 py-1.5 text-sm tabular-nums transition {active
          ? 'border-primary bg-primary text-bg'
          : 'border-border hover:border-primary'}"
      >
        {item}
      </button>
    {:else}
      <span aria-hidden="true" class="px-1 text-sm text-muted">…</span>
    {/if}
  {/each}

  <button
    type="button"
    onclick={() => jump(1)}
    disabled={current >= total}
    aria-label="Next page"
    class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
  >
    →
  </button>
</nav>
