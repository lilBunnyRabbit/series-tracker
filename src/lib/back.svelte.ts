import { browser } from "$app/environment";
import { afterNavigate } from "$app/navigation";

/**
 * In-app navigation tracker. Flips to true the first time we navigate within
 * the app, so back buttons can prefer `history.back()` (which respects the
 * actual path the user took) over a hardcoded fallback that's often wrong —
 * e.g. coming into a show detail from `/upcoming/` then tapping back used to
 * jump to `/` because the layout's backHref mapping always pointed there.
 *
 * On a direct landing (shared link, refresh, new tab) the tracker stays false
 * and the button falls back to its configured href so we never strand the
 * user at a closed tab.
 */
let hasInAppHistory = $state(false);

export function initBackTracker(): void {
  if (!browser) return;
  // afterNavigate fires inside SvelteKit's navigation lifecycle; the first
  // navigation that has a `from` URL means the user came from another page
  // in this session, so history.back() is safe to use after that point.
  afterNavigate(({ from }) => {
    if (from) hasInAppHistory = true;
  });
}

/**
 * Click handler factory for back links. Returns a function that:
 * - Lets normal click behaviour (modifier keys, middle-click) through, so
 *   ⌘-click still opens the fallback in a new tab.
 * - Calls `history.back()` if we know there's in-app history.
 * - Falls back to the link's href otherwise.
 */
export function smartBack(): (e: MouseEvent) => void {
  return (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!hasInAppHistory) return;
    e.preventDefault();
    history.back();
  };
}
