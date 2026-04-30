<script lang="ts">
  import { vibrate } from "$lib/haptics";
  import { STATUSES, STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { Status } from "$lib/types";

  type Props = { value: Status; onChange: (s: Status) => void };
  let { value, onChange }: Props = $props();

  function pick(s: Status): void {
    if (s === value) return;
    vibrate("tap");
    onChange(s);
  }
</script>

<div role="radiogroup" aria-label="Status" class="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
  {#each STATUSES as s (s)}
    {@const c = STATUS_COLOR[s]}
    {@const active = value === s}
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onclick={() => pick(s)}
      class="flex items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-sm font-medium transition {active
        ? `${c.border} ${c.bg} text-bg`
        : `border-border ${c.text} ${c.hoverBorder}`}"
    >
      <span class="h-2 w-2 rounded-full {active ? 'bg-bg' : c.dot}" aria-hidden="true"></span>
      {STATUS_LABEL[s]}
    </button>
  {/each}
</div>
