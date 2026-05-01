<script lang="ts">
  import { applyUpdate, dismiss, isUpdateAvailable, version } from "$lib/version.svelte";

  let updating = $state(false);

  const show = $derived(isUpdateAvailable());
  const newVersion = $derived(version.latest?.version ?? null);

  async function onUpdate(): Promise<void> {
    if (updating) return;
    updating = true;
    try {
      await applyUpdate();
    } catch {
      // applyUpdate triggers a reload on success — if we're still here, it failed.
      updating = false;
    }
  }
</script>

{#if show}
  <div class="toast-wrap" role="status" aria-live="polite">
    <div class="toast">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium">New version available</p>
        {#if newVersion}
          <p class="text-xs text-muted">v{newVersion} is ready to install</p>
        {/if}
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onclick={dismiss}
          class="rounded-md px-2.5 py-1.5 text-xs text-muted hover:text-text"
        >
          Later
        </button>
        <button
          type="button"
          onclick={onUpdate}
          disabled={updating}
          class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-60"
        >
          {updating ? "Updating..." : "Update now"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .toast-wrap {
    position: fixed;
    left: 0;
    right: 0;
    /* Mobile: clear the floating nav (≈3.25rem pill + safe-area). */
    bottom: calc(env(safe-area-inset-bottom, 0px) + 4.5rem);
    z-index: 50;
    display: flex;
    justify-content: center;
    padding: 0 0.75rem;
    pointer-events: none;
    animation: toast-in 220ms ease-out;
  }

  @media (min-width: 640px) {
    .toast-wrap {
      /* Desktop: floating nav is hidden, so dock at bottom-right. */
      left: auto;
      right: 1rem;
      bottom: 1rem;
      justify-content: flex-end;
      padding: 0;
    }
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 28rem;
    padding: 0.75rem 0.75rem 0.75rem 1rem;
    border-radius: 0.75rem;
    background: color-mix(in oklab, var(--color-surface) 92%, transparent);
    border: 1px solid var(--color-border);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow:
      0 12px 32px -12px rgb(0 0 0 / 0.55),
      0 2px 6px -2px rgb(0 0 0 / 0.4);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast-wrap {
      animation: none;
    }
  }
</style>
