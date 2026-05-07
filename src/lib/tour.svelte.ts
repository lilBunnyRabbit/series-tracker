// Tour state — controls the `<GuideTour>` overlay mounted in the root layout.
// Three trigger paths:
//
//   • First-launch: brand-new user (empty library, tourSeen unset). Opens the
//     full tour so they get the welcome → essentials walkthrough.
//   • Post-update: existing user has upgraded the app and at least one guide
//     section is tagged with a version newer than `lastSeenGuideVersion`.
//     Opens a filtered tour showing only the new/updated sections — keeps
//     the experience targeted instead of forcing the full tour again.
//   • Manual: any caller (Settings → Guide → "Take the tour") flips
//     `manualOpen` via `tour.show()` to replay the full tour on demand.
//
// `tour.close()` collapses all three paths: clears manualOpen, sets
// `tourSeen=true`, and stamps `lastSeenGuideVersion` to the current build's
// version so the post-update path won't re-fire until something newer ships.

import { GUIDE_BASELINE_VERSION, GUIDE_SECTIONS, type GuideSection } from "$lib/guide";
import { store } from "$lib/store.svelte";
import { version } from "$lib/version.svelte";

let manualOpen = $state(false);

/** Compare two semver strings (`"X.Y.Z"`). Returns positive if `a > b`,
 *  negative if `a < b`, zero if equal. Pre-release tags are not supported —
 *  this app's versions are plain numeric semver. */
function compareSemver(a: string, b: string): number {
  const [aMaj = 0, aMin = 0, aPat = 0] = a.split(".").map((n) => Number(n) || 0);
  const [bMaj = 0, bMin = 0, bPat = 0] = b.split(".").map((n) => Number(n) || 0);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPat - bPat;
}

/** Effective last-seen version. When the user has `tourSeen: true` but no
 *  explicit `lastSeenGuideVersion` (the field shipped after the original
 *  tour), assume they've seen everything up to the baseline so the
 *  post-update path only triggers for genuinely new sections. */
function effectiveLastSeen(): string | null {
  const explicit = store.preferences.lastSeenGuideVersion;
  if (explicit) return explicit;
  if (store.preferences.tourSeen) return GUIDE_BASELINE_VERSION;
  return null;
}

/** Sections newer than the effective last-seen version. Filtered to those
 *  flagged for the tour (inTour !== false) so an "internal-only" section
 *  bump doesn't pop the overlay. */
function newSinceLastSeen(): GuideSection[] {
  const last = effectiveLastSeen();
  if (!last) return [];
  return GUIDE_SECTIONS.filter(
    (s) => s.inTour !== false && compareSemver(s.version, last) > 0
  );
}

/** All in-tour sections — the first-launch and manual replay set. */
function allInTourSections(): GuideSection[] {
  return GUIDE_SECTIONS.filter((s) => s.inTour !== false);
}

export const tour = {
  /** True iff the overlay should be visible right now. */
  get open(): boolean {
    if (manualOpen) return true;
    if (!store.loaded) return false;
    if (!store.preferences.tourSeen) {
      // Brand-new user: full tour, but only when the library is empty so
      // existing users on a build that introduces the tour for the first
      // time aren't ambushed. They can still opt in via Replay.
      return store.entries.length === 0;
    }
    // Post-update path: tourSeen is true but new sections have shipped
    // since lastSeenGuideVersion. Auto-open in update mode.
    return newSinceLastSeen().length > 0;
  },

  /** Sections to render. Diverges by mode:
   *    • Manual / first-launch → every in-tour section
   *    • Post-update → only sections newer than lastSeenGuideVersion
   *  Returns an empty array when the overlay shouldn't be open at all
   *  (the consumer's `{#if tour.open}` already gates the mount, but
   *  defaulting to [] keeps the contract sane for callers that read
   *  sections without checking open first). */
  get sections(): GuideSection[] {
    if (manualOpen) return allInTourSections();
    if (!store.loaded) return [];
    if (!store.preferences.tourSeen) {
      return store.entries.length === 0 ? allInTourSections() : [];
    }
    return newSinceLastSeen();
  },

  /** True iff the current open is the post-update path (for callers that
   *  want to tweak copy — e.g. "What's new in v0.18" header instead of
   *  "Welcome"). Manual replay is treated as full-tour, not update. */
  get isUpdateMode(): boolean {
    if (manualOpen) return false;
    if (!store.loaded) return false;
    if (!store.preferences.tourSeen) return false;
    return newSinceLastSeen().length > 0;
  },

  /** Open the full tour explicitly — used by the Replay button. Bypasses
   *  tourSeen so the user can re-view the tour any number of times. */
  show(): void {
    manualOpen = true;
  },

  /** Close the tour and persist that the user has seen the current build's
   *  guide content. Idempotent. */
  close(): void {
    manualOpen = false;
    if (!store.preferences.tourSeen) {
      store.setPreference("tourSeen", true);
    }
    const current = version.current.version;
    if (current && store.preferences.lastSeenGuideVersion !== current) {
      store.setPreference("lastSeenGuideVersion", current);
    }
  },
};
