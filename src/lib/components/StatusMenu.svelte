<script lang="ts">
  import { vibrate } from "$lib/haptics";
  import { STATUS_COLOR, STATUS_DESCRIPTION, STATUS_LABEL } from "$lib/types";
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

  // Order: plan → watching → dropped → completed
  // (future intent first, completed last so the heaviest commitment lives at the bottom).
  const ADD_ORDER: Status[] = ["plan", "watching", "dropped", "completed"];

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
    vibrate("tap");
    dialog?.showModal();
  }

  function close(): void {
    dialog?.close();
  }

  async function pick(s: Status): Promise<void> {
    vibrate("success");
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
  class="m-auto w-[min(22rem,92vw)] max-w-[92vw] overflow-hidden rounded-lg border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
>
  <div class="w-full p-5">
    <h2 class="mb-5 text-sm font-medium uppercase tracking-wider text-muted">{title}</h2>
    <div class="flex flex-col gap-3">
      {#each ADD_ORDER as s (s)}
        {@const c = STATUS_COLOR[s]}
        <button
          type="button"
          onclick={() => pick(s)}
          class="group flex w-full items-center gap-3 overflow-hidden rounded-lg border border-border bg-surface-2 px-4 py-4 text-left transition {c.hoverBorder}"
        >
          <span class="h-3 w-3 shrink-0 rounded-full {c.dot}" aria-hidden="true"></span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold {c.text}">{STATUS_LABEL[s]}</span>
            <span class="mt-0.5 block truncate text-xs text-muted">{STATUS_DESCRIPTION[s]}</span>
          </span>
        </button>
      {/each}
    </div>
    <button
      type="button"
      onclick={close}
      class="mt-5 w-full rounded-md px-4 py-2 text-xs text-muted hover:text-text"
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
