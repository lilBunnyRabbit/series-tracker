<script lang="ts">
  import { base } from "$app/paths";
  import GuideVisual from "$lib/components/GuideVisual.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { GUIDE_SECTIONS, type GuideAccent } from "$lib/guide";
  import { tactile } from "$lib/tactile";
  import { tour } from "$lib/tour.svelte";

  // Smooth-scroll a section into view when a TOC chip is tapped. Uses native
  // scrollIntoView since the layout shell handles the body scroll for us.
  function scrollTo(id: string): void {
    if (typeof document === "undefined") return;
    const el = document.getElementById(`guide-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Tailwind class fragments per accent. Literal strings so the content
  // scanner picks them up. Mirrors the pattern used in /activity.
  const accentClasses: Record<GuideAccent, { iconBg: string; chipBg: string; chipText: string; chipBorder: string }> = {
    primary: {
      iconBg: "bg-primary/15 text-primary",
      chipBg: "bg-primary/10",
      chipText: "text-primary",
      chipBorder: "border-primary/40",
    },
    secondary: {
      iconBg: "bg-secondary/15 text-secondary",
      chipBg: "bg-secondary/10",
      chipText: "text-secondary",
      chipBorder: "border-secondary/40",
    },
    tertiary: {
      iconBg: "bg-tertiary/15 text-tertiary",
      chipBg: "bg-tertiary/10",
      chipText: "text-tertiary",
      chipBorder: "border-tertiary/40",
    },
    accent: {
      iconBg: "bg-accent/15 text-accent",
      chipBg: "bg-accent/10",
      chipText: "text-accent",
      chipBorder: "border-accent/40",
    },
  };
</script>

{#snippet headerActions()}
  <a
    href="{base}/activity/"
    use:tactile={{ haptic: false }}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-secondary/40 bg-secondary/10 px-3 py-1.5 text-sm text-secondary hover-border-secondary"
  >
    <Icon name="list" size={14} />
    <span>Activity</span>
  </a>
{/snippet}

<PageHeader
  title="Guide"
  subtitle="A tour of every feature in Series Tracker."
  actions={headerActions}
/>

<!-- Replay-the-tour CTA. Sits above the TOC so existing users (who never
     auto-saw the first-launch tour) can opt in. New users who already
     completed the tour have the same affordance for a refresher. -->
<section class="mb-5 rounded-lg border border-primary/40 bg-primary/10 p-4">
  <div class="flex items-start gap-3">
    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
      <Icon name="sparkles" size={18} />
    </span>
    <div class="min-w-0 flex-1">
      <h2 class="text-sm font-semibold text-primary">Take the tour</h2>
      <p class="mt-0.5 text-xs text-muted">
        A 1-minute paged walkthrough of the essentials — statuses, finding titles, tracking, and the picker.
      </p>
    </div>
    <button
      type="button"
      use:tactile
      onclick={tour.show}
      class="tap-target tap-target--btn shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-bg"
    >
      Start
    </button>
  </div>
</section>

<!-- ============================== TOC ===================================== -->
<!-- Horizontal scrolling chip rail. Each chip jumps to a section anchor; on
     mobile the row scrolls so longer chips don't wrap. -->
<nav aria-label="Guide sections" class="-mx-3 mb-6 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
  <ul class="flex gap-2 pb-2">
    {#each GUIDE_SECTIONS as section (section.id)}
      {@const a = accentClasses[section.accent]}
      <li class="shrink-0">
        <button
          type="button"
          use:tactile={{ haptic: "tick" }}
          onclick={() => scrollTo(section.id)}
          class="tap-target tap-target--chip flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs {a.chipBorder} {a.chipBg} {a.chipText}"
        >
          <Icon name={section.icon} size={14} />
          <span class="whitespace-nowrap">{section.title}</span>
        </button>
      </li>
    {/each}
  </ul>
</nav>

<!-- ============================== SECTIONS ================================ -->

<section class="space-y-5">
  {#each GUIDE_SECTIONS as section (section.id)}
    {@const a = accentClasses[section.accent]}
    <article
      id="guide-{section.id}"
      class="scroll-mt-20 space-y-4 rounded-lg border border-border bg-surface p-5"
    >
      <header class="flex items-start gap-3">
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {a.iconBg}"
          aria-hidden="true"
        >
          <Icon name={section.icon} size={20} />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="text-base font-semibold tracking-tight">{section.title}</h2>
          <p class="mt-0.5 text-xs text-muted">{section.summary}</p>
        </div>
      </header>

      <div class="space-y-3 text-sm leading-relaxed">
        {#each section.body as p, i (i)}
          <p>{p}</p>
        {/each}
      </div>

      {#if section.highlights}
        <ul class="space-y-1.5 rounded-md border border-border bg-surface-2 p-3 text-sm">
          {#each section.highlights as h (h.label)}
            <li class="flex items-baseline gap-2">
              <span class="h-1.5 w-1.5 shrink-0 translate-y-[3px] rounded-full {a.iconBg.split(' ')[0]}"></span>
              <span class="min-w-0">
                <strong class="font-medium {a.chipText}">{h.label}</strong>
                <span class="text-muted"> — {h.description}</span>
              </span>
            </li>
          {/each}
        </ul>
      {/if}

      {#if section.visual}
        <div class="pt-1">
          <GuideVisual visual={section.visual} />
        </div>
      {/if}
    </article>
  {/each}

  <!-- Footer link back to settings — covers the case where the user opens the
       guide direct (e.g. via a deep link) and wants to head back. -->
  <div class="pt-2 text-center">
    <a
      href="{base}/settings/"
      use:tactile={{ haptic: false }}
      class="tap-target tap-target--btn inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover-border-primary"
    >
      <Icon name="arrow-left" size={14} />
      <span>Back to settings</span>
    </a>
  </div>
</section>
