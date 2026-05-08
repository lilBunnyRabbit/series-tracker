<script lang="ts">
  // Mood — chip-based pre-filter that narrows the pool, then runs a
  // coin-flip-style two-card pick on the narrowed candidates. Layers on top
  // of the shared filters (status / kind / progress) so a user can stack
  // "TV only + Comfort + Short" without losing the standard axes.
  //
  // Mood axes:
  //   Length: short (≤60min / ≤20 ep) | long (≥130min / ≥40 ep)
  //   Vibe:   comfort (rewatchable OR completed) | challenge (plan OR untouched watching)
  //
  // Both axes default to "any" — leaving them off makes Mood functionally
  // identical to Coin Flip, which is fine because the chips are the only
  // value-add and we don't want to force selections.
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { tactile } from "$lib/tactile";
  import { vibrate } from "$lib/haptics";
  import { store } from "$lib/store.svelte";
  import {
    defaultWeight,
    entryRuntimeMinutes,
    filterEntries,
    samplePair,
  } from "$lib/picker";
  import { pickerPrefs } from "$lib/pickerPrefs.svelte";
  import { hasProgress } from "$lib/types";
  import type { Entry } from "$lib/types";
  import Filters from "./Filters.svelte";
  import MatchCard from "./MatchCard.svelte";
  import Winner from "./Winner.svelte";
  import { backOut } from "svelte/easing";
  import { fade, scale } from "svelte/transition";

  type Length = "any" | "short" | "long";
  type Vibe = "any" | "comfort" | "challenge";
  type Phase = "setup" | "flip" | "final";
  const PICK_DELAY_MS = 360;

  let length = $state<Length>("any");
  let vibe = $state<Vibe>("any");

  let phase = $state<Phase>("setup");
  let pair = $state<{ a: Entry; b: Entry } | null>(null);
  let pickedSide = $state<"a" | "b" | null>(null);
  let winner = $state<Entry | null>(null);

  function passesLength(e: Entry, l: Length): boolean {
    if (l === "any") return true;
    const mins = entryRuntimeMinutes(e);
    if (l === "short") {
      // Treat unknown runtime (movies with no runtime metadata) as eligible
      // so we don't accidentally exclude shorts that lack TMDB length data.
      if (mins === 0) return e.kind === "movie";
      return mins <= 60 || (e.kind === "tv" && mins <= 20 * 45);
    }
    return mins >= 130 || (e.kind === "tv" && mins >= 40 * 45);
  }

  function passesVibe(e: Entry, v: Vibe): boolean {
    if (v === "any") return true;
    if (v === "comfort") {
      return Boolean(e.rewatchable) || e.status === "completed";
    }
    // Challenge: things you haven't fully engaged with yet — Plan, or
    // Watching that you actually haven't started watching.
    return e.status === "plan" || (e.status === "watching" && !hasProgress(e));
  }

  const filtered = $derived(
    filterEntries(
      store.entries,
      pickerPrefs.selectedStatuses,
      pickerPrefs.kindFilter,
      pickerPrefs.progressFilter
    ).filter((e) => passesLength(e, length) && passesVibe(e, vibe))
  );

  function rollPair(): { a: Entry; b: Entry } | null {
    const sampled = samplePair(filtered, (e) =>
      defaultWeight(e, store.preferences.temptationPacing)
    );
    if (!sampled) return null;
    return { a: sampled[0], b: sampled[1] };
  }

  function start(): void {
    if (filtered.length === 0) return;
    if (filtered.length === 1) {
      winner = filtered[0];
      phase = "final";
      vibrate("success");
      return;
    }
    pair = rollPair();
    if (!pair) return;
    pickedSide = null;
    phase = "flip";
    vibrate("tick");
  }

  function reroll(): void {
    if (!pair) {
      pair = rollPair();
      return;
    }
    const exclude = filtered.length > 3
      ? new Set([`${pair.a.kind}:${pair.a.id}`, `${pair.b.kind}:${pair.b.id}`])
      : undefined;
    const sampled = samplePair(filtered, (e) =>
      defaultWeight(e, store.preferences.temptationPacing), exclude);
    if (!sampled) {
      pair = rollPair();
      return;
    }
    pair = { a: sampled[0], b: sampled[1] };
    pickedSide = null;
  }

  function pick(side: "a" | "b"): void {
    if (!pair || pickedSide) return;
    pickedSide = side;
    const win = side === "a" ? pair.a : pair.b;
    const lose = side === "a" ? pair.b : pair.a;
    store.applyTemptation(win.kind, win.id, "picker-win");
    store.applyTemptation(lose.kind, lose.id, "picker-loss");
    vibrate("success");
    setTimeout(() => {
      winner = win;
      phase = "final";
    }, PICK_DELAY_MS);
  }

  function pickAgain(): void {
    winner = null;
    pair = null;
    pickedSide = null;
    phase = "setup";
  }

  function setLength(l: Length): void {
    length = length === l ? "any" : l;
  }
  function setVibe(v: Vibe): void {
    vibe = vibe === v ? "any" : v;
  }
</script>

{#snippet flipActions()}
  <button
    type="button"
    use:tactile
    onclick={reroll}
    disabled={pickedSide !== null}
    class="tap-target tap-target--btn flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover-border-accent disabled:opacity-40"
    aria-label="Re-roll mood pair"
  >
    <Icon name="rotate-ccw" size={14} />
    <span>Re-roll pair</span>
  </button>
{/snippet}

<PageHeader
  title="Mood"
  subtitle="Mood chips narrow the pool — then a coin flip on the rest."
  actions={phase === "flip" ? flipActions : undefined}
  srOnly={phase !== "setup"}
/>

<section class="space-y-4">
  {#if phase === "setup"}
    <div in:fade={{ duration: 200 }} class="space-y-4">
      <p class="text-sm text-muted">
        Layer mood chips on top of your filters. Chip pairs are mutually
        exclusive — tap the active one to clear back to "any".
      </p>

      <div class="space-y-2">
        <h2 class="text-xs font-medium uppercase tracking-wider text-muted">Length</h2>
        <div class="flex flex-wrap gap-1.5 text-xs">
          {#each [["short", "Short"], ["long", "Long"]] as const as [v, label] (v)}
            {@const active = length === v}
            <button
              type="button"
              use:tactile
              onclick={() => setLength(v)}
              aria-pressed={active}
              class="tap-target tap-target--chip max-w-56 grow rounded-md border px-3 py-1.5 text-center transition-colors duration-150 {active
                ? 'border-tertiary bg-tertiary text-bg'
                : 'border-border text-muted hover-text-text'}"
            >
              {label}
            </button>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <h2 class="text-xs font-medium uppercase tracking-wider text-muted">Vibe</h2>
        <div class="flex flex-wrap gap-1.5 text-xs">
          {#each [["comfort", "Comfort"], ["challenge", "Challenge"]] as const as [v, label] (v)}
            {@const active = vibe === v}
            <button
              type="button"
              use:tactile
              onclick={() => setVibe(v)}
              aria-pressed={active}
              class="tap-target tap-target--chip max-w-56 grow rounded-md border px-3 py-1.5 text-center transition-colors duration-150 {active
                ? 'border-tertiary bg-tertiary text-bg'
                : 'border-border text-muted hover-text-text'}"
            >
              {label}
            </button>
          {/each}
        </div>
      </div>

      <Filters />

      <div class="rounded-lg border border-border bg-surface p-4 text-sm">
        {#if filtered.length === 0}
          <p class="text-muted">No matches for that mood. Try clearing a chip.</p>
        {:else if filtered.length === 1}
          <p class="text-muted">Only one match — that one wins by default.</p>
        {:else}
          <p>
            <span class="font-medium tabular-nums">{filtered.length}</span>
            <span class="text-muted">candidate{filtered.length === 1 ? "" : "s"}</span>
            <span class="text-muted">·</span>
            <span class="text-muted">2 head-to-head, weighted</span>
          </p>
        {/if}
      </div>

      <button
        type="button"
        use:tactile
        onclick={start}
        disabled={filtered.length === 0}
        class="tap-target tap-target--btn flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="filter" size={16} />
        <span>{filtered.length === 1 ? "Reveal pick" : "Match the mood"}</span>
      </button>
    </div>
  {:else if phase === "flip" && pair}
    <div
      in:fade={{ duration: 160 }}
      class="flex min-h-[calc(100dvh-12rem)] flex-col sm:min-h-[64vh]"
    >
      <div class="grid flex-1 grid-rows-[1fr_auto_2fr] gap-4">
        <div class="self-start text-center">
          <p class="text-xs uppercase tracking-[0.18em] text-tertiary">In the mood</p>
          <p class="text-[10px] text-muted/80">
            {length === "any" ? "any length" : length}
            <span aria-hidden="true">·</span>
            {vibe === "any" ? "any vibe" : vibe}
          </p>
        </div>

        <div>
          {#key `${pair.a.kind}:${pair.a.id}-${pair.b.kind}:${pair.b.id}`}
            <div
              class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4"
              in:fade={{ duration: 220, delay: 40 }}
            >
              <MatchCard
                entry={pair.a}
                side="a"
                locked={pickedSide !== null}
                isWinner={pickedSide === "a"}
                isLoser={pickedSide !== null && pickedSide !== "a"}
                onpick={() => pick("a")}
              />
              <span
                class="vs select-none text-center text-base font-bold tracking-widest text-muted"
                in:scale={{ start: 0.6, duration: 320, easing: backOut, delay: 60 }}
              >
                VS
              </span>
              <MatchCard
                entry={pair.b}
                side="b"
                locked={pickedSide !== null}
                isWinner={pickedSide === "b"}
                isLoser={pickedSide !== null && pickedSide !== "b"}
                onpick={() => pick("b")}
              />
            </div>
          {/key}
        </div>

        <div aria-hidden="true"></div>
      </div>

      <p class="pt-4 text-center text-xs text-muted">
        {pickedSide ? "Locking in…" : "Tap one — the other goes home"}
      </p>
    </div>
  {:else if phase === "final" && winner}
    {@const w = winner}
    <Winner
      winner={w}
      eyebrow="Mood matched"
      pickAgainLabel="Try another"
      onPickAgain={pickAgain}
    />
  {/if}
</section>

<style>
  .vs {
    text-shadow: 0 1px 0 rgb(0 0 0 / 0.4);
  }
</style>
