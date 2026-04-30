<script lang="ts">
  import { STATUSES, STATUS_LABEL } from "$lib/types";
  import type { Status } from "$lib/types";

  type Props = {
    label: string;
    busyLabel?: string;
    disabled?: boolean;
    busy?: boolean;
    onSelect: (status: Status) => void | Promise<void>;
    variant?: "primary" | "outline";
    size?: "sm" | "md";
    title?: string;
  };

  let {
    label,
    busyLabel = "Adding...",
    disabled = false,
    busy = false,
    onSelect,
    variant = "primary",
    size = "md",
    title = "Add as...",
  }: Props = $props();

  let dialog = $state<HTMLDialogElement>();

  const triggerClass = $derived(
    [
      "rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-50",
      size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
      variant === "primary" ? "bg-primary text-bg" : "border border-border",
    ].join(" ")
  );

  function open(): void {
    if (disabled || busy) return;
    dialog?.showModal();
  }

  function close(): void {
    dialog?.close();
  }

  async function pick(s: Status): Promise<void> {
    close();
    await onSelect(s);
  }

  function onBackdropClick(e: MouseEvent): void {
    if (e.target === dialog) close();
  }
</script>

<button type="button" onclick={open} {disabled} class={triggerClass}>
  {busy ? busyLabel : label}
</button>

<dialog
  bind:this={dialog}
  onclick={onBackdropClick}
  onclose={() => {}}
  class="m-auto rounded-lg border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
>
  <div class="w-[min(20rem,90vw)] p-4">
    <h2 class="mb-3 text-sm font-medium uppercase tracking-wider text-muted">{title}</h2>
    <div class="space-y-1">
      {#each STATUSES as s (s)}
        <button
          type="button"
          onclick={() => pick(s)}
          class="w-full rounded-md border border-border bg-surface-2 px-4 py-2.5 text-left text-sm transition hover:border-primary hover:bg-primary hover:text-bg"
        >
          {STATUS_LABEL[s]}
        </button>
      {/each}
    </div>
    <button
      type="button"
      onclick={close}
      class="mt-3 w-full rounded-md px-4 py-2 text-xs text-muted hover:text-text"
    >
      Cancel
    </button>
  </div>
</dialog>

<style>
  dialog::backdrop {
    background: rgb(0 0 0 / 0.6);
  }
</style>
