import type { Action } from "svelte/action";

// Stamps `data-overflow-left` / `data-overflow-right` on a horizontally
// scrollable element to drive a CSS edge-fade mask. Each attribute is
// `"true"` when there's content to scroll into in that direction.
//
// The action recomputes on:
//   - scroll (the obvious trigger)
//   - container resize (viewport / orientation change)
//   - child mutation (chips appearing or disappearing — page-actions can
//     register late, after a navigation transition)
//
// CSS owns the visual treatment: this action only flips the flags. The
// element should set `overflow-x: auto` on its own; the action doesn't
// touch styles.

export const edgeFade: Action<HTMLElement> = (node) => {
  function update() {
    // Use a 1px epsilon so sub-pixel rounding doesn't flicker the mask
    // on / off when scrolled exactly to an edge.
    const max = node.scrollWidth - node.clientWidth;
    node.dataset.overflowLeft = node.scrollLeft > 1 ? "true" : "false";
    node.dataset.overflowRight = node.scrollLeft < max - 1 ? "true" : "false";
  }

  update();
  node.addEventListener("scroll", update, { passive: true });

  const ro = new ResizeObserver(update);
  ro.observe(node);

  const mo = new MutationObserver(update);
  mo.observe(node, { childList: true, subtree: true });

  return {
    destroy() {
      node.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
    },
  };
};
