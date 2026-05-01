<script lang="ts">
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
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
    /** Extra classes appended to the trigger button (e.g. "w-full" inside grids). */
    class?: string;
    /** When true, ignore stored default-status preference and always show picker. */
    forcePicker?: boolean;
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
    class: extraClass = "",
    forcePicker = false,
  }: Props = $props();

  // Order: plan → watching → dropped → completed
  // (future intent first, completed last so the heaviest commitment lives at the bottom).
  const ADD_ORDER: Status[] = ["plan", "watching", "dropped", "completed"];

  let dialog = $state<HTMLDialogElement>();

  const triggerClass = $derived(
    [
      "tap-target tap-target--btn rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-50",
      size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
      variant === "primary" ? "bg-primary text-bg" : "border border-border",
      extraClass,
    ]
      .filter(Boolean)
      .join(" ")
  );

  function open(): void {
    if (disabled || busy) return;
    const preset = !forcePicker ? store.preferences.defaultAddStatus : null;
    if (preset) {
      void pick(preset);
      return;
    }
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

<button type="button" use:tactile onclick={open} {disabled} class={triggerClass}>
  {busy ? busyLabel : label}
</button>

<dialog
  bind:this={dialog}
  onclick={onBackdropClick}
  class="status-sheet m-auto w-[min(22rem,92vw)] max-w-[92vw] overflow-hidden border-border bg-surface p-0 text-text shadow-2xl"
>
  <div class="status-sheet-handle sm:hidden" aria-hidden="true"></div>
  <div class="w-full p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:pb-5">
    <h2 class="mb-5 text-sm font-medium uppercase tracking-wider text-muted">{title}</h2>
    <div class="flex flex-col gap-3">
      {#each ADD_ORDER as s (s)}
        {@const c = STATUS_COLOR[s]}
        <button
          type="button"
          use:tactile={{ haptic: "tap" }}
          onclick={() => pick(s)}
          class="tap-target tap-target--card group flex w-full items-center gap-3 overflow-hidden rounded-lg border border-border bg-surface-2 px-4 py-4 text-left {c.hoverBorder}"
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
      use:tactile={{ haptic: false }}
      onclick={close}
      class="tap-target tap-target--btn mt-5 w-full rounded-md px-4 py-2.5 text-xs text-muted hover-text-text"
    >
      Cancel
    </button>
  </div>
</dialog>

<style>
  /* Mobile: bottom sheet that slides up from the screen edge.
     Desktop (≥sm): centered modal with a soft pop-in. */
  .status-sheet {
    border-radius: 1rem 1rem 0 0;
    border: 1px solid var(--color-border);
  }
  .status-sheet[open] {
    animation: sheet-in 280ms var(--ease-spring);
  }
  .status-sheet::backdrop {
    background: rgb(0 0 0 / 0.6);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }
  .status-sheet[open]::backdrop {
    animation: backdrop-in 200ms ease-out;
  }

  /* Mobile: dock to the bottom of the viewport. */
  @media (max-width: 639.98px) {
    .status-sheet {
      margin: 0 0 0 0;
      max-width: 100%;
      width: 100%;
      max-height: 90vh;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: auto;
    }
  }

  /* Desktop: centered, rounded all corners, pop-in. */
  @media (min-width: 640px) {
    .status-sheet {
      border-radius: 0.75rem;
    }
    .status-sheet[open] {
      animation: pop-in 180ms var(--ease-out);
    }
  }

  /* Tiny grab handle on the mobile sheet. Aesthetic, not interactive. */
  .status-sheet-handle {
    margin: 0.5rem auto 0;
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 9999px;
    background: var(--color-border);
  }

  @media (prefers-reduced-motion: reduce) {
    .status-sheet[open],
    .status-sheet[open]::backdrop {
      animation: none;
    }
  }
</style>
