import { browser } from "$app/environment";
import { store } from "./store.svelte";

type Pattern = "tap" | "tick" | "success" | "warn";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  tick: 4,
  success: [8, 30, 12],
  warn: [16, 30, 16],
};

let mutedOverride: boolean | null = null;

export function setHapticsMuted(value: boolean): void {
  mutedOverride = value;
}

export function vibrate(pattern: Pattern = "tap", { force = false }: { force?: boolean } = {}): void {
  if (!browser) return;
  if (!force) {
    const muted = mutedOverride ?? store.preferences.hapticsMuted ?? false;
    if (muted) return;
  }
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(PATTERNS[pattern]);
  } catch {
    // ignore — some browsers throw inside iframes / opaque origins
  }
}
