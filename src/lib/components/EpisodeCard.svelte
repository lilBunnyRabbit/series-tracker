<script lang="ts">
  import { base } from "$app/paths";
  import { tactile } from "$lib/tactile";

  type Props = {
    kind: "tv" | "movie";
    id: number;
    title: string;
    /** Landscape backdrop / still URL — fallback to poster if missing. */
    backdrop: string | null;
    poster?: string | null;
    /** Episode label like "S11 · E19 — Crazy Love". */
    episodeLabel?: string;
    /** Top-left overlay — runtime ("42m") or air timing ("In 3 days"). */
    topLeft?: string;
    /** Bottom-left overlay — "8 remaining · 3d" or similar. */
    bottomLeft?: string;
    /** Watched ✓ chip. */
    watched?: boolean;
    /** Optional CSS custom properties for the temptation halo — `--tt` for
     *  intensity, `--tt-c` for hue. Consumed by the global `.tt-glow` rule. */
    glowStyle?: string;
    width?: "sm" | "md" | "lg";
    href?: string;
  };

  let {
    kind,
    id,
    title,
    backdrop,
    poster,
    episodeLabel,
    topLeft,
    bottomLeft,
    watched = false,
    glowStyle,
    width = "md",
    href,
  }: Props = $props();

  const finalHref = $derived(href ?? (kind === "tv" ? `${base}/show/${id}/` : `${base}/movie/${id}/`));
  const widthClass = $derived(
    width === "sm" ? "w-[220px]" : width === "lg" ? "w-[300px] sm:w-[340px]" : "w-[260px] sm:w-[280px]"
  );
  const image = $derived(backdrop ?? poster ?? null);
</script>

<div class="group relative flex flex-col gap-1.5 {widthClass}">
  <a
    href={finalHref}
    use:tactile
    style={glowStyle}
    class="tap-target tap-target--card tt-glow hover-zoom relative block aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-surface-2 shadow-sm"
    aria-label={title}
  >
    {#if image}
      <img src={image} alt="" class="h-full w-full object-cover" loading="lazy" />
    {/if}
    <!-- Subtle bottom gradient so the bottom-left strip stays readable on bright stills. -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/20 to-transparent"></div>

    {#if topLeft}
      <span class="absolute left-1.5 top-1.5 rounded bg-overlay px-1.5 py-0.5 text-[10px] font-medium text-on-overlay backdrop-blur-sm">
        {topLeft}
      </span>
    {/if}

    {#if watched}
      <span class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-bg shadow">
        ✓
      </span>
    {/if}

    {#if bottomLeft}
      <span class="absolute bottom-1.5 left-1.5 right-1.5 truncate text-[11px] font-medium text-text drop-shadow">
        {bottomLeft}
      </span>
    {/if}
  </a>

  <div class="min-w-0 px-0.5">
    <div class="line-clamp-1 text-sm font-medium leading-snug text-text">{title}</div>
    {#if episodeLabel}
      <div class="line-clamp-1 text-[11px] text-muted">{episodeLabel}</div>
    {/if}
  </div>
</div>
