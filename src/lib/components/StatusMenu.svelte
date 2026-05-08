<script lang="ts">
  import { vibrate } from "$lib/haptics";
  import { portal } from "$lib/portal";
  import { store } from "$lib/store.svelte";
  import { swipeToDismiss, tactile } from "$lib/tactile";
  import { STATUS_COLOR, STATUS_DESCRIPTION, STATUS_LABEL } from "$lib/types";
  import type { Status } from "$lib/types";

  type Props = {
    label: string;
    busyLabel?: string;
    disabled?: boolean;
    busy?: boolean;
    onSelect: (status: Status) => void | Promise<void>;
    variant?: "primary" | "outline";
    size?: "sm" | "md" | "icon";
    title?: string;
    /** Extra classes appended to the trigger button (e.g. "w-full" inside grids). */
    class?: string;
    /** When true, ignore stored default-status preference and always show picker. */
    forcePicker?: boolean;
    /** Imperatively open the menu by incrementing this number. Use for gesture
     *  triggers (swipe-to-add) where the parent needs to programmatically open
     *  the picker without simulating a click on the trigger button. */
    openTrigger?: number;
    /** When true the trigger button is not rendered — the parent supplies its
     *  own trigger and uses `openTrigger` to open the picker. */
    hideTrigger?: boolean;
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
    openTrigger = 0,
    hideTrigger = false,
  }: Props = $props();

  // Open the picker imperatively when the parent bumps `openTrigger`. Skip the
  // first effect tick so an externally-stored counter doesn't auto-open.
  let lastTrigger = $state<number | null>(null);
  $effect(() => {
    if (lastTrigger === null) {
      lastTrigger = openTrigger;
      return;
    }
    if (openTrigger !== lastTrigger) {
      lastTrigger = openTrigger;
      open();
    }
  });

  // Order: plan → watching → tuned → dropped → completed
  // (future intent first, completed last so the heaviest commitment lives at the bottom;
  // tuned/dropped sit together as the low-engagement middle tier).
  const ADD_ORDER: Status[] = ["plan", "watching", "tuned", "dropped", "completed"];

  // The dialog is mounted on demand so closed pickers add nothing to the DOM —
  // discover/library pages can render hundreds of cards, and an always-rendered
  // <dialog> per card would clutter the tree (and previously, with use:portal,
  // bloat <body> with hidden siblings).
  let mounted = $state(false);
  let dialog = $state<HTMLDialogElement>();

  // Once the dialog mounts (and use:portal moves it under <body>), open it.
  // Snapshot scroll first because showModal()'s focus-on-mount can scroll the
  // page; restore once now and once next frame to catch the async focus jump.
  $effect(() => {
    if (!mounted || !dialog || dialog.open) return;
    const scrollY = window.scrollY;
    lockBodyScroll();
    dialog.showModal();
    if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior });
    requestAnimationFrame(() => {
      if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior });
    });
  });

  const triggerClass = $derived(
    [
      "tap-target tap-target--btn rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-50",
      size === "icon"
        ? "flex h-12 w-12 items-center justify-center text-lg"
        : size === "sm"
          ? "px-3 py-1.5 text-xs"
          : "px-4 py-2 text-sm",
      variant === "primary" ? "bg-primary text-bg" : "border border-border",
      extraClass,
    ]
      .filter(Boolean)
      .join(" ")
  );

  // Modal dialogs don't lock body scroll natively — page would still scroll
  // behind the sheet. We toggle `overflow: hidden` on the documentElement
  // around showModal/close. The scrollbar gutter is reserved at the html
  // level (see layout.css) so removing the scrollbar here doesn't reflow.
  function lockBodyScroll(): void {
    document.documentElement.style.overflow = "hidden";
  }
  function unlockBodyScroll(): void {
    document.documentElement.style.overflow = "";
  }

  function open(): void {
    if (disabled || busy) return;
    const preset = !forcePicker ? store.preferences.defaultAddStatus : null;
    if (preset) {
      void pick(preset);
      return;
    }
    mounted = true;
  }

  function close(): void {
    if (dialog?.open) dialog.close();
    else onDialogClose();
  }

  function onDialogClose(): void {
    unlockBodyScroll();
    mounted = false;
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

{#if !hideTrigger}
  <button type="button" use:tactile onclick={open} {disabled} class={triggerClass}>
    {busy ? busyLabel : label}
  </button>
{/if}

{#if mounted}
  <dialog
    bind:this={dialog}
    use:portal
    onclick={onBackdropClick}
    onclose={onDialogClose}
    class="status-sheet m-auto w-[min(22rem,92vw)] max-w-[92vw] overflow-hidden border-border bg-surface p-0 text-text shadow-2xl"
  >
    <div
      class="status-sheet-drag sm:hidden"
      use:swipeToDismiss={{ target: dialog, onDismiss: close }}
      aria-hidden="true"
    >
      <span class="status-sheet-handle"></span>
    </div>
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
{/if}

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
    background: var(--color-backdrop);
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

  /* Drag zone — generous touch target around the visual handle so the user
     can grab anywhere near the top of the sheet to start a swipe-down. */
  .status-sheet-drag {
    padding: 0.625rem 0 0.5rem;
    display: block;
    touch-action: none;
    cursor: grab;
  }
  .status-sheet-drag:active {
    cursor: grabbing;
  }

  /* Visual handle pill rendered inside the drag zone. */
  .status-sheet-handle {
    display: block;
    margin: 0 auto;
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
