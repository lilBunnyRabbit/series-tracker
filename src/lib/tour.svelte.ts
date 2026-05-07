// First-launch tour state. The `<GuideTour>` overlay is mounted once in the
// root layout; this module is its single open/close controller.
//
// Two trigger paths:
//   • Auto: when the store has loaded, the user hasn't seen the tour, and the
//     library is empty. This is the brand-new-user case.
//   • Manual: any caller (e.g. Settings → Guide → "Take the tour") flips
//     `manualOpen` via `tour.show()` so existing users can replay it on demand
//     without first wiping `tourSeen`.
//
// `tour.close()` collapses both paths: clears manualOpen, sets tourSeen=true.
// Once tourSeen is set the auto path stays closed forever; only manualOpen
// can re-open the tour after that.

import { store } from "$lib/store.svelte";

let manualOpen = $state(false);

export const tour = {
  /** True iff the overlay should be visible right now. */
  get open(): boolean {
    if (manualOpen) return true;
    if (!store.loaded) return false;
    if (store.preferences.tourSeen) return false;
    // Don't auto-show for users who already have library data — they're
    // existing users on a build that introduces the tour for the first time.
    // They can still opt in via the Replay button on the guide page.
    if (store.entries.length > 0) return false;
    return true;
  },

  /** Open the tour explicitly — used by the Replay button. Bypasses
   *  tourSeen so the user can re-view the tour any number of times. */
  show(): void {
    manualOpen = true;
  },

  /** Close the tour and persist that the user has seen it. Idempotent. */
  close(): void {
    manualOpen = false;
    if (!store.preferences.tourSeen) {
      store.setPreference("tourSeen", true);
    }
  },
};
