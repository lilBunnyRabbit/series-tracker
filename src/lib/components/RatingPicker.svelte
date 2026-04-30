<script lang="ts">
  import { vibrate } from "$lib/haptics";

  type Props = { value: number | null; onChange: (v: number | null) => void; label?: string };
  let { value, onChange, label = "Your rating" }: Props = $props();

  const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  function pick(v: number): void {
    if (value === v) {
      vibrate("warn");
      onChange(null);
    } else {
      vibrate("tap");
      onChange(v);
    }
  }
</script>

<div class="flex flex-wrap items-center gap-1.5 text-xs">
  <span class="mr-1 text-muted">{label}</span>
  {#each VALUES as v (v)}
    {@const active = value != null && v <= value}
    <button
      type="button"
      onclick={() => pick(v)}
      aria-label="Rate {v}"
      aria-pressed={value === v}
      class="h-8 w-8 rounded-md border tabular-nums transition {active
        ? 'border-accent bg-accent text-bg'
        : 'border-border text-muted hover:border-accent'}"
    >
      {v}
    </button>
  {/each}
  {#if value != null}
    <button
      type="button"
      onclick={() => onChange(null)}
      class="ml-1 rounded-md px-2 py-1 text-[11px] text-muted hover:text-danger"
    >
      Clear
    </button>
  {/if}
</div>
