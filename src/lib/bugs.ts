// Known issues — typed config rendered at /settings/bugs/.
//
// Companion to roadmap.ts. The roadmap is "what's planned"; this is "what's
// broken right now (and what just got fixed)". Same shape philosophy: a flat
// list with a status field, so a single page can render both surfaces.
//
// When a bug is fixed, flip its `status` to "fixed" and stamp `fixedIn` with
// the version it landed in. After a release or two, prune fixed entries —
// the changelog is the long-term record. The bugs page should always feel
// fresh, not historical.
//
// User-facing copy: describe the symptom in one line, no implementation
// details. Same rule as roadmap.ts and CHANGELOG.md.

export type BugSeverity =
  /** Blocks core use of the app for affected users. */
  | "critical"
  /** Noticeable feature breakage with a workaround. */
  | "major"
  /** Annoyance or rough edge — works, but not as intended. */
  | "minor"
  /** Cosmetic / polish — visible but inconsequential. */
  | "polish";

export type BugStatus =
  /** Reproducible, on the list, not started. */
  | "open"
  /** Actively being looked at — cause unclear or fix in flight. */
  | "investigating"
  /** Documented but not going to be fixed — platform constraint, third-party
   *  bug, or a fix that would be worse than the symptom. Kept on the page so
   *  users know we're aware. Mirrors the roadmap's `"wont-ship"`. */
  | "wont-fix"
  /** Shipped a fix in `fixedIn`. Kept on the page briefly, then pruned. */
  | "fixed";

import type { Complexity } from "./complexity";

/** Same scale as RoadmapComplexity — see `complexity.ts`. */
export type BugComplexity = Complexity;

export type Bug = {
  id: string;
  title: string;
  /** One-line user-facing description of the symptom. */
  summary: string;
  status: BugStatus;
  severity: BugSeverity;
  complexity?: BugComplexity;
  /** Set when status === "fixed". */
  fixedIn?: string;
  /** Optional context: workaround, dependency, suspected cause. */
  note?: string;
  /** ISO date the bug was first noticed. */
  reportedOn?: string;
};

/**
 * Live list of known bugs. Keep ordered: open / investigating first by
 * severity (critical → polish), then fixed by descending fixedIn.
 *
 * Add new entries here the moment they're reproducible.
 */
export const KNOWN_BUGS: Bug[] = [
  {
    id: "card-pulse-watchlist",
    title: "Status-change pulse missing on watchlist cards",
    summary:
      "Changing a title's status from the watchlist (long-press → status, or via the picker sheet) doesn't fire the brief halo that show / movie info pages get. The status itself updates correctly — only the visual confirmation is missing.",
    status: "open",
    severity: "minor",
    complexity: "S",
    note: "Workaround: the status colour on the card border updates immediately, so the change is still visible — you just don't get the pulse animation.",
    reportedOn: "2026-05-08",
  },
  {
    id: "scroll-to-top-overlap",
    title: "Browser's scroll-to-top button overlaps the island",
    summary:
      "On mobile, the browser's native \"scroll to top\" affordance (status-bar tap on iOS, the floating up-arrow on some Androids) renders on top of the floating bottom island while you're scrolling. The island stays interactive but the overlap looks rough.",
    status: "wont-fix",
    severity: "minor",
    note: "We tried hiding the island while scrolling and the disappearing pill felt worse than the overlap — losing your back button mid-swipe is more disorienting than a brief visual collision. The browser owns that affordance and there's no API to opt out, so the call is to live with it.",
    reportedOn: "2026-05-08",
  },
];
