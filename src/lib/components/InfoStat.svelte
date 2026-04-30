<script lang="ts">
  type Props = { label: string; value: string };
  let { label, value }: Props = $props();
</script>

<div class="rounded-md border border-border bg-surface px-3 py-2">
  <div class="text-[10px] uppercase tracking-wider text-muted">{label}</div>
  <div class="mt-0.5 truncate text-sm font-medium">{value}</div>
</div>
