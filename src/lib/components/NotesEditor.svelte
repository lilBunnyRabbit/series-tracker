<script lang="ts">
  type Props = {
    value: string;
    onCommit: (v: string) => void;
    placeholder?: string;
    label?: string;
  };
  let { value, onCommit, placeholder = "e.g. xyz suggested it", label = "Notes" }: Props = $props();

  let draft = $state("");
  let dirty = $derived(draft !== value);

  // Sync draft to canonical value whenever it changes externally (mount, import).
  $effect(() => {
    draft = value;
  });

  function save(): void {
    if (!dirty) return;
    onCommit(draft);
  }
</script>

<div class="space-y-1.5">
  <div class="flex items-center justify-between text-xs">
    <span class="uppercase tracking-wider text-muted">{label}</span>
    {#if dirty}
      <button type="button" onclick={save} class="text-[11px] text-accent hover:text-text">Save</button>
    {/if}
  </div>
  <textarea
    bind:value={draft}
    onblur={save}
    rows="2"
    {placeholder}
    class="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
  ></textarea>
</div>
