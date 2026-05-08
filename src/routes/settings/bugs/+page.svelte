<script lang="ts">
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import {
    KNOWN_BUGS,
    type Bug,
    type BugSeverity,
    type BugStatus,
  } from "$lib/bugs";
  import { COMPLEXITY_DOTS, COMPLEXITY_LABEL } from "$lib/complexity";
  import { tactile } from "$lib/tactile";

  // Status presentation. Mirrors the roadmap page so the two surfaces feel
  // like siblings — same dot+label vocabulary, same row treatment.
  type StatusDef = {
    label: string;
    dot: string;
    text: string;
  };

  const STATUS: Record<BugStatus, StatusDef> = {
    open: { label: "Open", dot: "bg-error", text: "text-error" },
    investigating: { label: "Investigating", dot: "bg-accent animate-pulse", text: "text-accent" },
    "wont-fix": { label: "Won't fix", dot: "bg-muted", text: "text-muted" },
    fixed: { label: "Fixed", dot: "bg-primary", text: "text-primary" },
  };

  type SeverityDef = {
    label: string;
    text: string;
    border: string;
  };

  // Severity is a separate axis from status. Status answers "is it fixed
  // yet?", severity answers "how bad is it while open?". Rendered as a
  // small pill so the user can scan the list and triage at a glance.
  const SEVERITY: Record<BugSeverity, SeverityDef> = {
    critical: { label: "Critical", text: "text-error", border: "border-error/40" },
    major: { label: "Major", text: "text-warning", border: "border-warning/40" },
    minor: { label: "Minor", text: "text-secondary", border: "border-secondary/40" },
    polish: { label: "Polish", text: "text-muted", border: "border-border" },
  };

  // Stable sort: open / investigating first by severity (critical → polish),
  // then won't-fix, then fixed by descending fixedIn. Keeps urgent stuff up
  // top without depending on author order in bugs.ts.
  const SEVERITY_ORDER: BugSeverity[] = ["critical", "major", "minor", "polish"];
  const STATUS_ORDER: BugStatus[] = ["open", "investigating", "wont-fix", "fixed"];

  const sorted = [...KNOWN_BUGS].sort((a, b) => {
    const s = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (s !== 0) return s;
    if (a.status === "fixed" && b.status === "fixed") {
      return (b.fixedIn ?? "").localeCompare(a.fixedIn ?? "");
    }
    return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
  });

  const active = sorted.filter((b) => b.status === "open" || b.status === "investigating");
  const wontFix = sorted.filter((b) => b.status === "wont-fix");
  const fixed = sorted.filter((b) => b.status === "fixed");

  const counts = {
    open: active.filter((b) => b.status === "open").length,
    investigating: active.filter((b) => b.status === "investigating").length,
    wontFix: wontFix.length,
    fixed: fixed.length,
  };
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
  title="Known issues"
  subtitle="Bugs we know about — what's open, what's being looked at, what just got fixed."
  actions={headerActions}
/>

<!-- Snapshot — mirrors the roadmap header. When the list is empty the
     banner doubles as the empty state so the page still has shape. -->
<section class="mb-6 rounded-lg border border-primary/40 bg-primary/10 p-4">
  <div class="flex items-start gap-3">
    <span
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
      aria-hidden="true"
    >
      <Icon name={KNOWN_BUGS.length === 0 ? "check" : "bug"} size={18} />
    </span>
    <div class="min-w-0 flex-1">
      {#if KNOWN_BUGS.length === 0}
        <h2 class="text-sm font-semibold text-primary">All clear</h2>
        <p class="mt-0.5 text-xs text-muted">
          No known bugs right now. Hit something that feels wrong? Report it on
          <a
            href="https://github.com/lilBunnyRabbit/series-tracker/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent underline hover-text-text"
          >GitHub</a>
          and it'll show up here.
        </p>
      {:else}
        <h2 class="text-sm font-semibold text-primary">
          {counts.open + counts.investigating} open · {counts.wontFix} won't fix · {counts.fixed} recently fixed
        </h2>
        <p class="mt-0.5 text-xs text-muted">
          Open ones are listed by severity. Won't-fix entries are documented for awareness. Fixed entries hang around for a release or two so you can confirm the version that resolved them, then get pruned.
        </p>
        <div class="mt-2 flex flex-wrap gap-2 text-[11px]">
          {#if counts.open > 0}
            <span class="inline-flex items-center gap-1.5 rounded-full bg-error/10 px-2 py-0.5 text-error">
              <span class="h-1.5 w-1.5 rounded-full bg-error"></span>
              {counts.open} open
            </span>
          {/if}
          {#if counts.investigating > 0}
            <span class="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-accent">
              <span class="h-1.5 w-1.5 rounded-full bg-accent"></span>
              {counts.investigating} investigating
            </span>
          {/if}
          {#if counts.wontFix > 0}
            <span class="inline-flex items-center gap-1.5 rounded-full bg-muted/10 px-2 py-0.5 text-muted">
              <span class="h-1.5 w-1.5 rounded-full bg-muted"></span>
              {counts.wontFix} won't fix
            </span>
          {/if}
          {#if counts.fixed > 0}
            <span class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
              {counts.fixed} fixed
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>

{#snippet bugRow(bug: Bug)}
  {@const s = STATUS[bug.status]}
  {@const sev = SEVERITY[bug.severity]}
  <li class="py-3 first:pt-1 last:pb-1 {bug.status === 'fixed' || bug.status === 'wont-fix' ? 'opacity-70' : ''}">
    <div class="flex items-start gap-3">
      <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full {s.dot}" aria-hidden="true"></span>
      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-2">
          <div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
            <h4 class="text-sm font-medium">{bug.title}</h4>
            <span class="text-[11px] uppercase tracking-wider {s.text}">{s.label}</span>
            {#if bug.fixedIn}
              <span class="text-[11px] text-muted">· v{bug.fixedIn}</span>
            {/if}
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <span
              class="mt-0.5 rounded-md border {sev.border} px-1.5 py-0.5 text-[10px] uppercase tracking-wider {sev.text}"
              title="Severity"
            >
              {sev.label}
            </span>
            {#if bug.complexity}
              <span
                class="mt-0.5 rounded-md border border-border px-1.5 py-0.5 text-[11px] tracking-widest text-muted"
                title="Rough fix: {COMPLEXITY_LABEL[bug.complexity]}"
                aria-label="Rough fix: {COMPLEXITY_LABEL[bug.complexity]}"
              >
                {COMPLEXITY_DOTS[bug.complexity]}
              </span>
            {/if}
          </div>
        </div>
        <p class="mt-0.5 text-sm text-muted">{bug.summary}</p>
        {#if bug.note}
          <p class="mt-1 text-xs italic text-muted">{bug.note}</p>
        {/if}
      </div>
    </div>
  </li>
{/snippet}

{#if KNOWN_BUGS.length > 0}
  <section class="space-y-6">
    {#if active.length > 0}
      <article class="space-y-2 rounded-lg border border-border bg-surface p-4">
        <div>
          <h3 class="text-sm font-medium">Open</h3>
          <p class="mt-0.5 text-xs text-muted">Reproducible issues we know about. Severity orders the list.</p>
        </div>
        <ul class="divide-y divide-border/50">
          {#each active as bug (bug.id)}
            {@render bugRow(bug)}
          {/each}
        </ul>
      </article>
    {/if}

    {#if wontFix.length > 0}
      <article class="space-y-2 rounded-lg border border-border bg-surface p-4">
        <div>
          <h3 class="text-sm font-medium">Won't fix</h3>
          <p class="mt-0.5 text-xs text-muted">Documented but not going to be addressed — usually platform constraints or a fix worse than the symptom.</p>
        </div>
        <ul class="divide-y divide-border/50">
          {#each wontFix as bug (bug.id)}
            {@render bugRow(bug)}
          {/each}
        </ul>
      </article>
    {/if}

    {#if fixed.length > 0}
      <article class="space-y-2 rounded-lg border border-border bg-surface p-4">
        <div>
          <h3 class="text-sm font-medium">Recently fixed</h3>
          <p class="mt-0.5 text-xs text-muted">Resolved in the last release or two — confirm the version, then these get pruned.</p>
        </div>
        <ul class="divide-y divide-border/50">
          {#each fixed as bug (bug.id)}
            {@render bugRow(bug)}
          {/each}
        </ul>
      </article>
    {/if}
  </section>
{/if}

<div class="mt-8 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
  <p>
    Hit something not on this list? Open an issue on
    <a
      href="https://github.com/lilBunnyRabbit/series-tracker/issues"
      target="_blank"
      rel="noopener noreferrer"
      class="text-accent underline hover-text-text"
    >GitHub</a>
    — repro steps + the build version (Settings → About) make the fix faster.
  </p>
</div>

<div class="mt-6 pt-2 text-center">
  <a
    href="{base}/settings/"
    use:tactile={{ haptic: false }}
    class="tap-target tap-target--btn inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover-border-primary"
  >
    <Icon name="arrow-left" size={14} />
    <span>Back to settings</span>
  </a>
</div>
