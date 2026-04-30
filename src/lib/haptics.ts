import { browser } from "$app/environment";

type Pattern = "tap" | "tick" | "success" | "warn";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  tick: 4,
  success: [8, 30, 12],
  warn: [16, 30, 16],
};

let muted = false;

export function setHapticsMuted(value: boolean): void {
  muted = value;
}

export function vibrate(pattern: Pattern = "tap"): void {
  if (!browser || muted) return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(PATTERNS[pattern]);
  } catch {
    // ignore — some browsers throw inside iframes / opaque origins
  }
}
