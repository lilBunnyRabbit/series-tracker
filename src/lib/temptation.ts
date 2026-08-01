// Temptation — bounded engagement score in [0, 1] per library entry. Built up
// by activity (episodes watched, picker outcomes, detail-page opens, etc.) and
// faded by exponential time decay according to the user's pacing preference.
// Drives the watchlist Temptation sort and a refined warm glow on
// high-temptation cards.
//
// Persisted on the Entry as three fields:
//   • temptation          — the bounded value at temptationUpdatedAt time
//   • temptationUpdatedAt — ISO timestamp; decay is computed lazily from this
//   • temptationLog       — bounded list of recent kicks (for trend + caption)
//
// Reads (for sort, for the bar) call currentTemptation() which applies decay
// since the timestamp without writing. Writes (when an action fires) call
// applyAction() which folds the same decay into the persisted value, then
// applies the action's kick.

import type { Entry, Status, TemptationAction, TemptationEvent, TemptationPacing } from "./types";

/** How much each action nudges the score. Episode/season weights are sized so
 *  a few days of regular watching keep an active show near the ceiling, while
 *  ambient signals (clicks, ratings) settle in the middle bands. The
 *  marked-finished entry is a sentinel — applyAction handles it as a reset
 *  (set to 0) rather than a delta. */
const KICKS: Record<TemptationAction, number> = {
  "episode-watched": 0.25,
  "season-completed": 0.4,
  "picker-win": 0.15,
  "picker-loss": -0.1,
  "detail-opened": 0.03,
  "episode-page-opened": 0.05,
  "rated-high": 0.1,
  "rewatchable-on": 0.05,
  "marked-finished": 0,
  "movie-progress": 0.05,
};

/** Per-day exponential decay coefficient. Half-lives:
 *    Lingering ≈ 70 days   (slow fade, things stay warm for weeks)
 *    Balanced  ≈ 34 days   (default — gentle fade)
 *    Reactive  ≈ 17 days   (recent activity dominates)
 *    Restless  ≈ 10 days   (only the last week-or-two counts) */
const DECAY_PER_DAY: Record<TemptationPacing, number> = {
  lingering: 0.99,
  balanced: 0.98,
  reactive: 0.96,
  restless: 0.93,
};

/** Bands surface in the bar label and gate the card glow. Tuples are
 *  [exclusive upper bound, label] in ascending order; values >= 0.8 fall to
 *  the trailing "Burning" band. */
const BANDS: readonly [number, string][] = [
  [0.2, "Cold"],
  [0.4, "Drifting"],
  [0.6, "Warming"],
  [0.8, "Hot"],
];
const BURNING_LABEL = "Burning";

/** Cap on the per-entry log. Trend + last-bump caption only ever look at
 *  recent events, so 30 covers a few weeks of activity without bloating IDB. */
export const LOG_LIMIT = 30;

/** Threshold at which the refined high-temptation card glow turns on. Matches
 *  the Hot band's lower bound. */
export const GLOW_THRESHOLD = 0.6;

/** Map a 0..1 temptation value to the glow intensity (also 0..1) consumed
 *  by `--tt` on `.tt-glow`. Below the threshold returns 0; above, applies a
 *  quadratic curve so the Hot band reads as a subtle hint and Burning hits
 *  full intensity. Without the curve, the bottom of Hot (0.6) and the top
 *  of Burning (1.0) would land 50% apart, which over-glows merely-Hot
 *  cards and under-glows truly-burning ones. */
export function glowIntensity(value: number): number {
  if (value < GLOW_THRESHOLD) return 0;
  const linear = (value - GLOW_THRESHOLD) / (1 - GLOW_THRESHOLD);
  const ramped = Math.min(1, linear);
  return ramped * ramped;
}

/** Map each status to the CSS variable that drives the card glow's hue. The
 *  glow inherits the status colour rather than using a fixed amber so a
 *  high-temptation "Watching" card stays in its primary palette and a
 *  high-temptation "Plan" card stays in accent — no clash with the
 *  status-tinted border. Stored as `var(--color-X)` strings so the cards can
 *  drop them into inline `--tt-c` declarations directly. */
export const TEMPTATION_GLOW_COLOR: Record<Status, string> = {
  watching: "var(--color-primary)",
  completed: "var(--color-secondary)",
  plan: "var(--color-accent)",
  tuned: "var(--color-info)",
  dropped: "var(--color-muted)",
};

const MS_PER_DAY = 86_400_000;
const DEFAULT_PACING: TemptationPacing = "balanced";

function clamp01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

function pacingOrDefault(pacing: TemptationPacing | undefined): TemptationPacing {
  return pacing ?? DEFAULT_PACING;
}

/** Apply exponential decay to `value` over `elapsedMs`. Pure — no rounding,
 *  no clamping. Returns 0 unchanged. */
function decayValue(value: number, elapsedMs: number, pacing: TemptationPacing): number {
  if (value <= 0 || elapsedMs <= 0) return value;
  const days = elapsedMs / MS_PER_DAY;
  return value * Math.pow(DECAY_PER_DAY[pacing], days);
}

/** Lazy read: returns the entry's temptation as of *now*, applying decay since
 *  temptationUpdatedAt without mutating the entry. Used by the watchlist sort,
 *  the bar component, and any UI that wants the live value. */
export function currentTemptation(entry: Entry, pacing?: TemptationPacing): number {
  const stored = entry.temptation ?? 0;
  if (stored <= 0) return 0;
  const updated = entry.temptationUpdatedAt;
  if (!updated) return stored;
  const elapsedMs = Date.now() - new Date(updated).getTime();
  return decayValue(stored, elapsedMs, pacingOrDefault(pacing));
}

/** Mutates the entry: folds decay since the last update into the stored value,
 *  then applies the action's kick (or resets to 0 for "marked-finished"),
 *  appends a log event, trims to LOG_LIMIT, and bumps temptationUpdatedAt.
 *
 *  The stored `delta` on the log event is the action's nominal kick, not the
 *  post-clamp change. That keeps the last-bump caption legible ("+0.25 ·
 *  watched S2E5") even when the bar was already saturated; the actual visible
 *  jump is implicit in the bar's animated width. */
export function applyAction(
  entry: Entry,
  action: TemptationAction,
  pacing?: TemptationPacing,
  meta?: string
): void {
  const p = pacingOrDefault(pacing);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const updated = entry.temptationUpdatedAt;
  const decayedFrom = updated ? decayValue(entry.temptation ?? 0, nowMs - new Date(updated).getTime(), p) : entry.temptation ?? 0;

  let nextValue: number;
  let recordedDelta: number;
  if (action === "marked-finished") {
    nextValue = 0;
    recordedDelta = -decayedFrom;
  } else {
    const kick = KICKS[action];
    nextValue = clamp01(decayedFrom + kick);
    recordedDelta = kick;
  }

  entry.temptation = nextValue;
  entry.temptationUpdatedAt = nowIso;

  const event: TemptationEvent = { at: nowIso, delta: recordedDelta, action };
  if (meta) event.meta = meta;

  const log = entry.temptationLog ?? [];
  log.push(event);
  if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
  entry.temptationLog = log;
}

/** Band label for a 0..1 value. Used by the bar caption. */
export function band(value: number): string {
  for (const [upper, label] of BANDS) {
    if (value < upper) return label;
  }
  return BURNING_LABEL;
}

/** 0..4 index for the band — handy when callers need to colorize per band
 *  (e.g. CSS variable indexing) without re-scanning thresholds. */
export function bandIndex(value: number): 0 | 1 | 2 | 3 | 4 {
  if (value < 0.2) return 0;
  if (value < 0.4) return 1;
  if (value < 0.6) return 2;
  if (value < 0.8) return 3;
  return 4;
}

/** Direction the score has moved over the last `days` days, based on logged
 *  kicks vs. background decay. "flat" is the default when there's no signal
 *  either way — keeps the trend arrow honest about uncertainty. */
export function trend(entry: Entry, days = 7): "up" | "down" | "flat" {
  const log = entry.temptationLog;
  const cutoff = Date.now() - days * MS_PER_DAY;
  const recent = log
    ? log.filter((e) => new Date(e.at).getTime() >= cutoff)
    : [];
  if (recent.length === 0) {
    // No activity in the window — decay is the only force at play. Surface
    // "down" only if there's enough remaining value for the user to notice.
    const stored = entry.temptation ?? 0;
    return stored > 0.1 ? "down" : "flat";
  }
  let net = 0;
  for (const e of recent) net += e.delta;
  if (net > 0.05) return "up";
  if (net < -0.05) return "down";
  return "flat";
}

/** Most recent log event with a positive delta — drives the bar's "+0.25 ·
 *  watched S2E5 · 3d ago" caption. Negative-delta events (picker losses, the
 *  marked-finished reset) are intentionally skipped so the caption always
 *  reads as something the user *did* to engage. */
export function lastPositiveBump(entry: Entry): TemptationEvent | undefined {
  const log = entry.temptationLog;
  if (!log) return undefined;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].delta > 0) return log[i];
  }
  return undefined;
}

/** Human-readable label for an action — used in the last-bump caption. Pairs
 *  with the event's optional `meta` to produce "watched S2E5" / "picker win"
 *  / "rated highly" etc. */
const ACTION_LABEL: Record<TemptationAction, string> = {
  "episode-watched": "watched an episode",
  "season-completed": "completed a season",
  "picker-win": "picker pick",
  "picker-loss": "picker loss",
  "detail-opened": "opened the page",
  "episode-page-opened": "checked an episode",
  "rated-high": "rated highly",
  "rewatchable-on": "marked rewatchable",
  "marked-finished": "wrapped up",
  "movie-progress": "advanced progress",
};

/** Render the last-bump label for the bar caption. Prefers the event's
 *  `meta` (e.g. "S2E5") when present, falling back to the action label. */
export function bumpLabel(event: TemptationEvent): string {
  if (event.meta) {
    if (event.action === "episode-watched") return `watched ${event.meta}`;
    if (event.action === "season-completed") return `completed ${event.meta}`;
    if (event.action === "episode-page-opened") return `checked ${event.meta}`;
    if (event.action === "movie-progress") return `at ${event.meta}`;
    return event.meta;
  }
  return ACTION_LABEL[event.action];
}

/** Pacing presets in display order, with one-line descriptions for the
 *  settings selector. */
export const PACING_PRESETS: { value: TemptationPacing; label: string; hint: string }[] = [
  { value: "lingering", label: "Lingering", hint: "Slow fade · ~70-day half-life" },
  { value: "balanced", label: "Balanced", hint: "Default · ~34-day half-life" },
  { value: "reactive", label: "Reactive", hint: "Fast fade · ~17-day half-life" },
  { value: "restless", label: "Restless", hint: "Aggressive · ~10-day half-life" },
];

/** Debounce window for ambient page-open kicks (detail page mounts, episode
 *  page mounts). 30 minutes — long enough that quick back/forward navigation
 *  doesn't repeat-fire, short enough that genuine re-visits across sessions
 *  still register engagement. */
const PAGE_OPEN_WINDOW_MS = 30 * 60 * 1000;

/** Browser-only: run `commit` if no event with the given `cacheKey` has fired
 *  in the last `windowMs` (default 30 min). Used to debounce ambient
 *  page-open kicks so a quick mount/unmount round-trip doesn't double-bump.
 *  No-ops outside the browser (sessionStorage is undefined). */
export function debouncedPageOpen(
  cacheKey: string,
  commit: () => void,
  windowMs: number = PAGE_OPEN_WINDOW_MS
): void {
  if (typeof sessionStorage === "undefined") return;
  const last = Number(sessionStorage.getItem(cacheKey) ?? "0");
  const now = Date.now();
  if (now - last < windowMs) return;
  sessionStorage.setItem(cacheKey, String(now));
  commit();
}
