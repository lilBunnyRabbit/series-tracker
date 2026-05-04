<script lang="ts">
  import { base } from "$app/paths";
  import TypeBadge from "$lib/components/TypeBadge.svelte";
  import { tactile } from "$lib/tactile";
  import { STATUS_COLOR, STATUS_LABEL } from "$lib/types";
  import type { Status } from "$lib/types";

  type Props = {
    kind: "tv" | "movie";
    id: number;
    title: string;
    poster: string | null;
    /** Year ("2026") shown alongside the optional `meta` ("12 ep", "2h"). */
    year?: string;
    /** Compact metadata under the title — e.g. "12 ep" or "S1 · E1" or "2h". */
    meta?: string;
    /** Personal status for the bookmark indicator under poster. */
    status?: Status;
    /** TMDB rating overlay (top-right). */
    voteAverage?: number;
    /** Personal rating overlay (top-left). */
    rating?: number;
    /** Episode-watched ✓ overlay. */
    watched?: boolean;
    /** Width preset; "auto" stretches to fill the parent (use inside grids). */
    width?: "auto" | "sm" | "md" | "lg";
    href?: string;
  };

  let {
    kind,
    id,
    title,
    poster,
    year,
    meta,
    status,
    voteAverage,
    rating,
    watched = false,
    width = "md",
    href,
  }: Props = $props();

  const finalHref = $derived(href ?? (kind === "tv" ? `${base}/show/${id}/` : `${base}/movie/${id}/`));
  const widthClass = $derived(
    width === "auto"
      ? "w-full"
      : width === "sm"
        ? "w-[112px] sm:w-[124px]"
        : width === "lg"
          ? "w-[148px] sm:w-[164px]"
          : "w-[132px] sm:w-[148px]"
  );
  const c = $derived(status ? STATUS_COLOR[status] : null);
  // In-library posters get a soft status-tinted border; unfiled cards stay neutral.
  const posterBorder = $derived(c ? c.borderSoft : "border-border/60");
</script>

<a
  href={finalHref}
  use:tactile
  class="tap-target tap-target--card hover-zoom group flex flex-col gap-1.5 {widthClass}"
  aria-label={title}
>
  <div class="relative aspect-[2/3] w-full overflow-hidden rounded-lg border bg-surface-2 shadow-sm {posterBorder}">
    {#if poster}
      <img src={poster} alt="" class="h-full w-full object-cover" loading="lazy" />
    {/if}

    {#if typeof voteAverage === "number" && voteAverage > 0}
      <div class="absolute right-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-text backdrop-blur-sm">
        ★ {voteAverage.toFixed(1)}
      </div>
    {/if}

    {#if typeof rating === "number" && rating > 0}
      <div class="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-bg {c ? c.bg : 'bg-accent'}">
        ♥ {rating}
      </div>
    {/if}

    {#if watched}
      <div class="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-bg shadow">
        ✓
      </div>
    {/if}

    <span class="absolute bottom-1.5 left-1.5 flex items-center gap-1.5">
      <TypeBadge {kind} variant="overlay" />
      {#if c}
        <!-- Status dot overlay — paired with the soft border under the poster,
             this is the "in your library as X" signal. A labelled pill below
             the title pushed the year onto a second row and read as a
             duplicate badge, so the dot does all the work here. -->
        <span
          class="inline-flex items-center rounded bg-black/65 px-1.5 py-1 backdrop-blur-sm"
          title={status ? STATUS_LABEL[status] : undefined}
          aria-label={status ? STATUS_LABEL[status] : undefined}
        >
          <span class="h-1.5 w-1.5 rounded-full {c.dot}" aria-hidden="true"></span>
        </span>
      {/if}
    </span>
  </div>

  <div class="min-w-0 px-0.5">
    <div class="line-clamp-2 text-xs font-medium leading-snug text-text">{title}</div>
    {#if year || meta}
      <div class="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
        {#if year}<span class="tabular-nums">{year}</span>{/if}
        {#if year && meta}<span aria-hidden="true">·</span>{/if}
        {#if meta}<span class="truncate">{meta}</span>{/if}
      </div>
    {/if}
  </div>
</a>
