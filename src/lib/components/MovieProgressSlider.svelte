<script lang="ts">
  import { vibrate } from "$lib/haptics";

  type Props = {
    /** Persisted value from the store. Component holds its own working copy
     *  during a drag so the store sees one write per gesture. */
    value: number;
    /** Movie runtime in minutes — the upper bound for the scrubber. */
    max: number;
    /** Disables drag (used when the entry is already completed). */
    disabled?: boolean;
    /** Fired once on pointerup at the end of a drag. */
    onCommit: (minutes: number) => void;
  };
  let { value, max, disabled = false, onCommit }: Props = $props();

  // 14 px per minute — comfortable density: thin minor ticks read distinctly,
  // major ticks every 5 min anchor the eye, and the strip is wide enough that
  // a fingertip drag covers a meaningful range without going off-screen.
  const PX_PER_MIN = 14;

  // svelte-ignore state_referenced_locally
  let local = $state(value);
  // Sub-minute float used for the strip transform during drag so the ticks
  // glide smoothly with the finger instead of stepping in 20-px increments.
  // svelte-ignore state_referenced_locally
  let floatValue = $state<number>(value);
  let dragging = $state(false);
  let stripEl = $state<HTMLDivElement | null>(null);
  let startX = 0;
  let startValue = 0;

  // Mirror prop changes onto the local working copy when we're not in the
  // middle of a gesture. Otherwise the user's scrub would fight a stale prop.
  $effect(() => {
    if (!dragging) {
      local = value;
      floatValue = value;
    }
  });

  function clamp(v: number): number {
    return Math.max(0, Math.min(max, Math.round(v)));
  }

  function onPointerDown(e: PointerEvent): void {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (stripEl) stripEl.setPointerCapture(e.pointerId);
    dragging = true;
    startX = e.clientX;
    startValue = local;
    floatValue = local;
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    // Drag right → ticks slide right under the fixed indicator → progress
    // decreases (you've scrubbed back). Hence the inversion.
    const dx = e.clientX - startX;
    const target = startValue - dx / PX_PER_MIN;
    // Clamp at sub-minute precision so the strip stops at the bounds (no
    // overscroll past 0 or runtime).
    floatValue = Math.max(0, Math.min(max, target));
    const next = Math.round(floatValue);
    if (next === local) return;
    local = next;
    // Haptic on every minute crossing — the iOS exposure-slider ratchet feel.
    vibrate("tick");
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    if (stripEl) stripEl.releasePointerCapture(e.pointerId);
    // The transition on the strip animates the (≤0.5-minute) snap from the
    // drag-end float position back to the integer minute.
    floatValue = local;
    if (local !== value) onCommit(local);
  }

  const pct = $derived(max > 0 ? Math.round((local / max) * 100) : 0);
  const tickIndices = $derived(Array.from({ length: max + 1 }, (_, i) => i));
</script>

<div class="space-y-3">
  <div class="flex items-baseline justify-center gap-2.5 tabular-nums">
    <span class="text-2xl font-semibold {disabled ? 'text-muted' : 'text-text'}">{local}</span>
    <span class="text-sm text-muted">/ {max}m</span>
    <span class="text-muted">·</span>
    <span class="text-sm text-muted">{pct}%</span>
  </div>

  <div
    bind:this={stripEl}
    role="slider"
    tabindex={disabled ? -1 : 0}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={local}
    aria-valuetext="{local} minutes of {max}"
    aria-label="Movie progress"
    aria-disabled={disabled}
    class="movie-progress-slider relative h-24 w-full touch-none select-none overflow-hidden {disabled ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    <div
      class="strip absolute inset-y-0 left-1/2 flex items-center"
      style="transform: translate3d({-((dragging ? floatValue : local) * PX_PER_MIN + PX_PER_MIN / 2)}px, 0, 0); transition: {dragging ? 'none' : 'transform 140ms ease-out'};"
    >
      {#each tickIndices as i (i)}
        {@const isMajor = i % 5 === 0}
        {@const isHalfHour = i % 30 === 0 && i > 0}
        {@const center = dragging ? floatValue : local}
        {@const dist = Math.abs(i - center)}
        {@const prox = Math.max(0, 1 - dist / 2.5)}
        {@const bounce = 1 + prox * prox * 0.6}
        {@const tickClass = isHalfHour
          ? "h-12 w-0.5 bg-muted"
          : isMajor
            ? "h-10 w-0.5 bg-muted"
            : "h-6 w-px bg-muted/55"}
        <span class="relative flex h-full items-center justify-center" style="width: {PX_PER_MIN}px;">
          <span
            class="rounded-full {tickClass}"
            style="transform: scaleY({bounce}); transform-origin: center; transition: transform 90ms cubic-bezier(0.34, 1.56, 0.64, 1);"
          ></span>
          {#if isHalfHour}
            <span class="absolute bottom-0.5 text-[10px] font-medium tabular-nums text-muted">{i}m</span>
          {/if}
        </span>
      {/each}
    </div>

    <!-- Fixed center indicator — the strip slides under it. Taller than every
         tick + slightly wider so it reads as the focal point at a glance. -->
    <div class="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">
      <div class="h-16 w-0.5 rounded-full bg-text shadow-[0_0_10px_rgb(var(--shadow-color)/var(--shadow-alpha-2))]"></div>
    </div>
  </div>
</div>

<style>
  .movie-progress-slider {
    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%);
    mask-image: linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%);
  }
</style>
