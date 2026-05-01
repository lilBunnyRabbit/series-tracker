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

<div class="space-y-1.5">
  <div class="flex items-baseline justify-between gap-2 text-xs">
    <span class="text-muted">{label}</span>
    <span class="tabular-nums text-text">
      {#if value != null}
        <span class="font-semibold text-accent">{value}</span><span class="text-muted">/10</span>
      {:else}
        <span class="text-muted">—/10</span>
      {/if}
      {#if value != null}
        <button
          type="button"
          onclick={() => onChange(null)}
          aria-label="Clear rating"
          class="ml-2 text-muted hover:text-danger"
        >
          ×
        </button>
      {/if}
    </span>
  </div>
  <!-- Segmented 1–10 row. Buttons share a single border so the picker stays
       on a single line on narrow phones; flex-1 distributes width evenly. -->
  <div class="flex items-stretch overflow-hidden rounded-md border border-border">
    {#each VALUES as v (v)}
      {@const active = value != null && v <= value}
      <button
        type="button"
        onclick={() => pick(v)}
        aria-label="Rate {v}"
        aria-pressed={value === v}
        class="flex-1 border-r border-border py-2 text-xs tabular-nums transition last:border-r-0 {active
          ? 'bg-accent text-bg'
          : 'text-muted hover:text-text'}"
      >
        {v}
      </button>
    {/each}
  </div>
</div>
