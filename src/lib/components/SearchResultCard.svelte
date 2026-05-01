<script lang="ts">
  import { base } from "$app/paths";
  import StatusMenu from "$lib/components/StatusMenu.svelte";
  import TypeBadge from "$lib/components/TypeBadge.svelte";
  import { store } from "$lib/store.svelte";
  import { tactile } from "$lib/tactile";
  import { backdropUrl, posterUrl } from "$lib/tmdb";
  import { STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { SearchMultiResult, Status } from "$lib/types";

  type Props = { result: SearchMultiResult; onAdd: (r: SearchMultiResult, status: Status) => Promise<void> | void };
  let { result, onAdd }: Props = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);

  const existing = $derived(
    result.media_type !== "person" ? store.get(result.media_type, result.id) : undefined
  );
  const inLibrary = $derived(!!existing);
  const title = $derived(result.media_type === "movie" ? result.title : result.media_type === "tv" ? result.name : result.name);
  const date = $derived(
    result.media_type === "movie" ? result.release_date : result.media_type === "tv" ? result.first_air_date : ""
  );
  const poster = $derived(result.media_type === "person" ? null : posterUrl(result.poster_path, "w185"));
  const backdrop = $derived(
    result.media_type !== "person" ? backdropUrl(result.backdrop_path, "w780") : null
  );
  const detailHref = $derived(
    result.media_type === "movie"
      ? `${base}/movie/${result.id}/`
      : result.media_type === "tv"
        ? `${base}/show/${result.id}/`
        : null
  );
  // Soft status-tinted border once added to library, neutral otherwise.
  const cardBorder = $derived(existing ? STATUS_COLOR[existing.status].borderSoft : "border-border");

  async function handleStatusPick(status: Status): Promise<void> {
    if (result.media_type === "person") return;
    busy = true;
    error = null;
    try {
      if (existing) {
        store.setStatus(existing.kind, existing.id, status);
      } else {
        await onAdd(result, status);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  // ---- Swipe-to-add gesture (touch only) ----
  // The card is wrapped in a `pan-y` container so the browser handles vertical
  // page scroll natively while horizontal movement stays in our handlers. We
  // detect the dominant axis on the first ~10 px of movement: if horizontal,
  // capture the pointer (so events keep flowing even when the finger leaves
  // the card) and translate the card with the finger; if vertical, abort and
  // let the page scroll. On release past `SWIPE_TRIGGER`, the picker opens.
  const SWIPE_TRIGGER = 80;
  const SWIPE_MAX = 140; // visual rubber-band cap

  let swipeOpenTrigger = $state(0);
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeDx = $state(0);
  let swipeAxis: "h" | "v" | null = null;
  let swiping = $state(false);

  function onPointerDown(e: PointerEvent): void {
    if (e.pointerType !== "touch") return;
    if (result.media_type === "person") return;
    swipeStartX = e.clientX;
    swipeStartY = e.clientY;
    swipeDx = 0;
    swipeAxis = null;
    swiping = true;
  }

  function onPointerMove(e: PointerEvent): void {
    if (!swiping) return;
    const dx = e.clientX - swipeStartX;
    const dy = e.clientY - swipeStartY;
    if (swipeAxis === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        swipeAxis = "h";
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        // Vertical scroll wins — abort and let touch-action: pan-y handle it.
        swiping = false;
        swipeAxis = null;
        return;
      }
    }
    if (swipeAxis === "h") {
      // Rubber-band past SWIPE_MAX so over-swiping has visible diminishing
      // return rather than running off the screen.
      const raw = Math.max(0, dx);
      swipeDx = raw <= SWIPE_MAX ? raw : SWIPE_MAX + (raw - SWIPE_MAX) * 0.2;
    }
  }

  function onPointerUp(): void {
    if (!swiping) return;
    const fired = swipeAxis === "h" && swipeDx > SWIPE_TRIGGER;
    swiping = false;
    swipeAxis = null;
    swipeDx = 0;
    if (fired) swipeOpenTrigger++;
  }

  // Reveal the action layer proportionally to the swipe progress; clamp to 1
  // so it stays fully visible past the trigger threshold.
  const revealOpacity = $derived(Math.min(swipeDx / SWIPE_TRIGGER, 1));
  const reveal = $derived(swipeDx > 4); // hide layer entirely when card is at rest
</script>

<!-- Card-link pattern: the title <a> grows a ::before that overlays the whole
     card, so clicking the poster, overview, or empty space follows the link.
     Interactive children (the +Add menu) get position:relative + z-10 so their
     clicks land on them instead of the overlay. -->
<div class="swipe-wrap relative">
  {#if reveal}
    <!-- Action reveal: sits behind the card and is uncovered as the card
         translates right. Color follows the existing-status if any, else the
         primary "add" green. -->
    <div
      class="pointer-events-none absolute inset-0 flex items-center justify-start rounded-lg border bg-primary/15 px-4 {existing ? STATUS_COLOR[existing.status].border : 'border-primary'}"
      style:opacity={revealOpacity}
      aria-hidden="true"
    >
      <span class="flex items-center gap-2 text-sm font-medium {existing ? STATUS_COLOR[existing.status].text : 'text-primary'}">
        <span class="text-base leading-none">+</span>
        <span>{existing ? "Change status" : "Add to library"}</span>
      </span>
    </div>
  {/if}

  <article
    use:tactile={{ haptic: false }}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    class="tap-target tap-target--card swipe-card relative flex gap-3 overflow-hidden rounded-lg border bg-surface p-3 focus-within:border-primary {cardBorder}"
    style:transform={swipeDx > 0 ? `translateX(${swipeDx}px)` : ""}
    style:transition={swiping ? "none" : "transform 220ms var(--ease-spring)"}
  >
    {#if backdrop}
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-0 right-0 w-3/5 bg-cover bg-center opacity-25 [mask-image:linear-gradient(to_left,black,transparent)]"
        style="background-image: url('{backdrop}')"
      ></div>
    {/if}
    <div class="relative h-32 w-[88px] flex-shrink-0 overflow-hidden rounded bg-surface-2">
      {#if poster}
        <img src={poster} alt="" class="h-full w-full object-cover" loading="lazy" />
      {/if}
    </div>
    {#if result.media_type !== "person"}
      <span class="pointer-events-none absolute right-2 top-2 z-10">
        <TypeBadge kind={result.media_type} variant="chip" />
      </span>
    {/if}
    <div class="relative flex min-w-0 flex-1 flex-col">
      <div class="min-w-0 pr-14">
        {#if detailHref}
          <a href={detailHref} class="card-link block line-clamp-3 font-medium leading-snug">{title}</a>
        {:else}
          <span class="block line-clamp-3 font-medium leading-snug">{title}</span>
        {/if}
        <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
          {#if existing}
            {@const c = STATUS_COLOR[existing.status]}
            <span class="inline-flex items-center gap-1 font-medium {c.text}">
              <span class="h-1.5 w-1.5 rounded-full {c.dot}" aria-hidden="true"></span>
              {STATUS_LABEL[existing.status]}
            </span>
            {#if date}<span class="tabular-nums">· {date.slice(0, 4)}</span>{/if}
          {:else if date}
            <span class="tabular-nums">{date.slice(0, 4)}</span>
          {/if}
        </div>
      </div>
      {#if result.media_type !== "person" && result.overview}
        <p class="mt-2 line-clamp-2 text-xs text-muted">{result.overview}</p>
      {/if}
      {#if result.media_type !== "person" && !existing}
        <div class="relative z-10 mt-auto flex justify-end pt-2">
          <StatusMenu
            label="+ Add"
            {busy}
            size="sm"
            onSelect={handleStatusPick}
            title={`Add "${title}" as...`}
            openTrigger={swipeOpenTrigger}
          />
        </div>
      {/if}
      {#if result.media_type !== "person" && existing}
        <!-- Hidden picker driven by the swipe gesture so already-added cards
             can still trigger the same drawer to change status. -->
        <StatusMenu
          label=""
          size="sm"
          onSelect={handleStatusPick}
          title={`Change "${title}" status...`}
          openTrigger={swipeOpenTrigger}
          hideTrigger
        />
      {/if}
      {#if error}
        <p class="relative z-10 mt-2 text-xs text-danger">{error}</p>
      {/if}
    </div>
  </article>
</div>

<style>
  .card-link::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  /* Browser handles vertical pan natively (page scroll) while we own
     horizontal motion. Without this, iOS sometimes consumes horizontal pans
     as a back-navigation gesture and our pointer events never fire. */
  .swipe-card {
    touch-action: pan-y;
  }
</style>
