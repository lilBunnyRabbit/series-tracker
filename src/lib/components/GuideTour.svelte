<script lang="ts">
  // Full-screen first-launch tour. Pages through GUIDE_SECTIONS (filtered to
  // those flagged inTour ≠ false) one step at a time with horizontal slide
  // transitions, keyboard nav, and touch swipe. Single source of content with
  // the static /settings/guide page — both surfaces import the same array.
  //
  // Mounted via `{#if tour.open}` in the root layout so the DOM nodes don't
  // exist when the tour isn't visible (per project rule: dialogs are
  // lazy-mounted, not hidden in place). Portaled to <body> so its fixed
  // positioning escapes any transformed ancestor.
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import GuideVisual from "$lib/components/GuideVisual.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { bodyAddedIn, bodyText, type GuideAccent } from "$lib/guide";
  import { portal } from "$lib/portal";
  import { tactile } from "$lib/tactile";
  import { tour } from "$lib/tour.svelte";
  import { version } from "$lib/version.svelte";
  import { quintOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";

  // Sections come from the tour module so this component doesn't have to
  // know which mode is active. First-launch / manual replay → all in-tour
  // sections. Post-update → only those tagged with a version newer than
  // `lastSeenGuideVersion`. The `inTour: false` filter is applied upstream.
  const sections = $derived(tour.sections);
  const isUpdateMode = $derived(tour.isUpdateMode);

  let stepIndex = $state(0);
  // 1 = forward (slide in from right), -1 = back (slide in from left). The
  // slide direction has to follow the user's intent so the perceived motion
  // matches their tap target.
  let direction = $state<1 | -1>(1);

  const totalSteps = $derived(sections.length);
  const currentStep = $derived(sections[stepIndex]);
  const isFirst = $derived(stepIndex === 0);
  const isLast = $derived(stepIndex === totalSteps - 1);

  type AccentClasses = {
    iconBg: string;
    iconRing: string;
    progressFill: string;
    bullet: string;
    bulletText: string;
    btn: string;
    btnHover: string;
  };
  const accentClasses: Record<GuideAccent, AccentClasses> = {
    primary: {
      iconBg: "bg-primary/15 text-primary",
      iconRing: "ring-primary/20",
      progressFill: "bg-primary",
      bullet: "bg-primary",
      bulletText: "text-primary",
      btn: "bg-primary text-bg",
      btnHover: "hover-border-primary",
    },
    secondary: {
      iconBg: "bg-secondary/15 text-secondary",
      iconRing: "ring-secondary/20",
      progressFill: "bg-secondary",
      bullet: "bg-secondary",
      bulletText: "text-secondary",
      btn: "bg-secondary text-bg",
      btnHover: "hover-border-secondary",
    },
    tertiary: {
      iconBg: "bg-tertiary/15 text-tertiary",
      iconRing: "ring-tertiary/20",
      progressFill: "bg-tertiary",
      bullet: "bg-tertiary",
      bulletText: "text-tertiary",
      btn: "bg-tertiary text-bg",
      btnHover: "hover-border-tertiary",
    },
    accent: {
      iconBg: "bg-accent/15 text-accent",
      iconRing: "ring-accent/20",
      progressFill: "bg-accent",
      bullet: "bg-accent",
      bulletText: "text-accent",
      btn: "bg-accent text-bg",
      btnHover: "hover-border-accent",
    },
  };

  function next(): void {
    if (isLast) {
      finish();
      return;
    }
    direction = 1;
    stepIndex += 1;
  }

  function back(): void {
    if (isFirst) return;
    direction = -1;
    stepIndex -= 1;
  }

  function finish(): void {
    tour.close();
  }

  function skip(): void {
    tour.close();
  }

  function viewFullGuide(): void {
    tour.close();
    void goto(`${base}/settings/guide/`);
  }

  // Keyboard nav. Arrow keys advance / retreat, Escape skips. Bound while
  // open via $effect so the listener tears down cleanly on close.
  function onKey(e: KeyboardEvent): void {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      back();
    } else if (e.key === "Escape") {
      e.preventDefault();
      skip();
    }
  }

  $effect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Body scroll lock. Stop the page underneath from scrolling while the tour
  // is up — drag-to-back gestures on mobile in particular get confused if the
  // page is also scrolling.
  $effect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  });

  // The component is mounted via `{#if tour.open}` in the layout, so each
  // open/close cycle is a fresh mount — `stepIndex` and `direction` get
  // their `$state(...)` initial values back automatically. No manual reset
  // needed.

  // Touch swipe. We only treat single-finger horizontal drags past a small
  // threshold as commits — random scroll twitches shouldn't change pages.
  let dragStartX = $state<number | null>(null);
  let dragStartY = $state(0);
  let dragX = $state(0);
  // Once the pointer moves vertically past this much we abandon the gesture
  // and let the page scroll instead — prevents accidental page changes when
  // the user tries to scroll the body content of a tall step.
  const VERT_CANCEL = 16;
  const COMMIT_THRESHOLD = 60;

  function onPointerDown(e: PointerEvent): void {
    if (e.pointerType !== "touch") return;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragX = 0;
  }
  function onPointerMove(e: PointerEvent): void {
    if (dragStartX === null) return;
    const dy = Math.abs(e.clientY - dragStartY);
    if (dy > VERT_CANCEL) {
      // The user is scrolling vertically — abandon the swipe.
      dragStartX = null;
      dragX = 0;
      return;
    }
    dragX = e.clientX - dragStartX;
  }
  function onPointerUp(): void {
    if (dragStartX === null) return;
    if (dragX < -COMMIT_THRESHOLD) next();
    else if (dragX > COMMIT_THRESHOLD && !isFirst) back();
    dragStartX = null;
    dragX = 0;
  }
</script>

{#if currentStep}
  {@const a = accentClasses[currentStep.accent]}

  <div
    use:portal
    class="fixed inset-0 z-[60] flex items-stretch justify-center bg-bg/95 backdrop-blur-sm sm:items-center sm:p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tour-title"
    transition:fade={{ duration: 200 }}
  >
    <div class="flex w-full flex-col bg-bg shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
      {#if isUpdateMode}
        <!-- Post-update mode: a small banner orients the user before the
             progress bar so they know this is a "what's new" walkthrough,
             not a fresh-install onboarding. Renders once above the header. -->
        <div
          class="flex items-center justify-center gap-1.5 border-b border-accent/30 bg-accent/10 px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] text-accent"
          style="padding-top: max(env(safe-area-inset-top), 0.375rem)"
        >
          <Icon name="sparkles" size={12} />
          <span>What's new in v{version.current.version}</span>
        </div>
      {/if}

      <!-- Header: progress + skip -->
      <header
        class="flex items-center gap-3 border-b border-border px-4 py-3"
        style:padding-top={isUpdateMode ? "0.75rem" : "max(env(safe-area-inset-top), 0.75rem)"}
      >
        <div class="flex flex-1 items-center gap-1" aria-label="Progress">
          {#each sections as _, i (i)}
            {@const reached = i <= stepIndex}
            <span
              class="h-1 flex-1 rounded-full transition-colors duration-300 {reached
                ? a.progressFill
                : 'bg-border'}"
            ></span>
          {/each}
        </div>
        <button
          type="button"
          use:tactile={{ haptic: false }}
          onclick={skip}
          class="tap-target tap-target--btn shrink-0 rounded-md px-3 py-1 text-xs text-muted hover-text-text"
        >
          Skip
        </button>
      </header>

      <!-- Body: animated slide between steps. {#key stepIndex} forces remount
           so the fly transition runs against the new content cleanly. -->
      <main
        class="flex-1 overflow-y-auto"
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
      >
        {#key stepIndex}
          <div
            class="space-y-5 p-5 sm:p-6"
            in:fly={{ x: 40 * direction, duration: 280, easing: quintOut, opacity: 0 }}
          >
            <div class="flex flex-col items-center gap-3 text-center">
              <span
                class="flex h-16 w-16 items-center justify-center rounded-full ring-4 {a.iconRing} {a.iconBg}"
                aria-hidden="true"
              >
                <Icon name={currentStep.icon} size={28} />
              </span>
              <h2 id="tour-title" class="text-xl font-semibold tracking-tight">{currentStep.title}</h2>
              <p class="max-w-prose text-sm text-muted">{currentStep.summary}</p>
            </div>

            {#if currentStep.body.length > 0}
              <div class="space-y-3 text-sm leading-relaxed text-text/90">
                {#each currentStep.body as p, i (i)}
                  {@const isNew = tour.isItemNew(bodyAddedIn(p))}
                  <p>
                    {#if isNew}
                      <span
                        class="mr-1.5 inline-block rounded-full bg-accent/15 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-[0.12em] text-accent"
                        aria-label="New in this version"
                      >
                        New
                      </span>
                    {/if}{bodyText(p)}
                  </p>
                {/each}
              </div>
            {/if}

            {#if currentStep.highlights}
              <ul class="space-y-1.5 rounded-lg border border-border bg-surface p-3 text-sm">
                {#each currentStep.highlights as h (h.label)}
                  {@const hNew = tour.isItemNew(h.addedIn)}
                  <li class="flex items-baseline gap-2">
                    <span class="h-1.5 w-1.5 shrink-0 translate-y-[3px] rounded-full {a.bullet}"></span>
                    <span class="min-w-0">
                      {#if hNew}
                        <span
                          class="mr-1 inline-block rounded-full bg-accent/15 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-[0.12em] text-accent"
                          aria-label="New in this version"
                        >
                          New
                        </span>
                      {/if}
                      <strong class="font-medium {a.bulletText}">{h.label}</strong>
                      <span class="text-muted"> — {h.description}</span>
                    </span>
                  </li>
                {/each}
              </ul>
            {/if}

            {#if currentStep.visual}
              <div>
                <GuideVisual visual={currentStep.visual} />
              </div>
            {/if}

            {#if isLast}
              <div class="pt-1 text-center">
                <button
                  type="button"
                  use:tactile={{ haptic: false }}
                  onclick={viewFullGuide}
                  class="tap-target tap-target--btn inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs text-muted hover-text-text"
                >
                  View full guide
                  <Icon name="arrow-right" size={12} />
                </button>
              </div>
            {/if}
          </div>
        {/key}
      </main>

      <!-- Footer: back / step counter / next or finish -->
      <footer
        class="flex items-center justify-between gap-2 border-t border-border bg-surface/50 px-4 py-3"
        style="padding-bottom: max(env(safe-area-inset-bottom), 0.75rem)"
      >
        <button
          type="button"
          use:tactile
          onclick={back}
          disabled={isFirst}
          class="tap-target tap-target--btn rounded-md border border-border px-4 py-2 text-sm transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Back
        </button>
        <span class="text-xs tabular-nums text-muted">
          {stepIndex + 1} of {totalSteps}
        </span>
        <button
          type="button"
          use:tactile
          onclick={next}
          class="tap-target tap-target--btn rounded-md {a.btn} px-4 py-2 text-sm font-medium"
        >
          {isLast ? "Get started" : "Next"}
        </button>
      </footer>
    </div>
  </div>
{/if}
