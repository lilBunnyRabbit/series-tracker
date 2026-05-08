<script lang="ts">
  import { tactile } from "$lib/tactile";

  type KindKey = "all" | "tv" | "movie";

  interface Props {
    value: KindKey;
    onChange: (k: KindKey) => void;
    counts?: Partial<Record<KindKey, number>>;
    labels?: Partial<Record<KindKey, string>>;
    /** Optional restricted set — e.g. the feed's TV-or-Movies-only setup
     *  (no "All" because TMDB's discover endpoints are kind-scoped). */
    kinds?: KindKey[];
    ariaLabel?: string;
  }

  const { value, onChange, counts, labels, kinds, ariaLabel = "Media kind filter" }: Props = $props();

  const DEFAULT_KINDS: KindKey[] = ["all", "tv", "movie"];
  const KINDS = $derived(kinds ?? DEFAULT_KINDS);
  const DEFAULT_LABELS: Record<KindKey, string> = { all: "All", tv: "TV", movie: "Movies" };
  const KIND_COLOR: Record<KindKey, { bg: string; border: string; borderSoft: string; dot: string; text: string }> = {
    all: { bg: "bg-primary", border: "border-primary", borderSoft: "border-border/60", dot: "bg-primary", text: "text-muted" },
    tv: { bg: "bg-secondary", border: "border-secondary", borderSoft: "border-secondary/60", dot: "bg-secondary", text: "text-secondary" },
    movie: { bg: "bg-tertiary", border: "border-tertiary", borderSoft: "border-tertiary/60", dot: "bg-tertiary", text: "text-tertiary" },
  };
</script>

<div class="flex items-stretch gap-1 text-xs" role="tablist" aria-label={ariaLabel}>
  {#each KINDS as k (k)}
    {@const active = value === k}
    {@const c = KIND_COLOR[k]}
    {@const label = labels?.[k] ?? DEFAULT_LABELS[k]}
    <button
      type="button"
      role="tab"
      aria-selected={active}
      use:tactile
      onclick={() => onChange(k)}
      class="hero-tab {active ? 'flex-1' : 'shrink-0'} {active
        ? `hero-tab-active ${c.border} ${c.bg} text-bg`
        : `bg-transparent ${c.borderSoft} text-muted hover-text-text`}"
    >
      {#if k !== "all"}
        <span class="h-1.5 w-1.5 shrink-0 rounded-full {active ? 'bg-bg' : c.dot}" aria-hidden="true"></span>
      {/if}
      <span class="hero-tab-label">{label}</span>
      {#if counts && counts[k] !== undefined}
        <span
          class="tabular-nums {active
            ? 'ml-auto text-sm font-semibold text-bg/85'
            : `text-[10px] ${c.text}`}"
        >
          {counts[k]}
        </span>
      {/if}
    </button>
  {/each}
</div>
