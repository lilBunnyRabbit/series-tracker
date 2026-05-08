<script lang="ts">
  // Mode-select grid. Each card links to a dedicated sub-route under
  // /picker/<mode>/, so the floating island handles back-to-grid nav and the
  // mode pages can reserve their own page-actions rail. Last-used mode is
  // remembered in localStorage and surfaces as the highlighted card.
  import { base } from "$app/paths";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { tactile } from "$lib/tactile";
  import { pickerPrefs, setLastMode } from "$lib/pickerPrefs.svelte";
  import type { PickerMode } from "$lib/pickerPrefs.svelte";
  import { POOL_CAP } from "$lib/picker";
  import { fade, fly } from "svelte/transition";
  import { backOut } from "svelte/easing";

  type Accent = "primary" | "secondary" | "accent" | "tertiary";
  type ModeMeta = {
    id: PickerMode;
    title: string;
    summary: string;
    icon: "trophy" | "repeat" | "sparkles" | "trending-up" | "play" | "filter" | "rotate-ccw";
    accent: Accent;
  };

  // Tailwind only emits classes that appear verbatim in source — so each
  // accent variant is hand-listed instead of composed via template strings.
  const ACCENT_CLASSES: Record<Accent, { icon: string; chipBorder: string; chipBg: string; chipText: string; cardBorder: string; cardHover: string }> = {
    primary: {
      icon: "text-primary",
      chipBorder: "border-primary/40",
      chipBg: "bg-primary/10",
      chipText: "text-primary",
      cardBorder: "border-primary/60",
      cardHover: "hover-border-primary",
    },
    secondary: {
      icon: "text-secondary",
      chipBorder: "border-secondary/40",
      chipBg: "bg-secondary/10",
      chipText: "text-secondary",
      cardBorder: "border-secondary/60",
      cardHover: "hover-border-secondary",
    },
    tertiary: {
      icon: "text-tertiary",
      chipBorder: "border-tertiary/40",
      chipBg: "bg-tertiary/10",
      chipText: "text-tertiary",
      cardBorder: "border-tertiary/60",
      cardHover: "hover-border-tertiary",
    },
    accent: {
      icon: "text-accent",
      chipBorder: "border-accent/40",
      chipBg: "bg-accent/10",
      chipText: "text-accent",
      cardBorder: "border-accent/60",
      cardHover: "hover-border-accent",
    },
  };

  const MODES: ModeMeta[] = [
    {
      id: "bracket",
      title: "Bracket",
      summary: `Tournament across up to ${POOL_CAP} contenders. The deepest pick.`,
      icon: "trophy",
      accent: "accent",
    },
    {
      id: "mini",
      title: "Top 8",
      summary: "Quick bracket — eight contenders, three rounds, one winner.",
      icon: "trophy",
      accent: "primary",
    },
    {
      id: "coin",
      title: "Coin Flip",
      summary: "Two random titles head-to-head. One tap, one decision.",
      icon: "repeat",
      accent: "primary",
    },
    {
      id: "spin",
      title: "Spin",
      summary: "Roll a single random pick. Re-roll until you commit.",
      icon: "sparkles",
      accent: "secondary",
    },
    {
      id: "stalled",
      title: "Pick up where you left off",
      summary: "Surfaces shows you've started but haven't touched in a while.",
      icon: "play",
      accent: "primary",
    },
    {
      id: "mood",
      title: "Mood",
      summary: "Short / long, comfort / challenge — narrow the pool, then pick.",
      icon: "filter",
      accent: "tertiary",
    },
    {
      id: "rank",
      title: "Either / Or",
      summary: "Endless A-vs-B coin flips. Builds your personal Top 10 over time.",
      icon: "trending-up",
      accent: "accent",
    },
  ];

  const recommendedId = $derived<PickerMode>(pickerPrefs.lastMode ?? "bracket");
</script>

<PageHeader title="Picker" subtitle="Different ways to decide what to watch tonight." />

<section class="space-y-4" in:fade={{ duration: 200 }}>
  <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {#each MODES as m, i (m.id)}
      {@const recommended = m.id === recommendedId}
      {@const ac = ACCENT_CLASSES[m.accent]}
      <li in:fly={{ y: 12, duration: 320, easing: backOut, delay: 40 + i * 30 }}>
        <a
          href="{base}/picker/{m.id}/"
          use:tactile
          onclick={() => setLastMode(m.id)}
          aria-label="Use {m.title} mode"
          class="mode-card group relative flex w-full items-start gap-3 rounded-lg border bg-surface p-4 text-left transition-colors duration-150 {recommended
            ? `${ac.cardBorder} ${ac.cardHover}`
            : 'border-border hover-border-accent'}"
        >
          <span
            class="mode-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-2 {ac.icon}"
          >
            <Icon name={m.icon} size={20} />
          </span>
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="font-medium leading-tight">{m.title}</span>
              {#if recommended}
                <span class="rounded-full border {ac.chipBorder} {ac.chipBg} px-1.5 py-0.5 text-[10px] uppercase tracking-wider {ac.chipText}">
                  Last used
                </span>
              {/if}
            </div>
            <p class="text-xs text-muted">{m.summary}</p>
          </div>
          <Icon name="chevron-right" size={16} class="mt-1 shrink-0 text-muted opacity-60 transition-opacity group-hover:opacity-100" />
        </a>
      </li>
    {/each}
  </ul>

  <p class="pt-2 text-center text-[11px] text-muted/70">
    Filters, rewatchable boost, and Temptation weighting carry across every mode.
  </p>
</section>
