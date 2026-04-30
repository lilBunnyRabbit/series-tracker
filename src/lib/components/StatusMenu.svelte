<script lang="ts">
  import { STATUS_LABEL } from "$lib/types";
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

  // Order optimized for "I'm logging something I've already engaged with":
  // most common first (just finished), then in-progress, then future, then abandoned.
  const ADD_ORDER: Status[] = ["completed", "watching", "plan", "dropped"];

  const STATUS_DESCRIPTION: Record<Status, string> = {
    completed: "Finished — already watched it",
    watching: "Currently watching",
    plan: "Plan to watch later",
    dropped: "Started but won't finish",
  };

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
  <div class="w-[min(22rem,92vw)] p-5">
    <h2 class="mb-5 text-sm font-medium uppercase tracking-wider text-muted">{title}</h2>
    <div class="flex flex-col gap-3">
      {#each ADD_ORDER as s (s)}
        <button
          type="button"
          onclick={() => pick(s)}
          class="group w-full rounded-lg border border-border bg-surface-2 px-4 py-4 text-left transition hover:border-primary hover:bg-primary hover:text-bg"
        >
          <div class="text-sm font-semibold">{STATUS_LABEL[s]}</div>
          <div class="mt-0.5 text-xs text-muted transition group-hover:text-bg/75">{STATUS_DESCRIPTION[s]}</div>
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
