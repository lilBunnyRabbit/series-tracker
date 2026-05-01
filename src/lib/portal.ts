import type { Action } from "svelte/action";

/**
 * Move the host node to a target on mount and remove it on destroy. Use for
 * popovers, sheets, and dialogs that must escape transformed / clipping /
 * stacking-context ancestors so their fixed positioning is resolved against
 * the viewport rather than the nearest transformed parent.
 *
 * Why CSS `position: fixed` isn't enough: any ancestor with `transform`,
 * `filter`, or `perspective` becomes the containing block for descendant
 * fixed elements (CSS spec). For modal dialogs that should always be at the
 * viewport's bottom (mobile sheets) or center (desktop), this leaks parent
 * transforms into the dialog's coordinates.
 */
export const portal: Action<HTMLElement, HTMLElement | undefined> = (
  node,
  target = document.body
) => {
  let dest = target;
  dest.appendChild(node);
  return {
    update(next: HTMLElement | undefined) {
      const newDest = next ?? document.body;
      if (newDest !== dest) {
        newDest.appendChild(node);
        dest = newDest;
      }
    },
    destroy() {
      if (node.parentNode === dest) dest.removeChild(node);
    },
  };
};
