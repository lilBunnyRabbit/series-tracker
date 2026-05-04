<script lang="ts">
  import { vibrate } from "$lib/haptics";
  import { tactile } from "$lib/tactile";
  import { STATUS_COLOR } from "$lib/types";
  import type { Status } from "$lib/types";

  type Props = {
    value: number | null;
    onChange: (v: number | null) => void;
    label?: string;
    /** Optional status — when set, the picker tints to that status's color
        family instead of the default accent (yellow). */
    status?: Status;
  };
  let { value, onChange, label = "Your rating", status }: Props = $props();

  const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const c = $derived(status ? STATUS_COLOR[status] : null);
  const valueClass = $derived(c ? c.text : "text-accent");
  const activeClass = $derived(c ? `${c.bg} text-bg` : "bg-accent text-bg");

  function pick(v: number): void {
    if (value === v) {
      vibrate("warn");
      onChange(null);
    } else {
      onChange(v);
    }
  }
</script>

<div class="space-y-1.5">
  <div class="flex items-baseline justify-between gap-2 text-xs">
    <span class="text-muted">{label}</span>
    <span class="tabular-nums text-text">
      {#if value != null}
        <span class="font-semibold {valueClass}">{value}</span><span class="text-muted">/10</span>
      {:else}
        <span class="text-muted">—/10</span>
      {/if}
      {#if value != null}
        <button
          type="button"
          onclick={() => onChange(null)}
          aria-label="Clear rating"
          class="ml-2 text-muted hover:text-error"
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
        use:tactile={{ haptic: value === v ? "warn" : "tap" }}
        onclick={() => pick(v)}
        aria-label="Rate {v}"
        aria-pressed={value === v}
        class="tap-target tap-target--chip flex-1 border-r border-border py-2.5 text-xs tabular-nums transition-colors duration-150 last:border-r-0 {active
          ? activeClass
          : 'text-muted hover-text-text'}"
      >
        {v}
      </button>
    {/each}
  </div>
</div>
