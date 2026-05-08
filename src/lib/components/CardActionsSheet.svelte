<script lang="ts">
  import { vibrate } from "$lib/haptics";
  import { portal } from "$lib/portal";
  import { store } from "$lib/store.svelte";
  import { swipeToDismiss, tactile } from "$lib/tactile";
  import { effectiveSeasons, STATUS_COLOR, STATUS_LABEL, STATUSES } from "$lib/types";
  import type { Entry, Status } from "$lib/types";

  type Props = { entry: Entry; open: boolean; onClose: () => void };
  let { entry, open, onClose }: Props = $props();

  let dialog = $state<HTMLDialogElement>();

  // The dialog is mounted on demand (see `{#if open}` below) so library pages
  // with hundreds of cards don't carry hundreds of hidden <dialog> siblings.
  // When `open` flips true we mount + portal + showModal in one tick; on close
  // the parent flips it false, which unmounts the element entirely.
  $effect(() => {
    if (!dialog || dialog.open) return;
    dialog.showModal();
  });

  // TV "next episode" hint — same logic as info page so the sheet button label
  // matches what would happen on tap. Walks only the seasons that count
  // (specials excluded by default) to mirror incrementCurrent behavior.
  const nextEp = $derived.by<{ season: number; episode: number; total: number } | null>(() => {
    if (entry.kind !== "tv") return null;
    for (const s of effectiveSeasons(entry)) {
      const cur = entry.progress[s.number] ?? 0;
      if (cur < s.episodeCount) return { season: s.number, episode: cur + 1, total: s.episodeCount };
    }
    return null;
  });

  function close(): void {
    onClose();
  }

  function onBackdropClick(e: MouseEvent): void {
    if (e.target === dialog) close();
  }

  function changeStatus(s: Status): void {
    if (s === entry.status) {
      close();
      return;
    }
    vibrate("success");
    store.setStatus(entry.kind, entry.id, s);
    close();
  }

  function bumpNext(): void {
    if (entry.kind !== "tv") return;
    const ok = store.incrementCurrent(entry.id);
    if (ok) vibrate("success");
    close();
  }

  function remove(): void {
    if (!confirm(`Remove "${entry.title}" from your library?`)) return;
    vibrate("warn");
    store.removeFromLibrary(entry.kind, entry.id);
    close();
  }
</script>

{#if open}
<dialog
  bind:this={dialog}
  use:portal
  onclick={onBackdropClick}
  onclose={close}
  class="actions-sheet w-[min(22rem,92vw)] max-w-[92vw] overflow-hidden border-border bg-surface p-0 text-text shadow-2xl"
>
  <div
    class="actions-sheet-drag sm:hidden"
    use:swipeToDismiss={{ target: dialog, onDismiss: close }}
    aria-hidden="true"
  >
    <span class="actions-sheet-handle"></span>
  </div>
  <div class="w-full p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:pb-5">
    <header class="mb-4 min-w-0">
      <p class="text-xs uppercase tracking-wider text-muted">Quick actions</p>
      <h2 class="mt-0.5 truncate text-base font-semibold">{entry.title}</h2>
    </header>

    {#if nextEp}
      <button
        type="button"
        use:tactile={{ haptic: "success" }}
        onclick={bumpNext}
        class="tap-target tap-target--card mb-3 flex w-full items-center gap-3 rounded-lg border border-primary bg-primary/10 px-4 py-3 text-left"
      >
        <span class="text-base text-primary" aria-hidden="true">+</span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-primary">Mark S{nextEp.season} E{nextEp.episode} watched</span>
          <span class="text-xs text-muted">Next unwatched in this show</span>
        </span>
      </button>
    {/if}

    <p class="mb-2 text-xs uppercase tracking-wider text-muted">Status</p>
    <div class="grid grid-cols-2 gap-2">
      {#each STATUSES as s, i (s)}
        {@const c = STATUS_COLOR[s]}
        {@const active = entry.status === s}
        {@const wide = i === STATUSES.length - 1 && STATUSES.length % 2 === 1}
        <button
          type="button"
          use:tactile
          onclick={() => changeStatus(s)}
          class="tap-target tap-target--btn flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors duration-150 {wide
            ? 'col-span-2 justify-center'
            : ''} {active ? `${c.border} ${c.bg} text-bg` : `border-border ${c.text}`}"
        >
          <span class="h-2 w-2 rounded-full {active ? 'bg-bg' : c.dot}" aria-hidden="true"></span>
          {STATUS_LABEL[s]}
        </button>
      {/each}
    </div>

    <hr class="my-4 border-border" />

    <button
      type="button"
      use:tactile={{ haptic: "warn" }}
      onclick={remove}
      class="tap-target tap-target--btn w-full rounded-md border border-error/40 px-4 py-2.5 text-sm font-medium text-error transition-colors duration-150 active:bg-error/10"
    >
      Remove from library
    </button>

    <button
      type="button"
      use:tactile={{ haptic: false }}
      onclick={close}
      class="tap-target tap-target--btn mt-3 w-full rounded-md px-4 py-2.5 text-xs text-muted hover-text-text"
    >
      Cancel
    </button>
  </div>
</dialog>
{/if}

<style>
  .actions-sheet {
    margin: auto;
    border-radius: 1rem 1rem 0 0;
    border: 1px solid var(--color-border);
  }
  .actions-sheet[open] {
    animation: sheet-in 280ms var(--ease-spring);
  }
  .actions-sheet::backdrop {
    background: var(--color-backdrop);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }
  .actions-sheet[open]::backdrop {
    animation: backdrop-in 200ms ease-out;
  }

  @media (max-width: 639.98px) {
    .actions-sheet {
      margin: 0;
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

  @media (min-width: 640px) {
    .actions-sheet {
      border-radius: 0.75rem;
    }
    .actions-sheet[open] {
      animation: pop-in 180ms var(--ease-out);
    }
  }

  .actions-sheet-drag {
    padding: 0.625rem 0 0.5rem;
    display: block;
    touch-action: none;
    cursor: grab;
  }
  .actions-sheet-drag:active {
    cursor: grabbing;
  }
  .actions-sheet-handle {
    display: block;
    margin: 0 auto;
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 9999px;
    background: var(--color-border);
  }

  @media (prefers-reduced-motion: reduce) {
    .actions-sheet[open],
    .actions-sheet[open]::backdrop {
      animation: none;
    }
  }
</style>
