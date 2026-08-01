<script lang="ts">
  // Spin / Roulette — vertical prize-wheel reel with two entry paths:
  //   • Tap "Spin the wheel" / "Re-roll" → automated decay onto a random row.
  //   • Swipe on the reel → manual scroll; release with momentum and the
  //     reel decelerates past more rows, eventually snapping onto whatever
  //     row is at the centerline.
  //
  // The reel is conceptually infinite. Slot entries are stored in a ring
  // buffer of length REEL_SLOTS, indexed virtually — translateY can roam
  // unbounded, and a virtual row index `i` maps to `slots[((i % L) + L) % L]`.
  // A virtualized renderer only draws the rows in the visible window, so
  // the DOM stays cheap regardless of how far the user has flung.
  //
  // Weighting carries through by populating the ring buffer with weighted-
  // frequency samples (each entry appears in slots roughly proportional to
  // its rewatchable + temptation weight). Whenever a spin starts, the
  // *non-visible* slots are reshuffled with fresh samples — so each spin
  // surfaces new content while the visible window stays stable.
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { tactile } from "$lib/tactile";
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import {
    defaultWeight,
    entryHint,
    entryMeta,
    entryYear,
    filterEntries,
  } from "$lib/picker";
  import { pickerPrefs } from "$lib/pickerPrefs.svelte";
  import { STATUS_COLOR } from "$lib/types";
  import type { Entry } from "$lib/types";
  import Filters from "./Filters.svelte";
  import Winner from "./Winner.svelte";
  import { fade } from "svelte/transition";

  type Phase = "setup" | "spin" | "final";

  /** Ring-buffer length. Sized so even a heroic fling doesn't traverse the
   *  whole buffer (which would show duplicate rows mid-spin). 300 × 132px =
   *  ~40 000 px of reel — well past any plausible velocity. */
  const REEL_SLOTS = 300;
  /** Default automated-spin duration in ms. */
  const AUTO_SPIN_DURATION_MS = 2600;
  /** Each reel row is poster + label + gap; matches the inline CSS var. */
  const ITEM_HEIGHT_PX = 132;
  /** Visible neighbours above/below the centered "winner" row. Drives the
   *  window height, the centerline snap, and the haptic-tick boundaries. */
  const VISIBLE_NEIGHBOURS = 1;
  /** Extra rows rendered above/below the visible window so a fast scroll
   *  doesn't show empty edges between frames. */
  const OVERSCAN_ROWS = 2;
  /** Velocity-to-distance multiplier for swipe-flung spins. Higher = farther
   *  glide on a hard fling. */
  const FLING_DECAY_MS = 480;
  const FLING_MIN_DURATION_MS = 600;
  const FLING_MAX_DURATION_MS = 2400;
  /** Sample window for fling velocity calculation. */
  const VELOCITY_WINDOW_MS = 100;
  /** Min ms between haptic ticks during a spin so a fast deceleration
   *  doesn't strobe the motor. ~50 ms = ~20 ticks/sec — reads as a
   *  satisfying ratchet. */
  const HAPTIC_MIN_INTERVAL_MS = 50;
  /** How far automated spins fling, expressed in rows. The lower bound keeps
   *  the animation from feeling like a nudge; the upper bound caps total
   *  travel so the user doesn't wait forever. */
  const AUTO_FLING_ROWS = { min: 14, max: 28 };

  let phase = $state<Phase>("setup");
  let recent = $state<string[]>([]);
  let winner = $state<Entry | null>(null);

  /** Ring buffer of items. Always REEL_SLOTS long. */
  let slots = $state<Entry[]>([]);
  /** Vertical offset in px (unbounded; negative = scrolled past the start). */
  let translateY = $state(0);
  let spinning = $state(false);
  let dragging = $state(false);

  let reelTrack = $state<HTMLDivElement | null>(null);
  let dragStartY = 0;
  let dragStartTranslate = 0;
  let velocitySamples: { y: number; t: number }[] = [];
  let activePointerId: number | null = null;
  let animFrame: number | null = null;

  let lastTickIndex = Number.NaN;
  let lastHapticAt = 0;

  const filtered = $derived(
    filterEntries(
      store.entries,
      pickerPrefs.selectedStatuses,
      pickerPrefs.kindFilter,
      pickerPrefs.progressFilter
    )
  );

  /** Modular index helper — works for negative virtual indices too. */
  function modSlot(i: number): number {
    if (slots.length === 0) return 0;
    return ((i % slots.length) + slots.length) % slots.length;
  }

  /** Pick a single weighted-random entry from the filtered pool. Used to
   *  fill (or refill) ring-buffer slots. */
  function pickWeightedEntry(pool: Entry[], weights: number[], total: number): Entry {
    const r = Math.random() * total;
    let acc = 0;
    for (let i = 0; i < pool.length; i++) {
      acc += weights[i];
      if (r <= acc) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /** Build a fresh ring buffer. Called when entering the spin phase. */
  function buildSlots(pool: Entry[]): Entry[] {
    if (pool.length === 0) return [];
    const weights = pool.map((e) =>
      defaultWeight(e, store.preferences.temptationPacing)
    );
    const total = weights.reduce((a, b) => a + b, 0);
    const out: Entry[] = new Array(REEL_SLOTS);
    for (let i = 0; i < REEL_SLOTS; i++) {
      let candidate = pickWeightedEntry(pool, weights, total);
      // Avoid back-to-back duplicates so the reel reads cleanly when
      // scrolled slowly. Don't loop forever in tiny pools.
      const last = i > 0 ? out[i - 1] : undefined;
      let attempts = 0;
      while (
        last &&
        candidate.kind === last.kind &&
        candidate.id === last.id &&
        attempts < 5 &&
        pool.length > 1
      ) {
        candidate = pickWeightedEntry(pool, weights, total);
        attempts++;
      }
      out[i] = candidate;
    }
    return out;
  }

  /** Reshuffle every slot that's NOT in the currently-visible window. The
   *  visible window stays stable so the user doesn't see content jump
   *  underneath them, and the next spin scrolls onto fresh material. */
  function reshuffleNonVisible(): void {
    if (slots.length === 0 || filtered.length === 0) return;
    const center = currentCenterIndex();
    const keepFromVirt = center - VISIBLE_NEIGHBOURS - 1;
    const keepToVirt = center + VISIBLE_NEIGHBOURS + 1;
    // Convert the kept virtual range into ring-buffer slot indices.
    const keep = new Set<number>();
    for (let v = keepFromVirt; v <= keepToVirt; v++) keep.add(modSlot(v));
    const weights = filtered.map((e) =>
      defaultWeight(e, store.preferences.temptationPacing)
    );
    const total = weights.reduce((a, b) => a + b, 0);
    const next = slots.slice();
    for (let i = 0; i < next.length; i++) {
      if (keep.has(i)) continue;
      let candidate = pickWeightedEntry(filtered, weights, total);
      // Best-effort no-back-to-back at the seam where a kept row meets a
      // refreshed one — only check the immediate neighbour.
      const prev = next[i - 1];
      let attempts = 0;
      while (
        prev &&
        candidate.kind === prev.kind &&
        candidate.id === prev.id &&
        attempts < 4 &&
        filtered.length > 1
      ) {
        candidate = pickWeightedEntry(filtered, weights, total);
        attempts++;
      }
      next[i] = candidate;
    }
    slots = next;
  }

  function currentCenterIndex(): number {
    return Math.round(VISIBLE_NEIGHBOURS - translateY / ITEM_HEIGHT_PX);
  }

  /** Live virtual centerline index — unbounded, reactive. */
  const centerIndex = $derived.by(() => {
    if (slots.length === 0) return 0;
    return Math.round(VISIBLE_NEIGHBOURS - translateY / ITEM_HEIGHT_PX);
  });

  /** What's at the centerline right now, mapped through the ring buffer. */
  const chosen = $derived(slots.length > 0 ? slots[modSlot(centerIndex)] : null);

  // Haptic ticks as the centerline crosses a new row, throttled so fast
  // spins don't strobe.
  $effect(() => {
    const idx = centerIndex;
    if (Number.isNaN(lastTickIndex)) {
      lastTickIndex = idx;
      return;
    }
    if (idx !== lastTickIndex) {
      const now = performance.now();
      if ((spinning || dragging) && now - lastHapticAt >= HAPTIC_MIN_INTERVAL_MS) {
        vibrate("tick");
        lastHapticAt = now;
      }
      lastTickIndex = idx;
    }
  });

  function offsetForVirtIndex(virt: number): number {
    return -(virt - VISIBLE_NEIGHBOURS) * ITEM_HEIGHT_PX;
  }

  /** Strong ease-out — fast initial slide, long deceleration tail. Matches
   *  the cubic-bezier(0.05, 0.7, 0.1, 1) feel from the previous CSS
   *  transition, but sampled in JS so the virtualised renderer can track
   *  the visual position frame-by-frame instead of jumping straight to
   *  the target. */
  function easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }

  function cancelAnim(): void {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  /** Animate translateY to the offset that centres a specific virtual row.
   *  Driven by requestAnimationFrame so each tick mutates `translateY`
   *  state, which keeps the virtualised render window aligned with what
   *  the user actually sees. */
  function snapToVirtIndex(virt: number, durationMs: number): void {
    cancelAnim();
    const target = offsetForVirtIndex(virt);
    if (Math.abs(target - translateY) < 0.5) {
      translateY = target;
      spinning = false;
      vibrate("success");
      return;
    }
    spinning = true;
    const startY = translateY;
    const distance = target - startY;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOut(t);
      translateY = startY + distance * eased;
      if (t < 1) {
        animFrame = requestAnimationFrame(tick);
      } else {
        animFrame = null;
        translateY = target;
        spinning = false;
        vibrate("success");
        // Refresh non-visible content so the *next* spin scrolls onto
        // fresh material while leaving the current view untouched.
        reshuffleNonVisible();
      }
    };
    animFrame = requestAnimationFrame(tick);
  }

  /** Trigger an automated spin from the current position. Picks a random
   *  forward distance (in rows) and animates onto it. */
  function autoSpin(): void {
    if (slots.length === 0) return;
    const startVirt = currentCenterIndex();
    const span = AUTO_FLING_ROWS.min + Math.floor(Math.random() * (AUTO_FLING_ROWS.max - AUTO_FLING_ROWS.min));
    // Direction alternates randomly so spins don't always feel "downward".
    const direction = Math.random() < 0.5 ? 1 : -1;
    const targetVirt = startVirt + direction * span;
    snapToVirtIndex(targetVirt, AUTO_SPIN_DURATION_MS);
    vibrate("tick");
  }

  function start(): void {
    if (filtered.length === 0) return;
    slots = buildSlots(filtered);
    translateY = 0;
    phase = "spin";
    // One RAF gate so the rendered reel paints before we start the
    // animation — without it the user wouldn't see the initial frame.
    requestAnimationFrame(() => {
      autoSpin();
    });
  }

  function reroll(): void {
    if (spinning) return;
    // The currently-landed entry is being explicitly rejected — the user
    // saw it and said "give me something else". Fire picker-loss to match
    // the head-to-head modes' loser kick. Skipped during the very first
    // spin since there's no previous winner yet.
    if (chosen) {
      store.applyTemptation(chosen.kind, chosen.id, "picker-loss");
    }
    autoSpin();
  }

  function commit(): void {
    if (!chosen || spinning) return;
    store.applyTemptation(chosen.kind, chosen.id, "picker-win");
    pushRecent(chosen);
    winner = chosen;
    vibrate("success");
    phase = "final";
  }

  function pushRecent(e: Entry): void {
    const key = `${e.kind}:${e.id}`;
    const next = [key, ...recent.filter((k) => k !== key)];
    recent = next.slice(0, 4);
  }

  function pickAgain(): void {
    winner = null;
    slots = [];
    translateY = 0;
    recent = [];
    phase = "setup";
  }

  // ----- Swipe handling -----

  function onPointerDown(e: PointerEvent): void {
    if (slots.length === 0) return;
    // Mid-spin grab: cancel the rAF animation. Because the JS-driven
    // animation already mutates translateY each frame, the current state
    // value already matches what the user is seeing — no need to read
    // the DOM transform.
    if (spinning) {
      cancelAnim();
      spinning = false;
    }
    dragging = true;
    activePointerId = e.pointerId;
    dragStartY = e.clientY;
    dragStartTranslate = translateY;
    velocitySamples = [{ y: e.clientY, t: performance.now() }];
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging || e.pointerId !== activePointerId) return;
    const delta = e.clientY - dragStartY;
    translateY = dragStartTranslate + delta;
    const now = performance.now();
    velocitySamples.push({ y: e.clientY, t: now });
    const cutoff = now - VELOCITY_WINDOW_MS * 2;
    while (velocitySamples.length > 1 && velocitySamples[0].t < cutoff) {
      velocitySamples.shift();
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging || e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

    const now = performance.now();
    const recentSamples = velocitySamples.filter((s) => s.t >= now - VELOCITY_WINDOW_MS);
    let velocity = 0;
    if (recentSamples.length >= 2) {
      const first = recentSamples[0];
      const last = recentSamples[recentSamples.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) velocity = (last.y - first.y) / dt;
    }
    velocitySamples = [];

    // Project the fling: target = current + v * decay. Negative v sends the
    // reel up too. No clamping — the ring buffer makes the reel infinite.
    const projected = translateY + velocity * FLING_DECAY_MS;
    const targetVirt = Math.round(VISIBLE_NEIGHBOURS - projected / ITEM_HEIGHT_PX);

    const speed = Math.abs(velocity);
    const duration = Math.max(
      FLING_MIN_DURATION_MS,
      Math.min(FLING_MAX_DURATION_MS, FLING_MIN_DURATION_MS + speed * 600)
    );
    snapToVirtIndex(targetVirt, duration);
  }

  function onPointerCancel(): void {
    if (!dragging) return;
    dragging = false;
    activePointerId = null;
    velocitySamples = [];
    snapToVirtIndex(currentCenterIndex(), 240);
  }

  // ----- Virtualised rendering window -----

  /** Visible virtual-index range (inclusive on both ends) for the current
   *  scroll position. Includes overscan rows so a fast frame doesn't show
   *  empty edges. */
  const visibleRange = $derived.by(() => {
    if (slots.length === 0) return { start: 0, end: -1 };
    const visibleHalf = VISIBLE_NEIGHBOURS;
    const center = centerIndex;
    return {
      start: center - visibleHalf - OVERSCAN_ROWS,
      end: center + visibleHalf + OVERSCAN_ROWS,
    };
  });

  /** Materialised list of {virt, item} for the visible window. */
  const visibleRows = $derived.by<{ virt: number; item: Entry }[]>(() => {
    if (slots.length === 0) return [];
    const out: { virt: number; item: Entry }[] = [];
    for (let v = visibleRange.start; v <= visibleRange.end; v++) {
      out.push({ virt: v, item: slots[modSlot(v)] });
    }
    return out;
  });

  // Near-miss caption: the rows immediately above/below the current
  // chosen row in virtual space. Read off `slots` via mod indexing.
  const nearMisses = $derived.by(() => {
    if (slots.length === 0) return [];
    const out: Entry[] = [];
    for (let off = -VISIBLE_NEIGHBOURS; off <= VISIBLE_NEIGHBOURS; off++) {
      if (off === 0) continue;
      out.push(slots[modSlot(centerIndex + off)]);
    }
    return out;
  });
</script>

{#snippet spinActions()}
  <button
    type="button"
    use:tactile
    onclick={commit}
    disabled={spinning || dragging || !chosen}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm text-primary hover-border-primary disabled:opacity-40"
  >
    <Icon name="check" size={14} />
    <span>Lock in</span>
  </button>
  <button
    type="button"
    use:tactile
    onclick={reroll}
    disabled={spinning || dragging}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover-border-accent disabled:opacity-40"
    aria-label="Re-roll spin"
  >
    <Icon name="rotate-ccw" size={14} />
    <span>Re-roll</span>
  </button>
{/snippet}

<PageHeader
  title="Spin"
  subtitle="Roll one. Re-roll until you commit."
  actions={phase === "spin" ? spinActions : undefined}
  srOnly={phase !== "setup"}
/>

<section class="space-y-4">
  {#if phase === "setup"}
    <div in:fade={{ duration: 200 }} class="space-y-4">
      <p class="text-sm text-muted">
        Tap to spin the wheel, or swipe the reel directly — flick harder for
        a longer coast. Whatever lands at the centerline wins, and the reel
        is endless.
      </p>

      <Filters />

      <div class="rounded-lg border border-border bg-surface p-4 text-sm">
        {#if filtered.length === 0}
          <p class="text-muted">No items match. Pick a different status or type.</p>
        {:else}
          <p>
            <span class="font-medium tabular-nums">{filtered.length}</span>
            <span class="text-muted">candidate{filtered.length === 1 ? "" : "s"}</span>
            <span class="text-muted">·</span>
            <span class="text-muted">weighted by rewatchable + temptation</span>
          </p>
        {/if}
      </div>

      <button
        type="button"
        use:tactile
        onclick={start}
        disabled={filtered.length === 0}
        class="tap-target tap-target--btn flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="sparkles" size={16} />
        <span>Spin the wheel</span>
      </button>
    </div>
  {:else if phase === "spin"}
    <div in:fade={{ duration: 160 }} class="space-y-4">
      <!-- Title / info pinned to the top so it stays in the eye line while
           the reel sits at thumb-reach. The block reserves space for the
           live-updating chosen entry so the layout doesn't bounce between
           filled and empty states between spins. -->
      <div class="min-h-[5.5rem] text-center">
        <p class="text-xs uppercase tracking-[0.2em] text-secondary">
          {dragging ? "Pulling…" : spinning ? "Spinning…" : "Your spin"}
        </p>
        {#if chosen}
          {@const e = chosen}
          {#key `${e.kind}:${e.id}`}
            <h1 class="mt-1 text-xl font-semibold leading-tight">{e.title}</h1>
            <div class="mt-0.5 text-[11px] text-muted">
              {#if entryYear(e)}
                <span class="tabular-nums">{entryYear(e)}</span>
                <span aria-hidden="true">·</span>
              {/if}
              <span>{entryMeta(e)}</span>
              {#if entryHint(e)}
                <span aria-hidden="true">·</span>
                <span class="tabular-nums text-text/70">{entryHint(e)}</span>
              {/if}
            </div>
          {/key}
        {/if}
      </div>

      <!-- Extra top breathing room drops the reel into easier thumb-reach
           on mobile. Nudge sits between the title block and the wheel
           rather than padding the wheel itself, so the wheel keeps its
           natural rounded-card silhouette. -->
      <div
        class="reel-window mt-6 sm:mt-10 {dragging ? 'is-dragging' : ''}"
        style="--row-h: {ITEM_HEIGHT_PX}px; --neighbours: {VISIBLE_NEIGHBOURS}; height: calc(var(--row-h) * (var(--neighbours) * 2 + 1));"
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerCancel}
        role="slider"
        tabindex="0"
        aria-label="Spin reel — drag to scroll"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, slots.length - 1)}
        aria-valuenow={slots.length > 0 ? modSlot(centerIndex) : 0}
        aria-valuetext={chosen?.title ?? "no selection"}
      >
        <!-- Fixed centerline band — sits behind the reel track at the
             window-space row that whichever item is currently aligned with
             the centerline lives in. Stays put while the reel scrolls past,
             so the user always sees a clear "this is where it lands" cue
             even mid-spin. iOS-picker pattern. -->
        <span class="reel-center-band" aria-hidden="true"></span>
        <div
          bind:this={reelTrack}
          class="reel-track {spinning ? 'is-spinning' : ''} {dragging ? 'is-dragging' : ''}"
          style="transform: translate3d(0, {translateY}px, 0);"
        >
          {#each visibleRows as row (row.virt)}
            {@const e = row.item}
            {@const c = STATUS_COLOR[e.status]}
            {@const isCenter = row.virt === centerIndex}
            <div
              class="reel-item {isCenter ? 'is-center' : ''}"
              style="height: var(--row-h); top: {row.virt * ITEM_HEIGHT_PX}px;"
            >
              <div class="reel-poster relative h-[120px] w-[80px] shrink-0 overflow-hidden rounded-md border border-border/60 bg-surface-2">
                {#if e.poster}
                  <img src={e.poster} alt="" class="h-full w-full object-cover" loading="lazy" draggable="false" />
                {/if}
                <span
                  class="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full {c.dot}"
                  aria-hidden="true"
                ></span>
              </div>
              <div class="ml-3 min-w-0 flex-1">
                <div class="line-clamp-2 text-sm font-medium leading-tight">{e.title}</div>
                <div class="mt-0.5 text-[11px] text-muted">
                  {#if entryYear(e)}
                    <span class="tabular-nums">{entryYear(e)}</span>
                    <span aria-hidden="true">·</span>
                  {/if}
                  <span>{entryMeta(e)}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <span class="reel-pointer reel-pointer-left" aria-hidden="true"></span>
        <span class="reel-pointer reel-pointer-right" aria-hidden="true"></span>
      </div>

      {#if !spinning && !dragging && nearMisses.length > 0}
        <p class="text-center text-[11px] text-muted">
          Just missed:
          {#each nearMisses as miss, i (`${i}-${miss.kind}:${miss.id}`)}
            <span class="text-text/80">{miss.title}</span>{#if i < nearMisses.length - 1}<span class="text-muted">, </span>{/if}
          {/each}
        </p>
      {/if}

      <p class="text-center text-[11px] text-muted">
        Swipe the reel to spin — the wheel is endless.
      </p>
    </div>
  {:else if phase === "final" && winner}
    {@const w = winner}
    <Winner
      winner={w}
      eyebrow="Locked in"
      pickAgainLabel="Spin again"
      onPickAgain={pickAgain}
    />
  {/if}
</section>

<style>
  .reel-window {
    position: relative;
    width: 100%;
    max-width: 24rem;
    margin-inline: auto;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    background: var(--color-surface);
    /* Block native vertical scrolling — pointer events drive the reel
       directly, and letting the page scroll under our drag would steal
       the gesture. */
    touch-action: none;
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      black calc(var(--row-h) * 0.5),
      black calc(100% - var(--row-h) * 0.5),
      transparent 100%
    );
    mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      black calc(var(--row-h) * 0.5),
      black calc(100% - var(--row-h) * 0.5),
      transparent 100%
    );
    cursor: grab;
    user-select: none;
  }
  .reel-window.is-dragging {
    cursor: grabbing;
  }

  .reel-track {
    /* Animation is rAF-driven in JS so the virtualised render window can
       track the *current* visual position frame-by-frame. CSS transitions
       would only animate the visual transform while leaving translateY
       state pinned at the target — the rendered rows would hover near the
       destination and the user would see an empty wheel mid-spin. */
    position: absolute;
    inset: 0;
    will-change: transform;
    z-index: 1;
  }

  /* Fixed centerline band. Anchored at row index `var(--neighbours)` from
     the top of the window so it always sits where the chosen entry will
     land. Sits behind the reel track so items pass through it. */
  .reel-center-band {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(var(--row-h) * var(--neighbours));
    height: var(--row-h);
    background: color-mix(in oklab, var(--color-secondary) 14%, transparent);
    border-block: 1px solid color-mix(in oklab, var(--color-secondary) 35%, transparent);
    pointer-events: none;
    z-index: 0;
  }

  .reel-item {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    padding: 0 1rem;
    transition: transform 240ms ease-out, filter 240ms ease-out;
    pointer-events: none;
  }
  /* Active row treatment is intentionally subtle — the user already gets a
     fixed centerline band as a strong visual anchor, so the per-row
     highlight is a quiet poster-border accent. Stronger emphasis here
     would strobe distractingly during a fast spin since `is-center` flips
     between rows on every frame. */
  .reel-item.is-center .reel-poster {
    border-color: color-mix(in oklab, var(--color-secondary) 70%, transparent);
  }
  .reel-track.is-spinning .reel-item {
    filter: blur(0.4px);
  }

  .reel-pointer {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    transform: translateY(-50%) rotate(45deg);
    background: color-mix(in oklab, var(--color-secondary) 90%, transparent);
    border: 1px solid color-mix(in oklab, var(--color-secondary) 100%, transparent);
    pointer-events: none;
    z-index: 1;
  }
  .reel-pointer-left {
    left: -7px;
  }
  .reel-pointer-right {
    right: -7px;
  }

  @media (prefers-reduced-motion: reduce) {
    .reel-track.is-spinning .reel-item {
      filter: none;
    }
    .reel-item {
      transition: none;
    }
  }
</style>
