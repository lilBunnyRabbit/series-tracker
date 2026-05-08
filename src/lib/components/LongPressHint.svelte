<script lang="ts">
  import { tactile } from "$lib/tactile";
  import { fly } from "svelte/transition";

  type Props = {
    open: boolean;
    onDismiss: () => void;
    /** Auto-dismiss after this many ms. Pass 0 to disable. Default 9000. */
    autoDismissMs?: number;
  };

  let { open, onDismiss, autoDismissMs = 9000 }: Props = $props();

  // Auto-dismiss timer. Re-arms each time `open` flips back to true (so a user
  // who somehow re-triggers the hint mid-session gets a fresh window).
  $effect(() => {
    if (!open || autoDismissMs <= 0) return;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  });
</script>

{#if open}
  <div
    class="long-press-hint"
    role="status"
    aria-live="polite"
    in:fly={{ y: 64, duration: 260 }}
    out:fly={{ y: 64, duration: 200 }}
  >
    <div class="long-press-hint-pill">
      <span class="long-press-hint-accent" aria-hidden="true"></span>
      <span class="long-press-hint-text">
        <strong class="block text-sm leading-snug">Tip — long-press a card</strong>
        <span class="block text-[11px] leading-snug text-muted">
          Open quick actions without leaving this page.
        </span>
      </span>
      <button
        type="button"
        use:tactile
        onclick={onDismiss}
        class="tap-target tap-target--btn shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-bg"
      >
        Got it
      </button>
    </div>
  </div>
{/if}

<style>
  .long-press-hint {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 41;
    display: flex;
    justify-content: center;
    padding: 0 0.75rem;
    /* Float above the floating island AND any page-actions rail attached to
       it. On the watchlist (and other pages that register actions), the rail
       sits ~0.5rem + 1.75rem from the bottom and is ~3.5rem tall — its top
       edge is around 92px from the viewport bottom. 7.5rem of bottom padding
       keeps the toast clearly above it; pages without a rail just get a bit
       more clearance over the island, which still looks fine. */
    padding-bottom: calc(max(env(safe-area-inset-bottom, 0px), 0.5rem) + 7.5rem);
    pointer-events: none;
  }
  @media (min-width: 640px) {
    /* Desktop has no floating island, so the hint sits directly at the
       viewport edge with normal padding. */
    .long-press-hint {
      padding-bottom: 1rem;
    }
  }
  .long-press-hint-pill {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    max-width: 26rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.875rem;
    background: rgba(26, 31, 38, 0.9);
    background: color-mix(in oklab, var(--color-bg) 92%, transparent);
    border: 1px solid var(--color-border);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    box-shadow:
      0 12px 32px -8px rgb(0 0 0 / 0.55),
      0 6px 14px -4px rgb(0 0 0 / 0.4);
  }
  /* Slim left accent in primary so the toast reads as in-app chrome rather
     than a generic notification. */
  .long-press-hint-accent {
    flex-shrink: 0;
    width: 3px;
    align-self: stretch;
    border-radius: 9999px;
    background: var(--color-primary);
  }
  .long-press-hint-text {
    flex: 1;
    min-width: 0;
  }
</style>
