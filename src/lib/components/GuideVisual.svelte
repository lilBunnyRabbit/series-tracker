<script lang="ts">
  // Animated demo block for the in-app guide. Used by both the static
  // /settings/guide page and the first-launch tour overlay so demos stay
  // visually identical across the two surfaces. Picks the matching demo by
  // `visual` prop, gates animations on viewport visibility, and self-contains
  // all state — drop-in renderable anywhere.
  import Icon from "$lib/components/Icon.svelte";
  import type { GuideVisual } from "$lib/guide";
  import { STATUS_COLOR, STATUS_DESCRIPTION, STATUS_LABEL, STATUSES } from "$lib/types";

  type Props = {
    visual: GuideVisual;
  };

  let { visual }: Props = $props();

  type Accent = "primary" | "secondary" | "tertiary" | "accent";
  // Tailwind class fragments per accent. Literal strings so the content
  // scanner picks them up. Mirrored from the guide page's accentClasses —
  // kept in sync intentionally so chip and tile styling reads the same in
  // both contexts.
  const accentClasses: Record<Accent, { iconBg: string; chipBg: string; chipText: string; chipBorder: string }> = {
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

  // Action: report whether `node` is intersecting the viewport. We gate
  // animation intervals on this so demos that are scrolled offscreen (or
  // mounted-but-occluded by another tour step) don't burn CPU. Defaults to
  // `true` when IntersectionObserver isn't available so older engines still
  // see the animation.
  function inView(node: HTMLElement, callback: (visible: boolean) => void) {
    let cb = callback;
    if (typeof IntersectionObserver === "undefined") {
      cb(true);
      return {
        update(next: typeof callback) {
          cb = next;
          cb(true);
        },
      };
    }
    const observer = new IntersectionObserver(
      ([entry]) => cb(entry?.isIntersecting ?? false),
      { threshold: 0.1 }
    );
    observer.observe(node);
    return {
      update(next: typeof callback) {
        cb = next;
      },
      destroy() {
        observer.disconnect();
      },
    };
  }

  let visible = $state(false);

  // ---- statuses: cycle a highlight through the five status pills.
  let statusIndex = $state(0);
  $effect(() => {
    if (visual !== "statuses" || !visible) return;
    const id = setInterval(() => {
      statusIndex = (statusIndex + 1) % STATUSES.length;
    }, 1500);
    return () => clearInterval(id);
  });

  // ---- tv-progress: fake season counter ticking 4 → 7 → 4.
  const PROGRESS_SEQUENCE = [4, 5, 6, 7, 6, 5, 4];
  let progressStep = $state(0);
  const progressCount = $derived(PROGRESS_SEQUENCE[progressStep]!);
  const PROGRESS_TOTAL = 9;
  $effect(() => {
    if (visual !== "tv-progress" || !visible) return;
    const id = setInterval(() => {
      progressStep = (progressStep + 1) % PROGRESS_SEQUENCE.length;
    }, 900);
    return () => clearInterval(id);
  });

  // ---- picker: alternate which side wins.
  let pickerWinner = $state<"a" | "b">("a");
  $effect(() => {
    if (visual !== "picker" || !visible) return;
    const id = setInterval(() => {
      pickerWinner = pickerWinner === "a" ? "b" : "a";
    }, 1800);
    return () => clearInterval(id);
  });

  // ---- temptation: cycle through values that visit each band so the
  // demo bar tweens cool→warm and the active band chip lights up in turn.
  const TEMPT_SEQUENCE = [0.32, 0.55, 0.72, 0.88, 0.65, 0.42];
  let temptStep = $state(0);
  const temptValue = $derived(TEMPT_SEQUENCE[temptStep]!);
  const TEMPT_BANDS = [
    { label: "Cold", lo: 0, hi: 0.2 },
    { label: "Drifting", lo: 0.2, hi: 0.4 },
    { label: "Warming", lo: 0.4, hi: 0.6 },
    { label: "Hot", lo: 0.6, hi: 0.8 },
    { label: "Burning", lo: 0.8, hi: 1.01 },
  ] as const;
  $effect(() => {
    if (visual !== "temptation" || !visible) return;
    const id = setInterval(() => {
      temptStep = (temptStep + 1) % TEMPT_SEQUENCE.length;
    }, 1500);
    return () => clearInterval(id);
  });

  // ---- mobile-ui: cycle the active tab so the indicator slides.
  const MOBILE_TABS = [
    { icon: "home", label: "Home" },
    { icon: "compass", label: "Discover" },
    { icon: "bookmark", label: "Watchlist" },
    { icon: "search", label: "Search" },
    { icon: "user", label: "Profile" },
  ] as const;
  let mobileTab = $state(0);
  $effect(() => {
    if (visual !== "mobile-ui" || !visible) return;
    const id = setInterval(() => {
      mobileTab = (mobileTab + 1) % MOBILE_TABS.length;
    }, 1700);
    return () => clearInterval(id);
  });

  const MODES = [
    { icon: "search", label: "Search", accent: "primary" },
    { icon: "list", label: "Bulk search", accent: "secondary" },
    { icon: "compass", label: "Discover", accent: "secondary" },
    { icon: "grid", label: "Browse", accent: "tertiary" },
    { icon: "play", label: "Feed", accent: "primary" },
    { icon: "sparkles", label: "Surprise", accent: "accent" },
  ] as const;

  const TILES = [
    { label: "Titles", value: "47", icon: "bookmark", accent: "primary" },
    { label: "Hours watched", value: "312h", icon: "play", accent: "secondary" },
    { label: "Avg rating", value: "8.2", icon: "star", accent: "tertiary" },
    { label: "Top genre", value: "Sci-Fi", icon: "sparkles", accent: "accent" },
  ] as const;
</script>

<div use:inView={(v) => (visible = v)}>
  {#if visual === "statuses"}
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {#each STATUSES as s, i (s)}
        {@const c = STATUS_COLOR[s]}
        {@const active = i === statusIndex}
        <div
          class="flex items-center gap-3 rounded-lg border p-3 transition-all duration-300 {active
            ? `${c.border} ${c.bgSoft}`
            : 'border-border bg-surface-2'}"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-300 {c.bgSoft} {active ? 'scale-110' : 'scale-100'}"
            aria-hidden="true"
          >
            <span class="h-2.5 w-2.5 rounded-full {c.dot}"></span>
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium {active ? c.text : ''}">{STATUS_LABEL[s]}</div>
            <div class="text-[11px] text-muted">{STATUS_DESCRIPTION[s]}</div>
          </div>
        </div>
      {/each}
    </div>

  {:else if visual === "discover-modes"}
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {#each MODES as m (m.label)}
        {@const a = accentClasses[m.accent]}
        <div class="flex items-center gap-2 rounded-md border {a.chipBorder} {a.chipBg} px-3 py-2">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full {a.iconBg}">
            <Icon name={m.icon} size={14} />
          </span>
          <span class="text-xs font-medium {a.chipText}">{m.label}</span>
        </div>
      {/each}
    </div>

  {:else if visual === "watchlist-filters"}
    {@const c = STATUS_COLOR.watching}
    <div class="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
      <div class="flex items-center gap-2">
        <div class="flex flex-1 items-center gap-2 rounded-full {c.bg} px-3 py-1.5 text-xs font-medium text-bg">
          <span class="h-1.5 w-1.5 rounded-full bg-bg/70"></span>
          <span>Watching</span>
          <span class="ml-auto tabular-nums">12</span>
        </div>
        <div class="flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted">
          <Icon name="chevron-down" size={12} />
        </div>
      </div>
      <div class="flex items-center gap-1.5 overflow-x-auto text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {#each (["plan", "completed", "tuned", "dropped"] as const) as s (s)}
          {@const sc = STATUS_COLOR[s]}
          <span class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 {sc.border} {sc.text}">
            <span class="h-1 w-1 rounded-full {sc.dot}"></span>
            {STATUS_LABEL[s]}
          </span>
        {/each}
      </div>
      <div class="flex items-center justify-between gap-2 pt-1 text-xs text-muted">
        <span class="flex items-center gap-1.5"><Icon name="filter" size={12} /> Recently updated · Grid</span>
        <span class="flex items-center gap-1"><Icon name="search" size={12} /> Title…</span>
      </div>
    </div>

  {:else if visual === "tv-progress"}
    {@const c = STATUS_COLOR.watching}
    {@const pct = (progressCount / PROGRESS_TOTAL) * 100}
    <div class="rounded-lg border {c.borderSoft} bg-surface-2 p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs uppercase tracking-wider text-muted">Season 2</div>
          <div class="text-sm font-medium {c.text}">
            E{progressCount} of {PROGRESS_TOTAL}
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Demo minus"
            class="tap-target tap-target--icon flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Demo plus"
            class="tap-target tap-target--icon flex h-9 w-9 items-center justify-center rounded-full {c.bg} font-semibold text-bg"
          >
            +
          </button>
        </div>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-bg/60">
        <div class="h-full {c.bg} transition-all duration-500" style="width: {pct}%"></div>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        <span class="rounded-full border border-border px-2 py-0.5">Mark all</span>
        <span class="rounded-full border border-border px-2 py-0.5">Reset</span>
        <span class="rounded-full border {c.border} {c.text} px-2 py-0.5">Catch up</span>
      </div>
    </div>

  {:else if visual === "picker"}
    {@const winA = pickerWinner === "a"}
    <div class="rounded-lg border border-border bg-surface-2 p-3">
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div
          class="flex flex-col items-center gap-1.5 rounded-md border p-3 transition-all duration-500 {winA
            ? 'border-primary bg-primary/10 scale-[1.02]'
            : 'border-border bg-surface opacity-50 line-through'}"
        >
          <div class="aspect-[2/3] w-12 rounded {winA ? 'bg-primary/30' : 'bg-surface-2'}"></div>
          <span class="text-xs font-medium">Title A</span>
        </div>
        <span class="text-[11px] font-semibold uppercase tracking-wider text-muted">vs</span>
        <div
          class="flex flex-col items-center gap-1.5 rounded-md border p-3 transition-all duration-500 {!winA
            ? 'border-primary bg-primary/10 scale-[1.02]'
            : 'border-border bg-surface opacity-50 line-through'}"
        >
          <div class="aspect-[2/3] w-12 rounded {!winA ? 'bg-primary/30' : 'bg-surface-2'}"></div>
          <span class="text-xs font-medium">Title B</span>
        </div>
      </div>
      <div class="mt-3 h-1 w-full overflow-hidden rounded-full bg-bg/60">
        <div class="h-full bg-accent transition-all duration-500" style="width: 60%"></div>
      </div>
      <div class="mt-1.5 text-center text-[10px] uppercase tracking-wider text-muted">
        Round 2 · 4 left
      </div>
    </div>

  {:else if visual === "temptation"}
    {@const pct = Math.round(temptValue * 100)}
    {@const activeBand = TEMPT_BANDS.find((b) => temptValue >= b.lo && temptValue < b.hi) ?? TEMPT_BANDS[TEMPT_BANDS.length - 1]}
    <div class="space-y-3 rounded-lg border border-border bg-surface-2 p-3">
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-[11px] uppercase tracking-wider">
          <span class="text-muted">Temptation</span>
          <span class="flex items-center gap-1.5 tabular-nums">
            <span class="font-medium text-text">{activeBand.label}</span>
            <span class="text-muted">·</span>
            <span class="font-medium text-text">{pct}%</span>
          </span>
        </div>
        <div
          class="relative h-1.5 w-full overflow-hidden rounded-full"
          style="background: var(--brand-surface-2);"
        >
          <span class="heat-ramp absolute inset-0" aria-hidden="true"></span>
          <span
            class="absolute inset-y-0 right-0 transition-all duration-700 ease-out"
            aria-hidden="true"
            style="width: {100 - pct}%; background: var(--brand-surface-2);"
          ></span>
        </div>
        <p class="text-[11px] text-muted">+0.25 · watched S2E5 · 2d ago</p>
      </div>
      <div class="grid grid-cols-5 gap-1 text-center text-[9px] uppercase tracking-wider">
        {#each TEMPT_BANDS as b (b.label)}
          {@const active = b.label === activeBand.label}
          <span
            class="rounded-sm px-1 py-1 transition-colors duration-300 {active
              ? 'bg-accent/15 font-medium text-accent'
              : 'bg-bg/60 text-muted'}"
          >
            {b.label}
          </span>
        {/each}
      </div>
    </div>

  {:else if visual === "stats"}
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {#each TILES as t (t.label)}
        {@const a = accentClasses[t.accent]}
        <div class="rounded-lg border border-border bg-surface-2 p-3">
          <div class="mb-2 flex h-7 w-7 items-center justify-center rounded-full {a.iconBg}">
            <Icon name={t.icon} size={14} />
          </div>
          <div class="text-lg font-semibold tabular-nums {a.chipText}">{t.value}</div>
          <div class="text-[11px] uppercase tracking-wider text-muted">{t.label}</div>
        </div>
      {/each}
    </div>

  {:else if visual === "mobile-ui"}
    <div class="rounded-lg border border-border bg-surface-2 p-4">
      <div class="relative mx-auto flex h-14 w-full max-w-sm items-center rounded-full border border-border bg-bg/85 p-1 shadow-lg">
        <span
          class="absolute inset-y-1 rounded-full border border-primary/35 bg-primary/15 transition-transform duration-500"
          style="width: calc((100% - 0.5rem) / {MOBILE_TABS.length}); transform: translateX(calc(100% * {mobileTab}));"
          aria-hidden="true"
        ></span>
        {#each MOBILE_TABS as tab, i (tab.label)}
          {@const active = i === mobileTab}
          <div
            class="relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[9px] {active ? 'text-primary' : 'text-muted'}"
          >
            <Icon name={tab.icon} size={16} />
            <span class="leading-none">{tab.label}</span>
          </div>
        {/each}
      </div>
      <p class="mt-3 text-center text-[11px] text-muted">
        The active tab indicator slides as you switch. On detail pages this same pill swaps to ← Back + page title.
      </p>
    </div>
  {/if}
</div>
