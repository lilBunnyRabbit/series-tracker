<script lang="ts">
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import {
    ROADMAP_MILESTONES,
    type RoadmapItem,
    type RoadmapStatus,
  } from "$lib/roadmap";
  import { tactile } from "$lib/tactile";
  import { version } from "$lib/version.svelte";

  // Status presentation. Each status gets a small dot + label and a tinted
  // border on the row so the state reads at a glance. The class fragments
  // are literal strings so Tailwind's content scanner picks them up.
  type StatusDef = {
    label: string;
    dot: string;
    text: string;
    /** Whether the row should fade slightly (deferred / out-of-scope items). */
    muted: boolean;
  };

  const STATUS: Record<RoadmapStatus, StatusDef> = {
    shipped: { label: "Shipped", dot: "bg-primary", text: "text-primary", muted: false },
    "in-progress": { label: "In progress", dot: "bg-accent animate-pulse", text: "text-accent", muted: false },
    planned: { label: "Planned", dot: "bg-secondary", text: "text-secondary", muted: false },
    considering: { label: "Considering", dot: "bg-muted", text: "text-muted", muted: true },
    "wont-ship": { label: "Won't ship", dot: "bg-muted", text: "text-muted", muted: true },
  };

  // Group the in-flight v1.0 items by status for the headline counter at the
  // top of the page — gives users a quick "X shipped, Y planned, Z deferred"
  // read without scanning every section.
  const v1 = ROADMAP_MILESTONES.find((m) => m.id === "v1.0");
  const v1Counts = (() => {
    const c: Record<RoadmapStatus, number> = {
      shipped: 0,
      "in-progress": 0,
      planned: 0,
      considering: 0,
      "wont-ship": 0,
    };
    if (!v1) return c;
    for (const g of v1.groups) {
      for (const item of g.items) {
        if (item.internal) continue;
        c[item.status]++;
      }
    }
    return c;
  })();

  // Hide internal items from the rendered surface but keep them in the
  // typed config (e.g. README rewrite). Empty groups (only internal items)
  // get filtered out so we don't render an empty section.
  function visibleItems(items: readonly RoadmapItem[]): RoadmapItem[] {
    return items.filter((i) => !i.internal);
  }

  const milestones = ROADMAP_MILESTONES.map((m) => ({
    ...m,
    groups: m.groups
      .map((g) => ({ ...g, items: visibleItems(g.items) }))
      .filter((g) => g.items.length > 0),
  })).filter((m) => m.groups.length > 0);
</script>

{#snippet headerActions()}
  <a
    href="{base}/settings/"
    use:tactile={{ haptic: false }}
    class="tap-target tap-target--btn flex items-center gap-1.5 whitespace-nowrap rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm text-primary hover-border-primary"
  >
    <Icon name="settings" size={14} />
    <span>Settings</span>
  </a>
{/snippet}

<PageHeader
  title="Roadmap"
  subtitle="What's shipping in v1.0 and what's beyond."
  actions={headerActions}
/>

<!-- Snapshot — anchors the user with what's running and what's left. The
     "currently on" line uses the live version, so a new build immediately
     reflects in the banner without a roadmap.ts edit. -->
<section class="mb-6 rounded-lg border border-accent/40 bg-accent/10 p-4">
  <div class="flex items-start gap-3">
    <span
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"
      aria-hidden="true"
    >
      <Icon name="trending-up" size={18} />
    </span>
    <div class="min-w-0 flex-1">
      <h2 class="text-sm font-semibold text-accent">
        Currently on v{version.current.version}
      </h2>
      <p class="mt-0.5 text-xs text-muted">
        Working toward v1.0 — a polished, stable build worth recommending. Below is the full plan: what just shipped, what's lined up, and what's deferred.
      </p>
      <div class="mt-2 flex flex-wrap gap-2 text-[11px]">
        {#if v1Counts.shipped > 0}
          <span class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
            {v1Counts.shipped} shipped
          </span>
        {/if}
        {#if v1Counts["in-progress"] > 0}
          <span class="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-accent">
            <span class="h-1.5 w-1.5 rounded-full bg-accent"></span>
            {v1Counts["in-progress"]} in progress
          </span>
        {/if}
        {#if v1Counts.planned > 0}
          <span class="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-2 py-0.5 text-secondary">
            <span class="h-1.5 w-1.5 rounded-full bg-secondary"></span>
            {v1Counts.planned} planned
          </span>
        {/if}
        {#if v1Counts.considering > 0}
          <span class="inline-flex items-center gap-1.5 rounded-full bg-muted/10 px-2 py-0.5 text-muted">
            <span class="h-1.5 w-1.5 rounded-full bg-muted"></span>
            {v1Counts.considering} considering
          </span>
        {/if}
      </div>
    </div>
  </div>
</section>

<section class="space-y-8">
  {#each milestones as milestone (milestone.id)}
    <article class="space-y-4">
      <header class="space-y-1">
        <h2 class="text-base font-semibold tracking-tight">{milestone.title}</h2>
        <p class="text-sm text-muted">{milestone.summary}</p>
      </header>

      <div class="space-y-3">
        {#each milestone.groups as group (group.id)}
          <section class="space-y-2 rounded-lg border border-border bg-surface p-4">
            <div>
              <h3 class="text-sm font-medium">{group.title}</h3>
              <p class="mt-0.5 text-xs text-muted">{group.description}</p>
            </div>

            <ul class="divide-y divide-border/50">
              {#each group.items as item (item.id)}
                {@const s = STATUS[item.status]}
                <li class="py-3 first:pt-1 last:pb-1 {s.muted ? 'opacity-70' : ''}">
                  <div class="flex items-start gap-3">
                    <span
                      class="mt-1.5 h-2 w-2 shrink-0 rounded-full {s.dot}"
                      aria-hidden="true"
                    ></span>
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h4 class="text-sm font-medium">{item.title}</h4>
                        <span class="text-[11px] uppercase tracking-wider {s.text}">
                          {s.label}
                        </span>
                        {#if item.shippedIn}
                          <span class="text-[11px] text-muted">· v{item.shippedIn}</span>
                        {/if}
                        {#if item.complexity}
                          <span
                            class="ml-auto rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted"
                            title="Rough effort estimate"
                          >
                            {item.complexity}
                          </span>
                        {/if}
                      </div>
                      <p class="mt-0.5 text-sm text-muted">{item.summary}</p>
                      {#if item.note}
                        <p class="mt-1 text-xs italic text-muted">{item.note}</p>
                      {/if}
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
    </article>
  {/each}

  <!-- Pointer to the changelog so users can dig into the actual landed
       changes for any "shipped" item. -->
  <div class="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
    <p>
      Shipped items have detailed notes in the changelog —
      <a
        href="{base}/settings/"
        use:tactile={{ haptic: false }}
        class="text-accent underline hover-text-text"
      >
        open Settings → About → View changelog
      </a>
      to read what landed in any past release.
    </p>
  </div>

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
