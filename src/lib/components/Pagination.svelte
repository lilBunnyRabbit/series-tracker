<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { tactile } from "$lib/tactile";

  type Props = {
    current: number;
    total: number;
    onGoTo: (page: number) => void;
    /** Kept for backwards-compat with older call sites; no longer affects
     *  rendering since the redesign dropped sibling page-number buttons. */
    siblings?: number;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let { current, total, onGoTo, siblings: _siblings = 1 }: Props = $props();

  function jump(delta: number): void {
    const target = current + delta;
    if (target < 1 || target > total) return;
    onGoTo(target);
  }

  // One-way binding via `value={current}`: the input shows the current page,
  // the user types freely (DOM owns the in-flight value), commit on blur /
  // Enter. Avoids the round-trip pain of two-way binding when the prop
  // changes mid-edit.
  function commit(e: Event): void {
    const el = e.currentTarget as HTMLInputElement;
    const n = Number(el.value);
    if (!Number.isFinite(n)) {
      el.value = String(current);
      return;
    }
    const target = Math.min(Math.max(Math.floor(n), 1), total);
    if (target === current) {
      el.value = String(current);
      return;
    }
    onGoTo(target);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).value = String(current);
      (e.currentTarget as HTMLInputElement).blur();
    }
  }
</script>

<!-- Single row, never wraps. The page numbers grid is gone — at 100+ pages it
     was either a tiny scroll strip on mobile or it spilled to a second line.
     Replaced with an inline number input so the user types the page they
     want; First / Last chevrons handle the edges in one tap. -->
<nav
  class="pagination flex items-center justify-center gap-1 text-sm"
  aria-label="Pagination"
>
  <button
    type="button"
    use:tactile
    onclick={() => onGoTo(1)}
    disabled={current <= 1}
    aria-label="First page"
    title="First page"
    class="tap-target tap-target--btn flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-base leading-none hover-border-primary disabled:cursor-not-allowed disabled:opacity-40"
  >
    «
  </button>
  <button
    type="button"
    use:tactile
    onclick={() => jump(-1)}
    disabled={current <= 1}
    aria-label="Previous page"
    class="tap-target tap-target--btn flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border hover-border-primary disabled:cursor-not-allowed disabled:opacity-40"
  >
    <Icon name="arrow-left" size={14} />
  </button>

  <!-- Editable page indicator. Acts as both "where am I" and "jump to". -->
  <div class="flex shrink-0 items-center gap-1 px-1">
    <input
      type="number"
      min="1"
      max={total}
      inputmode="numeric"
      value={current}
      onkeydown={onKey}
      onblur={commit}
      aria-label="Page number"
      class="w-14 rounded-md border border-strong bg-surface-2 px-1.5 py-2 text-center text-sm tabular-nums outline-none focus:border-primary"
    />
    <span class="whitespace-nowrap text-xs tabular-nums text-muted">
      / {total.toLocaleString()}
    </span>
  </div>

  <button
    type="button"
    use:tactile
    onclick={() => jump(1)}
    disabled={current >= total}
    aria-label="Next page"
    class="tap-target tap-target--btn flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border hover-border-primary disabled:cursor-not-allowed disabled:opacity-40"
  >
    <Icon name="arrow-right" size={14} />
  </button>
  <button
    type="button"
    use:tactile
    onclick={() => onGoTo(total)}
    disabled={current >= total}
    aria-label="Last page"
    title="Last page"
    class="tap-target tap-target--btn flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-base leading-none hover-border-primary disabled:cursor-not-allowed disabled:opacity-40"
  >
    »
  </button>
</nav>

<style>
  /* Hide the native number-input spinners — they crowd the cell and the user
     types or uses the prev/next buttons instead. */
  .pagination input[type="number"]::-webkit-outer-spin-button,
  .pagination input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .pagination input[type="number"] {
    appearance: textfield;
    -moz-appearance: textfield;
  }
</style>
