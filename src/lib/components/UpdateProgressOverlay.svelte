<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { tactile } from "$lib/tactile";
  import type { UpdateStage } from "$lib/version.svelte";
  import { applyUpdate, isUpdateAvailable, version } from "$lib/version.svelte";

  let dialogEl: HTMLDialogElement | null = $state(null);

  // Visible step list. Order matters — the indicator state per step is derived
  // from the position of `version.stage` in this list.
  const STEPS: { id: Exclude<UpdateStage, "idle">; label: string; sub: string }[] = [
    { id: "installing", label: "Installing new version", sub: "Swapping in fresh app code" },
    { id: "clearing", label: "Clearing local cache", sub: "Wiping the old service worker" },
    { id: "reloading", label: "Restarting", sub: "Reloading the page" },
  ];
  const STAGE_ORDER: UpdateStage[] = ["idle", "installing", "clearing", "reloading"];

  const updating = $derived(version.stage !== "idle");
  const open = $derived(updating || isUpdateAvailable());
  const currentIdx = $derived(STAGE_ORDER.indexOf(version.stage));
  const newVersion = $derived(version.latest?.version ?? null);
  const currentVersion = $derived(version.current.version);

  function statusFor(id: UpdateStage): "done" | "active" | "pending" {
    const idx = STAGE_ORDER.indexOf(id);
    if (idx < currentIdx) return "done";
    if (idx === currentIdx) return "active";
    return "pending";
  }

  // showModal puts the dialog in the top layer so the rest of the app is
  // automatically inert and unfocusable — that's what makes it a true
  // non-dismissable overlay rather than a styled fixed div.
  $effect(() => {
    const el = dialogEl;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  });

  // Esc would normally close a <dialog>; cancelling the event keeps it open.
  // Combined with no close button anywhere in the body, the overlay is
  // genuinely non-dismissable.
  function blockCancel(e: Event): void {
    e.preventDefault();
  }
</script>

<dialog
  bind:this={dialogEl}
  class="update-dialog"
  oncancel={blockCancel}
  aria-labelledby="update-overlay-title"
  aria-describedby="update-overlay-desc"
>
  <div class="card">
    {#if updating}
      <div class="header">
        <h2 id="update-overlay-title">Updating Series Tracker</h2>
        {#if version.fromVersion && version.toVersion && version.fromVersion !== version.toVersion}
          <p class="versions" id="update-overlay-desc">
            <span class="from">v{version.fromVersion}</span>
            <span class="arrow" aria-hidden="true">
              <Icon name="arrow-right" size={14} />
            </span>
            <span class="to">v{version.toVersion}</span>
          </p>
        {:else if version.toVersion}
          <p class="versions" id="update-overlay-desc">
            <span class="to">v{version.toVersion}</span>
          </p>
        {/if}
      </div>

      <ul class="steps">
        {#each STEPS as step (step.id)}
          {@const status = statusFor(step.id)}
          <li class="step step--{status}">
            <span class="indicator" aria-hidden="true">
              {#if status === "done"}
                <Icon name="check" size={14} />
              {:else if status === "active"}
                <span class="spinner"></span>
              {:else}
                <span class="dot"></span>
              {/if}
            </span>
            <span class="text">
              <span class="label">{step.label}</span>
              <span class="sub">{step.sub}</span>
            </span>
          </li>
        {/each}
      </ul>

      <p class="footer-note">Don't close this tab — it'll only take a moment.</p>
    {:else}
      <div class="header">
        <h2 id="update-overlay-title">Update available</h2>
        {#if newVersion && newVersion !== currentVersion}
          <p class="versions" id="update-overlay-desc">
            <span class="from">v{currentVersion}</span>
            <span class="arrow" aria-hidden="true">
              <Icon name="arrow-right" size={14} />
            </span>
            <span class="to">v{newVersion}</span>
          </p>
        {:else if newVersion}
          <p class="versions" id="update-overlay-desc">
            <span class="to">v{newVersion}</span>
          </p>
        {/if}
      </div>

      <p class="ready-note">A new version of Series Tracker is ready to install.</p>

      <button
        type="button"
        use:tactile={{ haptic: "tap" }}
        onclick={() => void applyUpdate()}
        class="tap-target tap-target--btn update-btn"
      >
        Update now
      </button>
    {/if}
  </div>
</dialog>

<style>
  .update-dialog {
    border: none;
    background: transparent;
    padding: 0;
    margin: auto;
    max-width: 100%;
    max-height: 100%;
    color: var(--color-text);
  }
  .update-dialog::backdrop {
    background: var(--color-backdrop);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .update-dialog[open] {
    animation: card-in 280ms var(--ease-spring);
  }
  .update-dialog[open]::backdrop {
    animation: backdrop-in 200ms ease-out;
  }

  .card {
    width: min(28rem, calc(100vw - 2rem));
    padding: 1.5rem 1.25rem 1.25rem;
    border-radius: 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow:
      0 24px 48px -12px rgb(var(--shadow-color) / var(--shadow-alpha-2)),
      0 4px 12px -4px rgb(var(--shadow-color) / var(--shadow-alpha-3));
  }

  .header {
    text-align: center;
    margin-bottom: 1.25rem;
  }
  .header h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.625rem;
    letter-spacing: -0.01em;
  }

  .versions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    font-size: 1.125rem;
    font-weight: 500;
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .from {
    color: var(--color-muted);
    text-decoration: line-through;
    text-decoration-color: color-mix(in oklab, var(--color-muted) 60%, transparent);
  }
  .arrow {
    display: inline-flex;
    color: var(--color-muted);
  }
  .to {
    color: var(--color-primary);
  }

  .steps {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--color-surface-2);
    transition:
      background var(--dur-base) var(--ease-out),
      color var(--dur-base) var(--ease-out);
  }
  .step--active {
    background: color-mix(in oklab, var(--color-primary) 14%, var(--color-surface-2));
  }

  .indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 9999px;
    flex-shrink: 0;
    transition:
      background var(--dur-base) var(--ease-out),
      color var(--dur-base) var(--ease-out);
  }
  .step--pending .indicator {
    color: var(--color-muted);
  }
  .step--pending .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
    background: var(--color-border);
  }
  .step--active .indicator {
    color: var(--color-primary);
  }
  .step--active .spinner {
    width: 1rem;
    height: 1rem;
    border-radius: 9999px;
    border: 2px solid color-mix(in oklab, var(--color-primary) 28%, transparent);
    border-top-color: var(--color-primary);
    animation: spin 800ms linear infinite;
  }
  .step--done .indicator {
    background: var(--color-primary);
    color: var(--color-bg);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }
  .label {
    font-size: 0.875rem;
    color: var(--color-muted);
    transition: color var(--dur-base) var(--ease-out);
  }
  .sub {
    font-size: 0.7rem;
    color: var(--color-muted);
    opacity: 0.75;
  }
  .step--active .label,
  .step--done .label {
    color: var(--color-text);
  }
  .step--active .label {
    font-weight: 500;
  }

  .footer-note {
    text-align: center;
    font-size: 0.75rem;
    color: var(--color-muted);
    margin: 0;
  }

  .ready-note {
    text-align: center;
    font-size: 0.875rem;
    color: var(--color-muted);
    margin: 0 0 1.25rem;
  }

  .update-btn {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    background: var(--color-primary);
    color: var(--color-bg);
    font-size: 0.9375rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes backdrop-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes card-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .update-dialog[open],
    .update-dialog[open]::backdrop,
    .step--active .spinner {
      animation: none;
    }
  }
</style>
